// supabase/functions/_shared/order-messages.ts
//
// Transactional order messages, bound to STATE TRANSITIONS (never a global preorder flag),
// plus the guarded dispatcher that records each send to message_log so nothing double-sends.
//
// Phase 2: the registry is keyed by transition EDGE (from -> to), not just the destination
// state, because ready_to_fulfill is reachable two ways with different meanings:
//   paid -> ready_to_fulfill           = in-stock purchase (order confirmation)
//   preorder_hold -> ready_to_fulfill  = preorder release  ("we are preparing your order")
//   label_created -> ready_to_fulfill  = label voided      (NO message)
// The message_log idempotency key is unchanged: one successful send per
// (order, template_key, triggered_by_status). Voice rule: no em dashes.

import { emailWrapper } from './nurture-email-templates.ts';
import { OrderStatus, isTerminal } from './order-state.ts';
import { SHIP_WINDOW } from './order-config.ts';
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
function wrap(body: string): string {
  // Transactional email: neutralize the marketing unsubscribe placeholder baked into emailWrapper.
  return emailWrapper(body).split('{{UNSUB_URL}}').join('https://edeninstitute.health');
}
function trackingBits(order: OrderRow): { carrier: string; code: string; link: string } {
  const carrier = order.shipping_carrier ?? 'the carrier';
  const code = order.tracking_number ?? '';
  const link = order.tracking_url ?? (code ? `https://www.google.com/search?q=${encodeURIComponent(code + ' tracking')}` : 'https://edeninstitute.health');
  return { carrier, code, link };
}

// ── Email builders ───────────────────────────────────────────────────────
export function buildPreorderConfirmationEmail(order: OrderRow): { subject: string; html: string } {
  const item = order.product_label ? order.product_label : 'your order';
  const amount = money(order.amount_total_cents);
  const body =
    p(`Hi ${firstName(order)},`) +
    p(`Thank you. Your founding preorder is confirmed, and you are officially a founding member.`) +
    heading('Your order') +
    p(`${item}${amount ? `: ${amount} (charged today)` : ''}`) +
    p(`This is a founding preorder. Your patience helps fund the founding of this curriculum, and in exchange you receive the founding price and founding-member status.`) +
    p(`Estimated ship window: <strong>${SHIP_WINDOW}</strong>. That is an estimate, and we will keep you posted as it firms up.`) +
    p(`Your card was charged today. If we cannot ship within the estimated window, we will notify you and you may request a full refund.`) +
    p(`We are so grateful to have you with us at the founding of this.`) +
    signature();
  return { subject: 'Your founding preorder is confirmed', html: wrap(body) };
}

function buildOrderConfirmationEmail(order: OrderRow): { subject: string; html: string } {
  const item = order.product_label ? order.product_label : 'your order';
  const amount = money(order.amount_total_cents);
  const body =
    p(`Hi ${firstName(order)},`) +
    p(`Thank you. Your order is confirmed.`) +
    heading('Your order') +
    p(`${item}${amount ? `: ${amount} (charged today)` : ''}`) +
    p(`We are preparing your shipment now. You will receive an email with tracking the moment it is on its way.`) +
    p(`Thank you for bringing Eden's Table to your family's table. It is a joy to send this to you.`) +
    signature();
  return { subject: 'Your order is confirmed', html: wrap(body) };
}

function buildPreorderReleasedEmail(order: OrderRow): { subject: string; html: string } {
  const item = order.product_label ? order.product_label : 'your order';
  const body =
    p(`Hi ${firstName(order)},`) +
    p(`Good news. The waiting season is coming to a close.`) +
    p(`Your founding preorder of <strong>${item}</strong> has moved into preparation. Our family is packing boxes, and yours is among them.`) +
    p(`You will receive an email with tracking the moment your order ships${order.sms_consent ? ', and a text as well since you asked for updates that way' : ''}.`) +
    p(`Thank you for your patience. It helped plant this, and we do not take that lightly.`) +
    signature();
  return { subject: 'We are preparing your order', html: wrap(body) };
}

