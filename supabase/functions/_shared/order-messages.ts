// supabase/functions/_shared/order-messages.ts
//
// Transactional order messages, bound to STATE TRANSITIONS (never a global preorder flag),
// plus the guarded dispatcher that records each send to message_log so nothing double-sends.
// Voice rule: no em dashes (feedback_no_em_dashes).

import { emailWrapperTransactional } from './nurture-email-templates.ts';
import { escapeHtml, safeHttpsUrl } from './html-escape.ts';
import { OrderStatus } from './order-state.ts';
import { SHIP_GUARANTEE_TEXT, SHIP_TARGET } from './order-config.ts';
import { LULU_PRODUCTION_DELAY_MINUTES } from './lulu-config.ts';
import { Db, OrderRow, hasSentMessage, logMessage } from './order-db.ts';
import { sendSms } from './order-sms.ts';
import { captureException } from './sentry.ts';
import { Receipt, loadOrderReceipt, renderReceiptHtml } from './receipt.ts';

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
  // The payer types this name at Stripe checkout; it goes into email HTML.
  return escapeHtml(n || 'there');
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
  const html = emailWrapperTransactional(body, 'preorder');
  return { subject: 'Your preorder is confirmed', html };
}

// Returns RAW values (orderSmsText reuses them as plain text); escape at HTML use sites.
function trackingBits(order: OrderRow): { carrier: string; code: string; link: string | null } {
  const carrier = order.shipping_carrier ?? 'the carrier';
  const code = order.tracking_number ?? '';
  // Lulu supplies this URL; only an https link may become an href.
  const link = safeHttpsUrl(order.tracking_url);
  return { carrier, code, link };
}

const PRINT_CANCEL_HOURS = Math.round(LULU_PRODUCTION_DELAY_MINUTES / 60);

// ── Print-on-demand order emails ─────────────────────────────────────────────
// Written 2026-09-11 in the founder's voice, from her own pages and mail. Facts
// only from the code: the cancellation window equals Lulu's production delay;
// tracking comes from Lulu's SHIPPED status; MAIL transit is about two weeks.

// 2026-09-12, scholarship states: the confirmation is now an ITEMIZED receipt
// with the word "curriculum" on every line (see _shared/receipt.ts). `receipt` is
// loaded by the dispatcher from order_items; if it is missing (no items written,
// a DB hiccup) the old single line is the fallback, so the buyer still hears from
// us. The fallback is logged, because it is not scholarship-ready.
export function buildOrderConfirmationEmail(order: OrderRow, receipt: Receipt | null = null): { subject: string; html: string } {
  const item = order.product_label ? order.product_label : 'your Sprouts set';
  const amount = money(order.amount_total_cents);
  const body =
    p(`Hi ${firstName(order)},`) +
    p(`Thank you!! Your order is in and your books are about to be printed just for you.`) +
    heading('Your order') +
    (order.order_number
      ? p(`Order number: <strong>${order.order_number}</strong><br>`
        + `Keep this one. It is how I find you fast if you ever need anything.`)
      : '') +
    (receipt
      ? renderReceiptHtml(receipt) +
        p(`<span style="font-size:14px;">Using a scholarship or education savings account? This receipt is itemized for your records, and Stripe also emails you a numbered invoice you can download as a PDF.</span>`)
      : p(`${item}${amount ? `: ${amount}, charged today` : ''}`)) +
    heading('What happens now') +
    p(`Because each set is printed for you and nobody else, there is a <strong>${PRINT_CANCEL_HOURS} hour pause</strong> `
      + `before printing starts. That is your window. If the address is wrong, if you meant two sets, if you `
      + `changed your mind, just reply to this email and I will fix it or refund you in full. Once printing `
      + `starts it cannot be changed.`) +
    p(`After that your books print, get packed and go in the mail, and you will get an email from me with `
      + `tracking the day they ship. Plan on about two to three weeks from today to your door.`) +
    p(`I am so glad you are starting. Week 1 is waiting for you.`) +
    signature();
  return { subject: `Your Sprouts books are ordered${order.order_number ? ` (${order.order_number})` : ''}`, html: emailWrapperTransactional(body, 'order') };
}

export function buildShippedEmail(order: OrderRow): { subject: string; html: string } {
  const item = order.product_label ? order.product_label : 'your Sprouts set';
  const { carrier, code, link } = trackingBits(order);
  const body =
    p(`Hi ${firstName(order)},`) +
    p(`They are on the way!! Your <strong>${escapeHtml(item)}</strong> shipped today${carrier !== 'the carrier' ? ` with ${escapeHtml(carrier)}` : ''}.`) +
    heading('Tracking') +
    (code ? p(`Tracking number: <strong>${escapeHtml(code)}</strong>`) : '') +
    (link
      ? p(`<a href="${escapeHtml(link)}" style="display:inline-block;background-color:${BRAND.forest};color:#F5F0E8;font-family:Georgia,serif;font-size:16px;font-weight:bold;padding:12px 28px;text-decoration:none;">Track your package</a>`)
      : '') +
    (!code && !link ? p(`The carrier has not posted a tracking number yet. If nothing has arrived in two weeks, reply to this email and I will chase it.`) : '') +
    p(`Mail usually takes a week or two. When the box lands, open the Teacher's Guide to Week 1 and read it `
      + `together at the table before you do anything else. That is the whole method.`) +
    (order.order_number ? p(`Order number: ${order.order_number}`) : '') +
    signature();
  return { subject: 'Your Sprouts books shipped', html: emailWrapperTransactional(body, 'order') };
}

