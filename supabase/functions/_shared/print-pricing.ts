// supabase/functions/_shared/print-pricing.ts
//
// Volume pricing and shipping for printed add-ons (founder decisions 2026-09-26,
// the co-op notebook tier):
//   - Extra Student Notebooks: the first 5 in an ORDER are the normal price
//     ($39.99) and every one after that is the volume price ($32). In the
//     both-bands bundle the 5 are counted ACROSS both bands' notebooks, not per
//     band. Only as add-ons shipped with a set; create-checkout enforces that.
//   - Shipping (founder rule, same day): "whatever covers my cost, I don't want
//     to pay any of the shipping". SHIPPING_RULES below, a base per order plus a
//     per-unit amount, plus a ground surcharge for heavy curriculum parcels. Fitted
//     to Lulu's public shipping quotes and verified cart by cart against them (see
//     SHIPPING_RULES and testdata/lulu-shipping-quotes-2026-09-26.json).
//
// PURE AND DEPENDENCY-FREE on purpose. Imported by:
//   - create-checkout   the Stripe lines it charges and the shipping amount
//   - BookCheckoutController / back-to-eden.astro   the Back to Eden shipping shown
//   - receipt.ts        the receipt rows
//   - PrintBuyBox.tsx   what the buyer sees before checkout
//   - src/test/printVolumePricing.test.ts (vitest) and the Deno tests
// so the buyer, Stripe and the receipt can never disagree about the math.
//
// The item prices are not in this file: retail_price_cents, volume_price_cents
// and volume_min_qty come from the products row. The shipping rules ARE here,
// because they are one formula over the whole cart, not a per-product price.
//
// Voice rule: no em dashes.

export interface PriceTierPart {
  /** How many units at this price. Always at least 1. */
  qty: number;
  /** Unit price in cents. */
  unitCents: number;
  /** 'base' = the product's normal price, 'volume' = the volume price. */
  tier: 'base' | 'volume';
}

export interface TierLine {
  /** Identifies the line in the result (the SKU). */
  key: string;
  qty: number;
  baseCents: number;
  volumeCents?: number | null;
  volumeMinQty?: number | null;
}

/** True when a row's volume tier is complete and sensible (lower price, threshold of at least 2). */
function hasTier(baseCents: number, volumeCents: number | null | undefined, volumeMinQty: number | null | undefined): boolean {
  return typeof volumeCents === 'number' && Number.isInteger(volumeCents) && volumeCents > 0 && volumeCents < baseCents &&
    typeof volumeMinQty === 'number' && Number.isInteger(volumeMinQty) && volumeMinQty >= 2;
}

/**
 * Split every line of one order into base-price and volume-price parts, with
 * ONE shared allowance of base-price units across all tiered lines (founder
 * 2026-09-26: "the first 5 extra notebooks across both bands are $39.99").
 *
 * The allowance is (volume_min_qty - 1), the smallest among the tiered lines.
 * It is handed out in SKU order (alphabetical), never request order, so
 * create-checkout, the receipt and the buy box always split the same way. With
 * one tiered line (a single-band cart) this is exactly the per-line rule.
 *
 * A line with no tier, or a half-configured or nonsensical one (volume price not
 * lower than base, threshold below 2), is all base price and does not use the
 * allowance: a bad row can never charge MORE, and never less than intended.
 * Lines with a quantity below 1 get [].
 */
export function splitVolumeTierPooled(lines: TierLine[]): Map<string, PriceTierPart[]> {
  const out = new Map<string, PriceTierPart[]>();
  const tiered = lines.filter((l) => hasTier(l.baseCents, l.volumeCents, l.volumeMinQty));
  let allowance = tiered.length ? Math.min(...tiered.map((l) => (l.volumeMinQty as number) - 1)) : 0;
  for (const l of [...lines].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))) {
    if (!Number.isInteger(l.qty) || l.qty < 1) {
      out.set(l.key, []);
      continue;
    }
    if (!hasTier(l.baseCents, l.volumeCents, l.volumeMinQty)) {
      out.set(l.key, [{ qty: l.qty, unitCents: l.baseCents, tier: 'base' }]);
      continue;
    }
    const baseQty = Math.min(l.qty, allowance);
    allowance -= baseQty;
    const parts: PriceTierPart[] = [];
    if (baseQty > 0) parts.push({ qty: baseQty, unitCents: l.baseCents, tier: 'base' });
    if (l.qty > baseQty) parts.push({ qty: l.qty - baseQty, unitCents: l.volumeCents as number, tier: 'volume' });
    out.set(l.key, parts);
  }
  return out;
}

