// supabase/functions/_shared/starter-config.ts
//
// Single source of truth for the Eden's Table Starter Units: $39 digital products
// carrying weeks 1-9 of a band (Teacher's Guide, Student Notebook and the
// Read-Aloud storybook). Sprouts buyers also earn a $39 credit toward the kit;
// Seedlings buyers do not (founder decision 2026-09-23, see STARTER_BANDS).
//
// TWO BANDS since 2026-09-23 (founder decision): Sprouts (K-2) and Seedlings
// (grades 3-5). The Sprouts constants below are UNCHANGED and are still exported
// under their original names, so every existing importer and every existing
// Sprouts buyer sees exactly what they saw before. The per-band registry,
// STARTER_BANDS, sits at the bottom of this file and is built FROM those constants
// for Sprouts, so the two can never drift apart.
//
// The three printed CARD SETS stay print-exclusive. That is a product decision, not
// an oversight: they are made to be carried outside and passed around a table.
//
// NO STRIPE OBJECT IDs ARE HARDCODED HERE, deliberately.
//
//   - The PRICE resolves through Stripe's `lookup_key` ("sprouts_starter_unit"),
//     which create-checkout already supports for every other one-off product. The
//     same lookup key is set in test and live, so no ID has to be carried across
//     modes and no ID has to be invented before the live object exists.
//   - The COUPON has no lookup-key equivalent, so it comes from the environment
//     (STRIPE_STARTER_CREDIT_COUPON_ID). The functions that need it fail loudly
//     rather than falling back to a guess.
//
// The one Stripe id below is the KIT PRODUCT, and it is a verified value, read
// off the live API on 2026-08-26: both price_1Tc7TJ2NWfYbCZT83q4TuxFf ($249
// founding) and price_1To6KC2NWfYbCZT8AHRdC9Gv ($349 retail) belong to
// prod_UbK7PJQPkKhcnE. That single fact is what makes the credit survive the
// founding sellout for free: a coupon scoped to the PRODUCT covers both prices,
// so the same code that took $39 off $249 takes $39 off $349 with no migration.

/** Stripe lookup_key and our internal SKU. Same string on purpose. */
export const STARTER_LOOKUP_KEY = 'sprouts_starter_unit';

/** $39.00. The price object is the billing truth; this is for copy and assertions. */
export const STARTER_PRICE_CENTS = 3900;

/**
 * The credit applied to a later kit purchase.
 *
 * FOUNDER DECISION 2026-08-26. The brief contradicted itself, calling the credit
 * both "full credit" and "the difference between $39 and $249" ($210). $210 would
 * have sold a $249 kit for $78 all-in and taken roughly $85,500 out of the print
 * run across 500 units. Camila confirmed $39: the starter price applies to the
 * kit, Eden still nets $249, and the credit costs nothing when it converts.
 */
export const STARTER_CREDIT_CENTS = 3900;

/**
 * Stripe Tax product tax code: books transferred electronically.
 *
 * NOT the physical-goods default (txcd_99999999) that the three physical SKUs use,
 * and not the account preset (txcd_10000000, General - Electronically Supplied
 * Services). txcd_10302000 is the precise code for a downloadable book, which is
 * what a curriculum PDF is, and it is the code the 2026-07-23 tax-code session
 * already recommended for the Deep-Dive Guide.
 *
 * OPEN WITH THE CPA (punch #88): digital books and generic digital goods are taxed
 * differently in a meaningful number of states, so this choice moves real money.
 * It is stated once, here, so changing it is a one-line change plus a Stripe
 * product update, not a hunt.
 */
export const STARTER_TAX_CODE = 'txcd_10302000';

/**
 * What happens to outstanding credits when the 500th founding kit sells.
 *
 * 'honour_retail' (SHIPPED, founder decision 2026-08-26): codes stay live and come
 *   off the $349 retail price. Nothing is deactivated. Chosen because the original
 *   spec, 'expire_at_cap', would remove the founding price and the credit in the
 *   same instant from the people most likely to buy a kit.
 * 'expire_at_cap' (the original brief): every outstanding code is deactivated at
 *   the cap and no new code is issued after it. Fully implemented and tested, one
 *   constant away, so the decision stays reversible.
 */
export type CreditExpiryPolicy = 'honour_retail' | 'expire_at_cap';
export const CREDIT_EXPIRY_POLICY: CreditExpiryPolicy = 'honour_retail';

