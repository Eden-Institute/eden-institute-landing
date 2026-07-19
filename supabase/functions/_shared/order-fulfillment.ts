// supabase/functions/_shared/order-fulfillment.ts
//
// Phase 2 fulfillment actions, built ON the Phase 1 spine: every state change goes
// through transition() (validated edges + edge-keyed messages + message_log guard).
// Called from the founder-fulfillment EF (admin queue) and shipping-webhook EF.

import { Db, getOrderById, logMessage as _logMessage } from './order-db.ts';
import { transition } from './order-flow.ts';
import {
  EpAddressInput,
  buyShipment,
  createShipment,
  lowestRate,
  refundShipment,
  verifyAddress,
} from './easypost.ts';
import { ShippableItem, combinedParcel, shipFromAddress } from './shipping-config.ts';

// ── EasyPost event ledger (twin of claimStripeEvent) ──────────────────────────
export async function claimShippingEvent(
  db: Db,
  event: { id: string; type: string; payload?: unknown },
): Promise<{ proceed: boolean }> {
  const { error } = await db.from('shipping_events')
    .insert({ event_id: event.id, type: event.type, payload: event.payload ?? null, status: 'received' });
  if (!error) return { proceed: true };
  // deno-lint-ignore no-explicit-any
  if ((error as any)?.code === '23505') {
    const { data } = await db.from('shipping_events').select('status').eq('event_id', event.id).maybeSingle();
    return { proceed: data?.status !== 'processed' };
  }
  throw error;
}

export async function markShippingEventProcessed(db: Db, eventId: string): Promise<void> {
  await db.from('shipping_events')
    .update({ status: 'processed', processed_at: new Date().toISOString() }).eq('event_id', eventId);
}

export async function markShippingEventError(db: Db, eventId: string, message: string): Promise<void> {
  await db.from('shipping_events')
    .update({ status: 'error', error: String(message).slice(0, 2000) }).eq('event_id', eventId);
}

// ── Batch release (Phase 4 switch) ───────────────────────────────────────────
/**
 * Release every held preorder of a product: preorder_hold -> ready_to_fulfill, firing one
 * preorder_released email/SMS per order via the edge registry. Idempotent end to end:
 * already-released orders fail canTransition and are skipped; re-releases cannot re-send
 * because message_log_sent_once already holds the (order, template, status) slot.
 */
export async function releasePreordersForProduct(
  db: Db,
  sku: string,
): Promise<{ found: number; released: number; failed: number }> {
  const ids = new Set<string>();

  // Branch-0 orders carry lookup_key = sku.
  const byKey = await db.from('orders').select('id').eq('status', 'preorder_hold').eq('lookup_key', sku);
  for (const r of byKey.data ?? []) ids.add(r.id);

  // Belt and braces: match through order_items for any order shape.
  const { data: prod } = await db.from('products').select('id').eq('sku', sku).maybeSingle();
  if (prod) {
    const byItem = await db.from('order_items')
      .select('order_id, orders!inner(status)')
      .eq('product_id', prod.id)
      .eq('orders.status', 'preorder_hold');
    for (const r of byItem.data ?? []) ids.add(r.order_id);
  }

  let released = 0, failed = 0;
  for (const id of ids) {
    try {
      await transition(db, id, 'ready_to_fulfill');
      released++;
    } catch (e) {
      failed++;
      console.error(`release failed for order ${id}:`, e instanceof Error ? e.message : String(e));
    }
  }
  return { found: ids.size, released, failed };
}

/** Release a specific set of held orders (admin bulk-select path). Same guards as above. */
export async function releaseOrders(db: Db, orderIds: string[]): Promise<{ released: number; skipped: number }> {
  let released = 0, skipped = 0;
  for (const id of orderIds) {
    const order = await getOrderById(db, id);
    if (!order || order.status !== 'preorder_hold') { skipped++; continue; }
    await transition(db, id, 'ready_to_fulfill');
    released++;
  }
  return { released, skipped };
}

