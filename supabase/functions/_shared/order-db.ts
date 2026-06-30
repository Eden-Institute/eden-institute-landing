// supabase/functions/_shared/order-db.ts
//
// Service-role DB access for the preorder system, via the supabase-js admin client that
// stripe-webhook already constructs (passed in, to reuse its connection and match the
// existing recordHomeschoolOrder write path). Typed against a minimal structural interface
// so we don't couple to a specific supabase-js import specifier.

import { OrderStatus } from './order-state.ts';

// deno-lint-ignore no-explicit-any
export interface Db { from(table: string): any }

export interface OrderRow {
  id: string;
  customer_email: string;
  customer_phone: string | null;
  shipping_name: string | null;
  product_label: string | null;
  amount_total_cents: number | null;
  currency: string | null;
  sms_consent: boolean;
  status: OrderStatus;
}

// deno-lint-ignore no-explicit-any
function errCode(err: any): string | undefined { return err?.code; }

// ── Event-level idempotency gate ─────────────────────────────────────────────
/**
 * Inserts the event as 'received'; returns proceed=false ONLY if it was already fully
 * processed. An event that exists but is still 'received'/'error' (an in-flight or
 * previously-failed attempt) is allowed to proceed, so a transient failure + Stripe retry is
 * never permanently skipped. (A rare concurrent double-delivery is caught downstream by the
 * order UNIQUE and the message_log partial-unique.)
 */
export async function claimStripeEvent(
  db: Db,
  event: { id: string; type: string; payload?: unknown },
): Promise<{ proceed: boolean }> {
  const { error } = await db.from('stripe_events')
    .insert({ event_id: event.id, type: event.type, payload: event.payload ?? null, status: 'received' });
  if (!error) return { proceed: true };
  if (errCode(error) === '23505') {
    const { data } = await db.from('stripe_events').select('status').eq('event_id', event.id).maybeSingle();
    return { proceed: data?.status !== 'processed' };
  }
  throw error;
}

export async function markEventProcessed(db: Db, eventId: string): Promise<void> {
  await db.from('stripe_events')
    .update({ status: 'processed', processed_at: new Date().toISOString() })
    .eq('event_id', eventId);
}

export async function markEventError(db: Db, eventId: string, message: string): Promise<void> {
  await db.from('stripe_events')
    .update({ status: 'error', error: String(message).slice(0, 2000) })
    .eq('event_id', eventId);
}

// ── Orders ───────────────────────────────────────────────────────────────────
/** Insert the order as `paid`, idempotent on UNIQUE(stripe_checkout_session_id). */
export async function upsertOrderPaid(
  db: Db,
  // deno-lint-ignore no-explicit-any
  order: Record<string, any>,
): Promise<{ id: string; created: boolean }> {
  const ins = await db.from('orders').insert(order).select('id').maybeSingle();
  if (!ins.error && ins.data) return { id: ins.data.id, created: true };
  if (ins.error && errCode(ins.error) === '23505') {
    const ex = await db.from('orders').select('id')
      .eq('stripe_checkout_session_id', order.stripe_checkout_session_id).maybeSingle();
    if (ex.data) return { id: ex.data.id, created: false };
  }
  throw ins.error ?? new Error('upsertOrderPaid: no row returned');
}

export async function addOrderItem(
  db: Db,
  // deno-lint-ignore no-explicit-any
  item: Record<string, any>,
): Promise<void> {
  const { error } = await db.from('order_items').insert(item);
  if (error && errCode(error) !== '23505') throw error; // ignore dup on replay
}

export async function setOrderStatus(db: Db, orderId: string, status: OrderStatus): Promise<void> {
  const { error } = await db.from('orders')
    .update({ status, updated_at: new Date().toISOString() }).eq('id', orderId);
  if (error) throw error;
}

export async function getOrderById(db: Db, orderId: string): Promise<OrderRow | null> {
  const { data } = await db.from('orders').select('*').eq('id', orderId).maybeSingle();
  return (data as OrderRow) ?? null;
}

export async function getOrderByPaymentIntent(db: Db, paymentIntentId: string): Promise<OrderRow | null> {
  const { data } = await db.from('orders').select('*')
    .eq('stripe_payment_intent_id', paymentIntentId).maybeSingle();
  return (data as OrderRow) ?? null;
}

// ── Messages ───────────────────────────────────────────────────────────────────
export async function hasSentMessage(
  db: Db, orderId: string, templateKey: string, status: OrderStatus,
): Promise<boolean> {
  const { data } = await db.from('message_log').select('id')
    .eq('order_id', orderId).eq('template_key', templateKey)
    .eq('triggered_by_status', status).eq('status', 'sent').maybeSingle();
  return !!data;
}

export async function logMessage(db: Db, row: {
  order_id: string;
  channel: 'email' | 'sms';
  template_key: string;
  triggered_by_status: OrderStatus;
  status: 'sent' | 'failed';
  provider_id: string | null;
}): Promise<void> {
  const { error } = await db.from('message_log').insert(row);
  if (error && errCode(error) !== '23505') throw error; // 23505 = slot already claimed in a race; fine
}

// ── Founding-allocation counter ────────────────────────────────────────────────
/** Founding line-items sold for a product, excluding cancelled/refunded orders. */
export async function countFoundingSold(db: Db, productId: string): Promise<number> {
  const { count, error } = await db.from('order_items')
    .select('id, orders!inner(status)', { count: 'exact', head: true })
    .eq('product_id', productId)
    .eq('is_founding', true)
    .not('orders.status', 'in', '("cancelled","refunded")');
  if (error) throw error;
  return count ?? 0;
}
