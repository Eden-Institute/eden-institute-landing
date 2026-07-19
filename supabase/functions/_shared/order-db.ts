// supabase/functions/_shared/order-db.ts
//
// Service-role DB access for the preorder system, via the supabase-js admin client that
// stripe-webhook already constructs (passed in, to reuse its connection and match the
// existing recordHomeschoolOrder write path). Typed against a minimal structural interface
// so we don't couple to a specific supabase-js import specifier.

import { OrderStatus } from './order-state.ts';

// deno-lint-ignore no-explicit-any
export interface Db { from(table: string): any; rpc(fn: string, args?: Record<string, unknown>): any }

export interface OrderRow {
  id: string;
  /** Customer-facing identifier (ET-1001...). The uuid `id` stays internal. */
  order_number: string | null;
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
/**
 * Founding UNITS sold for a product (SUM of line quantities, not a row count), excluding
 * cancelled/refunded orders. A cart line can carry quantity > 1, so a row count would
 * undercount and overshoot the 500-unit founding gate. Lives in SQL
 * (founding_units_sold RPC, migration 20260714120000) because PostgREST cannot SUM here.
 */
export async function countFoundingSold(db: Db, productId: string): Promise<number> {
  const { data, error } = await db.rpc('founding_units_sold', { p_product_id: productId });
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}

export interface FoundingGate {
  sold: number;
  cap: number | null;
  closed: boolean;
}

/**
 * Latch-aware founding gate (founding_gate RPC, migration 20260717170000). Returns the
 * net founding units sold, the cap, and whether the founding window is CLOSED. The RPC
 * stamps products.founding_closed_at the first time sold reaches the cap, so a later
 * refund can never reopen founding pricing: the scarcity claim is a one-way promise.
 * This, not countFoundingSold alone, is what price selection must consult.
 */
export async function getFoundingGate(db: Db, productId: string): Promise<FoundingGate> {
  const { data, error } = await db.rpc('founding_gate', { p_product_id: productId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row.sold !== 'number') throw new Error('founding_gate: no row returned');
  return { sold: row.sold, cap: typeof row.cap === 'number' ? row.cap : null, closed: !!row.closed };
}

// ── Stock ceiling ──────────────────────────────────────────────────────────────

export interface StockGate {
  sold: number;
  /** null = uncapped. */
  cap: number | null;
  /** null when uncapped. */
  remaining: number | null;
  soldOut: boolean;
}

/**
 * Availability for a product (stock_gate RPC, migration 20260719210000).
 *
 * Deliberately NOT latched, unlike the founding gate. Running out of stock is a
 * reversible fact, because a refund frees the unit it consumed; the founding PRICE
 * window is a one-way promise and latches, but availability must be able to reopen.
 *
 * Counts BOTH price tiers: founding_qty_limit (500) only switches price, while
 * stock_qty (1000) is the ceiling on what we can actually ship.
 */
export async function getStockGate(db: Db, productId: string): Promise<StockGate> {
  const { data, error } = await db.rpc('stock_gate', { p_product_id: productId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row.sold !== 'number') throw new Error('stock_gate: no row returned');
  return {
    sold: row.sold,
    cap: typeof row.cap === 'number' ? row.cap : null,
    remaining: typeof row.remaining === 'number' ? row.remaining : null,
    soldOut: !!row.sold_out,
  };
}
