// supabase/functions/_shared/order-config.ts
//
// Single source of truth reconciling Stripe Prices with our products, the founding-period
// gate, and the customer-facing ship window. Wiring uses Stripe PRICE IDs directly (like the
// existing deep_dive_guide override), so no Stripe "lookup keys" are required.

export const SHIP_WINDOW = 'Winter 2026';

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
  },
  {
    sku: 'sprouts_notebook',
    name: 'Student Notebook',
    productType: 'notebook',
    foundingPriceId: 'price_1TjktC2NWfYbCZT8voGtwnOg',
    retailPriceId: 'price_1To6Hr2NWfYbCZT86GlPe9PK',
    foundingPriceCents: 1999,
    retailPriceCents: 2499,
  },
];

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
