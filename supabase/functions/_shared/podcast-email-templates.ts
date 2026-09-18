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

const ESPRESSO = '#2A231E';
const LINEN = '#F5EDD6';
const SOFT_GOLD = '#E8D5A3';
const PARCHMENT = '#FAF6EE';

function para(text: string): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.65;color:${ESPRESSO};margin:0 0 18px 0;">${text}</p>`;
}

function podcastShell(body: string): string {
  return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:${LINEN};">
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
