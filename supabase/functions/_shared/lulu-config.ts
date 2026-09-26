// supabase/functions/_shared/lulu-config.ts
//
// Configuration for the Lulu print-on-demand rail.
//
// TWO LAYERS, deliberately:
//   - LULU_BOOKS: the three PRINTABLES (what Lulu manufactures). Each has a
//     Lulu package id, a page count, and its own files / cached printable id
//     (those live in the lulu_printables table, keyed by `key`).
//   - LULU_PRODUCTS: what the SHOP SELLS. Founder decision 2026-09-10: the
//     three books are NOT sold separately; they sell together as ONE set for
//     $249 with a flat $12 shipping charge. So there is one sellable SKU that
//     maps to all three printables, and one order line becomes three Lulu line
//     items.
//
// Price and shipping live in the products table (seeded by migration
// 20260911000100 from that decision); this file never carries a price.
//
// BANDS (2026-09-23). The rail sells more than one band's printed year: Sprouts
// (K-2, the original) and Seedlings (grades 3-5). Every printable and every
// product belongs to exactly one band, and lulu_printables is keyed by
// (band, book_key) since migration 20260923200000. Sprouts is the default
// everywhere a band is not given, so every pre-band caller behaves exactly as
// it did. One order prints ONE band: create-checkout refuses a mixed cart.
// The one exception (2026-09-26) is a product that spans bands on purpose, the
// both-bands bundle (both_bands_print_set, see LuluProduct.parts): a cart with
// the bundle may also carry either band's extra notebooks, and its Lulu job
// prints both bands' books in one parcel.
//
// Voice rule: no em dashes.

// tg/nb/ra: the Eden's Table curriculum books. pb/sj/sg (2026-09-25): the Back to
// Eden book, sold one title at a time: the 6x9 paperback, the Study & Journal
// Edition and the Study Guide (both 8.5x11 coil).
export type LuluBookKey = 'tg' | 'nb' | 'ra' | 'pb' | 'sj' | 'sg';
export const LULU_BOOK_KEYS: readonly LuluBookKey[] = ['tg', 'nb', 'ra', 'pb', 'sj', 'sg'];

// 'bte' is Camila's book Back to Eden (2026-09-25). Not a curriculum band: it has
// its own customer wording everywhere a band name would appear (see isBookBand).
// Kept short and lower-case so it fits the external_id pattern below.
export type LuluBand = 'sprouts' | 'seedlings' | 'bte';
export const LULU_BANDS: readonly LuluBand[] = ['sprouts', 'seedlings', 'bte'];
export const DEFAULT_LULU_BAND: LuluBand = 'sprouts';

/** Customer-facing band facts, used by emails, receipts and the storefront. */
export const LULU_BAND_INFO: Record<LuluBand, { bandName: string; grades: string }> = {
  sprouts: { bandName: 'Sprouts', grades: 'K-2' },
  seedlings: { bandName: 'Seedlings', grades: '3-5' },
  bte: { bandName: 'Back to Eden', grades: '' },
};

/** Read a stored or requested band. Anything unknown, null or absent is Sprouts. */
export function normalizeLuluBand(raw: unknown): LuluBand {
  return raw === 'seedlings' ? 'seedlings' : raw === 'bte' ? 'bte' : 'sprouts';
}

/** True for the Back to Eden book, whose messages, receipts and pages are not curriculum wording. */
export function isBookBand(band: LuluBand): boolean {
  return band === 'bte';
}

export interface LuluBook {
  band: LuluBand;
  key: LuluBookKey;
  /** Title Lulu prints on the job ticket. Should match the cover. */
  title: string;
  /**
   * Lulu POD package id, dotted format. Verified against Lulu's Print API
   * product specification sheet (lulu-print-api-spec-sheet.xlsx, read
   * 2026-09-10): trim . ink . quality . binding . paper . finish.
   * The lulu_printables row may override this; this is the default.
   */
  podPackageId: string;
  /**
   * Interior page count. NULL means the final count is not yet fixed and the
   * lulu_printables row MUST carry it before the book can be submitted.
   */
  pageCount: number | null;
}

