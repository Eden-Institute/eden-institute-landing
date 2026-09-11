// supabase/functions/_shared/order-messages.ts
//
// Transactional order messages, bound to STATE TRANSITIONS (never a global preorder flag),
// plus the guarded dispatcher that records each send to message_log so nothing double-sends.
// Voice rule: no em dashes (feedback_no_em_dashes).

import { emailWrapper } from './nurture-email-templates.ts';
import { OrderStatus, isTerminal } from './order-state.ts';
import { SHIP_GUARANTEE_TEXT, SHIP_TARGET } from './order-config.ts';
import { LULU_PRODUCTION_DELAY_MINUTES } from './lulu-config.ts';
import { Db, OrderRow, hasSentMessage, logMessage } from './order-db.ts';
import { sendSms } from './order-sms.ts';
import { captureException } from './sentry.ts';

const FROM = 'Camila at The Eden Institute <hello@edeninstitute.health>';
const REPLY_TO = 'hello@edeninstitute.health';
const BRAND = { forest: '#2C3E2D', text: '#3D3832', gold: '#C5A44E', sage: '#5C7A5C' };

// ── text helpers (match homeschool-followup-templates.ts so chrome is identical) ──
function p(text: string, extra = ''): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${BRAND.text};margin:0 0 16px 0;${extra}">${text}</p>`;
}
function heading(text: string): string {
  return `<h2 style="font-family:Georgia,serif;font-size:22px;line-height:1.3;color:${BRAND.forest};margin:0 0 16px 0;font-weight:bold;">${text}</h2>`;
}
function signature(): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${BRAND.text};margin:24px 0 4px 0;">Grace and health,</p>` +
    `<p style="font-family:Georgia,serif;font-size:16px;color:${BRAND.text};font-weight:bold;margin:0;">Camila</p>` +
    `<p style="font-family:Georgia,serif;font-size:14px;color:${BRAND.text};margin:4px 0 0 0;">The Eden Institute</p>`;
}
function money(cents: number | null): string {
  return cents == null ? '' : `$${(cents / 100).toFixed(2)}`;
}
function firstName(order: OrderRow): string {
  const n = (order.shipping_name ?? '').trim().split(/\s+/)[0];
  return n || 'there';
}

export function buildPreorderConfirmationEmail(order: OrderRow): { subject: string; html: string } {
  const item = order.product_label ? order.product_label : 'your order';
  const amount = money(order.amount_total_cents);
  const body =
    p(`Hi ${firstName(order)},`) +
    // Wording is deliberately tier-NEUTRAL. This template has no way to tell a
    // founding buyer from a retail one: OrderRow carries no product_id and no
    // founding flag, and it fires on the paid transition for every order,
    // including those placed after the founding 500 close. It therefore may not
    // assert the founding price OR "founding member" status.
    // It also may not imply Founding Family status, which is a SEPARATE tier
    // (first 50 PAID orders, founder decision 2026-07-25) that this email cannot
    // detect either. See PreorderBuyBox.tsx and launch email 8, which both keep
    // the two claims apart.
    p(`Thank you. Your preorder is confirmed and your kit is reserved in the first print run.`) +
    heading('Your order') +
    // The order number is the handle the customer needs for any later question, and
    // /returns tells them to quote it. Before this it existed nowhere they could see.
    (order.order_number
      ? p(`Order number: <strong>${order.order_number}</strong><br>`
        + `Keep this. Quote it in any email to us about your order.`)
      : '') +
    p(`${item}${amount ? `: ${amount} (charged today)` : ''}`) +
    p(`Your patience helps fund the first print run of this curriculum. The amount above is what you paid today.`) +
    p(`If your order is one of the first fifty, I will write to you separately about Founding Families.`) +
    // Two dates, deliberately. The first is what we are aiming for; the second is the
    // binding commitment the FTC delay-notice clock runs on. Both must be plainly
    // visible: if only the target were prominent, it would become the stated time.
    p(`We are aiming to ship in <strong>${SHIP_TARGET}</strong>.`) +
    p(`Your guaranteed ship date is <strong>on or before ${SHIP_GUARANTEE_TEXT}</strong>. `
      + `If we cannot ship by then, we will write to you before that date, and you may `
      + `cancel for a full refund.`) +
    p(`Your card was charged today. You can also cancel for a full refund at any point `
      + `before your order ships, by replying to this email.`) +
    p(`We are so grateful to have you with us this early.`) +
    signature();
  // Transactional email: neutralize the marketing unsubscribe placeholder baked into
  // emailWrapper, and correct its quiz-funnel footer reason for purchase receipts.
  // The wrapper writes the apostrophe as &rsquo;, so the replacement has to match
  // that form. The straight-apostrophe version below it never matched, and every
  // confirmation sent before 2026-09-03 carried the quiz footer reason.
  const html = emailWrapper(body)
    .split('{{UNSUB_URL}}').join('https://edeninstitute.health')
    .split("You&rsquo;re receiving this because you completed the Constitutional Assessment at edeninstitute.health.")
    .join("You&rsquo;re receiving this because you placed a preorder at edeninstitute.health.")
    .split("You're receiving this because you completed the Constitutional Assessment at edeninstitute.health.")
    .join("You're receiving this because you placed a preorder at edeninstitute.health.");
  return { subject: 'Your preorder is confirmed', html };
}

