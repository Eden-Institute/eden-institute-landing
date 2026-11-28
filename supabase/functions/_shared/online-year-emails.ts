// supabase/functions/_shared/online-year-emails.ts
//
// Eden's Table Online Year (punch #472), ticket OY8: the family emails, word for word from the plan's approved
// "Emails" cards (Nov 23): 1 Your year is ready, 2 A sibling was added, 3 Two weeks before a year ends,
// 4 The day a year ends. (Email 5, the sign-in code, lives in online-year-signin.ts.)
//
//   After a paid order (stripe-webhook, Online Year branch, only when licenses were just granted):
//     an order with a first-child license -> Email 1 (one email, every child of the order named);
//     an order of sibling licenses only    -> Email 2, one per sibling.
//   Daily (online-year-cron, 13:00 UTC):
//     active licenses ending within 14 days, not renewed, not yet told -> Email 3, then renew_notice_sent_at;
//     active licenses that ended in the last 3 days, not renewed, not yet told -> Email 4, then ended_notice_sent_at.
// Every send carries a Resend Idempotency-Key per order or license and email, so a redelivered webhook or a
// re-run job never sends twice. Sending never throws into the webhook: a failed email is logged and the founder
// is told; the sale and the licenses are already recorded.
//
// Pure: building and planning are tested in online-year-emails.test.ts; the I/O is injected.

import { ONLINE_YEAR_PRICE_CENTS } from './online-year-checkout.ts';

export const OY_EMAIL_FROM = 'Camila at The Eden Institute <hello@orders.edeninstitute.health>';
export const OY_EMAIL_REPLY_TO = 'hello@edeninstitute.health';
export const SIGNIN_URL = 'https://edeninstitute.health/online-year/sign-in';
export const RENEW_DAYS = 14;
export const ENDED_GRACE_DAYS = 3;

const BAND: Record<string, { name: string; label: string }> = {
  sprouts: { name: 'Sprouts', label: 'Sprouts (K-2)' },
  seedlings: { name: 'Seedlings', label: 'Seedlings (3-5)' },
};

/** The approved tags (em-tags): utm_source=email, utm_medium=email, utm_campaign=online_year, utm_content=... */
export function taggedUrl(base: string, content: 'ready' | 'sibling' | 'renew_14' | 'ended'): string {
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}utm_source=email&utm_medium=email&utm_campaign=online_year&utm_content=${content}`;
}
export function renewUrl(band: string, content: 'renew_14' | 'ended'): string {
  return taggedUrl(`https://edeninstitute.health/online-year/checkout?band=${band}`, content);
}

/** "December 1, 2027" in Central, the way the reader shows end dates. */
export function endDateText(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: 'long', day: 'numeric' });
}

