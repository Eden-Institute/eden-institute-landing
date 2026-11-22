// supabase/functions/_shared/wired-delivery-email.ts
//
// Fearfully & Wonderfully Wired, W7: the two purchase delivery emails (`em-blueprint`,
// `em-familymap`), word for word from Camila's approved transactional copy (answer 32, via
// WIRED_PDF_COPY.emails). Transactional: no list, no unsubscribe row, never held by the one-a-day
// guard. Sender "Camila at The Eden Institute", replies to hello@.
//
// Since W9 (2026-11-20) the footer carries the approved "Delete my quiz data" link (/wired/delete). Before W9
// the footer line ends at the order sentence; the business name and mailing address row stays.
// 2026-11-21 (Camila, "Use as written"): a pilot unlock gets each email's approved "Pilot version": its own first
// line and the pilot footer sentence. The address row and the delete link are the same rows paid buyers get.
// 2026-11-21 (PR #829, Camila's taps): the button carries her signed results token (paid and pilot), and the
// complete Family Map after her own questions has its own approved email (`em-familymap-complete`).

import { WIRED_PDF_COPY as COPY, type CopyItem } from "./wired-pdf-content.ts";
import { BRAND, emailShell } from "./nurture-email-templates.ts";
import { tagEmailHtml } from "./email-utm.ts";
import { pilotVersion } from "./wired-email-tx.ts";

export type DeliveryKind = "blueprint" | "family_map";

const KEYS: Record<DeliveryKind, string> = {
  blueprint: "Blueprint delivery (`em-blueprint`)",
  family_map: "Family Map delivery (`em-familymap`)",
};
const SITE = "https://edeninstitute.health";
const ADDRESS = "Rooted in Faith Ventures LLC &middot; 303 Holly Cir, Unit 3262, Clarksville, TN 37043";
// Footer text on the forest band: cream, about 9:1 contrast on #2C3E2D (the old #6B6560 was about 2:1;
// Camila flagged it 11/19). Same color the address row and the order line use.
const FOOTER_INK = "#E8E3DA";
// Mail apps auto-link a street address (bright blue, low contrast). A zero-width space after each
// digit run and inheriting colour in a span stops the detector without changing what she reads.
const ADDRESS_HTML = `<span style="color:${FOOTER_INK};text-decoration:none;">${ADDRESS.replace(/(\d+)/g, "$1&#8203;")}</span>`;

function items(kind: DeliveryKind): CopyItem[] {
  const b = COPY.emails[KEYS[kind]];
  if (!b) throw new Error(`wired delivery email copy missing: ${KEYS[kind]}`);
  return b;
}
const field = (it: CopyItem[], prefix: string) => {
  const f = it.find((i) => i.s.startsWith(prefix));
  if (!f) throw new Error(`wired delivery email: '${prefix}' missing`);
  return f.s.slice(prefix.length).trim();
};
const fill = (s: string, v: Record<string, string>) => s.replace(/\[([^\]]+)\]/g, (m, k) => (k in v ? v[k] : m));
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface DeliveryEmail { subject: string; preview: string; html: string; text: string; buttonUrl: string | null }

/** Her private results link, the way em-update builds it: /wired/results?t=<signed token>, then the copy's own UTM query. */
function privateLink(token: string, btnTarget: string): string {
  const q = btnTarget.indexOf("?");
  return `${SITE}/wired/results?t=${encodeURIComponent(token)}${q >= 0 ? `&${btnTarget.slice(q + 1)}` : ""}`;
}

/** The email body + footer rows, shared by the delivery emails and the complete-map email (same markup, same rows). */
function render(o: { preview: string; greeting: string; body: string[]; button: { label: string; url: string } | null; footerLine: string }): { html: string; text: string } {
  const p = (s: string) => `<p style="margin:0 0 16px 0;font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${BRAND.text ?? "#3D3832"};">${esc(s)}</p>`;
  const button = o.button
    ? `<p style="margin:8px 0 24px 0;text-align:center;"><a href="${esc(o.button.url)}" style="display:inline-block;background:#2C3E2D;color:#FFFFFF;font-family:Georgia,serif;font-size:15px;font-weight:bold;text-decoration:none;padding:12px 26px;border-radius:4px;">${esc(o.button.label)}</a></p>`
    : "";
  const html = emailShell(
    `<span style="display:none;max-height:0;overflow:hidden;">${esc(o.preview)}</span>` +
      p(o.greeting) +
      o.body.map((s) => (s === "[button]" ? button : p(s))).join("") +
      `<p style="margin:24px 0 0 0;font-family:Georgia,serif;font-size:16px;font-weight:bold;">Camila</p>` +
      `<p style="margin:4px 0 0 0;font-family:Georgia,serif;font-size:14px;">The Eden Institute</p>`,
    `<tr><td style="font-family:Georgia,serif;font-size:12px;color:${FOOTER_INK};text-align:center;">${esc(o.footerLine)}</td></tr>
<tr><td style="font-family:Georgia,serif;font-size:12px;color:${FOOTER_INK};text-align:center;padding-top:6px;">${ADDRESS_HTML}</td></tr>
<tr><td style="text-align:center;padding-top:8px;"><a href="https://edeninstitute.health/wired/delete" style="font-family:Georgia,serif;font-size:12px;color:${FOOTER_INK};text-decoration:underline;">Delete my quiz data</a></td></tr>`,
    { shopCard: false },
  );
  const text = [o.greeting, ...o.body.map((s) => (s === "[button]" ? `${o.button!.label}: ${o.button!.url}` : s)), "Camila", "The Eden Institute", "", o.footerLine, ADDRESS.replace("&middot;", "·"), "Delete my quiz data: https://edeninstitute.health/wired/delete"].join("\n\n");
  return { html: tagEmailHtml(html, { medium: "nurture", campaign: "learner_quiz" }), text };
}

