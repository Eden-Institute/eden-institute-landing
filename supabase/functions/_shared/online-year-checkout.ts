// supabase/functions/_shared/online-year-checkout.ts
//
// Eden's Table Online Year, OY2 (punch #472): the pure half of the Online Year cart. No I/O
// here, so every rule is unit tested. create-checkout/online-year-checkout.ts does the
// checks that need the database or Stripe; stripe-webhook (OY3, not built yet) will grant
// the licenses from the session metadata written by buildOnlineYearMetadata.
//
// Decided (EdensTable_Digital_License_Plan.md "Decided (Nov 20)" + "Decided (Nov 23)"):
//   - per child, 12 months from purchase, one band per license;
//   - $149 a year for the first child in a band (Teacher's Guide + storybook + that child's
//     Notebook pages), $29 a year for each sibling in the same band;
//   - a sibling year needs an active first-child year in that band (Build ticket OY2): a
//     cart of first child + siblings is fine, a sibling-only cart needs a live license;
//   - child first name or nickname only (the Wired privacy line); children never log in.
//
// Which child is the "first child": the family's live first-child license holder when she
// is in the cart (an early renewal of the $149 year keeps the teacher pages with her);
// otherwise the first name typed, when the family has no live first-child year in that
// band; otherwise nobody (every child in the cart is a $29 sibling).

/** The one lookup_key create-checkout and (OY3) stripe-webhook dispatch on. Never a Stripe price. */
export const ONLINE_YEAR_CART_KEY = 'online_year_cart';

export type OnlineYearBand = 'sprouts' | 'seedlings';
export const ONLINE_YEAR_BANDS: readonly OnlineYearBand[] = ['sprouts', 'seedlings'];

export type OnlineYearKind = 'first_child' | 'sibling';

/** Stripe price lookup keys, one per band and kind (prices decided Nov 23: $149 / $29). */
export const ONLINE_YEAR_PRICE_KEYS: Record<OnlineYearBand, Record<OnlineYearKind, string>> = {
  sprouts: { first_child: 'online_year_sprouts_first_child', sibling: 'online_year_sprouts_sibling' },
  seedlings: { first_child: 'online_year_seedlings_first_child', sibling: 'online_year_seedlings_sibling' },
};

/** Price in cents per kind, for the dry run, the E2E test prices and the tests (Stripe stays the source live). */
export const ONLINE_YEAR_PRICE_CENTS: Record<OnlineYearKind, number> = { first_child: 14900, sibling: 2900 };

/**
 * Product names and descriptions on Stripe's screen: "Approved copy" > "### Checkout" >
 * "Product names" (products2), word for word, with the band name and grades swapped in
 * ("Sprouts shown; Seedlings uses the same words with its band name and grades").
 */
export const ONLINE_YEAR_BAND_LABEL: Record<OnlineYearBand, string> = {
  sprouts: 'Sprouts (K-2)',
  seedlings: 'Seedlings (3-5)',
};
const BAND_WORD: Record<OnlineYearBand, string> = { sprouts: 'Sprouts', seedlings: 'Seedlings' };

export function onlineYearProductName(band: OnlineYearBand, kind: OnlineYearKind): string {
  return `Eden's Table Online Year: ${ONLINE_YEAR_BAND_LABEL[band]}, ${kind === 'first_child' ? 'first child' : 'sibling'}`;
}

export function onlineYearProductDescription(band: OnlineYearBand, kind: OnlineYearKind): string {
  return kind === 'first_child'
    ? `12 months of online access to all 36 weeks of ${BAND_WORD[band]}: the Teacher's Guide, the Read-Aloud Storybook, this child's Notebook pages to print, and their portfolio. For one household.`
    : `12 months of this child's ${BAND_WORD[band]} Notebook pages to print and their own portfolio. Goes with an active first-child Online Year.`;
}

/** "Under the button" (Approved copy > Checkout fields, `agree`), also Stripe's submit message. */
export const ONLINE_YEAR_UNDER_BUTTON =
  'All sales final on digital products. No automatic renewal: we\'ll email you before your year ends.';

/** The required box (Approved copy > Checkout fields, `agree`). */
export const ONLINE_YEAR_AGREEMENT =
  "I understand this is a 12-month license for my household only. It's read online, doesn't download, and can't be shared. Digital purchases are final.";

/** Same 1-40 character limit as online_year_licenses.child_name (OY1 migration). */
export const MAX_CHILD_NAME_LENGTH = 40;
/** A family is never this big in one band in practice; the cap keeps a forged request from building a silly cart. */
export const MAX_ONLINE_YEAR_CHILDREN = 10;

/** Countries at launch (her Nov 23 tap): U.S., Canada and Australia. */
export const ONLINE_YEAR_COUNTRIES = ['US', 'CA', 'AU'] as const;

export function isOnlineYearBand(v: unknown): v is OnlineYearBand {
  return typeof v === 'string' && (ONLINE_YEAR_BANDS as readonly string[]).includes(v);
}

/**
 * A child's first name or nickname, tidied: spaces collapsed, 1-40 characters, at least one
 * letter, and only letters, spaces, hyphens, apostrophes and periods (no digits, no markup).
 * Null when it does not pass.
 */