export interface OyLicense {
  id: string;
  parent_id: string;
  band: string;
  child_name: string;
  kind: 'first_child' | 'sibling' | string;
  starts_at: string;
  ends_at: string;
  status: string;
  order_id: string | null;
  renews_license_id?: string | null;
  renew_notice_sent_at?: string | null;
  ended_notice_sent_at?: string | null;
}
export interface OyParent {
  id: string;
  email: string;
  first_name: string | null;
}
export interface OyEmail {
  to: string;
  subject: string;
  preview: string;
  html: string;
  text: string;
  idempotencyKey: string;
  /** What to mark once sent (cron emails only). */
  mark?: { licenseId: string; column: 'renew_notice_sent_at' | 'ended_notice_sent_at' };
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const P = (t: string) => `<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#222222;margin:0 0 14px 0;">${t}</p>`;
const BUTTON = (label: string, href: string) =>
  `<p style="margin:6px 0 20px 0;"><a href="${esc(href)}" style="display:inline-block;background-color:#2E3D32;color:#FAF8F3;font-family:Arial,Helvetica,sans-serif;font-size:15px;text-decoration:none;padding:12px 22px;border-radius:3px;">${esc(label)}</a></p>`;

/** One shell for all four: paragraphs, one button, Camila's sign-off, the approved order footer. */
export function shell(o: { preview: string; greeting: string; before: string[]; button: { label: string; href: string }; after: string[]; footer: string }): { html: string; text: string } {
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:16px;background-color:#ffffff;">
<div style="display:none;max-height:0;overflow:hidden;">${esc(o.preview)}</div>
<div style="max-width:560px;">
${P(esc(o.greeting))}
${o.before.map((t) => P(esc(t))).join('\n')}
${BUTTON(o.button.label, o.button.href)}
${o.after.map((t) => P(esc(t))).join('\n')}
${P('Camila<br>The Eden Institute')}
<div style="border-top:1px solid #eeeeee;margin:28px 0 12px 0;"></div>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:#888888;margin:0;">${esc(o.footer)}</p>
</div>
</body></html>`;
  const text = [o.greeting, ...o.before, `${o.button.label}: ${o.button.href}`, ...o.after, 'Camila\nThe Eden Institute', `--\n${o.footer}`].join('\n\n');
  return { html, text };
}

const greet = (firstName: string | null) => ((firstName ?? '').trim() ? `Hi ${(firstName ?? '').trim()},` : 'Hi,');
const orderFooter = (address: string) => `You're getting this because of your Online Year order. ${address}`;
const NOT_REFUNDABLE = "Because this is digital, it isn't refundable. If anything isn't working, just reply and we'll fix it.";
const joinNames = (names: string[]) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

/** Email 1: Your year is ready (em-ready2). Children = this order's licenses in one band. */
export function readyEmail(parent: OyParent, band: string, children: { name: string; ends_at: string }[], orderId: string, address: string): OyEmail {
  const b = BAND[band];
  const end = endDateText(children[0].ends_at);
  const runs = children.length === 1
    ? `${children[0].name}'s year runs through ${end}.`
    : `${joinNames(children.map((c) => c.name))}'s years run through ${end}.`;
  const startWeek = children.length === 1
    ? `Start with Week 1 in the Teacher's Guide; it lays out each day for you. When it's time for Notebook pages, tap Print, and ${children[0].name}'s name goes on every page.`
    : "Start with Week 1 in the Teacher's Guide; it lays out each day for you. When it's time for Notebook pages, tap Print, and each child's name goes on their own pages.";
  const preview = "Open it tonight. Here's how the year works.";
  const { html, text } = shell({
    preview,
    greeting: greet(parent.first_name),
    before: [`Thank you! Your Online Year of ${b.label} is ready. ${runs}`],
    button: { label: `Open ${b.name}`, href: taggedUrl(SIGNIN_URL, 'ready') },
    after: [
      startWeek,
      "You'll sign in with this email address. Each time you use a new device, we'll email you a code. It works on 3 devices with one child, plus one more for each sibling.",
      NOT_REFUNDABLE,
    ],
    footer: orderFooter(address),
  });
  return { to: parent.email, subject: `Your ${b.name} Online Year is ready`, preview, html, text, idempotencyKey: `oy-ready-${orderId}-${band}` };
}

/** Email 2: A sibling was added (em-sibling2). */
export function siblingEmail(parent: OyParent, sib: OyLicense, firstEndsAt: string, address: string): OyEmail {
  const b = BAND[sib.band];
  const preview = 'Their own Online Year starts today.';
  const { html, text } = shell({
    preview,
    greeting: greet(parent.first_name),
    before: [`${sib.child_name} is all set! Their Notebook pages are open now, with their name on every page, and their year runs through ${endDateText(sib.ends_at)}.`],
    button: { label: `Open ${b.name}`, href: taggedUrl(SIGNIN_URL, 'sibling') },
    after: [`The Teacher's Guide and storybook stay with your first Online Year, which runs through ${endDateText(firstEndsAt)}.`, NOT_REFUNDABLE],
    footer: orderFooter(address),
  });
  return { to: parent.email, subject: `${sib.child_name}'s Notebook pages are ready`, preview, html, text, idempotencyKey: `oy-sibling-${sib.id}` };
}

/** Email 3: Two weeks before a year ends (em-renew). `siblingsRunning` = sibling names whose year outlasts this $149 one. */
export function renewEmail(parent: OyParent, lic: OyLicense, siblingsRunning: string[], address: string): OyEmail {
  const b = BAND[lic.band];
  const end = endDateText(lic.ends_at);
  const price = lic.kind === 'first_child' ? ONLINE_YEAR_PRICE_CENTS.first_child : ONLINE_YEAR_PRICE_CENTS.sibling;
  const preview = 'Renew anytime before then to keep going without a gap.';
  const before = [
    `Just a heads up: ${lic.child_name}'s Online Year of ${b.name} ends on ${end}.`,
    `If you'd like another 12 months, you can renew now for $${price / 100}, and nothing changes on your end. The new year starts when this one ends, so renewing early doesn't cost you any days.`,
  ];
  if (lic.kind === 'first_child' && siblingsRunning.length) {
    before.push(`The Teacher's Guide and storybook come with this license, so renew it to keep them open for ${joinNames(siblingsRunning)} too.`);
  }
  const { html, text } = shell({
    preview,
    greeting: greet(parent.first_name),
    before,
    button: { label: `Renew ${lic.child_name}'s year`, href: renewUrl(lic.band, 'renew_14') },
    after: [`If you're finished, you don't need to do anything. We never charge you automatically, and it simply closes on ${end}.`],
    footer: orderFooter(address),
  });
  return {
    to: parent.email, subject: `${lic.child_name}'s Online Year ends on ${end}`, preview, html, text,
    idempotencyKey: `oy-renew14-${lic.id}`, mark: { licenseId: lic.id, column: 'renew_notice_sent_at' },
  };
}

/** Email 4: The day a year ends (em-ended). */
export function endedEmail(parent: OyParent, lic: OyLicense, address: string): OyEmail {
  const b = BAND[lic.band];
  const preview = 'Everything you printed is yours to keep. Renew anytime.';
  const { html, text } = shell({
    preview,
    greeting: greet(parent.first_name),
    before: [
      `${lic.child_name}'s Online Year of ${b.name} ended today. Thank you for spending this year with us.`,
      "Everything you printed is yours to keep. If you'd like to keep going, you can renew anytime and pick up where you left off.",
    ],
    button: { label: `Renew ${lic.child_name}'s year`, href: renewUrl(lic.band, 'ended') },
    after: [],
    footer: orderFooter(address),
  });
  return {
    to: parent.email, subject: `${lic.child_name}'s Online Year has ended`, preview, html, text,
    idempotencyKey: `oy-ended-${lic.id}`, mark: { licenseId: lic.id, column: 'ended_notice_sent_at' },
  };
}

/** Emails for one just-granted order. `familyLicenses` = every license the parent holds (for Email 2's first end date). */
export function planOrderEmails(parent: OyParent, orderId: string, orderLicenses: OyLicense[], familyLicenses: OyLicense[], address: string): OyEmail[] {
  const out: OyEmail[] = [];
  const live = orderLicenses.filter((l) => l.status === 'active');
  for (const band of ['sprouts', 'seedlings']) {
    const inBand = live.filter((l) => l.band === band);
    if (!inBand.length) continue;
    if (inBand.some((l) => l.kind === 'first_child')) {
      out.push(readyEmail(parent, band, inBand.map((l) => ({ name: l.child_name, ends_at: l.ends_at })), orderId, address));
    } else {
      const first = familyLicenses
        .filter((l) => l.band === band && l.kind === 'first_child' && l.status === 'active')
        .sort((a, b) => b.ends_at.localeCompare(a.ends_at))[0];
      for (const s of inBand) out.push(siblingEmail(parent, s, first ? first.ends_at : s.ends_at, address));
    }
  }
  return out;
}

/** The daily job: renew (14 days out) and ended (last 3 days) emails due now. */
export function planCronEmails(now: Date, licenses: OyLicense[], parents: Map<string, OyParent>, address: string): OyEmail[] {
  const t = now.getTime();
  const renewed = new Set(licenses.map((l) => l.renews_license_id).filter(Boolean) as string[]);
  const out: OyEmail[] = [];
  for (const l of licenses) {
    if (l.status !== 'active' || renewed.has(l.id)) continue;
    const parent = parents.get(l.parent_id);
    if (!parent) continue;
    const end = Date.parse(l.ends_at);
    if (end > t && end - t <= RENEW_DAYS * 86_400_000 && !l.renew_notice_sent_at) {
      const sibs = licenses
        .filter((s) => s.parent_id === l.parent_id && s.band === l.band && s.kind === 'sibling' && s.status === 'active' && Date.parse(s.ends_at) > end)
        .map((s) => s.child_name);
      out.push(renewEmail(parent, l, sibs, address));
    } else if (end <= t && t - end <= ENDED_GRACE_DAYS * 86_400_000 && !l.ended_notice_sent_at) {
      out.push(endedEmail(parent, l, address));
    }
  }
  return out;
}