/** How long a delivered download link stays valid. Spec: roughly 7 days. */
export const DOWNLOAD_URL_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Master PDFs. Read-only; never written back to.
 *
 * FOUNDER DECISION 2026-09-01, and it REVERSES the 2026-08-26 decision above it.
 * These are no longer the partner sample files. The two products are now
 * deliberately different things:
 *
 *   PARTNER GIFT   six components (all three card sets included), SIX weeks.
 *   STARTER UNIT   three components (no card sets),               NINE weeks.
 *
 * Because the week counts differ, one set of files can no longer serve both. The
 * partner lane keeps pointing at the `6wk` objects (api/partner-sample.ts and
 * functions/partner-welcome), so the 42 founding partners' existing links are
 * untouched and keep serving exactly what they were promised.
 *
 * Consequence to know: re-uploading a partner sample component NO LONGER affects
 * starter buyers, and vice versa. The two lanes must now be updated separately.
 */
export const STARTER_SOURCE_BUCKET = 'partner-assets';
export const STARTER_MASTERS = {
  teachersGuide: 'sample/edens-table-9wk-teachers-guide.pdf',
  studentNotebook: 'sample/edens-table-9wk-student-notebook.pdf',
  // The Read-Aloud storybook ships with the paid Starter Unit. This nine-week cut
  // carries FOUR of the year's seven readings (the opening plus stories one to
  // three, at weeks 1, 2, 4 and 7), not the full 36-week book. Verified against
  // the storybook's own contents page, not inferred from the filename.
  readAloud: 'sample/edens-table-9wk-read-aloud.pdf',
} as const;

/** Private bucket holding the per-buyer stamped copies. Never public. */
export const STARTER_BUCKET = 'starter-unit';

/** Customer-facing filenames on the delivered PDFs. */
export const STARTER_FILENAMES = {
  teachersGuide: "Edens-Table-Sprouts-Starter-Teachers-Guide.pdf",
  studentNotebook: "Edens-Table-Sprouts-Starter-Student-Notebook.pdf",
  readAloud: "Edens-Table-Sprouts-Starter-Read-Aloud.pdf",
} as const;

/**
 * The licence line stamped into every page footer and repeated in the email.
 *
 * Spec section 6. Deliberately short enough to fit one footer line at 7pt, and
 * deliberately not threatening: the buyer is a homeschooling parent, not a pirate.
 * No em dashes (house rule).
 */
export const STARTER_LICENSE_LINE =
  'Single household use. Resale, co-op, or classroom use requires a separate licence.';

/** Public URL of the product page, used in emails and the confirmation page. */
export const STARTER_PAGE_URL = 'https://edeninstitute.health/starter';

/**
 * Credit code shape: EDEN-S-XXXXXX.
 *
 * Ambiguous glyphs (0/O, 1/I/L) are excluded because this code gets read off a
 * phone screen and typed into a checkout field on another device. Stripe accepts
 * A-Z, a-z, 0-9 and dashes, and matches case-insensitively.
 */
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const CREDIT_CODE_PREFIX = 'EDEN-S-';
export const CREDIT_CODE_BODY_LENGTH = 6;

export function generateCreditCode(): string {
  // Rejection sampling: bytes >= 248 (the largest multiple of 31 <= 256) are
  // discarded so every symbol is equally likely.
  const limit = 256 - (256 % CODE_ALPHABET.length);
  let body = '';
  const buf = new Uint8Array(16);
  while (body.length < CREDIT_CODE_BODY_LENGTH) {
    crypto.getRandomValues(buf);
    for (const b of buf) {
      if (b < limit && body.length < CREDIT_CODE_BODY_LENGTH) body += CODE_ALPHABET[b % CODE_ALPHABET.length];
    }
  }
  return CREDIT_CODE_PREFIX + body;
}

/** Normalise a code the way both storage and comparison expect. */
export function normalizeCreditCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

