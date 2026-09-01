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

import { STARTER_LICENSE_LINE, STARTER_PRICE_CENTS, STARTER_CREDIT_CENTS } from './starter-config.ts';

export interface StarterEmailModel {
  firstName: string | null;
  email: string;
  teachersGuideUrl: string;
  studentNotebookUrl: string;
  readAloudUrl: string;
  creditCode: string | null;
  downloadToken: string;
  linksExpireAt: Date;
}

const KIT_URL = 'https://edeninstitute.health/preorder';
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

/** Long-form date, e.g. "2 September 2026". Avoids US/UK numeric ambiguity. */
function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function dollars(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

export function renderStarterDeliveryEmail(m: StarterEmailModel): {
  subject: string;
  html: string;
  text: string;
} {
  const greeting = m.firstName ? `${m.firstName},` : 'Hello,';
  const expires = formatDate(m.linksExpireAt);
  const rerequestUrl = `https://edeninstitute.health/starter/downloads?t=${encodeURIComponent(m.downloadToken)}`;

  const creditBlock = m.creditCode
    ? `
${rule()}
${sectionLabel('Your credit toward the full kit')}
${para(`The ${dollars(STARTER_PRICE_CENTS)} you just spent comes straight off the Sprouts Complete Kit. Use this code at checkout and it takes ${dollars(STARTER_CREDIT_CENTS)} off:`)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:6px 0 18px 0;">
<span style="display:inline-block;border:2px dashed #C9A84C;background-color:#FBF7EF;color:#1C3A2E;font-family:Georgia,serif;font-size:22px;font-weight:bold;letter-spacing:3px;padding:16px 28px;">${m.creditCode}</span>
</td></tr></table>
${para(`The code is tied to this email address and can be used once. It does not expire when the founding 500 sell out: if you come back later, it still comes off the price you see then.`)}
${ctaButton('See the full kit', KIT_URL)}
`
    : '';

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
${para(greeting)}
${para(`Here are your first nine weeks of Eden's Table, Sprouts. Everything you need to start teaching is in these three files.`)}

${sectionLabel('Your downloads')}
${ctaButton("Teacher's Guide", m.teachersGuideUrl)}
${ctaButton('Student Notebook', m.studentNotebookUrl)}
${ctaButton('Read-Aloud Storybook', m.readAloudUrl)}
${para(`<span style="font-size:14px;color:#5A6B5F;">These links work until <strong>${expires}</strong>. Download them onto your own device and they are yours to keep. If the links lapse before you get to them, <a href="${rerequestUrl}" style="color:#1C3A2E;">request fresh ones here</a> and we will send new ones straight away.</span>`)}
${creditBlock}
${rule()}
${sectionLabel('About the plant cards')}
${para(`The Field Cards, Recipe Cards and Around the Table Cards are not in this download, and that is deliberate. They are made to be carried outside, propped against a mixing bowl and passed around a table by small hands. A screen cannot do any of that, so they stay in the printed kit where they belong. The storybook is different, which is why it is here: a story reads aloud just as well from a screen.`)}
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
    `Teacher's Guide: ${m.teachersGuideUrl}`,
    `Student Notebook: ${m.studentNotebookUrl}`,
    `Read-Aloud Storybook: ${m.readAloudUrl}`,
    '',
    `These links work until ${expires}. Download them onto your own device and they are yours to keep.`,
    `If they lapse, request fresh ones here: ${rerequestUrl}`,
    '',
    ...(m.creditCode
      ? [
        `YOUR CREDIT TOWARD THE FULL KIT: ${m.creditCode}`,
        `That is ${dollars(STARTER_CREDIT_CENTS)} off the Sprouts Complete Kit. It is tied to this email address and can be used once.`,
        `It does not expire when the founding 500 sell out.`,
        `See the full kit: ${KIT_URL}`,
        '',
      ]
      : []),
    'About the plant cards: the Field Cards, Recipe Cards and Around the Table Cards are not in this download, and that is deliberate. They are made to be carried outside and passed around a table, so they stay in the printed kit. The storybook is different, which is why it is here.',
    '',
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
