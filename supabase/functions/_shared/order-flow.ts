// supabase/functions/_shared/order-flow.ts
//
// Orchestration for the order lifecycle, called from stripe-webhook. Keeps the webhook
// edit tiny. Records the order from a completed Checkout Session then transitions it to
// preorder_hold (preorder product) or straight to ready_to_fulfill (in-stock product,
// is_preorder=false); applies full refunds; logs partial refunds without changing state.

import { OrderStatus, canTransition } from './order-state.ts';
import {
  Db,
  OrderRow,
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
): Promise<{ id: string; name: string | null; founding_price_cents: number; retail_price_cents: number; is_preorder: boolean } | null> {
  const { data, error } = await db.from('products')
    .select('id, name, founding_price_cents, retail_price_cents, is_preorder')
    .eq('sku', sku).maybeSingle();
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
 * Record a completed preorder/in-stock Checkout Session (1..N cart lines).
 *
 * Idempotent end to end: the order upsert is keyed on UNIQUE(stripe_checkout_session_id),
 * item inserts on UNIQUE(order_id, product_id), transitions on the state machine, and
 * messages on message_log. Items and the transition run even when the order row already
 * existed, so a webhook retry that crashed mid-write finishes the job instead of skipping it.
 *
 * Destination state is data-driven off products.is_preorder at the moment the webhook
 * lands: true -> preorder_hold (preorder confirmation), false -> ready_to_fulfill
 * (in-stock order confirmation). Messages stay bound to the transition edges, never to
 * the flag itself.
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

  // Any preorder line holds the whole order. Defaults to true when nothing resolved,
  // so an unrecognised sku is never released as if it were in stock.
  const isPreorderOrder = resolved.length
    ? resolved.some((r) => r.prod.is_preorder !== false)
    : true;

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
    // Origin marker for the broadcast list, data-driven off the products actually
    // bought. Any preorder line makes the whole order a preorder: a mixed cart ships
    // as one parcel, so it can only move when every line is ready.
    is_preorder: isPreorderOrder,
    // Acceptance evidence. This is the chargeback and FTC defence: what the buyer was
    // shown, that they accepted it, and when. Do not drop these.
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

  const target: OrderStatus = isPreorderOrder ? 'preorder_hold' : 'ready_to_fulfill';
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
 * The state a replayed order must have arrived from, or null when it cannot be known.
 * Only used by the replay branch of transition(); the normal path knows its own edge.
 */
function inferPriorStatus(order: OrderRow, to: OrderStatus): OrderStatus | null {
  switch (to) {
    case 'preorder_hold': return 'paid';
    case 'ready_to_fulfill': return order.is_preorder === false ? 'paid' : 'preorder_hold';
    case 'label_created': return 'ready_to_fulfill';
    case 'shipped': return 'label_created';
    case 'delivered': return 'shipped';
    default: return null;
  }
}

/**
 * Validated transition: moves status only along an allowed edge, then fires the messages
 * bound to that EDGE. Suppression is a property of state (terminal states fire nothing;
 * a disallowed edge is ignored, not forced).
 */
export async function transition(db: Db, orderId: string, to: OrderStatus): Promise<void> {
  const order = await getOrderById(db, orderId);
  if (!order) throw new Error(`transition: order ${orderId} not found`);
  if (order.status === to) {
    // Already at the destination: a webhook retry after a crash BETWEEN the status
    // write and message dispatch lands here, so dispatch must still run or the
    // confirmation email/SMS is permanently lost. message_log dedupes real sends,
    // and terminal states dispatch nothing, so this is replay-safe.
    //
    // Messages are keyed on the EDGE, and by definition the edge is gone once the
    // status has already moved, so it has to be inferred. Every destination has
    // exactly one predecessor except ready_to_fulfill, which is reachable from paid
    // (bought in stock) or preorder_hold (a released preorder); is_preorder tells
    // those apart. An unrecognised destination sends NOTHING rather than guess,
    // because guessing here means mailing a buyer the wrong stage of their order.
    const inferred = inferPriorStatus(order, to);
    if (inferred) {
      await dispatchTransitionMessages(db, order, to, inferred);
    } else {
      console.warn(`transition: replay into ${to} for ${orderId}; edge not inferable, no messages sent`);
    }
    return;
  }
  if (!canTransition(order.status, to)) {
    console.warn(`transition: ignoring disallowed ${order.status} -> ${to} for ${orderId}`);
    return;
  }
  const from = order.status;
  await setOrderStatus(db, orderId, to);
  await dispatchTransitionMessages(db, { ...order, status: to }, to, from);
}