/** Normalise an email for the lock check. Lowercase + trim, nothing cleverer. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// THE BAND REGISTRY (2026-09-23)
// ---------------------------------------------------------------------------
//
// One entry per band that has a Starter Unit. Everything that differs between the
// Sprouts and the Seedlings Starter Unit lives here, and nowhere else: the lookup
// key, the master files, the delivered filenames, the page, the copy nouns, and
// whether the band carries a credit at all.
//
// HOW A PURCHASE FINDS ITS BAND. The Stripe lookup_key is the only input. The
// webhook maps it through starterBandForLookupKey, records the band on the
// delivery row (public.starter_deliveries.band, migration 20260923120000), and
// every later step reads the band back from the row. A row with NO band (every
// row written before that migration) is Sprouts, because Sprouts was the only
// Starter Unit that existed: normalizeStarterBand(null) === 'sprouts'.
//
// THE CREDIT IS PER BAND, and only Sprouts has one. FOUNDER DECISION 2026-09-23:
// "this was for the kit only and we are not doing it for seedlings". So the
// Seedlings entry has `credit: null`, and every credit step (minting a promotion
// code, writing starter_credits, looking a code up for the email or the
// downloads page, cancelling one on refund) is skipped for it via
// starterBandHasCredit. The Sprouts credit machinery is untouched.

export type StarterBand = 'sprouts' | 'seedlings';

export interface StarterFileSet {
  teachersGuide: string;
  studentNotebook: string;
  readAloud: string;
}

/** A band's Starter Unit credit. Only Sprouts has one. */
export interface StarterCreditConfig {
  cents: number;
  /** Env var holding the coupon id. Read at call time, never defaulted. */
  couponEnv: string;
  /** The Stripe product the coupon is scoped to (verified value). */
  targetProductId: string;
}

export interface StarterBandConfig {
  band: StarterBand;
  /** Stripe lookup_key AND our internal SKU. Same string on purpose. */
  lookupKey: string;
  /** "Sprouts" / "Seedlings". The only band noun copy should use. */
  bandName: string;
  /** "K-2" / "3-5". */
  grades: string;
  /** Product name for analytics line items. */
  productName: string;
  priceCents: number;
  /** Master PDFs in STARTER_SOURCE_BUCKET. Read-only. */
  masters: StarterFileSet;
  /** Customer-facing filenames on the delivered PDFs. */
  filenames: StarterFileSet;
  /** Public product page. */
  pageUrl: string;
  /** Default Stripe success_url. {CHECKOUT_SESSION_ID} is filled in by Stripe. */
  successUrl: string;
  /**
   * The printed year this band's Starter Unit leads to, for the delivery email.
   * Null when that product is not on sale yet, and the email then says so plainly
   * rather than linking to another band's books.
   */
  printSetUrl: string | null;
  /**
   * The credit a purchase earns, or null for none. Null means NO promotion code,
   * NO coupon and NO starter_credits row, ever, for this band.
   */
  credit: StarterCreditConfig | null;
}

export const STARTER_BANDS: Record<StarterBand, StarterBandConfig> = {
  sprouts: {
    band: 'sprouts',
    lookupKey: STARTER_LOOKUP_KEY,
    bandName: 'Sprouts',
    grades: 'K-2',
    productName: 'Sprouts Starter Unit',
    priceCents: STARTER_PRICE_CENTS,
    masters: STARTER_MASTERS,
    filenames: STARTER_FILENAMES,
    pageUrl: STARTER_PAGE_URL,
    successUrl: 'https://edeninstitute.health/starter/thank-you?session_id={CHECKOUT_SESSION_ID}',
    printSetUrl: 'https://edeninstitute.health/books',
    // Unchanged: the same coupon env var and the verified kit product (see the
    // header of this file) the Sprouts credit has used since 2026-08-26.
    credit: {
      cents: STARTER_CREDIT_CENTS,
      couponEnv: 'STRIPE_STARTER_CREDIT_COUPON_ID',
      targetProductId: 'prod_UbK7PJQPkKhcnE',
    },
  },
  seedlings: {
    band: 'seedlings',
    lookupKey: 'seedlings_starter_unit',
    bandName: 'Seedlings',
    grades: '3-5',
    productName: 'Seedlings Starter Unit',
    priceCents: 3900,
    // Same private bucket as Sprouts. THESE OBJECTS DID NOT EXIST when this was
    // written (2026-09-23); they are uploaded separately. create-checkout refuses
    // to sell the Seedlings Starter Unit while any of the three is missing
    // (missingStarterMasters), and the fulfiller fails the delivery loudly, naming
    // the missing path, rather than sending an email with nothing behind it.
    //
    // The Seedlings Read-Aloud cut carries TWO readings: Story Seven (Week 2) and
    // Story Eight (Week 8). Per the founder brief of 2026-09-23, not inferred from
    // the file.
    masters: {
      teachersGuide: 'sample/edens-table-seedlings-9wk-teachers-guide.pdf',
      studentNotebook: 'sample/edens-table-seedlings-9wk-student-notebook.pdf',
      readAloud: 'sample/edens-table-seedlings-9wk-read-aloud.pdf',
    },
    filenames: {
      teachersGuide: 'Edens-Table-Seedlings-Starter-Teachers-Guide.pdf',
      studentNotebook: 'Edens-Table-Seedlings-Starter-Student-Notebook.pdf',
      readAloud: 'Edens-Table-Seedlings-Starter-Read-Aloud.pdf',
    },
    pageUrl: 'https://edeninstitute.health/starter/seedlings',
    successUrl: 'https://edeninstitute.health/starter/seedlings/thank-you?session_id={CHECKOUT_SESSION_ID}',
    // On sale since 2026-09-24: the #seedlings buy box on /books.
    printSetUrl: 'https://edeninstitute.health/books#seedlings',
    // FOUNDER DECISION 2026-09-23: no credit, no coupon of any kind.
    credit: null,
  },
};