function buildShippedEmail(order: OrderRow): { subject: string; html: string } {
  const item = order.product_label ? order.product_label : 'your order';
  const { carrier, code, link } = trackingBits(order);
  const body =
    p(`Hi ${firstName(order)},`) +
    p(`It is on the way. Your <strong>${item}</strong> has shipped with ${carrier}.`) +
    heading('Tracking') +
    p(`Tracking number: <strong>${code}</strong>`) +
    p(`<a href="${link}" style="display:inline-block;background-color:${BRAND.forest};color:#F5F0E8;font-family:Georgia,serif;font-size:16px;font-weight:bold;padding:12px 28px;text-decoration:none;">Track your package</a>`) +
    p(`We prayed over this season of building, and it is a gift to finally send it to your table.`) +
    signature();
  return { subject: 'Your order is on its way', html: wrap(body) };
}

export function buildOrderEmail(templateKey: string, order: OrderRow): { subject: string; html: string } {
  switch (templateKey) {
    case 'preorder_confirmation': return buildPreorderConfirmationEmail(order);
    case 'order_confirmation': return buildOrderConfirmationEmail(order);
    case 'preorder_released': return buildPreorderReleasedEmail(order);
    case 'shipped': return buildShippedEmail(order);
    default: throw new Error(`No email builder for template '${templateKey}'`);
  }
}

// ── SMS builders ─────────────────────────────────────────────────────────
export function preorderSmsText(_order: OrderRow): string {
  return `Thank you for your founding preorder from The Eden Institute. Your card was charged today; estimated ship window ${SHIP_WINDOW} (an estimate). If we cannot ship in that window we will notify you and you may request a full refund. Reply STOP to opt out.`;
}

export function orderSmsText(templateKey: string, order: OrderRow): string {
  const { carrier, code, link } = trackingBits(order);
  switch (templateKey) {
    case 'preorder_received_sms':
      return preorderSmsText(order);
    case 'order_received_sms':
      return `Thank you for your Eden's Table order from The Eden Institute. Your card was charged today and we are preparing your shipment. Tracking will follow by email and text. Reply STOP to opt out.`;
    case 'preorder_released_sms':
      return `Good news from The Eden Institute: your Eden's Table preorder is now being prepared for shipment. Tracking will follow as soon as it ships. Reply STOP to opt out.`;
    case 'shipped_sms':
      return `Your Eden's Table order has shipped with ${carrier}. Track it here: ${link} (tracking ${code}). Reply STOP to opt out.`;
    case 'delivered_sms':
      return `Your Eden's Table order was delivered. We pray it blesses your family's table. Reply STOP to opt out.`;
    default:
      throw new Error(`No SMS builder for template '${templateKey}'`);
  }
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

// ── Edge-keyed registry ───────────────────────────────────────────────────
interface MessageDef {
  channel: 'email' | 'sms';
  templateKey: string;
  /** Only fire when the transition came FROM this state. Omit = any source state. */
  from?: OrderStatus;
}

const REGISTRY: Partial<Record<OrderStatus, MessageDef[]>> = {
  preorder_hold: [
    { channel: 'email', templateKey: 'preorder_confirmation', from: 'paid' },
    { channel: 'sms', templateKey: 'preorder_received_sms', from: 'paid' },
  ],
  ready_to_fulfill: [
    // In-stock purchase lands here directly from paid.
    { channel: 'email', templateKey: 'order_confirmation', from: 'paid' },
    { channel: 'sms', templateKey: 'order_received_sms', from: 'paid' },
    // Batch release of held preorders.
    { channel: 'email', templateKey: 'preorder_released', from: 'preorder_hold' },
    { channel: 'sms', templateKey: 'preorder_released_sms', from: 'preorder_hold' },
    // label_created -> ready_to_fulfill (void) deliberately matches nothing.
  ],
  shipped: [
    { channel: 'email', templateKey: 'shipped', from: 'label_created' },
    { channel: 'sms', templateKey: 'shipped_sms', from: 'label_created' },
  ],
  delivered: [
    { channel: 'sms', templateKey: 'delivered_sms', from: 'shipped' },
  ],
};

/**
 * Fire the messages bound to the EDGE (fromStatus -> toStatus), each guarded by
 * message_log so a webhook replay or admin double-click never double-sends. Terminal
 * states (cancelled/refunded) fire nothing.
 */
export async function dispatchTransitionMessages(
  db: Db,
  order: OrderRow,
  toStatus: OrderStatus,
  fromStatus: OrderStatus,
): Promise<void> {
  if (isTerminal(toStatus)) return;
  const defs = (REGISTRY[toStatus] ?? []).filter((d) => !d.from || d.from === fromStatus);
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
