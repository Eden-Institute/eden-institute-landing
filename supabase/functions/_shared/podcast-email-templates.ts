// Emails for the Tales & Table Talk podcast list (entry_funnel 'podcast', signups
// from talesandtabletalk.com).
//
// Deliberately NOT built on nurture-email-templates' emailShell: that shell carries
// the Eden Institute header and shop card, and the podcast is its own brand. Colours
// follow TTT_Brand_Guide_v1_2026-09-13 (Espresso #2A231E, Linen #F5EDD6, Soft Gold
// #E8D5A3, Parchment #FAF6EE). Special Elite cannot be relied on in mail clients, so
// the body is set in Georgia, the same fallback the Eden emails use.
//
// The postal line comes from receipt.ts's SELLER_ADDRESS so it can never drift from
// the address on every other email (the 2026-07-20 wrong-address incident).
//
// Copy approved by Camila 2026-09-17, verbatim. Voice rule: no em dashes.
// podcast-email-templates.test.ts pins the wording and the legal footer.

import { SELLER_ADDRESS } from './receipt.ts';
import { escapeHtml } from './html-escape.ts';

const ESPRESSO = '#2A231E';
const LINEN = '#F5EDD6';
const SOFT_GOLD = '#E8D5A3';
const PARCHMENT = '#FAF6EE';

function para(text: string): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.65;color:${ESPRESSO};margin:0 0 18px 0;">${text}</p>`;
}

export function podcastShell(body: string, preheaderText = ''): string {
  const pre = preheaderText
    ? `<div style="display:none;font-size:1px;color:${LINEN};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheaderText)}</div>`
    : '';
  return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:${LINEN};">
${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${LINEN};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="background:${ESPRESSO};padding:28px 24px;text-align:center;">
<p style="font-family:Georgia,serif;font-size:24px;color:${LINEN};margin:0;">Tales &amp; Table Talk</p>
<p style="font-family:Georgia,serif;font-size:15px;color:${SOFT_GOLD};margin:8px 0 0 0;">Read-alouds for moms and their littles</p>
</td></tr>
<tr><td style="background:${PARCHMENT};padding:32px 28px 16px 28px;">
${body}
</td></tr>
<tr><td style="background:${ESPRESSO};padding:20px 24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-family:Georgia,serif;font-size:11px;color:${LINEN};text-align:center;">You're receiving this because you signed up at talesandtabletalk.com.</td></tr>
<tr><td style="font-family:Georgia,serif;font-size:11px;color:${LINEN};text-align:center;padding-top:6px;">Rooted in Faith Ventures LLC &middot; ${SELLER_ADDRESS}</td></tr>
<tr><td style="text-align:center;padding-top:8px;"><a href="{{UNSUB_URL}}" style="font-family:Georgia,serif;font-size:11px;color:${LINEN};text-decoration:underline;">Unsubscribe</a></td></tr>
</table>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** firstName must already be HTML-escaped by the caller (resend-waitlist does this). */
export function buildPodcastWelcomeEmail(firstName: string): { subject: string; html: string } {
  const body = [
    para(`Hi ${firstName},`),
    para("Thank you for joining the Tales and Table Talk list. I'm so glad you're here."),
    para('Tales and Table Talk is a weekly read-aloud podcast for moms and their littles. Every episode is a story, and every episode ends at the table, with my girls and me talking about what we just heard.'),
    para("We launch in January on the Ultimate Homeschool Podcast Network. You'll be the first to hear when the first episode goes live, along with the printable questions that go with it."),
    para('Until then, go read them something, and then talk about it.'),
    `<p style="font-family:Georgia,serif;font-size:16px;color:${ESPRESSO};margin:8px 0 16px 0;">Camila</p>`,
  ].join('\n');
  return {
    subject: "You're on the list for Tales & Table Talk",
    html: podcastShell(body),
  };
}

// ── Broadcasts to the podcast list (sent by the podcast-announce function) ──
//
// A campaign is plain text, not HTML: every paragraph is escaped at render, so copy
// pasted from a doc cannot inject markup. The greeting ("Hi {name},") and the sign-off
// are added here, so the campaign holds only the body. validatePodcastCampaign runs
// before anything renders or sends; podcast-announce refuses a campaign that fails it.

export interface PodcastCampaign {
  /** Idempotency key: every address is claimed once per key in founders_send_log. */
  key: string;
  subject: string;
  /** Inbox preview line shown after the subject. */
  preheader: string;
  /** Body paragraphs, plain text, in order. No greeting, no sign-off. */
  paragraphs: string[];
  button?: { label: string; url: string };
  /** Who approved this exact copy and when, e.g. "Camila 2027-01-05". Required. */
  approvedBy: string;
}

const EM_DASH = '\u2014';

export function validatePodcastCampaign(c: PodcastCampaign): string[] {
  const errors: string[] = [];
  if (!/^podcast_[a-z0-9_]{3,80}$/.test(c.key)) {
    errors.push('key must look like podcast_<lowercase_words>, e.g. podcast_episode1_launch_2027_01');
  }
  if (!c.subject.trim()) errors.push('subject is empty');
  if (!c.preheader.trim()) errors.push('preheader is empty');
  if (c.paragraphs.length === 0 || c.paragraphs.some((x) => !x.trim())) {
    errors.push('paragraphs must be non-empty');
  }
  if (!c.approvedBy.trim()) errors.push('approvedBy is empty: no send without a named approval');
  const allText = [c.subject, c.preheader, ...c.paragraphs, c.button?.label ?? ''].join(' ');
  if (allText.includes(EM_DASH)) errors.push('copy contains an em dash (voice rule)');
  if (c.button) {
    if (!c.button.label.trim()) errors.push('button label is empty');
    let ok = false;
    try {
      ok = new URL(c.button.url).protocol === 'https:';
    } catch {
      ok = false;
    }
    if (!ok) errors.push('button url must be an absolute https URL');
  }
  return errors;
}

function broadcastButton(label: string, url: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px 0;">
<tr><td align="center">
<a href="${escapeHtml(url)}" target="_blank" style="display:inline-block;background:${ESPRESSO};color:${SOFT_GOLD};font-family:Georgia,serif;font-size:16px;text-decoration:none;padding:14px 36px;border-radius:2px;">${escapeHtml(label)}</a>
</td></tr>
</table>`;
}

/**
 * Render one broadcast for one recipient. firstName is RAW text here (it is escaped
 * below), unlike buildPodcastWelcomeEmail, whose caller passes pre-escaped HTML.
 * Throws if the campaign fails validation, so an invalid campaign cannot render.
 */
export function buildPodcastBroadcastEmail(
  firstName: string,
  c: PodcastCampaign,
): { subject: string; html: string } {
  const errors = validatePodcastCampaign(c);
  if (errors.length) throw new Error(`invalid podcast campaign: ${errors.join('; ')}`);
  const name = firstName.trim() || 'there';
  const body = [
    para(`Hi ${escapeHtml(name)},`),
    ...c.paragraphs.map((x) => para(escapeHtml(x))),
    c.button ? broadcastButton(c.button.label, c.button.url) : '',
    `<p style="font-family:Georgia,serif;font-size:16px;color:${ESPRESSO};margin:8px 0 16px 0;">Camila</p>`,
  ].filter(Boolean).join('\n');
  return { subject: c.subject, html: podcastShell(body, c.preheader) };
}