export const STARTER_BAND_LIST: readonly StarterBand[] = ['sprouts', 'seedlings'];

/** Every Starter Unit lookup key, for create-checkout's allow-lists. */
export const STARTER_LOOKUP_KEYS: readonly string[] = STARTER_BAND_LIST.map((b) => STARTER_BANDS[b].lookupKey);

/** The band a lookup key sells, or null when it is not a Starter Unit. */
export function starterBandForLookupKey(lookupKey: string | null | undefined): StarterBand | null {
  if (!lookupKey) return null;
  for (const b of STARTER_BAND_LIST) {
    if (STARTER_BANDS[b].lookupKey === lookupKey) return b;
  }
  return null;
}

/**
 * The band stored on a delivery or credit row.
 *
 * null/undefined means a row written before the band column existed, which can
 * only be Sprouts. Anything else unrecognised THROWS: guessing a band would stamp
 * the wrong curriculum with a buyer's name and email it to them.
 */
export function normalizeStarterBand(raw: unknown): StarterBand {
  if (raw === null || raw === undefined || raw === '') return 'sprouts';
  if (raw === 'sprouts' || raw === 'seedlings') return raw;
  throw new Error(`unknown starter band '${String(raw)}'; refusing to guess`);
}

export function starterConfig(band: StarterBand): StarterBandConfig {
  return STARTER_BANDS[band];
}

/** Whether a purchase of this band earns a credit. False means never touch credits. */
export function starterBandHasCredit(band: StarterBand): boolean {
  return STARTER_BANDS[band].credit !== null;
}

/**
 * Env vars that must be set before a band's Starter Unit may be sold. Empty means
 * sellable. Sprouts needs its coupon, exactly as before. A band with no credit
 * (Seedlings) needs none.
 */
export function missingStarterEnv(band: StarterBand): string[] {
  const credit = STARTER_BANDS[band].credit;
  if (!credit) return [];
  return Deno.env.get(credit.couponEnv) ? [] : [credit.couponEnv];
}

/**
 * Which of a band's master paths are absent, given the object names listed in the
 * master folder. PURE, so the check itself is unit-tested; create-checkout does
 * the listing.
 */
export function missingStarterMasters(band: StarterBand, presentPaths: readonly string[]): string[] {
  const present = new Set(presentPaths);
  return Object.values(STARTER_BANDS[band].masters).filter((p) => !present.has(p));
}

/**
 * What must be true BEFORE a non-Sprouts Starter Unit is sold, checked by
 * create-checkout ahead of creating any Stripe session. Returns problems; empty
 * means sellable. Never throws. Masters are checked separately (needs Storage).
 *
 *   1. The band's env vars (none for Seedlings, which has no credit).
 *   2. The band migration (20260923120000) is applied: starter_deliveries.band
 *      is readable. Without it the webhook's Seedlings delivery insert fails
 *      AFTER payment. Only starter_deliveries is probed: a band with no credit
 *      never reads or writes starter_credits.
 *
 * Not called for Sprouts, whose guard is unchanged (its coupon env only).
 */
// deno-lint-ignore no-explicit-any
export async function starterPrepaymentProblems(db: { from(table: string): any }, band: StarterBand): Promise<string[]> {
  const missing = missingStarterEnv(band);
  if (missing.length) return missing.map((m) => `env ${m} not set`);
  try {
    const { error } = await db.from('starter_deliveries').select('band').limit(0);
    if (error) return [`migration not applied: starter_deliveries.band unreadable (${error.message ?? String(error)})`];
  } catch (err) {
    return [`migration probe on starter_deliveries threw: ${err instanceof Error ? err.message : String(err)}`];
  }
  return [];
}
