// supabase/functions/_shared/order-flow.ts
//
// Orchestration for the preorder lifecycle, called from stripe-webhook. Keeps the webhook
// edit tiny (one import + one branch). Records the order from a completed Checkout Session
// then transitions paid -> preorder_hold (which fires the confirmation messages); and
// applies refunds (charge.refunded -> refunded, which fires nothing).

import { OrderStatus, canTransition } from './order-state.ts';
import { productForLookupKey } from './order-config.ts';
import {
  Db,
  addOrderItem,
  getOrderById,
  getOrderByPaymentIntent,
  setOrderStatus,
  upsertOrderPaid,
} from './order-db.ts';
import { dispatchTransitionMessages } from './order-messages.ts';

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
  shipping_details?: { name?: string | null; address?: unknown } | null;
  // deno-lint-ignore no-explicit-any
  metadata?: Record<string, any> | null;
}

async function productBySku(
  db: Db,
  sku: string,
): Promise<{ id: string; founding_price_cents: number; retail_price_cents: number } | null> {
  const { data } = await db.from('products')
    .select('id, founding_price_cents, retail_price_cents').eq('sku', sku).maybeSingle();
  return data ?? null;
}

/**
 * Record a completed preorder Checkout Session. Idempotent: the order upsert is keyed on
 * stripe_checkout_session_id and message dispatch is guarded by message_log.
 * `lookupKey` is the resolved Stripe price lookup_key for this session.
 */
export async function recordPreorderFromSession(
  db: Db,
  session: CheckoutSessionLike,
  lookupKey: string,
): Promise<void> {
  const ref = productForLookupKey(lookupKey);
  const email = session.customer_details?.email ?? session.customer_email ?? '';
  const phone = session.customer_details?.phone ?? null;
  const smsConsent = session.metadata?.sms_consent === 'true' || session.metadata?.sms_consent === true;

  const order = {
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: session.payment_intent ?? null,
    stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
    status: 'paid' as OrderStatus,
    customer_email: email,
    customer_phone: phone,
    shipping_name: session.shipping_details?.name ?? session.customer_details?.name ?? null,
    shipping_address: session.shipping_details?.address ?? null,
    lookup_key: lookupKey,
    product_label: ref?.sku ?? lookupKey,
    amount_total_cents: session.amount_total ?? null,
    tax_cents: session.total_details?.amount_tax ?? null,
    currency: session.currency ?? 'usd',
    payment_status: session.payment_status ?? null,
    sms_consent: smsConsent,
    is_preorder: true,
    raw: session,
  };

  const { id: orderId, created } = await upsertOrderPaid(db, order);
  if (!created) return; // already recorded (idempotent)

  if (ref) {
    const prod = await productBySku(db, ref.sku);
    if (prod) {
      await addOrderItem(db, {
        order_id: orderId,
        product_id: prod.id,
        quantity: 1,
        unit_price_cents: session.amount_total ??
          (ref.isFounding ? prod.founding_price_cents : prod.retail_price_cents),
        is_founding: ref.isFounding,
      });
    }
  }

  await transition(db, orderId, 'preorder_hold');
}

/** Apply a refund: locate the order by payment_intent and move it to `refunded` (no messages). */
export async function applyRefundByPaymentIntent(db: Db, paymentIntentId: string): Promise<boolean> {
  const order = await getOrderByPaymentIntent(db, paymentIntentId);
  if (!order) return false;
  if (order.status === 'refunded') return true; // idempotent
  await transition(db, order.id, 'refunded');
  return true;
}

/**
 * Validated transition: moves status only along an allowed edge, then fires the messages
 * bound to the destination state. Suppression is a property of state (terminal states fire
 * nothing; a disallowed edge is ignored, not forced).
 */
export async function transition(db: Db, orderId: string, to: OrderStatus): Promise<void> {
  const order = await getOrderById(db, orderId);
  if (!order) throw new Error(`transition: order ${orderId} not found`);
  if (order.status === to) return;
  if (!canTransition(order.status, to)) {
    console.warn(`transition: ignoring disallowed ${order.status} -> ${to} for ${orderId}`);
    return;
  }
  await setOrderStatus(db, orderId, to);
  await dispatchTransitionMessages(db, { ...order, status: to }, to);
}
