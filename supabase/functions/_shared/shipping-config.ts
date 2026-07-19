// supabase/functions/_shared/shipping-config.ts
//
// Flat-tier shipping model (decision brief 1B, approved 2026-07-02) + physical helpers.
// Customer-facing shipping stays FLAT (tiers live on products.shipping_tier_cents);
// actual postage is whatever EasyPost charges at label purchase and is recorded on the
// order (shipping_cost_cents) so flat-vs-actual margin is measured, not guessed.

import { EpParcel } from './easypost.ts';

export const GRAMS_PER_OUNCE = 28.3495;
export const CM_PER_INCH = 2.54;

/** Ship-from address, stored as one JSON secret so no address lives in code.
 * SHIP_FROM_JSON example:
 * {"name":"Eden's Table (Rooted in Faith Ventures LLC)","street1":"...","city":"...","state":"TN","zip":"...","phone":"..."}
 */
// deno-lint-ignore no-explicit-any
export function shipFromAddress(): any {
  const raw = Deno.env.get('SHIP_FROM_JSON');
  if (!raw) throw new Error('SHIP_FROM_JSON missing (set the warehouse/ship-from address secret)');
  return JSON.parse(raw);
}

export interface ShippableItem {
  quantity: number;
  weight_grams: number | null;
  package_length_cm: number | null;
  package_width_cm: number | null;
  package_height_cm: number | null;
  shipping_tier_cents: number | null;
  sku?: string;
}

/**
 * BLENDED MIXED-CART RATE (the documented formula):
 *   customer shipping = MAX(shipping_tier_cents of any item in the order).
 * Kit present -> kit tier; notebooks ride inside the kit box for $0 extra (the added
 * weight stays inside the same carrier weight class). Notebook-only order -> notebook
 * tier regardless of notebook count (they share one mailer). Always ONE shipment.
 */
export function calculateOrderShippingCents(items: ShippableItem[]): number {
  return items.reduce((mx, it) => Math.max(mx, it.shipping_tier_cents ?? 0), 0);
}

/**
 * Single combined parcel for the (possibly mixed) order: weights sum across items and
 * quantities; dimensions are the largest box among the items (the kit box dominates and
 * everything else rides inside it). Converted to EasyPost units (inches / ounces).
 * Throws if any item is missing physicals: buying a mispriced label is worse than
 * stopping the queue.
 */
export function combinedParcel(items: ShippableItem[]): EpParcel {
  if (items.length === 0) throw new Error('combinedParcel: no items');
  let grams = 0;
  let l = 0, w = 0, h = 0;
  for (const it of items) {
    if (!it.weight_grams || !it.package_length_cm || !it.package_width_cm || !it.package_height_cm) {
      throw new Error(`Product ${it.sku ?? '(unknown)'} is missing weight/dimensions; set them on the products table before buying labels`);
    }
    grams += it.weight_grams * (it.quantity || 1);
    if (Number(it.package_length_cm) > l) l = Number(it.package_length_cm);
    if (Number(it.package_width_cm) > w) w = Number(it.package_width_cm);
    if (Number(it.package_height_cm) > h) h = Number(it.package_height_cm);
  }
  return {
    length: round1(l / CM_PER_INCH),
    width: round1(w / CM_PER_INCH),
    height: round1(h / CM_PER_INCH),
    weight: round1(grams / GRAMS_PER_OUNCE),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