// Configuration locked by the founder on 2026-09-06 / 2026-09-09 (Standard
// Color, 80# coated white, gloss cover):
//   Teacher's Guide     US Letter 8.5 x 11, coil bound, 240 pages
//   Student Notebook    US Letter 8.5 x 11, coil bound, 224 pages
//   Read-Aloud          A5 5.83 x 8.27, perfect bound, page count 112
//                       (Lulu requires at least 32 interior pages for
//                       perfect bound; the founder is adding pages).
//
// Spec-sheet rows behind the package ids (base + per page, USD):
//   0850X1100.FC.STD.CO.080CW444.GXX   $6.95 + $0.0635/page, 2 to 470 pages
//   0583X0827.FC.STD.PB.080CW444.GXX   $1.99 + $0.0505/page, 32 to 800 pages
// At 240 pages the Teacher's Guide comes to $22.19, which matches the price the
// founder read off Lulu's calculator on 2026-09-09.
// MATTE covers since 2026-09-25 (founder: "matte everywhere", to match her Lulu
// projects, which are all matte). The last segment is the cover finish: G gloss,
// M matte. Same price on the spec sheet. The lulu_printables rows are switched by
// migration 20260925210000; these defaults only apply to a row with no package id.
const PACKAGE_LETTER_COIL = '0850X1100.FC.STD.CO.080CW444.MXX';
const PACKAGE_A5_PERFECT_BOUND = '0583X0827.FC.STD.PB.080CW444.MXX';

// Back to Eden (founder decisions 2026-09-25, matching her Lulu projects after she
// moved all three to the cheaper papers): the paperback is black and white on 60#
// white uncoated (its interior has no colour on any page), both coil books standard
// colour on 60# white uncoated, matte covers. Spec-sheet rows (base + per page):
//   0600X0900.BW.STD.PB.060UW444.MXX   $1.99 + $0.025/page   186 pp = $6.64
//   0850X1100.FC.STD.CO.060UW444.MXX   $6.95 + $0.0562/page  386 pp = $28.64, 266 pp = $21.90
const PACKAGE_BTE_PAPERBACK = '0600X0900.BW.STD.PB.060UW444.MXX';
const PACKAGE_BTE_COIL = '0850X1100.FC.STD.CO.060UW444.MXX';

// ─── SEEDLINGS PAGE COUNTS: the ONE place to change them ─────────────────────
// Founder decision 2026-09-23: the Seedlings set prints on the SAME packages as
// Sprouts (Teacher's Guide and Student Notebook letter coil bound, Read-Aloud A5
// perfect bound). These counts were read from the assembled Seedlings files on
// 2026-09-23; the Student Notebook is 227 pages (founder 2026-09-24, matching the
// lulu_printables seedlings/nb row). They are only the
// default: a lulu_printables row with its own page_count wins, and that row is
// what Lulu is actually sent. Lulu limits: coil 2 to 470 pages, perfect bound
// 32 to 800 (spec sheet, 2026-09-10).
export const SEEDLINGS_PAGE_COUNTS: Record<'tg' | 'nb' | 'ra', number> = {
  tg: 245,
  nb: 227,
  ra: 160,
};
// ──────────────────────────────────────────────────────────────────────────────

