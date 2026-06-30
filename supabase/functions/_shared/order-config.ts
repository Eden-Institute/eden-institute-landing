// supabase/functions/_shared/order-config.ts
//
// Single place that reconciles Stripe lookup_keys with our products and holds the
// customer-facing ship window. CONFIRM the lookup_keys below against the Stripe Prices
// created for launch (a founding + a retail Price per product).

export const SHIP_WINDOW = 'Winter 2026';

export interface ProductRef {
  sku: string;
  isFounding: boolean;
}

// Stripe Price lookup_key -> { product SKU, whether this is the founding price }.
// These must match the lookup_keys set on the Stripe Prices AND the products.sku seed rows.
export const LOOKUP_KEY_TO_PRODUCT: Record<string, ProductRef> = {
  sprouts_kit_founding: { sku: 'sprouts_kit', isFounding: true },
  sprouts_kit_retail: { sku: 'sprouts_kit', isFounding: false },
  sprouts_notebook_founding: { sku: 'sprouts_notebook', isFounding: true },
  sprouts_notebook_retail: { sku: 'sprouts_notebook', isFounding: false },
};

export const PREORDER_LOOKUP_KEYS = Object.keys(LOOKUP_KEY_TO_PRODUCT);

export function productForLookupKey(lookupKey: string | null | undefined): ProductRef | null {
  if (!lookupKey) return null;
  return LOOKUP_KEY_TO_PRODUCT[lookupKey] ?? null;
}
