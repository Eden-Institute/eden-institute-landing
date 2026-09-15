// supabase/functions/_shared/starter-email.ts
//
// The Starter Unit delivery email. Pure rendering, no I/O, so the copy can be
// unit-tested and previewed without sending anything.
//
// COPY RULES OBSERVED HERE:
//   - No em dashes anywhere in customer-facing text (house rule).
//   - The product is a STARTER UNIT, never a "sample", "lite", "preview" or
//     "partial". It is six complete weeks, not a fraction of something better.
//   - The plant cards are described as print-exclusive because they are made for
//     hands, stated as a design decision rather than an omission.
//
// STRUCTURE MATCHES partner-welcome: OUTLINED buttons, not filled. Gmail's
// compose editor strips background-color from pasted HTML but keeps color and
// border, so a solid button renders as invisible cream-on-white in a draft. These
// are sent rather than drafted so it would survive either way, but keeping one
// button style across every Eden email is worth more than the fill.

import { STARTER_LICENSE_LINE } from './starter-config.ts';
import { Receipt, renderReceiptHtml, renderReceiptText } from './receipt.ts';
import { escapeHtml } from './html-escape.ts';

export interface StarterEmailModel {
  firstName: string | null;
  email: string;
  creditCode: string | null;
  downloadToken: string;
  /**
   * The itemized receipt (2026-09-12, scholarship states). Optional so a missing
   * order row can never block a buyer's files; the fulfiller logs when it is null.
   */
  receipt?: Receipt | null;
}

// 2026-09-12, the print-first pivot. This delivery email used to hand the buyer
// their $39 kit credit code and send them to /preorder. The kit is off sale, so
// the credit is still MINTED (stripe-webhook and starter-credit.ts unchanged) and
// simply not mentioned. Founder plan: when the boxed edition launches, Starter
// buyers are the first list she mails and the credit is what opens that email.
// Do not restore the credit block here while the kit is off sale.
const PRINT_SET_URL = 'https://edeninstitute.health/books';
const RETURNS_URL = 'https://edeninstitute.health/returns';

function para(text: string): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 16px 0;">${text}</p>`;
}

function ctaButton(label: string, url: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:7px 0;">
<a href="${url}" target="_blank" style="display:inline-block;border:2px solid #1C3A2E;color:#1C3A2E;font-family:Georgia,serif;font-size:14px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;text-decoration:none;padding:14px 30px;">${label}</a>
</td></tr></table>`;
}

function rule(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #C9A84C;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr></table>`;
}

function sectionLabel(text: string): string {
  return `<p style="font-family:Georgia,serif;font-size:12px;font-weight:bold;letter-spacing:3px;color:#8A6D1F;text-transform:uppercase;margin:0 0 18px 0;">${text}</p>`;
}