export const LULU_BOOKS: LuluBook[] = [
  {
    band: 'sprouts',
    key: 'tg',
    title: "Eden's Table Sprouts: Teacher's Guide",
    podPackageId: PACKAGE_LETTER_COIL,
    pageCount: 240,
  },
  {
    band: 'sprouts',
    key: 'nb',
    title: "Eden's Table Sprouts: Student Notebook",
    podPackageId: PACKAGE_LETTER_COIL,
    pageCount: 224,
  },
  {
    band: 'sprouts',
    key: 'ra',
    title: "Eden's Table Sprouts: Read-Aloud Storybook",
    podPackageId: PACKAGE_A5_PERFECT_BOUND,
    pageCount: 112,
  },
  {
    band: 'seedlings',
    key: 'tg',
    title: "Eden's Table Seedlings: Teacher's Guide",
    podPackageId: PACKAGE_LETTER_COIL,
    pageCount: SEEDLINGS_PAGE_COUNTS.tg,
  },
  {
    band: 'seedlings',
    key: 'nb',
    title: "Eden's Table Seedlings: Student Notebook",
    podPackageId: PACKAGE_LETTER_COIL,
    pageCount: SEEDLINGS_PAGE_COUNTS.nb,
  },
  {
    band: 'seedlings',
    key: 'ra',
    title: "Eden's Table Seedlings: Read-Aloud Storybook",
    podPackageId: PACKAGE_A5_PERFECT_BOUND,
    pageCount: SEEDLINGS_PAGE_COUNTS.ra,
  },
  // Back to Eden. Page counts read from the final Lulu interiors on 2026-09-25.
  {
    band: 'bte',
    key: 'pb',
    title: 'Back to Eden: A Biblical Foundation for Herbal Healing',
    podPackageId: PACKAGE_BTE_PAPERBACK,
    pageCount: 186,
  },
  {
    band: 'bte',
    key: 'sj',
    title: 'Back to Eden: Study & Journal Edition',
    podPackageId: PACKAGE_BTE_COIL,
    pageCount: 386,
  },
  {
    band: 'bte',
    key: 'sg',
    title: 'Back to Eden: Study Guide',
    podPackageId: PACKAGE_BTE_COIL,
    pageCount: 266,
  },
];

export interface LuluProduct {
  /** products.sku and the Stripe metadata key. */
  sku: string;
  /** Which band's printables this product draws on. */
  band: LuluBand;
  /** Display name for emails and the dashboard. */
  name: string;
  /** Which printables one unit of this product produces. */
  books: LuluBookKey[];
  /** Per-order cap enforced by create-checkout. */
  maxQtyPerOrder: number;
  /**
   * A product that prints books from MORE THAN ONE band (2026-09-26: the
   * both-bands bundle). When present it replaces {band, books} for printing;
   * `band` then only names the first part, for callers that need one band.
   */
  parts?: { band: LuluBand; books: LuluBookKey[] }[];
  /**
   * An add-on (the extra Student Notebooks): sold only in the same order as a
   * set that covers its band, because it ships in the set's parcel and a
   * notebook on its own lands at a loss (founder 2026-09-26). create-checkout
   * enforces it; ESA invoices do not use create-checkout and are not affected.
   */
  addOn?: true;
}

