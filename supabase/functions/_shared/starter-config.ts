// supabase/functions/_shared/starter-config.ts
//
// Single source of truth for the Eden's Table Sprouts Starter Unit: a $39 digital
// product carrying weeks 1-6 of the Sprouts (K-2) band (Teacher's Guide, Student
// Notebook and the Read-Aloud storybook), plus the $39 credit toward the $249 kit.
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
 * Master PDFs. These are the SAME objects the founding-partner six-week sample
 * serves, read-only, and they are never written back to.
 *
 * Founder decision 2026-08-26: reuse the existing files rather than cut a second
 * set, so the partner gift and the paid starter unit cannot drift apart. The
 * personalised copies are written to a DIFFERENT bucket (see STARTER_BUCKET), so
 * nothing here is mutated and the 42 founding partners keep exactly the files
 * their existing links already point at.
 *
 * Trade-off worth knowing: because these are shared, re-uploading a partner sample
 * component silently changes what new starter buyers receive. That is usually what
 * you want. If the two ever need to diverge, change the paths here and nothing
 * else moves.
 */
export const STARTER_SOURCE_BUCKET = 'partner-assets';
export const STARTER_MASTERS = {
  teachersGuide: 'sample/edens-table-6wk-teachers-guide.pdf',
  studentNotebook: 'sample/edens-table-6wk-student-notebook.pdf',
  // Added 2026-08-26 (founder decision): the Read-Aloud storybook ships with the
  // paid Starter Unit too. This is the SAME six-week file the founding partners
  // receive, carrying the stories that cover weeks 1 to 6, not the full 36-week
  // book. Confirmed by Camila rather than inferred from the filename.
  readAloud: 'sample/edens-table-6wk-read-aloud.pdf',
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
  const bytes = new Uint8Array(CREDIT_CODE_BODY_LENGTH);
  crypto.getRandomValues(bytes);
  let body = '';
  for (const b of bytes) body += CODE_ALPHABET[b % CODE_ALPHABET.length];
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