export function buildDeliveredEmail(order: OrderRow): { subject: string; html: string } {
  const item = order.product_label ? order.product_label : 'your Sprouts set';
  const body =
    p(`Hi ${firstName(order)},`) +
    p(`Your <strong>${escapeHtml(item)}</strong> was delivered today!`) +
    p(`If it is not where you expected, check with everyone at home first, then the porch, the side door `
      + `and anywhere else the mail carrier likes to hide things. Still nothing? Reply to this email and we `
      + `will sort it out together.`) +
    p(`If a book arrived bent, misprinted or damaged, send me a photo and I will replace it, no charge.`) +
    p(`Now go find a plant. Week 1 starts whenever you are ready.`) +
    signature();
  return { subject: 'Your Sprouts books are here', html: emailWrapperTransactional(body, 'order') };
}

/**
 * Refund confirmation (founder request 2026-09-17). Fires on the transition INTO
 * refunded, which only a FULL Stripe refund causes (charge.refunded with
 * charge.refunded === true; partial refunds leave the order alone). Stripe's own
 * refund receipts are switched OFF in the Dashboard, so this is the only notice
 * the buyer gets. Product-neutral on purpose: printed sets, preorders and digital
 * orders all reach this state.
 */
export function buildRefundEmail(order: OrderRow): { subject: string; html: string } {
  const amount = money(order.amount_total_cents);
  // Digital orders collect no shipping name; fall back to the billing name.
  const billingFirst = String(order.raw?.customer_details?.name ?? '').trim().split(/\s+/)[0];
  const name = order.shipping_name ? firstName(order) : escapeHtml(billingFirst || 'there');
  const label = order.product_label ? escapeHtml(order.product_label) : '';
  const which = order.order_number
    ? `order <strong>${order.order_number}</strong>${label ? ` (${label})` : ''}`
    : (label ? `your ${label}` : 'your order');
  const body =
    p(`Hi ${name},`) +
    p(`Your refund is done! ${amount ? `<strong>${amount}</strong> is` : 'Your money is'} on its way back to you for ${which}.`) +
    p(`It usually shows up in 5 to 10 business days, depending on your bank. If you paid with Klarna, `
      + `Afterpay or Affirm, they cancel any payments you have left and send back what you already paid.`) +
    p(`Didn't ask for this refund, or something looks off? Just reply to this email and I will sort it out.`) +
    p(`Thank you so much for giving us a try. You are always welcome back.`) +
    signature();
  return {
    subject: `Your refund is on its way${order.order_number ? ` (${order.order_number})` : ''}`,
    html: emailWrapperTransactional(body, order.is_preorder ? 'preorder' : 'order'),
  };
}

export function buildOrderEmail(templateKey: string, order: OrderRow, receipt: Receipt | null = null): { subject: string; html: string } {
  switch (templateKey) {
    case 'preorder_confirmation': return buildPreorderConfirmationEmail(order);
    case 'order_confirmation': return buildOrderConfirmationEmail(order, receipt);
    case 'shipped': return buildShippedEmail(order);
    case 'delivered': return buildDeliveredEmail(order);
    case 'refund_confirmation': return buildRefundEmail(order);
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
      return `Thank you for your Sprouts order from The Eden Institute!${ref} Your payment went through today. Your books print in ${PRINT_CANCEL_HOURS} hours; reply to your confirmation email before then to change anything. I will text you when they ship. Reply STOP to opt out.`;
    case 'shipped_sms':
      // "from The Eden Institute": A2P 10DLC requires the brand name in every
      // message, and a reviewer reads these against the campaign samples.
      return `Your Sprouts books from The Eden Institute shipped today${carrier !== 'the carrier' ? ` with ${carrier}` : ''}!${link ? ` Track them: ${link}` : ''}${code ? ` (tracking ${code})` : ''} Reply STOP to opt out.`;
    case 'delivered_sms':
      return `Your Sprouts books from The Eden Institute were delivered today! Anything wrong with them, reply to your confirmation email and I will make it right. Reply STOP to opt out.`;
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
  // Email only: the one terminal state that tells the buyer something. cancelled
  // stays silent (it has no entry here).
  refunded: [
    { channel: 'email', templateKey: 'refund_confirmation' },
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
 * double-sends. Terminal states fire only what the registry lists for them:
 * refunded sends the refund confirmation, cancelled sends nothing.
 */
export async function dispatchTransitionMessages(
  db: Db,
  order: OrderRow,
  toStatus: OrderStatus,
  fromStatus: OrderStatus | null = null,
): Promise<void> {
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
        // The receipt is only needed on the confirmation, and a failure to load it
        // must never cost the buyer their email: fall back and log it loudly.
        let receipt: Receipt | null = null;
        if (def.templateKey === 'order_confirmation') {
          try {
            receipt = await loadOrderReceipt(db, order);
          } catch (e) {
            console.error('order_confirmation: receipt load threw, sending unitemized:', String(e));
          }
          if (!receipt) console.error(`order_confirmation: NO itemized receipt for ${order.order_number ?? order.id}; sent the single-line fallback`);
        }
        const { subject, html } = buildOrderEmail(def.templateKey, order, receipt);
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