// The sellable products. The set (founder decision 2026-09-10: the three books
// together, never separately) and, since 2026-09-11, an extra Student Notebook
// for siblings at $39.99, printed in the same job and shipped in the same
// parcel. Caps are engineering defaults, not founder rules; raise on request.
// Founder decisions 2026-09-26: extra notebooks up to 100 per order (co-ops),
// with volume pricing from the 6th (products.volume_price_cents, see
// print-pricing.ts). Back to Eden print titles stay at 10 copies each until the
// founder decides how shipping rises on big book orders (2026-09-26).
export const LULU_PRODUCTS: LuluProduct[] = [
  {
    sku: 'sprouts_print_set',
    band: 'sprouts',
    name: 'Sprouts Printed Curriculum Set',
    books: ['tg', 'nb', 'ra'],
    maxQtyPerOrder: 2,
  },
  {
    sku: 'sprouts_nb_print',
    band: 'sprouts',
    name: 'Extra Student Notebook, printed',
    books: ['nb'],
    maxQtyPerOrder: 100,
    addOn: true,
  },
  // Founder decision 2026-09-23: the Seedlings (grades 3-5) printed year, the
  // same three books, $249 like Sprouts. The price lives in the products row,
  // whose stripe_retail_price_id stays NULL until the founder creates the
  // Stripe Price; until then the storefront shows "coming soon" and checkout
  // refuses.
  {
    sku: 'seedlings_print_set',
    band: 'seedlings',
    name: 'Seedlings Printed Curriculum Set',
    books: ['tg', 'nb', 'ra'],
    maxQtyPerOrder: 2,
  },
  // Founder decision 2026-09-24: an extra Seedlings Student Notebook for
  // siblings, $39.99, sold exactly like sprouts_nb_print (same cap, NB-only
  // Lulu line, same parcel). Its products row starts with a NULL
  // stripe_retail_price_id, so the /books box hides the option and checkout
  // refuses it until the founder creates the Stripe Price.
  {
    sku: 'seedlings_nb_print',
    band: 'seedlings',
    name: 'Seedlings Extra Student Notebook, printed',
    books: ['nb'],
    maxQtyPerOrder: 100,
    addOn: true,
  },
  // Founder decision 2026-09-26: both printed years together, $429 + flat $12
  // shipping (vs $498 bought separately). One order, one Lulu job, both bands'
  // three books in one parcel. Price by Stripe lookup key
  // (products.stripe_lookup_key = this SKU); the row ships INACTIVE until the
  // founder creates that Stripe Price, so the /books box shows "coming soon".
  {
    sku: 'both_bands_print_set',
    band: 'sprouts',
    name: 'Sprouts and Seedlings Printed Curriculum Sets',
    books: ['tg', 'nb', 'ra'],
    maxQtyPerOrder: 2,
    parts: [
      { band: 'sprouts', books: ['tg', 'nb', 'ra'] },
      { band: 'seedlings', books: ['tg', 'nb', 'ra'] },
    ],
  },
  // Back to Eden (2026-09-25): each title sells on its own, and a buyer can put
  // the paperback and the Study Guide in one order (one parcel, the higher
  // shipping tier). Prices come from Stripe by lookup key (products.stripe_lookup_key).
  {
    sku: 'bte_paperback_print',
    band: 'bte',
    name: 'Back to Eden, Paperback',
    books: ['pb'],
    maxQtyPerOrder: 10,
  },
  {
    sku: 'bte_study_journal_print',
    band: 'bte',
    name: 'Back to Eden, Study & Journal Edition',
    books: ['sj'],
    maxQtyPerOrder: 10,
  },
  {
    sku: 'bte_study_guide_print',
    band: 'bte',
    name: 'Back to Eden, Study Guide',
    books: ['sg'],
    maxQtyPerOrder: 10,
  },
];

export function luluProductBySku(sku: string): LuluProduct | undefined {
  return LULU_PRODUCTS.find((p) => p.sku === sku);
}

/** What one unit of a product prints, band by band. Single-band products are one part. */
export function luluProductParts(product: LuluProduct): { band: LuluBand; books: LuluBookKey[] }[] {
  return product.parts ?? [{ band: product.band, books: product.books }];
}

/** Every band a SKU prints (one for all but the both-bands bundle). Empty for a non-Lulu SKU. */
export function luluBandsForSku(sku: string | null | undefined): LuluBand[] {
  const product = sku ? luluProductBySku(sku) : undefined;
  if (!product) return [];
  return [...new Set(luluProductParts(product).map((p) => p.band))];
}

/** True for a product whose one unit is a full set (Teacher's Guide + Notebook + Read-Aloud) of `band`. */
function isSetFor(product: LuluProduct, band: LuluBand): boolean {
  return luluProductParts(product).some((p) => p.band === band && p.books.includes('tg') && p.books.includes('ra'));
}