/**
 * `firstName` null -> "Hi there," is NOT approved copy, so the greeting falls back to the plain
 * "Hi," the approved observer invite uses. `hasOwnAnswers` (Family Map) skips the
 * "one quick step" lines, per the approved note.
 * `pilot` (2026-11-21, approved "Use as written"): a pilot unlock swaps ONLY the first line and the footer sentence
 * for the approved pilot wording (each email's "Pilot version" note). Paid buyers' emails are unchanged.
 * `resultsToken` (2026-11-21, Camila's tap "Yes, add her private link"): the button opens HER results page on any
 * device, /wired/results?t=<signed results token> plus the copy's UTM query, exactly as em-update does. Required
 * whenever the email shows its button (paid and pilot alike); the page moves the token to storage and strips it from
 * the address bar.
 */
export function buildDeliveryEmail(kind: DeliveryKind, o: { firstName: string | null; nickname?: string; hasOwnAnswers?: boolean; pilot?: boolean; resultsToken?: string }): DeliveryEmail {
  const it = items(kind);
  const v: Record<string, string> = { Nickname: o.nickname ?? "", "first name": o.firstName ?? "" };
  const subject = fill(field(it, "Subject:"), v);
  const preview = fill(field(it, "Preview:"), v);
  const [btnLabel, btnTarget] = field(it, "Button:").split(" -> ");

  // Body = the lines between the greeting and the sign-off, in order; [button] marks the button.
  const start = it.findIndex((i) => i.s.startsWith("Hi "));
  const end = it.findIndex((i) => i.s === "Camila");
  let body = it.slice(start + 1, end).map((i) => i.s);
  const pilot = o.pilot ? pilotVersion(it, KEYS[kind]) : null;
  if (pilot) {
    if (!pilot.firstLine) throw new Error(`${KEYS[kind]}: the pilot first line is missing from its note`);
    // The first line after the greeting is the one the pilot version replaces ("Thank you! ...").
    if (!/^Thank you!/.test(body[0] ?? "")) throw new Error(`${KEYS[kind]}: the first line is not the one the pilot version replaces`);
    body = [pilot.firstLine, ...body.slice(1)];
  }
  if (kind === "family_map" && o.hasOwnAnswers) {
    body = body.filter((s) => !/^One quick step:/.test(s) && s !== "[button]" && !/^As soon as you finish/.test(s));
  }
  let buttonUrl: string | null = null;
  if (body.includes("[button]")) {
    if (!o.resultsToken) throw new Error(`${KEYS[kind]}: the button needs her private link (results token)`);
    buttonUrl = privateLink(o.resultsToken, btnTarget);
  }
  const greeting = o.firstName ? fill(it[start].s, v) : "Hi,";
  const footerLine = pilot ? pilot.footerSentence : field(it, "Footer:").split(" Delete my quiz data")[0].trim();
  const { html, text } = render({
    preview, greeting, body: body.map((s) => (s === "[button]" ? s : fill(s, v))),
    button: buttonUrl ? { label: fill(btnLabel, v), url: buttonUrl } : null, footerLine,
  });
  return { subject, preview, html, text, buttonUrl };
}

const COMPLETE_KEY = "Complete Family Map, after her own questions (`em-familymap-complete`)";

/**
 * The complete Family Map, after her own questions (`em-familymap-complete`, APPROVED by Camila 2026-11-21 ~4:28 PM
 * CT, "Use as written"; the same for paid and pilot families): its own subject, preview and lines, no button. Footer =
 * the em-familymap footer for a paid family, or the pilot footer sentence quoted in its own Footer line for a tester's
 * family. Same address row and delete link as every delivery email.
 */
export function buildCompleteMapEmail(o: { firstName: string | null; pilot?: boolean }): Omit<DeliveryEmail, "buttonUrl"> {
  const it = COPY.emails[COMPLETE_KEY];
  if (!it) throw new Error(`wired delivery email copy missing: ${COMPLETE_KEY}`);
  const v: Record<string, string> = { "first name": o.firstName ?? "" };
  const start = it.findIndex((i) => i.s.startsWith("Hi "));
  const end = it.findIndex((i) => i.s === "Camila");
  if (start < 0 || end < start) throw new Error(`${COMPLETE_KEY}: greeting or sign-off missing`);
  const body = it.slice(start + 1, end).map((i) => i.s);
  if (body.some((s) => /\[[^\]]+\]/.test(s))) throw new Error(`${COMPLETE_KEY}: unexpected placeholder or button in the body`);
  let footerLine: string;
  if (o.pilot) {
    const quoted = field(it, "Footer:").match(/\("([^"]+)"\)/)?.[1];
    if (!quoted) throw new Error(`${COMPLETE_KEY}: the pilot footer is missing from its Footer line`);
    footerLine = quoted;
  } else {
    footerLine = field(items("family_map"), "Footer:").split(" Delete my quiz data")[0].trim();
  }
  const preview = fill(field(it, "Preview:"), v);
  const { html, text } = render({ preview, greeting: o.firstName ? fill(it[start].s, v) : "Hi,", body, button: null, footerLine });
  return { subject: fill(field(it, "Subject:"), v), preview, html, text };
}
