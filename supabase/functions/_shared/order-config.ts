// supabase/functions/_shared/order-config.ts
//
// Single source of truth reconciling Stripe Prices with our products, the founding-period
// gate, and the customer-facing ship window. Wiring uses Stripe PRICE IDs directly (like the
// existing deep_dive_guide override), so no Stripe "lookup keys" are required.

// Two dates, and the distinction is load-bearing (founder decision 2026-07-19).
//
// SHIP_TARGET is what we are aiming for and what marketing talks about.
// SHIP_GUARANTEE_TEXT is the BINDING commitment, and it is the one the FTC Mail Order
// Rule clock runs on: miss it by more than 30 days and every order whose buyer does not
// affirmatively consent must be cancelled and refunded (16 CFR 435.2(b)(1)(iii)).
//
// Both must be displayed clearly. If only the target were prominent, a regulator could
// treat the TARGET as the stated shipping time, which would pull the deadline forward by
// two months. Never show one without the other.
//
// The authoritative date also lives in products.ships_on (migration 20260719210000) so a
// later preorder wave carries its own; these constants are the copy for THIS wave.
// Revised 2026-08-26 (founder decision). The first print run moved to spring 2027 so
// kits reach families before the school year starts. TARGET is a SHIP month, not a
// delivery date: shipping in July puts kits in hand before August, which is the goal.
export const SHIP_TARGET = 'July 31, 2027';
export const SHIP_GUARANTEE_TEXT = 'September 30, 2027';
export const SHIP_GUARANTEE_DATE = '2027-09-30';

// What the buyer accepts in the disclaimer checkbox, stamped into session metadata and
// the accepted_ship_window_text column. Carries BOTH dates so the acceptance evidence
// matches exactly what was on screen.
export const SHIP_WINDOW =
  `aiming for ${SHIP_TARGET}, guaranteed on or before ${SHIP_GUARANTEE_TEXT}`;

// Flat shipping per preorder order (founder decision 2026-07-02). Keep the display copy in
// web/components/islands/PreorderBuyBox.tsx and web/pages/preorder.astro in sync if this
// changes. Stripe Tax taxes it via the shipping tax_code set in create-checkout.
export const PREORDER_FLAT_SHIPPING_CENTS = 1200;

// The founding period (founding price for BOTH the kit and the notebook) ends once this many
// founding units of the gate SKU have sold. Founder rule: "Notebook retail after 500 kits".
export const FOUNDING_GATE_SKU = 'sprouts_kit';
export const FOUNDING_GATE_LIMIT = 500;

export interface PreorderProduct {
  sku: string;
  name: string;
  productType: 'kit' | 'notebook';
  foundingPriceId: string;
  retailPriceId: string;
  foundingPriceCents: number;
  retailPriceCents: number;
  // Hard per-order cap enforced by create-checkout (the UI stepper mirrors it).
  // Notebook cap 5 = founder decision 2026-07-14; above that is a co-op conversation.
  maxQtyPerOrder: number;
}

// Phase-1 launch products. Stripe Price IDs provided by the founder 2026-06-30 (confirm LIVE mode).
export const PREORDER_PRODUCTS: PreorderProduct[] = [
  {
    sku: 'sprouts_kit',
    name: 'Sprouts Complete Kit',
    productType: 'kit',
    foundingPriceId: 'price_1Tc7TJ2NWfYbCZT83q4TuxFf',
    retailPriceId: 'price_1To6KC2NWfYbCZT8AHRdC9Gv',
    foundingPriceCents: 24900,
    retailPriceCents: 34900,
    maxQtyPerOrder: 1,
  },
  {
    sku: 'sprouts_notebook',
    name: 'Student Notebook',
    productType: 'notebook',
    foundingPriceId: 'price_1TjktC2NWfYbCZT8voGtwnOg',
    retailPriceId: 'price_1To6Hr2NWfYbCZT86GlPe9PK',
    foundingPriceCents: 1900,
    retailPriceCents: 2499,
    maxQtyPerOrder: 5,
  },
];

// Cart shape create-checkout accepts. Distinct SKUs only; quantity per line.
export interface PreorderCartItem {
  sku: string;
  qty: number;
}

// Future products (recorded, NOT wired into Phase 1):
//   Seedlings Kit: founding price_1Tc7UU2NWfYbCZT8qS41OjNA / retail price_1To6LG2NWfYbCZT8O7XvFE9B
//   Two-Kit Bundle: price_1Tc7YJ2NWfYbCZT8NUEbMmg8

export function preorderProductBySku(sku: string): PreorderProduct | undefined {
  return PREORDER_PRODUCTS.find((p) => p.sku === sku);
}

/** Resolve a Stripe Price ID to { sku, isFounding } (used by reconcile / webhook fallback). */
export function productForPriceId(priceId: string | null | undefined): { sku: string; isFounding: boolean } | null {
  if (!priceId) return null;
  for (const p of PREORDER_PRODUCTS) {
    if (priceId === p.foundingPriceId) return { sku: p.sku, isFounding: true };
    if (priceId === p.retailPriceId) return { sku: p.sku, isFounding: false };
  }
  return null;
}