export type CartBandCheck =
  | { ok: true; bands: LuluBand[] }
  | { ok: false; code: 'PRINT_MIXED_BANDS' | 'PRINT_ADDON_NEEDS_SET'; error: string; sku?: string };

/**
 * The band rules for one print cart, shared by create-checkout (before the
 * charge) and buildLuluLineItems (before the print job):
 *   - One band per order, as before 2026-09-26, UNLESS the cart holds a product
 *     that spans bands (the both-bands bundle); then every line must print a band
 *     that product covers. Back to Eden never mixes with the curriculum.
 *   - `requireSetForAddOns` (checkout only): an add-on (extra notebook) needs a
 *     set covering its band in the same cart. The Lulu side does not check this:
 *     ESA invoices sell a notebook on its own and still print through it.
 * `bands` is ordered by first appearance, so a cart led by the bundle reads
 * ['sprouts', 'seedlings'].
 */
export function checkCartBands(skus: string[], opts: { requireSetForAddOns?: boolean } = {}): CartBandCheck {
  const products = skus.map((s) => luluProductBySku(s)).filter((p): p is LuluProduct => !!p);
  const bands: LuluBand[] = [];
  for (const p of products) for (const b of luluBandsForSku(p.sku)) if (!bands.includes(b)) bands.push(b);
  if (bands.length > 1) {
    const spanning = products.filter((p) => luluBandsForSku(p.sku).length > 1);
    const covered = new Set(spanning.flatMap((p) => luluBandsForSku(p.sku)));
    if (spanning.length === 0 || bands.some((b) => !covered.has(b))) {
      return {
        ok: false,
        code: 'PRINT_MIXED_BANDS',
        error: 'The Sprouts and Seedlings sets check out separately, or together as the both-years bundle.',
      };
    }
  }
  if (opts.requireSetForAddOns) {
    for (const p of products) {
      if (!p.addOn) continue;
      if (!products.some((q) => q !== p && isSetFor(q, p.band))) {
        return {
          ok: false,
          code: 'PRINT_ADDON_NEEDS_SET',
          error: 'Extra Student Notebooks are added to a printed set order. Please add the set too.',
          sku: p.sku,
        };
      }
    }
  }
  return { ok: true, bands };
}

/** A band's book by key. `band` defaults to Sprouts, the pre-band behaviour. */
export function luluBookByKey(key: string, band: LuluBand = DEFAULT_LULU_BAND): LuluBook | undefined {
  return LULU_BOOKS.find((b) => b.key === key && b.band === band);
}

/** The band a SKU prints, or null for a SKU that is not on the Lulu rail. */
export function luluBandForSku(sku: string | null | undefined): LuluBand | null {
  if (!sku) return null;
  return luluProductBySku(sku)?.band ?? null;
}

/**
 * The band of a recorded order, from orders.lookup_key (the first cart SKU,
 * written by order-flow). Anything that is not a Lulu SKU, including every
 * order recorded before bands existed, reads as Sprouts.
 */
export function printBandForOrder(order: { lookup_key?: string | null } | null | undefined): LuluBand {
  return luluBandForSku(order?.lookup_key ?? null) ?? DEFAULT_LULU_BAND;
}

/**
 * The band words a print order's messages use: 'Sprouts', 'Seedlings', 'Back to
 * Eden', or 'Sprouts and Seedlings' for the both-bands bundle (2026-09-26).
 * Every single-band order reads exactly as it did before.
 */
export function printBandNameForOrder(order: { lookup_key?: string | null } | null | undefined): string {
  const bands = luluBandsForSku(order?.lookup_key ?? null);
  if (bands.length > 1) return bands.map((b) => LULU_BAND_INFO[b].bandName).join(' and ');
  return LULU_BAND_INFO[printBandForOrder(order)].bandName;
}

/**
 * The external_id put on a Lulu line item, which comes back on the job and is
 * how a returned printable id is cached against the right row. Sprouts keeps the
 * bare book key it has always used ('tg'), so its jobs look exactly as before;
 * other bands are prefixed ('seedlings-tg').
 */