// ── Transactional wrapper ────────────────────────────────────────────────────
// emailWrapper bakes in the marketing unsubscribe placeholder and the quiz-funnel
// footer reason; both are wrong on a purchase receipt. The wrapper writes the
// apostrophe as &rsquo;, so that form is matched first (the straight form never
// matched, and every confirmation before 2026-09-03 carried the quiz footer).
function wrapTransactional(body: string, reason: string): string {
  return emailWrapper(body)
    .split('{{UNSUB_URL}}').join('https://edeninstitute.health')
    .split("You&rsquo;re receiving this because you completed the Constitutional Assessment at edeninstitute.health.")
    .join(`You&rsquo;re receiving this because you ${reason} at edeninstitute.health.`)
    .split("You're receiving this because you completed the Constitutional Assessment at edeninstitute.health.")
    .join(`You're receiving this because you ${reason} at edeninstitute.health.`);
}

function trackingBits(order: OrderRow): { carrier: string; code: string; link: string | null } {
  const carrier = order.shipping_carrier ?? 'the carrier';
  const code = order.tracking_number ?? '';
  const link = order.tracking_url ?? null;
  return { carrier, code, link };
}

const PRINT_CANCEL_HOURS = Math.round(LULU_PRODUCTION_DELAY_MINUTES / 60);

// ── Print-on-demand order emails (2026-09-10) ────────────────────────────────
// COPY STATUS: written by Claude as factual placeholders so the rail can be
// tested end to end. The founder writes the voice before the shop opens.
// Facts: the cancellation window equals Lulu's production delay; tracking comes
// from Lulu's SHIPPED status.

export function buildOrderConfirmationEmail(order: OrderRow): { subject: string; html: string } {
  const item = order.product_label ? order.product_label : 'your order';
  const amount = money(order.amount_total_cents);
  const body =
    p(`Hi ${firstName(order)},`) +
    p(`Thank you. Your order is confirmed.`) +
    heading('Your order') +
    (order.order_number
      ? p(`Order number: <strong>${order.order_number}</strong><br>`
        + `Keep this. Quote it in any email to us about your order.`)
      : '') +
    p(`${item}${amount ? `: ${amount} (charged today)` : ''}`) +
    p(`Each book is printed for you when you order. Printing begins <strong>${PRINT_CANCEL_HOURS} hours</strong> `
      + `after your order, and until then you can change your mind or correct your address for a full refund `
      + `by replying to this email. Once printing has begun the order cannot be changed.`) +
    p(`You will get an email with tracking the moment your books are on their way.`) +
    signature();
  return { subject: 'Your order is confirmed', html: wrapTransactional(body, 'placed an order') };
}

