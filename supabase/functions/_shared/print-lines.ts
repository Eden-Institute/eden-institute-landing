// supabase/functions/_shared/print-lines.ts
//
// Stripe's expanded print-shop line items back to our cart lines (2026-09-26).
// Lives here, not in stripe-webhook/index.ts, so it can be unit tested (that file
// starts a server on import). Pure: no network, no database.
//
// Voice rule: no em dashes.

import type { ResolvedLineItem } from './order-flow.ts';

export interface PrintProductKeys {
  sku: string;
  stripe_retail_price_id: string | null;
  stripe_lookup_key: string | null;
}

/**
 * Stripe's expanded line items -> one ResolvedLineItem PER SKU, or null when any
 * line cannot be placed (the caller then falls back to print_cart metadata).
 *
 * Why merge (2026-09-26): create-checkout charges an add-on past its volume
 * threshold as TWO Stripe lines (5 x the Price + 2 x inline price_data on the
 * same Stripe product). order_items is UNIQUE(order_id, product_id) and
 * addOrderItem ignores a duplicate, so writing two rows would silently drop the
 * second and Lulu would print 5 notebooks for a 7-notebook order. One row per
 * SKU with the summed quantity and the BASE unit price; the receipt splits it
 * back with the same tier rule (receipt.ts receiptLinesForItems).
 *
 * In the bundle the 5 base-price notebooks are shared across both bands, so one
 * band can be charged ONLY as an inline volume line. That line has no base line
 * to borrow its SKU from, so this returns null and the webhook uses print_cart
 * metadata (right quantities; unit price = the products row, which the receipt
 * splits the same way). Never a guess.
 */
// deno-lint-ignore no-explicit-any
export function mergePrintLines(lines: any[], products: PrintProductKeys[]): ResolvedLineItem[] | null {
  const byPrice = new Map<string, string>()
  const byLookup = new Map<string, string>()
  for (const p of products) {
    if (p.stripe_retail_price_id) byPrice.set(p.stripe_retail_price_id, p.sku)
    if (p.stripe_lookup_key) byLookup.set(p.stripe_lookup_key, p.sku)
  }
  const productOf = (price: { product?: unknown } | null | undefined): string | null =>
    typeof price?.product === "string" ? price.product : ((price?.product as { id?: string } | null)?.id ?? null)

  // Pass 1: lines whose Price is ours (stored id or lookup key). These carry the base price.
  const skuByStripeProduct = new Map<string, string>()
  const placed: ({ sku: string; base: boolean } | null)[] = lines.map((li) => {
    const price = li?.price
    const sku = (price?.id && byPrice.get(price.id)) || (price?.lookup_key && byLookup.get(price.lookup_key)) || null
    if (!sku) return null
    const prod = productOf(price)
    if (prod) skuByStripeProduct.set(prod, sku)
    return { sku, base: true }
  })
  // Pass 2: inline volume lines, placed by their Stripe product.
  for (let i = 0; i < lines.length; i++) {
    if (placed[i]) continue
    const prod = productOf(lines[i]?.price)
    const sku = prod ? skuByStripeProduct.get(prod) : undefined
    if (!sku) return null
    placed[i] = { sku, base: false }
  }
  if (lines.length === 0) return null

  const out: ResolvedLineItem[] = []
  for (let i = 0; i < lines.length; i++) {
    const { sku, base } = placed[i]!
    const qty = lines[i]?.quantity ?? 1
    const unit = typeof lines[i]?.price?.unit_amount === "number" ? lines[i].price.unit_amount : null
    const existing = out.find((x) => x.sku === sku)
    if (existing) {
      existing.quantity += qty
      if (base && unit != null) existing.unitPriceCents = unit
    } else {
      out.push({ sku, isFounding: false, quantity: qty, unitPriceCents: base ? unit : null })
    }
  }
  return out
}
