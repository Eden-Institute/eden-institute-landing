// Email bodies for preorder broadcasts.
//
// Two shapes with very different rules:
//
//   update       — a manufacturer progress note. Free-form body from the founder.
//   delay_notice — a legal instrument. 16 CFR 435.2(b)(1)(i) requires it to state a
//                  DEFINITE revised shipping date (or say plainly that we cannot give
//                  one), inform the buyer of the right to cancel for a prompt refund,
//                  and provide a free way to do it. The consent language is NOT
//                  interchangeable between the two cases, so it is generated here from
//                  requiresOptIn rather than typed by hand each time.
//
// Voice rule: no em dashes (feedback_no_em_dashes).

import { emailWrapper } from './nurture-email-templates.ts';

const BRAND = { forest: '#2C3E2D', text: '#3D3832', gold: '#C5A44E' };

function p(text: string, extra = ''): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${BRAND.text};margin:0 0 16px 0;${extra}">${text}</p>`;
}

function heading(text: string): string {
  return `<h2 style="font-family:Georgia,serif;font-size:22px;line-height:1.3;color:${BRAND.forest};margin:0 0 16px 0;font-weight:bold;">${text}</h2>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 12px 0;"><tr>`
    + `<td style="background-color:${BRAND.forest};padding:14px 28px;">`
    + `<a href="${href}" style="font-family:Georgia,serif;font-size:16px;color:#FFFFFF;text-decoration:none;font-weight:bold;">${label}</a>`
    + `</td></tr></table>`;
}

function signature(): string {
  return p('Grace and health,', 'margin-top:24px;margin-bottom:4px;')
    + `<p style="font-family:Georgia,serif;font-size:16px;color:${BRAND.text};font-weight:bold;margin:0;">Camila</p>`
    + `<p style="font-family:Georgia,serif;font-size:14px;color:${BRAND.text};margin:4px 0 0 0;">The Eden Institute</p>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!
  ));
}

/**
 * Minimal, deliberately restricted markdown: blank-line paragraphs, "## " headings,
 * and [label](https://url) links. Everything else is escaped.
 *
 * Not a general markdown renderer on purpose. The founder's text lands in an email
 * sent to every buyer, so the safe move is a tiny allow-list rather than a library
 * with an HTML passthrough. Links are restricted to https to avoid javascript: URLs.
 */
export function renderBody(markdown: string): string {
  return markdown
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      if (block.startsWith('## ')) return heading(escapeHtml(block.slice(3).trim()));
      const withBreaks = escapeHtml(block).replace(/\n/g, '<br>');
      const linked = withBreaks.replace(
        /\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g,
        (_m, label, href) => `<a href="${href}" style="color:${BRAND.forest};">${label}</a>`,
      );
      return p(linked);
    })
    .join('');
}

export interface UpdateInput {
  firstName: string;
  bodyMarkdown: string;
  orderNumberLine?: string;
}

export function buildUpdateEmail(input: UpdateInput): string {
  const body = p(`Hi ${escapeHtml(input.firstName)},`)
    + renderBody(input.bodyMarkdown)
    + (input.orderNumberLine ? p(escapeHtml(input.orderNumberLine), 'font-size:14px;color:#6B6560;') : '')
    + signature();
  return finish(body, 'update');
}

export interface DelayNoticeInput {
  firstName: string;
  /** Founder's explanation of the delay. 435.2(a)(3): a reason is required when no
   *  definite date can be given. */
  bodyMarkdown: string;
  /** Formatted revised date, or null when we genuinely cannot give one. */
  revisedShipDate: string | null;
  /** True when silence must be treated as cancellation rather than consent. */
  requiresOptIn: boolean;
  consentUrl: string;
  cancelUrl: string;
  orderNumber: string | null;
}

/**
 * The compliant delay notice. Every clause below maps to a requirement:
 *   - definite revised date, or an explicit statement that we cannot give one
 *   - the right to cancel for a full and prompt refund
 *   - a free, one-click way to exercise it
 *   - the correct consequence-of-silence language for THIS notice's threshold
 */
export function buildDelayNoticeEmail(input: DelayNoticeInput): string {
  const dateLine = input.revisedShipDate
    ? p(`Our new expected ship date is <strong>${escapeHtml(input.revisedShipDate)}</strong>.`)
    : p('We are not yet able to give you a definite new ship date. The reason is above, '
      + 'and we will write to you again as soon as we can commit to one.');

  // The two cases say genuinely different things, and sending the wrong one is itself
  // a violation. Opt-in must warn that silence cancels; opt-out must state that
  // silence is consent.
  const consequence = input.requiresOptIn
    ? p('<strong>If we do not hear from you within 30 days, your order will be '
      + 'cancelled and refunded in full, automatically.</strong> You do not need to do '
      + 'anything to receive that refund. If you would like to keep your order and wait, '
      + 'please tell us using the first button below.')
    : p('If we do not hear from you, we will take that as agreement to the new date and '
      + 'keep your order in the queue. You can still cancel at any time before it ships.');

  const body = p(`Hi ${escapeHtml(input.firstName)},`)
    + heading("Your Eden's Table order is running late")
    + renderBody(input.bodyMarkdown)
    + dateLine
    + p('You have the right to cancel this order and receive a <strong>full refund</strong>, '
      + 'including shipping. It costs you nothing and you do not need to give a reason.')
    + consequence
    + button(input.consentUrl, input.requiresOptIn ? 'Keep my order and wait' : 'Yes, keep my order')
    + button(input.cancelUrl, 'Cancel and refund me in full')
    + p('Either button is one click and takes effect immediately. If you would rather '
      + 'write to a person, reply to this email and it reaches Camila directly.',
      'font-size:14px;color:#6B6560;')
    + (input.orderNumber
      ? p(`Order ${escapeHtml(input.orderNumber)}`, 'font-size:14px;color:#6B6560;')
      : '')
    + signature();
  return finish(body, 'delay');
}

/**
 * Neutralise the marketing chrome baked into emailWrapper. These are transactional
 * and legal messages: they must not carry an unsubscribe link (a buyer cannot opt out
 * of being told their order is late) and the quiz-funnel footer reason is wrong.
 */
function finish(body: string, kind: 'update' | 'delay'): string {
  return emailWrapper(body)
    .split('{{UNSUB_URL}}').join('https://edeninstitute.health')
    .split("You're receiving this because you completed the Constitutional Assessment at edeninstitute.health.")
    .join(kind === 'delay'
      ? 'You are receiving this because you placed a preorder at edeninstitute.health. '
        + 'This is a required notice about your order and is not marketing.'
      : 'You are receiving this because you placed a preorder at edeninstitute.health.');
}