export function luluLineExternalId(band: LuluBand, key: LuluBookKey): string {
  return band === 'sprouts' ? key : `${band}-${key}`;
}

/** Inverse of luluLineExternalId. Null for anything it did not produce. */
export function parseLuluLineExternalId(externalId: string): { band: LuluBand; key: LuluBookKey } | null {
  const isKey = (k: string): k is LuluBookKey => k === 'tg' || k === 'nb' || k === 'ra';
  if (isKey(externalId)) return { band: 'sprouts', key: externalId };
  const m = /^([a-z]+)-(tg|nb|ra|pb|sj|sg)$/.exec(externalId);
  if (!m || m[1] === 'sprouts' || !(LULU_BANDS as readonly string[]).includes(m[1])) return null;
  return { band: m[1] as LuluBand, key: m[2] as LuluBookKey };
}

/** Map key for a lulu_printables row. */
export function printableMapKey(band: LuluBand, key: string): string {
  return `${band}:${key}`;
}

/** The lulu_printables columns the readiness check reads. */
export interface PrintableReadinessRow {
  band?: string | null;
  book_key: string;
  pod_package_id: string | null;
  page_count: number | null;
  interior_url: string | null;
  cover_url: string | null;
  printable_id: string | null;
}

/**
 * Why a band's books cannot be printed right now, one line per problem; empty
 * means every book the band's products use can go to Lulu. The same rule
 * buildLuluLineItems enforces at submit time (a cached printable_id, or a
 * package id, page count and both file URLs), run BEFORE the buyer is charged so
 * a band with missing files is refused at checkout instead of failing after
 * payment. Rows with no band column (before migration 20260923200000) count as
 * Sprouts.
 */
export function printableProblems(band: LuluBand, rows: PrintableReadinessRow[]): string[] {
  const keys = new Set<LuluBookKey>();
  for (const p of LULU_PRODUCTS) {
    for (const part of luluProductParts(p)) if (part.band === band) for (const k of part.books) keys.add(k);
  }
  const problems: string[] = [];
  for (const key of keys) {
    const row = rows.find((r) => normalizeLuluBand(r.band) === band && r.book_key === key);
    if (!row) {
      problems.push(`${band}/${key}: no lulu_printables row`);
      continue;
    }
    if (row.printable_id) continue;
    const book = luluBookByKey(key, band);
    const missing: string[] = [];
    if (!(row.pod_package_id ?? book?.podPackageId)) missing.push('pod_package_id');
    if (!(row.page_count ?? book?.pageCount)) missing.push('page_count');
    if (!row.interior_url) missing.push('interior_url');
    if (!row.cover_url) missing.push('cover_url');
    if (missing.length) problems.push(`${band}/${key}: missing ${missing.join(', ')}`);
  }
  return problems;
}

/** Where the storefront lives. Checkout returns buyers here. */
export const PRINT_SHOP_URL = 'https://edeninstitute.health/books';

/** The Back to Eden book page, where its checkout starts and returns. */
export const BOOK_PAGE_URL = 'https://edeninstitute.health/back-to-eden';

/**
 * Minutes Lulu holds a job before printing. This is the ENTIRE cancellation
 * window: Lulu's terms allow cancelling only during this delay, and once
 * production starts a job cannot be cancelled, changed or refunded. Lulu's
 * maximum is 2880 (48 hours), and that is what we use, so a buyer who emails
 * "wrong address" the next morning can still be caught. The cost is two days
 * of latency on every order.
 */
export const LULU_PRODUCTION_DELAY_MINUTES = 2880;

export const LULU_SHIPPING_LEVELS = [
  'MAIL',
  'PRIORITY_MAIL',
  'GROUND_HD',
  'GROUND_BUS',
  'GROUND',
  'EXPEDITED',
  'EXPRESS',
] as const;
export type LuluShippingLevel = (typeof LULU_SHIPPING_LEVELS)[number];

