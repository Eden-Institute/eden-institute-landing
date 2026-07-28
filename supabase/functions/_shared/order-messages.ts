// supabase/functions/_shared/order-messages.ts
//
// Transactional order messages, bound to STATE TRANSITIONS (never a global preorder flag),
// plus the guarded dispatcher that records each send to message_log so nothing double-sends.
// Voice rule: no em dashes (feedback_no_em_dashes).

import { emailWrapper } from './nurture-email-templates.ts';
import { OrderStatus, isTerminal } from './order-state.ts';
import { SHIP_GUARANTEE_TEXT, SHIP_TARGET } from './order-config.ts';
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
  const html = emailWrapper(body)
    .split('{{UNSUB_URL}}').join('https://edeninstitute.health')
    .split("You're receiving this because you completed the Constitutional Assessment at edeninstitute.health.")
    .join("You're receiving this because you placed a preorder at edeninstitute.health.");
  return { subject: 'Your preorder is confirmed', html };
}

export function preorderSmsText(order: OrderRow): string {
  const ref = order.order_number ? ` Order ${order.order_number}.` : '';
  return `Thank you for your preorder from The Eden Institute.${ref} Your card was charged today. We are aiming to ship ${SHIP_TARGET}, guaranteed on or before ${SHIP_GUARANTEE_TEXT}. You may cancel for a full refund any time before it ships. Reply STOP to opt out.`;
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

// Messages registered per transition. Phase 1 wires only preorder_hold.
interface MessageDef { channel: 'email' | 'sms'; templateKey: string }
const REGISTRY: Partial<Record<OrderStatus, MessageDef[]>> = {
  preorder_hold: [
    { channel: 'email', templateKey: 'preorder_confirmation' },
    { channel: 'sms', templateKey: 'preorder_received_sms' },
  ],
};

/**
 * Fire the messages bound to a transition INTO `toStatus`, each guarded by message_log so a
 * webhook replay never double-sends. Terminal states (cancelled/refunded) fire nothing.
 */
export async function dispatchTransitionMessages(db: Db, order: OrderRow, toStatus: OrderStatus): Promise<void> {
  if (isTerminal(toStatus)) return;
  for (const def of REGISTRY[toStatus] ?? []) {
    if (def.channel === 'sms' && !order.sms_consent) continue;
    if (await hasSentMessage(db, order.id, def.templateKey, toStatus)) continue;

    let providerId: string | null = null;
    let ok = false;
    try {
      if (def.channel === 'email') {
        const { subject, html } = buildPreorderConfirmationEmail(order);
        providerId = await sendResendEmail(order.customer_email, subject, html);
      } else {
        providerId = await sendSms(order.customer_phone, preorderSmsText(order));
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
