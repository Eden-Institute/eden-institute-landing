// supabase/functions/_shared/order-flow.ts
//
// Orchestration for the order lifecycle, called from stripe-webhook. Keeps the webhook
// edit tiny. Records the order from a completed Checkout Session then transitions it to
// preorder_hold (preorder product) or straight to ready_to_fulfill (in-stock product,
// is_preorder=false); applies full refunds; logs partial refunds without changing state.

import { OrderStatus, canTransition } from './order-state.ts';
import {
  Db,
  addOrderItem,
  getOrderById,
  getOrderByPaymentIntent,
  logMessage,
  setOrderStatus,
  upsertOrderPaid,
} from './order-db.ts';
import { dispatchTransitionMessages } from './order-messages.ts';

interface ShippingDetailsLike {
  name?: string | null;
  address?: unknown;
}

// Minimal shape of the Checkout Session fields we read.
export interface CheckoutSessionLike {
  id: string;
  payment_intent?: string | null;
  customer?: string | null;
  customer_email?: string | null;
  customer_details?: { email?: string | null; phone?: string | null; name?: string | null } | null;
  amount_total?: number | null;
  total_details?: { amount_tax?: number | null } | null;
  currency?: string | null;
  payment_status?: string | null;
  shipping_details?: ShippingDetailsLike | null;
  // Newer Stripe API versions move shipping under collected_information.
  collected_information?: { shipping_details?: ShippingDetailsLike | null } | null;
  // deno-lint-ignore no-explicit-any
  metadata?: Record<string, any> | null;
}

export interface ResolvedProduct {
  sku: string;
  isFounding: boolean;
}

async function productBySku(
  db: Db,
  sku: string,
): Promise<{ id: string; name: string | null; founding_price_cents: number; retail_price_cents: number; is_preorder: boolean } | null> {
  const { data } = await db.from('products')
    .select('id, name, founding_price_cents, retail_price_cents, is_preorder')
    .eq('sku', sku).maybeSingle();
  return data ?? null;
}

/**
 * Record a completed preorder/in-stock Checkout Session. Idempotent: the order upsert is
 * keyed on stripe_checkout_session_id and message dispatch is guarded by message_log.
 * `product` is resolved by the webhook from the checkout metadata (preorder_sku +
 * is_founding). Destination state is data-driven off products.is_preorder at the moment
 * the webhook lands: true -> preorder_hold (preorder confirmation), false ->
 * ready_to_fulfill (in-stock order confirmation). Messages stay bound to the transition
 * edges, never to the flag itself.
 */
export async function recordPreorderFromSession(
  db: Db,
  session: CheckoutSessionLike,
  product: ResolvedProduct,
): Promise<void> {
  const email = (session.customer_details?.email ?? session.customer_email ?? '').toLowerCase().trim();
  const phone = session.customer_details?.phone ?? null;
  const smsConsent = session.metadata?.sms_consent === 'true' || session.metadata?.sms_consent === true;
  const shipping = session.shipping_details ?? session.collected_information?.shipping_details ?? null;

  const prod = await productBySku(db, product.sku);

  const order = {
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
    stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
    status: 'paid' as OrderStatus,
    customer_email: email,
    customer_phone: phone,
    shipping_name: shipping?.name ?? session.customer_details?.name ?? null,
    shipping_address: shipping?.address ?? null,
    lookup_key: product.sku,
    product_label: prod?.name ?? product.sku,
    amount_total_cents: session.amount_total ?? null,
    tax_cents: session.total_details?.amount_tax ?? null,
    currency: session.currency ?? 'usd',
    payment_status: session.payment_status ?? null,
    sms_consent: smsConsent,
    is_preorder: prod ? prod.is_preorder !== false : true, // origin marker for the broadcast list
    raw: session,
  };

  const { id: orderId, created } = await upsertOrderPaid(db, order);
  if (!created) return; // already recorded (idempotent)

  if (prod) {
    await addOrderItem(db, {
      order_id: orderId,
      product_id: prod.id,
      quantity: 1,
      unit_price_cents: product.isFounding ? prod.founding_price_cents : prod.retail_price_cents,
      is_founding: product.isFounding,
    });
  }

  const target: OrderStatus = prod && prod.is_preorder === false ? 'ready_to_fulfill' : 'preorder_hold';
  await transition(db, orderId, target);
}

/** Apply a FULL refund: locate the order by payment_intent and move it to `refunded` (no messages). */
export async function applyRefundByPaymentIntent(db: Db, paymentIntentId: string): Promise<boolean> {
  const order = await getOrderByPaymentIntent(db, paymentIntentId);
  if (!order) return false;
  if (order.status === 'refunded') return true; // idempotent
  await transition(db, order.id, 'refunded');
  return true;
}

/**
 * PARTIAL refund after (or before) shipping: order state is NOT changed and no cancelled/
 * refunded messaging fires. The refund is recorded to message_log as an audit 'note' row
 * keyed by the charge id, so replays of the same charge.refunded event do not duplicate.
 */
export async function logPartialRefund(db: Db, paymentIntentId: string, chargeId: string, amountRefundedCents: number): Promise<boolean> {
  const order = await getOrderByPaymentIntent(db, paymentIntentId);
  if (!order) return false;
  const { data: existing } = await db.from('message_log').select('id')
    .eq('order_id', order.id).eq('template_key', `partial_refund:${chargeId}`).maybeSingle();
  if (existing) return true; // replayed event; already logged
  await logMessage(db, {
    order_id: order.id,
    channel: 'note',
    template_key: `partial_refund:${chargeId}`,
    triggered_by_status: order.status,
    status: 'logged',
    provider_id: `${amountRefundedCents}`,
  });
  console.log(`partial refund logged: order=${order.id} charge=${chargeId} amount=${amountRefundedCents} (state kept: ${order.status})`);
  return true;
}

/**
 * Validated transition: moves status only along an allowed edge, then fires the messages
 * bound to that EDGE. Suppression is a property of state (terminal states fire nothing;
 * a disallowed edge is ignored, not forced).
 */
export async function transition(db: Db, orderId: string, to: OrderStatus): Promise<void> {
  const order = await getOrderById(db, orderId);
  if (!order) throw new Error(`transition: order ${orderId} not found`);
  if (order.status === to) return;
  if (!canTransition(order.status, to)) {
    console.warn(`transition: ignoring disallowed ${order.status} -> ${to} for ${orderId}`);
    return;
  }
  const from = order.status;
  await setOrderStatus(db, orderId, to);
  await dispatchTransitionMessages(db, { ...order, status: to }, to, from);
}