/** Lulu print job statuses, as documented. */
export const LULU_TERMINAL_STATUSES = ['SHIPPED', 'DELIVERED', 'REJECTED', 'CANCELED', 'ERROR'] as const;

/** Base URL. Production by default; set LULU_API_BASE to https://api.sandbox.lulu.com for the sandbox. */
export function luluApiBase(): string {
  return (Deno.env.get('LULU_API_BASE') ?? 'https://api.lulu.com').replace(/\/$/, '');
}

/**
 * The shipping level every job is submitted with. A founder decision that had
 * not been made when this was written, so it is READ FROM THE ENVIRONMENT and
 * there is deliberately no default: a job cannot be submitted until
 * LULU_SHIPPING_LEVEL is set to one of Lulu's levels. Guessing "MAIL" here
 * would silently pick the slowest, least traceable option for every customer.
 */
export function luluShippingLevel(): LuluShippingLevel {
  const raw = (Deno.env.get('LULU_SHIPPING_LEVEL') ?? '').trim().toUpperCase();
  if (!raw) {
    throw new Error(
      'LULU_SHIPPING_LEVEL is not set. Choose one of ' + LULU_SHIPPING_LEVELS.join(', ') + ' before submitting jobs.',
    );
  }
  if (!(LULU_SHIPPING_LEVELS as readonly string[]).includes(raw)) {
    throw new Error(`LULU_SHIPPING_LEVEL '${raw}' is not a Lulu shipping level (${LULU_SHIPPING_LEVELS.join(', ')})`);
  }
  return raw as LuluShippingLevel;
}

/**
 * The level to fall back to when Lulu does not offer LULU_SHIPPING_LEVEL for a
 * parcel, or null when LULU_SHIPPING_LEVEL_FALLBACK is unset (then nothing
 * changes: every job goes out on the primary level, as before 2026-09-26).
 *
 * Why it exists: Lulu's public shipping-options quote for the Sprouts set (read
 * 2026-09-26, to Clarksville TN) offers MAIL up to the set plus 5 extra
 * notebooks, then stops; from the set plus 6 only GROUND_HD, EXPEDITED and
 * EXPRESS come back. With MAIL configured, a co-op order of 10 or 100 notebooks
 * would be charged and then refused by Lulu. Which level to fall back to is a
 * founder decision, so there is no default here either.
 */
export function luluShippingLevelFallback(): LuluShippingLevel | null {
  const raw = (Deno.env.get('LULU_SHIPPING_LEVEL_FALLBACK') ?? '').trim().toUpperCase();
  if (!raw) return null;
  if (!(LULU_SHIPPING_LEVELS as readonly string[]).includes(raw)) {
    throw new Error(`LULU_SHIPPING_LEVEL_FALLBACK '${raw}' is not a Lulu shipping level (${LULU_SHIPPING_LEVELS.join(', ')})`);
  }
  return raw as LuluShippingLevel;
}

/**
 * Pick the level for one job from the levels Lulu offers for it. The primary
 * level whenever it is offered, or when the offer is unknown (quote failed, or
 * no fallback configured); the fallback only when Lulu offers it and not the
 * primary. If neither is offered the primary is returned and Lulu's refusal is
 * the loud failure, exactly as before.
 */
export function pickShippingLevel(
  primary: LuluShippingLevel,
  fallback: LuluShippingLevel | null,
  offered: readonly string[] | null,
): LuluShippingLevel {
  if (!fallback || !offered || offered.includes(primary)) return primary;
  return offered.includes(fallback) ? fallback : primary;
}

/** Contact email Lulu writes to about a job. The shop owner, never the buyer. */
export function luluContactEmail(): string {
  return Deno.env.get('FOUNDER_EMAIL') ?? 'hello@edeninstitute.health';
}
