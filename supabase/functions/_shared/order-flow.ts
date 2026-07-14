// supabase/functions/_shared/order-flow.ts
//
// Orchestration for the preorder lifecycle, called from stripe-webhook. Keeps the webhook
// edit tiny. Records the order from a completed Checkout Session then transitions
// paid -> preorder_hold (which fires confirmation messages); and applies refunds.

import { OrderStatus, canTransition } from './order-state.ts';
import {
  Db,
  addOrderItem,
  getOrderById,
  getOrderByPaymentIntent,
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

// One resolved cart line: sku + founding flag from the webhook (Stripe line_items expansion,
// with checkout metadata as fallback), quantity from the cart, unit price from Stripe when
// the expansion succeeded (billing truth) or the products table otherwise.
export interface ResolvedLineItem {
  sku: string;
  isFounding: boolean;
  quantity: number;
  unitPriceCents?: number | null;
}

async function productBySku(
  db: Db,
  sku: string,
): Promise<{ id: string; name: string | null; founding_price_cents: number; retail_price_cents: number } | null> {
  const { data, error } = await db.from('products')
    .select('id, name, founding_price_cents, retail_price_cents').eq('sku', sku).maybeSingle();
  // A TRANSIENT read failure must throw (webhook 500s, Stripe retries); swallowing it
  // would record the order with paid lines silently missing. Only a genuinely unknown
  // sku (data null, no error) is the caller's skip-with-warning case.
  if (error) throw new Error(`products lookup failed for sku '${sku}': ${error.message}`);
  return data ?? null;
}

/** "Sprouts Complete Kit" / "Sprouts Complete Kit + 2 x Student Notebook" for emails + dashboard. */
function buildProductLabel(lines: { name: string; quantity: number }[]): string {
  return lines
    .map((l) => (l.quantity > 1 ? `${l.quantity} x ${l.name}` : l.name))
    .join(' + ');
}

/**
 * Record a completed preorder Checkout Session (1..N cart lines). Idempotent end to end:
 * the order upsert is keyed on UNIQUE(stripe_checkout_session_id), item inserts on
 * UNIQUE(order_id, product_id), transitions on the state machine, messages on message_log.
 * Items and the transition run even when the order row already existed, so a webhook retry
 * that crashed mid-write finishes the job instead of skipping it.
 */
export async function recordPreorderFromSession(
  db: Db,
  session: CheckoutSessionLike,
  items: ResolvedLineItem[],
): Promise<void> {
  const email = (session.customer_details?.email ?? session.customer_email ?? '').toLowerCase().trim();
  const phone = session.customer_details?.phone ?? null;
  const smsConsent = session.metadata?.sms_consent === 'true' || session.metadata?.sms_consent === true;
  const shipping = session.shipping_details ?? session.collected_information?.shipping_details ?? null;

  const resolved: {
    line: ResolvedLineItem;
    prod: NonNullable<Awaited<ReturnType<typeof productBySku>>>;
  }[] = [];
  for (const line of items) {
    const prod = await productBySku(db, line.sku);
    if (prod) resolved.push({ line, prod });
    else console.error(`recordPreorderFromSession: unknown sku '${line.sku}' on session ${session.id}; line skipped`);
  }

  // Disclaimer acceptance, stamped into metadata by create-checkout at session creation.
  const acceptedShipWindow = session.metadata?.accepted_ship_window === 'true';
  const acceptedFoundingMember = session.metadata?.accepted_founding_member === 'true';

  const order = {
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
    stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
    status: 'paid' as OrderStatus,
    customer_email: email,
    customer_phone: phone,
    shipping_name: shipping?.name ?? session.customer_details?.name ?? null,
    shipping_address: shipping?.address ?? null,
    lookup_key: items[0]?.sku ?? null,
    product_label: resolved.length
      ? buildProductLabel(resolved.map((r) => ({ name: r.prod.name ?? r.line.sku, quantity: r.line.quantity })))
      : items[0]?.sku ?? 'preorder',
    amount_total_cents: session.amount_total ?? null,
    tax_cents: session.total_details?.amount_tax ?? null,
    currency: session.currency ?? 'usd',
    payment_status: session.payment_status ?? null,
    sms_consent: smsConsent,
    is_preorder: true,
    accepted_ship_window: acceptedShipWindow,
    accepted_founding_member: acceptedFoundingMember,
    accepted_ship_window_text: session.metadata?.accepted_ship_window_text ?? null,
    disclaimer_accepted_at: session.metadata?.disclaimer_accepted_at ?? null,
    raw: session,
  };

  const { id: orderId } = await upsertOrderPaid(db, order);

  // Always attempt every line: UNIQUE(order_id, product_id) + addOrderItem's 23505
  // tolerance make this a no-op for lines a previous delivery already wrote.
  for (const { line, prod } of resolved) {
    await addOrderItem(db, {
      order_id: orderId,
      product_id: prod.id,
      quantity: line.quantity,
      unit_price_cents: line.unitPriceCents ??
        (line.isFounding ? prod.founding_price_cents : prod.retail_price_cents),
      is_founding: line.isFounding,
    });
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
  if (order.status === to) {
    // Already at the destination: a webhook retry after a crash BETWEEN the status
    // write and message dispatch lands here, so dispatch must still run or the
    // confirmation email/SMS is permanently lost. message_log dedupes real sends,
    // and terminal states dispatch nothing, so this is replay-safe.
    await dispatchTransitionMessages(db, order, to);
    return;
  }
  if (!canTransition(order.status, to)) {
    console.warn(`transition: ignoring disallowed ${order.status} -> ${to} for ${orderId}`);
    return;
  }
  await setOrderStatus(db, orderId, to);
  await dispatchTransitionMessages(db, { ...order, status: to }, to);
}
