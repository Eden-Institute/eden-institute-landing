// supabase/functions/_shared/starter-config.ts
//
// Single source of truth for the Eden's Table Starter Units: $39 digital products
// carrying weeks 1-9 of a band (Teacher's Guide, Student Notebook and the
// Read-Aloud storybook). Since 2026-11-22 (founder decision, see STARTER_BANDS) a
// family-paid Starter of EITHER band earns one $39 credit, single use, never
// expiring, good on that band's printed set or the two-band printed set (and, for
// Sprouts, the Complete Kit when it is on sale again). Until then only Sprouts had a
// credit, and it was good on the kit only.
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
//   - The COUPONS have no lookup-key equivalent, so they come from the environment,
//     one per band (STARTER_BANDS[band].credit.couponEnv). The functions that need
//     one fail loudly rather than falling back to a guess. The original kit-only
//     coupon (STRIPE_STARTER_CREDIT_COUPON_ID) is now LEGACY: nothing new is minted
//     on it, and it is read only to recognise codes minted before 2026-11-22.
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
 *
 * FOUNDER DECISION 2026-11-22: the same $39, from either band's Starter, now also
 * comes off that band's printed set ($249) or the two-band printed set ($429).
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
 *
 * 🛑 2026-11-22: the founder ruled that the credit NEVER expires, and it is now good
 * on the printed sets too. deactivateOutstandingCredits cannot tell a kit-only code
 * from a printed-set code, so flipping this to 'expire_at_cap' would also kill every
 * printed-set credit at the kit cap, against that ruling. starter-credit.test.ts
 * pins 'honour_retail' for that reason.
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
// THE CREDIT IS PER BAND. History: 2026-09-23 the founder ruled "this was for the
// kit only and we are not doing it for seedlings", so Seedlings had `credit: null`.
// FOUNDER DECISION 2026-11-22 (her own taps) replaces that:
//
//   1. A FAMILY-PAID Starter of EITHER band earns ONE $39 credit, single use, that
//      NEVER expires.
//   2. It is good on that band's printed set, the two-band printed set, and (Sprouts
//      only) the Sprouts Complete Kit when it is on sale again. One use: whichever
//      the family buys first.
//   3. Scholarship- or ESA-paid Starters earn none. That stays structural: a credit
//      is minted ONLY by stripe-webhook's paid-Starter path. esa-fulfil (Laws L-29),
//      the print-gift offers (fpea-gift.ts) and founder gifts (starter-gift.ts) queue
//      deliveries without ever touching starter_credits or Stripe.
//
// So both entries now carry a credit, each against its OWN NEW coupon. A coupon's
// applies_to cannot be edited after it is created, which is why the old kit-only
// coupon could not simply be widened. WHAT EACH COUPON MUST BE (Lane 2 creates them
// in Stripe at ship time and sets the env vars; nothing here invents an id):
//
//   amount_off 3900, currency usd, duration 'forever', NO redeem_by, NO coupon-level
//   max_redemptions (each family's promotion code carries max_redemptions 1), and
//   applies_to.products = the Stripe products behind the skus in appliesToSkus:
//     Sprouts   (STRIPE_STARTER_PRINT_CREDIT_COUPON_SPROUTS):
//               sprouts_print_set, both_bands_print_set, sprouts_kit
//               (sprouts_kit is STARTER_KIT_PRODUCT_ID below, the one verified id)
//     Seedlings (STRIPE_STARTER_PRINT_CREDIT_COUPON_SEEDLINGS):
//               seedlings_print_set, both_bands_print_set
//   The printed sets' product ids are not stored in this repo as product ids (the
//   products table holds a Price id or a lookup key per sku), so they are named by
//   sku here. scripts/move-starter-credits-to-print.ts resolves each sku to its
//   Stripe product live and checks the coupon's applies_to against it, read-only,
//   on every dry run.
//
// The codes on these coupons are promotion codes that are NOT bound to a Stripe
// Customer, because the print checkout makes a fresh Customer for every order and a
// bound code would be refused there (promotion_code_customer_mismatch). See the
// enforcement notes at the top of starter-credit.ts for what that trades away.

export type StarterBand = 'sprouts' | 'seedlings';

export interface StarterFileSet {
  teachersGuide: string;
  studentNotebook: string;
  readAloud: string;
}

/** A band's Starter Unit credit. Both bands have one since 2026-11-22. */
export interface StarterCreditConfig {
  cents: number;
  /** Env var holding the coupon id. Read at call time, never defaulted. */
  couponEnv: string;
  /**
   * What the coupon's applies_to.products must cover, named by products.sku. The
   * coupon is the Stripe-side enforcement of this list; create-checkout uses the
   * same list to give a readable refusal before Stripe is called.
   */
  appliesToSkus: readonly string[];
}