export function cleanChildName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.normalize('NFC').replace(/\s+/gu, ' ').trim().replace(/’/g, "'");
  if (name.length < 1 || name.length > MAX_CHILD_NAME_LENGTH) return null;
  if (!/\p{L}/u.test(name)) return null;
  if (!/^[\p{L}\p{M}' .-]+$/u.test(name)) return null;
  return name;
}

export interface OnlineYearChild { name: string; kind: OnlineYearKind }

export interface OnlineYearCartPlan {
  band: OnlineYearBand;
  /** In the order she typed them; at most one first_child. */
  children: OnlineYearChild[];
  lines: { lookup_key: string; quantity: number }[];
}

export type OnlineYearPlanError =
  | 'unknown_band'
  | 'no_children'
  | 'too_many_children'
  | 'bad_child_name'
  | 'duplicate_child_name';

/**
 * The cart for one band. `liveFirstChildName` is the child on the family's live (active,
 * not ended) first-child license in this band, or null when there is none.
 */
export function planOnlineYearCart(input: {
  band: unknown;
  childNames: unknown;
  liveFirstChildName: string | null;
}): { ok: true; plan: OnlineYearCartPlan } | { ok: false; error: OnlineYearPlanError } {
  if (!isOnlineYearBand(input.band)) return { ok: false, error: 'unknown_band' };
  const band = input.band;
  if (!Array.isArray(input.childNames) || input.childNames.length === 0) return { ok: false, error: 'no_children' };
  if (input.childNames.length > MAX_ONLINE_YEAR_CHILDREN) return { ok: false, error: 'too_many_children' };

  const names: string[] = [];
  const seen = new Set<string>();
  for (const raw of input.childNames) {
    const name = cleanChildName(raw);
    if (name === null) return { ok: false, error: 'bad_child_name' };
    const key = name.toLowerCase();
    // online_year_licenses has unique (order_id, band, lower(child_name)): one license per child per order.
    if (seen.has(key)) return { ok: false, error: 'duplicate_child_name' };
    seen.add(key);
    names.push(name);
  }

  const live = input.liveFirstChildName ? input.liveFirstChildName.replace(/\s+/gu, ' ').trim().toLowerCase() : null;
  // No live first-child year in this band: the first name typed is the $149 first child, so a
  // sibling year can never be bought alone. A live one: every child is a $29 sibling, except
  // that child herself (renewing her keeps the $149 year, and the teacher pages, with her).
  const firstIndex = live === null ? 0 : names.findIndex((n) => n.toLowerCase() === live);

  const children: OnlineYearChild[] = names.map((name, i) => ({ name, kind: i === firstIndex ? 'first_child' : 'sibling' }));
  const siblings = children.filter((c) => c.kind === 'sibling').length;
  const lines: { lookup_key: string; quantity: number }[] = [];
  if (firstIndex >= 0) lines.push({ lookup_key: ONLINE_YEAR_PRICE_KEYS[band].first_child, quantity: 1 });
  if (siblings > 0) lines.push({ lookup_key: ONLINE_YEAR_PRICE_KEYS[band].sibling, quantity: siblings });
  return { ok: true, plan: { band, children, lines } };
}

/** Sum of a plan in cents at the decided prices (tests + dry run only). */
export function onlineYearPlanCents(plan: OnlineYearCartPlan): number {
  return plan.children.reduce((s, c) => s + ONLINE_YEAR_PRICE_CENTS[c.kind], 0);
}

/**
 * Session + PaymentIntent metadata for OY3's grant: the band, then one key per child
 * (oy_child_1..n = name, oy_kind_1..n = first_child | sibling). Each value is at most 40
 * characters, far under Stripe's 500-character limit, and 10 children use 21 of its 50 keys.
 */
export function buildOnlineYearMetadata(plan: OnlineYearCartPlan): Record<string, string> {
  const md: Record<string, string> = {
    lookup_key: ONLINE_YEAR_CART_KEY,
    oy_band: plan.band,
    oy_children: String(plan.children.length),
  };
  plan.children.forEach((c, i) => {
    md[`oy_child_${i + 1}`] = c.name;
    md[`oy_kind_${i + 1}`] = c.kind;
  });
  return md;
}

/** The reverse of buildOnlineYearMetadata, for OY3 and the tests. Null when anything is missing or malformed. */
export function readOnlineYearMetadata(md: Record<string, string | undefined> | null | undefined): OnlineYearCartPlan | null {
  if (!md || md.lookup_key !== ONLINE_YEAR_CART_KEY || !isOnlineYearBand(md.oy_band)) return null;
  const n = Number(md.oy_children);
  if (!Number.isInteger(n) || n < 1 || n > MAX_ONLINE_YEAR_CHILDREN) return null;
  const children: OnlineYearChild[] = [];
  for (let i = 1; i <= n; i++) {
    const name = cleanChildName(md[`oy_child_${i}`]);
    const kind = md[`oy_kind_${i}`];
    if (name === null || (kind !== 'first_child' && kind !== 'sibling')) return null;
    children.push({ name, kind });
  }
  if (children.filter((c) => c.kind === 'first_child').length > 1) return null;
  const band = md.oy_band;
  const siblings = children.filter((c) => c.kind === 'sibling').length;
  const lines: { lookup_key: string; quantity: number }[] = [];
  if (children.some((c) => c.kind === 'first_child')) lines.push({ lookup_key: ONLINE_YEAR_PRICE_KEYS[band].first_child, quantity: 1 });
  if (siblings > 0) lines.push({ lookup_key: ONLINE_YEAR_PRICE_KEYS[band].sibling, quantity: siblings });
  return { band, children, lines };
}

/** Where Stripe sends her back. */
export const ONLINE_YEAR_SUCCESS_URL = 'https://edeninstitute.health/online-year/thank-you?session_id={CHECKOUT_SESSION_ID}';
export function onlineYearCancelUrl(band: OnlineYearBand): string {
  return `https://edeninstitute.health/online-year/checkout?band=${band}`;
}