// ── Address validation ─────────────────────────────────────────────────────
// deno-lint-ignore no-explicit-any
function toEpAddress(order: { shipping_name?: string | null; shipping_address?: any }): EpAddressInput {
  const a = order.shipping_address ?? {};
  return {
    name: order.shipping_name ?? undefined,
    street1: a.line1 ?? '',
    street2: a.line2 ?? undefined,
    city: a.city ?? '',
    state: a.state ?? '',
    zip: a.postal_code ?? '',
    country: a.country ?? 'US',
  };
}

/** Validate the order's shipping address and persist the outcome. Never buys anything. */
export async function validateOrderAddress(
  db: Db,
  orderId: string,
): Promise<{ valid: boolean; errors: string[] }> {
  const order = await getOrderById(db, orderId);
  if (!order) throw new Error(`order ${orderId} not found`);
  if (!order.shipping_address) {
    await db.from('orders').update({
      address_validation_status: 'failed',
      address_validation_error: 'No shipping address on the order',
      updated_at: new Date().toISOString(),
    }).eq('id', orderId);
    return { valid: false, errors: ['No shipping address on the order'] };
  }
  const result = await verifyAddress(toEpAddress(order));
  await db.from('orders').update({
    address_validation_status: result.valid ? 'valid' : 'failed',
    address_validation_error: result.valid ? null : result.errors.join('; ').slice(0, 1000),
    updated_at: new Date().toISOString(),
  }).eq('id', orderId);
  return { valid: result.valid, errors: result.errors };
}

// ── Label purchase (Phase 3) ────────────────────────────────────────────────
async function shippableItemsForOrder(db: Db, orderId: string, lookupKey: string | null): Promise<ShippableItem[]> {
  const { data } = await db.from('order_items')
    .select('quantity, products(sku, weight_grams, package_length_cm, package_width_cm, package_height_cm, shipping_tier_cents)')
    .eq('order_id', orderId);
  // deno-lint-ignore no-explicit-any
  const items: ShippableItem[] = (data ?? []).map((r: any) => ({
    quantity: r.quantity ?? 1,
    sku: r.products?.sku,
    weight_grams: r.products?.weight_grams ?? null,
    package_length_cm: r.products?.package_length_cm ?? null,
    package_width_cm: r.products?.package_width_cm ?? null,
    package_height_cm: r.products?.package_height_cm ?? null,
    shipping_tier_cents: r.products?.shipping_tier_cents ?? null,
  }));
  if (items.length > 0) return items;
  // Legacy orders without order_items rows: fall back to the product referenced by lookup_key.
  if (lookupKey) {
    const { data: prod } = await db.from('products')
      .select('sku, weight_grams, package_length_cm, package_width_cm, package_height_cm, shipping_tier_cents')
      .eq('sku', lookupKey).maybeSingle();
    if (prod) return [{ quantity: 1, ...prod }];
  }
  throw new Error(`order ${orderId} has no shippable items`);
}

export interface LabelResult {
  ok: boolean;
  error?: string;
  labelUrl?: string;
  carrier?: string;
  trackingNumber?: string;
  costCents?: number;
}

/**
 * Phase 3 label purchase, in order:
 *   1. guard: order must be ready_to_fulfill
 *   2. validate address; on failure flag the order (admin shows it) and DO NOT buy
 *   3. one combined parcel (mixed carts ship as a single shipment)
 *   4. buy the lowest rate; capture label URL, carrier, tracking, actual cost
 *   5. transition -> label_created (records the capture; no message on this edge)
 */