export function buildShippedEmail(order: OrderRow): { subject: string; html: string } {
  const item = order.product_label ? order.product_label : 'your order';
  const { carrier, code, link } = trackingBits(order);
  const body =
    p(`Hi ${firstName(order)},`) +
    p(`It is on the way. Your <strong>${item}</strong> has shipped with ${carrier}.`) +
    heading('Tracking') +
    (code ? p(`Tracking number: <strong>${code}</strong>`) : '') +
    (link
      ? p(`<a href="${link}" style="display:inline-block;background-color:${BRAND.forest};color:#F5F0E8;font-family:Georgia,serif;font-size:16px;font-weight:bold;padding:12px 28px;text-decoration:none;">Track your package</a>`)
      : '') +
    (!code && !link ? p(`The carrier has not issued a tracking number yet. Reply to this email if it has not arrived within two weeks.`) : '') +
    (order.order_number ? p(`Order number: ${order.order_number}`) : '') +
    signature();
  return { subject: 'Your order is on its way', html: wrapTransactional(body, 'placed an order') };
}

export function buildDeliveredEmail(order: OrderRow): { subject: string; html: string } {
  const item = order.product_label ? order.product_label : 'your order';
  const body =
    p(`Hi ${firstName(order)},`) +
    p(`Your <strong>${item}</strong> was delivered today.`) +
    p(`If it is not where you expected, check with anyone else at home first, then any porch, side door `
      + `or mailroom the carrier might use. If it still does not turn up, reply to this email and we will sort it out with you.`) +
    p(`If a book arrived damaged or misprinted, reply with a photo and we will replace it.`) +
    signature();
  return { subject: "Your Eden's Table order has arrived", html: wrapTransactional(body, 'placed an order') };
}

export function buildOrderEmail(templateKey: string, order: OrderRow): { subject: string; html: string } {
  switch (templateKey) {
    case 'preorder_confirmation': return buildPreorderConfirmationEmail(order);
    case 'order_confirmation': return buildOrderConfirmationEmail(order);
    case 'shipped': return buildShippedEmail(order);
    case 'delivered': return buildDeliveredEmail(order);
    default: throw new Error(`No email builder for template '${templateKey}'`);
  }
}

export function orderSmsText(templateKey: string, order: OrderRow): string {
  const ref = order.order_number ? ` Order ${order.order_number}.` : '';
  const { carrier, code, link } = trackingBits(order);
  switch (templateKey) {
    case 'preorder_received_sms':
      return preorderSmsText(order);
    case 'order_received_sms':
      return `Thank you for your order from The Eden Institute (edeninstitute.health).${ref} Your card was charged today. Your books are printed to order; tracking will follow by email and text when they ship. Reply STOP to opt out.`;
    case 'shipped_sms':
      return `Your Eden's Table order has shipped with ${carrier}.${link ? ` Track it: ${link}` : ''}${code ? ` (tracking ${code})` : ''} Reply STOP to opt out.`;
    case 'delivered_sms':
      return `Your Eden's Table order was delivered. Reply to your confirmation email if anything is wrong with it. Reply STOP to opt out.`;
    default:
      throw new Error(`No SMS builder for template '${templateKey}'`);
  }
}

export function preorderSmsText(order: OrderRow): string {
  const ref = order.order_number ? ` Order ${order.order_number}.` : '';
  return `Thank you for your preorder from The Eden Institute (edeninstitute.health).${ref} Your card was charged today. We are aiming to ship ${SHIP_TARGET}, guaranteed on or before ${SHIP_GUARANTEE_TEXT}. You may cancel for a full refund any time before it ships. Reply STOP to opt out.`;
}