/** One line on its own (a single-band cart): the pooled rule with one line. */
export function splitVolumeTier(
  qty: number,
  baseCents: number,
  volumeCents: number | null | undefined,
  volumeMinQty: number | null | undefined,
): PriceTierPart[] {
  return splitVolumeTierPooled([{ key: 'x', qty, baseCents, volumeCents, volumeMinQty }]).get('x') ?? [];
}

/** Total cents for `qty` units of one line under the tier rule. */
export function volumeTierTotal(
  qty: number,
  baseCents: number,
  volumeCents: number | null | undefined,
  volumeMinQty: number | null | undefined,
): number {
  return splitVolumeTier(qty, baseCents, volumeCents, volumeMinQty).reduce((n, p) => n + p.qty * p.unitCents, 0);
}

/** Total cents for several lines sharing one allowance. */
export function pooledTierTotal(lines: TierLine[]): number {
  let n = 0;
  for (const parts of splitVolumeTierPooled(lines).values()) for (const p of parts) n += p.qty * p.unitCents;
  return n;
}

// ── Shipping (founder 2026-09-26: cover Lulu's cost, every cart) ─────────────
//
// shipping = the lead line's base
//          + perExtra for every other unit in the cart (the lead line's own
//            first unit is the one the base covers)
//          + GROUND_SURCHARGE_CENTS when a curriculum parcel is too heavy for MAIL
//            (likelyNeedsGround), because Lulu then ships it GROUND_HD
// The lead line is the one with the highest rank, then the highest base (the
// bundle, else a set, else a book title).
//
// HOW THE NUMBERS WERE CHOSEN. Lulu's public shipping-options quote (read-only,
// 2026-09-26) for every cart the buy boxes allow: each set, 2 sets, the bundle and
// 2 bundles with 0 to 100 extra notebooks (0 to 200 for bundles), every notebook
// count; each Back to Eden title x1 to x10; paperback + Study Guide. The job's
// level is MAIL when Lulu offers it, else GROUND_HD (LULU_SHIPPING_LEVEL_FALLBACK).
// Cost covered = Lulu shipping + its $0.75 per-job fulfillment fee
// (migration 20260911220000) + 10% for the sales tax Lulu charges on them, and
// the charge also pays Stripe's fee on itself: 6%, the worst of the methods this
// checkout accepts (cards 2.9%, Klarna 5.99%, Affirm and Afterpay 6%; stripe.com
// pricing read 2026-09-26; the 30c per charge is on the order, not the shipping
// line). So charge >= (shipping + 0.75) x 1.10 / 0.94 on every cart. Lulu
// priced every cart the same to TN, CA, NY, TX, FL, WA, ME, MT, AK, HI and an APO
// address. Bases are whole dollars and per-unit amounts round quarters, the
// smallest that clear every cart. The Deno test re-checks all 837 quoted carts.
//
// Kept from before because they already cover: $12 for a set, $10 for one coil
// book. Raised: one paperback $6 -> $8 (Lulu MAIL $5.69 + $0.75 fee is $6.44).
// The bundle base is $16 rather than $14 because a $14 base would need a $17
// ground surcharge on every heavy order to cover the heavy bundle carts.

export interface ShippingRule {
  /** Charged once, for the first unit of the lead line. */
  baseCents: number;
  /** Charged for every other unit of this SKU in the cart. */
  perExtraCents: number;
  /** Picks the lead line: highest rank, then highest base. */
  rank: number;
}

export const SHIPPING_RULES: Record<string, ShippingRule> = {
  both_bands_print_set: { baseCents: 1600, perExtraCents: 425, rank: 3 },
  sprouts_print_set: { baseCents: 1200, perExtraCents: 200, rank: 2 },
  seedlings_print_set: { baseCents: 1200, perExtraCents: 200, rank: 2 },
  // Add-ons: never the lead in a cart checkout allows (they need a set). The base
  // only matters if one ever reached here alone, and then it is the set's $12.
  sprouts_nb_print: { baseCents: 1200, perExtraCents: 75, rank: 0 },
  seedlings_nb_print: { baseCents: 1200, perExtraCents: 75, rank: 0 },
  bte_paperback_print: { baseCents: 800, perExtraCents: 125, rank: 1 },
  bte_study_guide_print: { baseCents: 1000, perExtraCents: 250, rank: 1 },
  bte_study_journal_print: { baseCents: 1000, perExtraCents: 250, rank: 1 },
};

/** Added when a curriculum parcel is too heavy for MAIL (it ships GROUND_HD). */
export const GROUND_SURCHARGE_CENTS = 1500;

/**
 * The shipping charge for one print cart, in cents, or null when any SKU has no
 * rule (the caller refuses the checkout rather than guess an amount).
 */