export function renderStarterDeliveryEmail(m: StarterEmailModel): {
  subject: string;
  html: string;
  text: string;
} {
  const greeting = m.firstName ? `${m.firstName},` : 'Hello,';

  // ONE link, to a page, and it never expires.
  //
  // This email used to carry three signed URLs pointing straight at the PDFs.
  // Two things were wrong with that. They lapsed after seven days, so the email
  // a buyer kept became useless and the way back was a sentence of small grey
  // text. And a raw PDF link is exactly what a mail app's embedded browser
  // cannot handle: on 2026-09-05 a buyer tapped hers, got a white screen, and
  // reasonably concluded the product was broken. It was not. The files were
  // perfect and the link resolved to a valid 13 MB PDF when fetched outside her
  // mail app.
  //
  // A page can explain itself. A PDF cannot.
  const downloadsUrl = `https://edeninstitute.health/starter/downloads?t=${encodeURIComponent(m.downloadToken)}`;

  const creditBlock = `
${rule()}
${sectionLabel('When you want the rest of the year')}
${para(`These are the first nine weeks of the 36-week year. The other twenty-seven are finished too, and the whole year is printed to order: the Teacher's Guide, the Student Notebook and the whole Read-Aloud storybook, at your door in about two to three weeks. There is no hurry at all, and nothing here stops working if you never buy it.`)}
${ctaButton('See the printed year', PRINT_SET_URL)}
`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Your Eden's Table Starter Unit</title></head>
<body style="margin:0;padding:0;background-color:#F5F0E8;font-family:Georgia,serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F0E8;">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#FFFFFF;border:1px solid #E8E3DA;">
<tr><td style="background-color:#1C3A2E;padding:28px 20px;text-align:center;">
<span style="font-family:Georgia,serif;font-size:13px;font-weight:bold;letter-spacing:4px;color:#C9A84C;">THE EDEN INSTITUTE</span>
</td></tr>
<tr><td style="padding:34px 36px;">
${para(escapeHtml(greeting))}
${para(`Here are your first nine weeks of Eden's Table, Sprouts. Everything you need to start teaching is in these three files.`)}

${sectionLabel('Your downloads')}
${para(`Your Teacher's Guide, Student Notebook and Read-Aloud Storybook are waiting on one page:`)}
${ctaButton('Open your downloads', downloadsUrl)}
${para(`<span style="font-size:14px;color:#5A6B5F;">Save this email. That link does not expire, so you can come back to it any time, on any device.</span>`)}
${para(`<span style="font-size:14px;color:#5A6B5F;"><strong>If a file opens as a blank white screen</strong>, you are not doing anything wrong. Some email apps open links in a small built in browser that cannot display a PDF. Press and hold the link instead of tapping it, choose Open in Safari or Open in Chrome, and it will open properly. Opening this email on a computer works too.</span>`)}
${creditBlock}
${m.receipt ? `${rule()}
${sectionLabel('Your receipt')}
${renderReceiptHtml(m.receipt)}
${para(`<span style="font-size:14px;color:#5A6B5F;">Using a scholarship or education savings account? This receipt is itemized for your records, and Stripe also emails you a numbered invoice you can download as a PDF.</span>`)}` : ''}
${rule()}
${para(`<span style="font-size:14px;color:#5A6B5F;">${STARTER_LICENSE_LINE} If you teach a co-op or a classroom, reply to this email and we will sort out the right licence for you.</span>`)}
${para(`<span style="font-size:14px;color:#5A6B5F;">Because this is a digital download, it is not refundable once the files have been downloaded. Our full policy is <a href="${RETURNS_URL}" style="color:#1C3A2E;">here</a>.</span>`)}
${para(`Grace and health,`)}
${para(`<strong>Camila</strong><br><span style="font-size:14px;">The Eden Institute</span>`)}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    greeting,
    '',
    "Here are your first nine weeks of Eden's Table, Sprouts.",
    '',
    "Your Teacher's Guide, Student Notebook and Read-Aloud Storybook are on one page:",
    downloadsUrl,
    '',
    'Save this email. That link does not expire, so you can come back to it any time, on any device.',
    '',
    'If a file opens as a blank white screen, you are not doing anything wrong. Some email apps open links in a small built in browser that cannot display a PDF. Press and hold the link instead of tapping it, choose Open in Safari or Open in Chrome, and it will open properly. Opening this email on a computer works too.',
    '',
    'When you want the rest of the year: the other twenty-seven weeks are finished and the whole year is printed to order, at your door in about two to three weeks.',
    `See the printed year: ${PRINT_SET_URL}`,
    '',
    ...(m.receipt ? [renderReceiptText(m.receipt), ''] : []),
    STARTER_LICENSE_LINE,
    'If you teach a co-op or a classroom, reply to this email and we will sort out the right licence for you.',
    '',
    `Because this is a digital download, it is not refundable once the files have been downloaded. Full policy: ${RETURNS_URL}`,
    '',
    'Grace and health,',
    'Camila',
    'The Eden Institute',
  ].join('\n');

  return { subject: "Your Eden's Table Starter Unit is ready", html, text };
}