export async function buyLabelForOrder(db: Db, orderId: string): Promise<LabelResult> {
  const order = await getOrderById(db, orderId);
  if (!order) return { ok: false, error: 'Order not found' };
  if (order.status !== 'ready_to_fulfill') {
    return { ok: false, error: `Order is ${order.status}; labels can only be bought from ready_to_fulfill` };
  }

  const validation = await validateOrderAddress(db, orderId);
  if (!validation.valid) {
    return { ok: false, error: `Address validation failed: ${validation.errors.join('; ') || 'undeliverable'}` };
  }

  // deno-lint-ignore no-explicit-any
  const lookupKey = (order as any).lookup_key ?? null;
  const items = await shippableItemsForOrder(db, orderId, lookupKey);
  const parcel = combinedParcel(items);

  const shipment = await createShipment(toEpAddress(order), shipFromAddress(), parcel);
  const rate = lowestRate(shipment);
  if (!rate) return { ok: false, error: 'EasyPost returned no rates for this shipment' };

  const bought = await buyShipment(shipment.id, rate.id);
  const labelUrl = bought?.postage_label?.label_url ?? null;
  const trackingNumber = bought?.tracking_code ?? null;
  const trackingUrl = bought?.tracker?.public_url ?? null;
  const carrier = bought?.selected_rate?.carrier ?? rate.carrier ?? null;
  const costCents = Math.round(parseFloat(bought?.selected_rate?.rate ?? rate.rate) * 100);

  if (!labelUrl || !trackingNumber) {
    return { ok: false, error: 'Label purchase returned no label URL or tracking number; check EasyPost dashboard' };
  }

  await db.from('orders').update({
    shipping_label_url: labelUrl,
    shipping_carrier: carrier,
    tracking_number: trackingNumber,
    tracking_url: trackingUrl,
    shipping_cost_cents: costCents,
    easypost_shipment_id: shipment.id,
    updated_at: new Date().toISOString(),
  }).eq('id', orderId);

  await transition(db, orderId, 'label_created');
  return { ok: true, labelUrl, carrier, trackingNumber, costCents };
}

// ── Manual transitions (admin queue) ─────────────────────────────────────────
/**
 * label_created -> shipped. Admin confirms AFTER the carrier has picked up the package.
 * Refuses without a valid label + tracking (a voided label clears both, so a voided order
 * can never be marked shipped). Fires the shipped email/SMS via the edge registry.
 */
export async function markOrderShipped(db: Db, orderId: string): Promise<void> {
  const order = await getOrderById(db, orderId);
  if (!order) throw new Error(`order ${orderId} not found`);
  if (order.status !== 'label_created') throw new Error(`Order is ${order.status}; only label_created orders can be marked shipped`);
  if (!order.shipping_label_url || !order.tracking_number) {
    throw new Error('Order has no valid label/tracking (was the label voided?); buy a new label first');
  }
  await db.from('orders').update({ shipped_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', orderId);
  await transition(db, orderId, 'shipped');
}

/** shipped -> delivered (carrier webhook or manual override). Fires the delivered SMS once. */
export async function markOrderDelivered(db: Db, orderId: string): Promise<void> {
  const order = await getOrderById(db, orderId);
  if (!order) throw new Error(`order ${orderId} not found`);
  if (order.status !== 'shipped') throw new Error(`Order is ${order.status}; only shipped orders can be marked delivered`);
  await db.from('orders').update({ delivered_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', orderId);
  await transition(db, orderId, 'delivered');
}

/**
 * Void the purchased label (EasyPost refund) and return the order to the fulfillment
 * queue: label fields cleared, label_created -> ready_to_fulfill (an edge with no
 * messages). The order can never be marked shipped in this state.
 */
export async function voidOrderLabel(db: Db, orderId: string): Promise<void> {
  const order = await getOrderById(db, orderId);
  if (!order) throw new Error(`order ${orderId} not found`);
  if (order.status !== 'label_created') throw new Error(`Order is ${order.status}; only label_created orders can have their label voided`);
  if (order.easypost_shipment_id) {
    await refundShipment(order.easypost_shipment_id); // carrier refund is async on their side
  }
  await db.from('orders').update({
    shipping_label_url: null,
    shipping_carrier: null,
    tracking_number: null,
    tracking_url: null,
    shipping_cost_cents: null,
    easypost_shipment_id: null,
    updated_at: new Date().toISOString(),
  }).eq('id', orderId);
  await transition(db, orderId, 'ready_to_fulfill');
}

/** Carrier webhook path: resolve an order by tracking number. */
// deno-lint-ignore no-explicit-any
export async function getOrderByTracking(db: Db, trackingNumber: string): Promise<any | null> {
  const { data } = await db.from('orders').select('*').eq('tracking_number', trackingNumber).maybeSingle();
  return data ?? null;
}