/** The Sprouts Complete Kit sku (founding preorder products table). */
export const STARTER_CREDIT_KIT_SKU = 'sprouts_kit';

/**
 * The Sprouts Complete Kit's Stripe product. Verified value (see the header of this
 * file): both kit prices hang off it.
 */
export const STARTER_KIT_PRODUCT_ID = 'prod_UbK7PJQPkKhcnE';

/**
 * The ORIGINAL kit-only coupon (2026-08-26 to 2026-11-22). Nothing is minted on it
 * any more. It is read only to recognise a code minted before 2026-11-22: by
 * create-checkout (a readable refusal for an old code on the print shop) and by the
 * one-off move script (which moves the outstanding ones onto the new coupon).
 */
export const LEGACY_KIT_CREDIT_COUPON_ENV = 'STRIPE_STARTER_CREDIT_COUPON_ID';

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
   * The credit a family-paid purchase earns, or null for none. Null means NO
   * promotion code, NO coupon and NO starter_credits row, ever, for this band.
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
    // FOUNDER DECISION 2026-11-22: the Sprouts printed set, the two-band set, and
    // the Complete Kit when it is on sale again. A NEW coupon (see the registry
    // notes above); the 2026-08-26 kit-only one is LEGACY_KIT_CREDIT_COUPON_ENV.
    credit: {
      cents: STARTER_CREDIT_CENTS,
      couponEnv: 'STRIPE_STARTER_PRINT_CREDIT_COUPON_SPROUTS',
      appliesToSkus: ['sprouts_print_set', 'both_bands_print_set', STARTER_CREDIT_KIT_SKU],
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
    // FOUNDER DECISION 2026-11-22, replacing 2026-09-23's "no credit": the Seedlings
    // printed set and the two-band set. Never the Sprouts set alone, and never the
    // kit (the Complete Kit is a Sprouts product).
    credit: {
      cents: STARTER_CREDIT_CENTS,
      couponEnv: 'STRIPE_STARTER_PRINT_CREDIT_COUPON_SEEDLINGS',
      appliesToSkus: ['seedlings_print_set', 'both_bands_print_set'],
    },
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
 * sellable. A band with a credit needs its coupon, because the credit is minted
 * AFTER payment and a missing coupon would take $39 for a credit we cannot issue.
 * Since 2026-11-22 that is both bands, each on its own new coupon. A band with no
 * credit would need none.
 */
export function missingStarterEnv(band: StarterBand): string[] {
  const credit = STARTER_BANDS[band].credit;
  if (!credit) return [];
  return Deno.env.get(credit.couponEnv) ? [] : [credit.couponEnv];
}

/**
 * What a credit code is, read off its promotion code's coupon id: a band's printed-
 * set credit, a legacy kit-only credit (minted before 2026-11-22), or null when the
 * coupon is none of ours or its env var is unset. Env read at call time.
 *
 * Used only to give a READABLE refusal before Stripe is called. Stripe's coupon
 * scope is the enforcement; null therefore means "let Stripe decide", never "allow".
 */
export type StarterCreditKind = StarterBand | 'legacy_kit';

export function starterCreditKindForCoupon(couponId: string | null | undefined): StarterCreditKind | null {
  if (!couponId) return null;
  for (const b of STARTER_BAND_LIST) {
    const env = STARTER_BANDS[b].credit?.couponEnv;
    if (env && Deno.env.get(env) === couponId) return b;
  }
  if (Deno.env.get(LEGACY_KIT_CREDIT_COUPON_ENV) === couponId) return 'legacy_kit';
  return null;
}

/** The skus a credit of this kind comes off. A legacy code: the kit only. */
export function starterCreditAppliesToSkus(kind: StarterCreditKind): readonly string[] {
  if (kind === 'legacy_kit') return [STARTER_CREDIT_KIT_SKU];
  return STARTER_BANDS[kind].credit?.appliesToSkus ?? [];
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
 *   1. The band's env vars (since 2026-11-22, Seedlings needs its printed-set
 *      credit coupon, STRIPE_STARTER_PRINT_CREDIT_COUPON_SEEDLINGS).
 *   2. The band migration (20260923120000) is applied: starter_deliveries.band
 *      is readable. Without it the webhook's Seedlings delivery insert fails
 *      AFTER payment. Only starter_deliveries is probed: starter_credits has
 *      existed since 2026-08-26 and has no band column.
 *
 * Not called for Sprouts, whose guard is its coupon env only (missingStarterEnv).
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