export function printShippingCents(items: { sku: string; qty: number }[]): number | null {
  const lines = items.filter((i) => Number.isInteger(i.qty) && i.qty > 0);
  if (lines.length === 0) return 0;
  if (lines.some((l) => !SHIPPING_RULES[l.sku])) return null;
  let lead = lines[0];
  for (const l of lines) {
    const a = SHIPPING_RULES[l.sku], b = SHIPPING_RULES[lead.sku];
    if (a.rank > b.rank || (a.rank === b.rank && a.baseCents > b.baseCents)) lead = l;
  }
  let total = SHIPPING_RULES[lead.sku].baseCents;
  for (const l of lines) total += SHIPPING_RULES[l.sku].perExtraCents * (l.qty - (l === lead ? 1 : 0));
  // Curriculum only: the Back to Eden per-copy amounts already cover ground.
  if (curriculumNeedsGround(lines)) total += GROUND_SURCHARGE_CENTS;
  return total;
}

// ── Parcel weight, for the "ships by ground" note (display only) ─────────────
//
// Lulu's public shipping quote (2026-09-26, to Clarksville TN) stops offering
// MAIL once a parcel passes roughly a set plus 5 notebooks. Measured edges:
//   MAIL offered:     Sprouts set + 5 NB, 2 Sprouts sets + 2 NB, bundle + 2 NB
//   MAIL not offered: Sprouts set + 6 NB, Seedlings set + 5 NB, bundle + 3 NB, 2 bundles
// Weight is modelled as letter-page equivalents (an A5 page is 0.5157 of a
// letter page). The boundary falls between 1642 (Sprouts + 5 NB, offered) and
// 1690 (Seedlings + 5 NB, refused); 1650 sits inside it. It matched Lulu's
// MAIL / no-MAIL answer on every one of the 836 curriculum carts quoted. It decides
// the buy-box note and the ground surcharge; the level a job really ships on is
// decided by Lulu's live quote at submit time (LULU_SHIPPING_LEVEL_FALLBACK).
// Page counts mirror LULU_BOOKS / SEEDLINGS_PAGE_COUNTS in lulu-config.ts; a
// Deno test fails if they drift.

const A5_TO_LETTER = (5.83 * 8.27) / (8.5 * 11);
const SPROUTS_SET_PAGES = 240 + 224 + 112 * A5_TO_LETTER;
const SEEDLINGS_SET_PAGES = 245 + 227 + 160 * A5_TO_LETTER;

/** Letter-page equivalents of one unit of each curriculum SKU. */
export const PARCEL_PAGE_EQUIV: Record<string, number> = {
  sprouts_print_set: SPROUTS_SET_PAGES,
  seedlings_print_set: SEEDLINGS_SET_PAGES,
  both_bands_print_set: SPROUTS_SET_PAGES + SEEDLINGS_SET_PAGES,
  sprouts_nb_print: 224,
  seedlings_nb_print: 227,
};

/** Above this many letter-page equivalents Lulu stopped offering MAIL (see above). */
export const MAIL_PARCEL_PAGE_LIMIT = 1650;

/** True when a curriculum order is too heavy for MAIL (it ships GROUND_HD). */
export function curriculumNeedsGround(items: { sku: string; qty: number }[]): boolean {
  let pages = 0;
  for (const it of items) pages += (PARCEL_PAGE_EQUIV[it.sku] ?? 0) * Math.max(0, it.qty);
  return pages > MAIL_PARCEL_PAGE_LIMIT;
}

// Back to Eden prints on lighter paper (60# uncoated), so it has its own scale,
// fitted the same way to Lulu's quotes (2026-09-26): MAIL offered for Study Guide
// x7 (1862) and Study & Journal x5 (1930), refused for Study Guide x8 (2128) and
// Study & Journal x6 (2316); paperback x10 (1074) always MAIL. 6x9 paperback pages
// count at 6x9 / letter = 0.5775.
export const BOOK_PAGE_EQUIV: Record<string, number> = {
  bte_paperback_print: 186 * ((6 * 9) / (8.5 * 11)),
  bte_study_guide_print: 266,
  bte_study_journal_print: 386,
};
export const BOOK_MAIL_PAGE_LIMIT = 2000;

/** True when a Back to Eden order is too heavy for MAIL (it ships GROUND_HD). */
export function bookNeedsGround(items: { sku: string; qty: number }[]): boolean {
  let pages = 0;
  for (const it of items) pages += (BOOK_PAGE_EQUIV[it.sku] ?? 0) * Math.max(0, it.qty);
  return pages > BOOK_MAIL_PAGE_LIMIT;
}

/**
 * True when an order will ship GROUND_HD (no MAIL offered): the buy-box note,
 * and the street-address requirement (no PO box, no APO) in _shared/ship-address.ts.
 */
export function likelyNeedsGround(items: { sku: string; qty: number }[]): boolean {
  return curriculumNeedsGround(items) || bookNeedsGround(items);
}