async function sendResendEmail(to: string, subject: string, html: string): Promise<string | null> {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) throw new Error('RESEND_API_KEY missing');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, reply_to: REPLY_TO, subject, html }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
  const json = await res.json().catch(() => ({}));
  return (json && typeof json.id === 'string') ? json.id : null;
}

// Messages registered per transition, keyed by the EDGE (from -> to) where the
// destination is reachable more than one way with different meanings:
//   paid -> ready_to_fulfill           = in-stock or print-on-demand purchase (order confirmation)
//   preorder_hold -> ready_to_fulfill  = preorder release (no message wired yet; Phase 2)
// The message_log idempotency key is unchanged: one successful send per
// (order, template_key, triggered_by_status).
interface MessageDef {
  channel: 'email' | 'sms';
  templateKey: string;
  /** Only fire when the transition came FROM this state. Omit = any source state. */
  from?: OrderStatus;
}
const REGISTRY: Partial<Record<OrderStatus, MessageDef[]>> = {
  preorder_hold: [
    { channel: 'email', templateKey: 'preorder_confirmation' },
    { channel: 'sms', templateKey: 'preorder_received_sms' },
  ],
  ready_to_fulfill: [
    { channel: 'email', templateKey: 'order_confirmation', from: 'paid' },
    { channel: 'sms', templateKey: 'order_received_sms', from: 'paid' },
  ],
  shipped: [
    { channel: 'email', templateKey: 'shipped' },
    { channel: 'sms', templateKey: 'shipped_sms' },
  ],
  delivered: [
    // Email FIRST, not SMS only: SMS consent defaults unchecked, so an SMS-only
    // delivered message would reach almost nobody. The email is also the record.
    { channel: 'email', templateKey: 'delivered' },
    { channel: 'sms', templateKey: 'delivered_sms' },
  ],
};

/**
 * When a replay lands on an order already at the destination, the source state is
 * gone. ready_to_fulfill is the only destination whose messages depend on it, and
 * is_preorder settles that: a preorder got there by release, anything else by paying.
 */
function inferFromStatus(order: OrderRow, toStatus: OrderStatus): OrderStatus | null {
  if (toStatus === 'ready_to_fulfill') return order.is_preorder ? 'preorder_hold' : 'paid';
  return null;
}

/**
 * Fire the messages bound to the transition INTO `toStatus` (filtered by the edge when
 * a definition names one), each guarded by message_log so a webhook replay never
 * double-sends. Terminal states (cancelled/refunded) fire nothing.
 */
export async function dispatchTransitionMessages(
  db: Db,
  order: OrderRow,
  toStatus: OrderStatus,
  fromStatus: OrderStatus | null = null,
): Promise<void> {
  if (isTerminal(toStatus)) return;
  const from = fromStatus ?? inferFromStatus(order, toStatus);
  const defs = (REGISTRY[toStatus] ?? []).filter((d) => !d.from || d.from === from);
  for (const def of defs) {
    if (def.channel === 'sms' && !order.sms_consent) continue;
    if (def.channel === 'sms' && !order.customer_phone) continue;
    if (await hasSentMessage(db, order.id, def.templateKey, toStatus)) continue;

    let providerId: string | null = null;
    let ok = false;
    try {
      if (def.channel === 'email') {
        const { subject, html } = buildOrderEmail(def.templateKey, order);
        providerId = await sendResendEmail(order.customer_email, subject, html);
      } else {
        providerId = await sendSms(order.customer_phone, orderSmsText(def.templateKey, order));
      }
      ok = providerId !== null;
    } catch (e) {
      console.error(`order message failed (${def.templateKey}):`, String(e));
      await captureException(e, {
        function: 'order-messages',
        template_key: def.templateKey,
        channel: def.channel,
        order_id: order.id,
      });
    }
    await logMessage(db, {
      order_id: order.id,
      channel: def.channel,
      template_key: def.templateKey,
      triggered_by_status: toStatus,
      status: ok ? 'sent' : 'failed',
      provider_id: providerId,
    });
  }
}
