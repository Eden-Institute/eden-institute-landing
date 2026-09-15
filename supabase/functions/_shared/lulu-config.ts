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
// Voice rule: no em dashes.

export type LuluBookKey = 'tg' | 'nb' | 'ra';

export interface LuluBook {
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
export const LULU_BOOKS: LuluBook[] = [
  {
    key: 'tg',
    title: "Eden's Table Sprouts: Teacher's Guide",
    podPackageId: '0850X1100.FC.STD.CO.080CW444.GXX',
    pageCount: 240,
  },
  {
    key: 'nb',
    title: "Eden's Table Sprouts: Student Notebook",
    podPackageId: '0850X1100.FC.STD.CO.080CW444.GXX',
    pageCount: 224,
  },
  {
    key: 'ra',
    title: "Eden's Table Sprouts: Read-Aloud Storybook",
    podPackageId: '0583X0827.FC.STD.PB.080CW444.GXX',
    pageCount: 112,
  },
];

export interface LuluProduct {
  /** products.sku and the Stripe metadata key. */
  sku: string;
  /** Display name for emails and the dashboard. */
  name: string;
  /** Which printables one unit of this product produces. */
  books: LuluBookKey[];
  /** Per-order cap enforced by create-checkout. */
  maxQtyPerOrder: number;
}

// The sellable products. The set (founder decision 2026-09-10: the three books
// together, never separately) and, since 2026-09-11, an extra Student Notebook
// for siblings at $39.99, printed in the same job and shipped in the same
// parcel. Caps are engineering defaults, not founder rules; raise on request.
export const LULU_PRODUCTS: LuluProduct[] = [
  {
    sku: 'sprouts_print_set',
    name: 'Sprouts Printed Curriculum Set',
    books: ['tg', 'nb', 'ra'],
    maxQtyPerOrder: 2,
  },
  {
    sku: 'sprouts_nb_print',
    name: 'Extra Student Notebook, printed',
    books: ['nb'],
    maxQtyPerOrder: 5,
  },
];

export function luluProductBySku(sku: string): LuluProduct | undefined {
  return LULU_PRODUCTS.find((p) => p.sku === sku);
}

export function luluBookByKey(key: string): LuluBook | undefined {
  return LULU_BOOKS.find((b) => b.key === key);
}

/** Where the storefront lives. Checkout returns buyers here. */
export const PRINT_SHOP_URL = 'https://edeninstitute.health/books';

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

/** Contact email Lulu writes to about a job. The shop owner, never the buyer. */
export function luluContactEmail(): string {
  return Deno.env.get('FOUNDER_EMAIL') ?? 'hello@edeninstitute.health';
}
