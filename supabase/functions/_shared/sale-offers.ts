// supabase/functions/_shared/sale-offers.ts
//
// Every dated offer the store runs, in one registry (founder decision 2026-11-20,
// generalizing the FPEA 2027 convention offer in fpea-offer.ts):
//
//   fpea2027    FPEA convention offer, /fpea only (QR code at the booth).
//               May 27 through June 5, 2027, America/New_York.
//               25% off either Starter Unit, AND free shipping plus the band's
//               Starter Unit gifted with any printed set.
//   spring2027  Spring Planning Week, WHOLE SITE. Feb 22 through Feb 28, 2027,
//               America/Chicago. 25% off either Starter Unit only. Printed sets
//               are full price that week.
//   summer2027  Back-to-School Week, WHOLE SITE. Jul 5 through Jul 11, 2027,
//               America/Chicago. Free shipping plus the band's Starter Unit gifted
//               with any printed set (both Starters with the both-years set).
//               Starter Units are full price that week.
//
// The two site-wide weeks use America/Chicago because the business is in
// Tennessee. That is an assumption, not a founder decision: change the bounds
// below (and the tests) if she wants another zone.
//
// Each offer runs on exactly the FPEA mechanics:
//   - The Starter discount is an inline price_data line on the Starter's own Stripe
//     product, computed from the real Stripe Price's unit_amount at checkout, never
//     a typed amount. No promotion code is created or accepted.
//   - Free shipping is the same fixed-amount shipping option at 0.
//   - A gifted Starter goes through the normal Starter rail and never mints a kit
//     credit or a promotion code (founder law: no credit until the kits are live).
//   - create-checkout is the gate: it refuses an offer outside its window
//     (OFFER_NOT_OPEN / OFFER_ENDED) and a perk the offer does not include
//     (OFFER_NOT_APPLICABLE). What a page shows is cosmetic.
//   - Offer sessions get no cart-recovery link (Stripe honours one for 30 days)
//     and expire inside the window.
//
// PURE AND DEPENDENCY-FREE, like print-pricing.ts, because both sides import it:
// create-checkout, stripe-webhook (through fpea-gift.ts), the Starter fulfiller and
// its email, the receipt and the order confirmation, AND the web buy boxes. Nothing
// here reads the environment, the clock or the network; callers pass the time in.
//
// Copy rule: no em dashes. Every FPEA string is kept exactly as fpea-offer.ts had it.

// ── The registry ───────────────────────────────────────────────────────────

export const FPEA_OFFER_ID = 'fpea2027';
export const SPRING_2027_OFFER_ID = 'spring2027';
export const SUMMER_2027_OFFER_ID = 'summer2027';
export type SaleOfferId = typeof FPEA_OFFER_ID | typeof SPRING_2027_OFFER_ID | typeof SUMMER_2027_OFFER_ID;

/** The words each offer uses, so a family always reads the name of the offer they used. */
export interface SaleOfferCopy {
  /** Subject of a refusal sentence: "The FPEA convention offer opens on ...". */
  subject: string;
  /** "Order X was bought with {withPhrase}" (founder alerts). */
  withPhrase: string;
  /** create-checkout's OFFER_NOT_APPLICABLE sentence. */
  notApplicable: string;
  /** Stripe's note by the Pay button on a discounted Starter. Null without the discount. */
  starterCheckoutNote: string | null;
  /** Page line under the Starter button: "{label}: 25% off the regular $39.00." */
  starterPriceLabel: string | null;
  /** Shipping option name in Stripe Checkout on a print order. Null without the gift. */
  printShippingName: string | null;
  /** Start of Stripe's note on a print order: "{lead}: shipping is free, and ...". */
  printNoteLead: string | null;
  /** Start of the page note in the print buy box: "{lead}: free shipping, plus ...". */
  printBadgeLead: string | null;
  /** Start of the order-confirmation paragraph: "{lead}, shipping is on me, and ...". */
  confirmationLead: string | null;
  /** First sentence of the gifted Starter's email. */
  giftEmailThanks: string | null;
}

export interface SaleOffer {
  id: SaleOfferId;
  /** Customer-facing name. */
  name: string;
  /** IANA zone the dates are stated in. */
  timeZone: string;
  /** First instant of the window, ms since epoch (inclusive). */
  opensAtMs: number;
  /** First instant AFTER the window, ms since epoch (exclusive). */
  endsAtMs: number;
  /** True: every Starter or printed-set buy box on the site shows it during the window. */
  siteWide: boolean;
  /** Percent off a Starter Unit, or null when Starters are full price under this offer. */
  starterDiscountPercent: number | null;
  /** True: a printed set ships free and brings its band's Starter Unit. */
  printGift: boolean;
  /** starter_deliveries key prefix for gifted Starters. Null without the gift. Never reused. */
  giftKeyPrefix: string | null;
  copy: SaleOfferCopy;
}

const STARTER_DOWNLOAD_NOTE = 'Your download link is on the next page and in your email.';

/**
 * FPEA 2027. 2027-05-27 00:00:00 in New York (Eastern DAYLIGHT time, UTC-4, so
 * 04:00 UTC) through 2027-06-05 23:59:59; the end bound is 2027-06-06 00:00 EDT,
 * exclusive. fpea-offer.test.ts formats both back in America/New_York.
 */
export const FPEA_OFFER: SaleOffer = {
  id: FPEA_OFFER_ID,
  name: 'FPEA convention offer',
  timeZone: 'America/New_York',
  opensAtMs: Date.UTC(2027, 4, 27, 4, 0, 0),
  endsAtMs: Date.UTC(2027, 5, 6, 4, 0, 0),
  siteWide: false,
  starterDiscountPercent: 25,
  printGift: true,
  giftKeyPrefix: 'fpea_',
  copy: {
    subject: 'The FPEA convention offer',
    withPhrase: 'the FPEA convention offer',
    notApplicable: 'The FPEA convention offer is for the printed curriculum sets and the Starter Units.',
    starterCheckoutNote: `FPEA convention price: 25% off the Starter Unit. ${STARTER_DOWNLOAD_NOTE}`,
    starterPriceLabel: 'FPEA price',
    printShippingName: 'Free shipping (FPEA convention offer)',
    printNoteLead: 'FPEA convention offer',
    printBadgeLead: 'FPEA offer',
    confirmationLead: 'Because you ordered with the FPEA convention offer',
    giftEmailThanks: 'Thank you for your order at the FPEA convention!',
  },
};

/**
 * Spring Planning Week 2027. 2027-02-22 00:00:00 in Chicago (Central STANDARD time,
 * UTC-6, so 06:00 UTC; daylight time starts 2027-03-14) through 2027-02-28
 * 23:59:59; the end bound is 2027-03-01 00:00 CST, exclusive.
 */
export const SPRING_2027_OFFER: SaleOffer = {
  id: SPRING_2027_OFFER_ID,
  name: 'Spring Planning Week',
  timeZone: 'America/Chicago',
  opensAtMs: Date.UTC(2027, 1, 22, 6, 0, 0),
  endsAtMs: Date.UTC(2027, 2, 1, 6, 0, 0),
  siteWide: true,
  starterDiscountPercent: 25,
  printGift: false,
  giftKeyPrefix: null,
  copy: {
    subject: 'The Spring Planning Week sale',
    withPhrase: 'the Spring Planning Week sale',
    notApplicable: 'The Spring Planning Week sale is for the Starter Units. The printed sets are at their regular price this week.',
    starterCheckoutNote: `Spring Planning Week price: 25% off the Starter Unit. ${STARTER_DOWNLOAD_NOTE}`,
    starterPriceLabel: 'Spring Planning Week price',
    printShippingName: null,
    printNoteLead: null,
    printBadgeLead: null,
    confirmationLead: null,
    giftEmailThanks: null,
  },
};

/**
 * Back-to-School Week 2027. 2027-07-05 00:00:00 in Chicago (Central DAYLIGHT time,
 * UTC-5, so 05:00 UTC) through 2027-07-11 23:59:59; the end bound is 2027-07-12
 * 00:00 CDT, exclusive.
 */
export const SUMMER_2027_OFFER: SaleOffer = {
  id: SUMMER_2027_OFFER_ID,
  name: 'Back-to-School Week',
  timeZone: 'America/Chicago',
  opensAtMs: Date.UTC(2027, 6, 5, 5, 0, 0),
  endsAtMs: Date.UTC(2027, 6, 12, 5, 0, 0),
  siteWide: true,
  starterDiscountPercent: null,
  printGift: true,
  giftKeyPrefix: 'summer2027_',
  copy: {
    subject: 'The Back-to-School Week sale',
    withPhrase: 'the Back-to-School Week sale',
    notApplicable: 'The Back-to-School Week sale is for the printed curriculum sets. The Starter Units are at their regular price this week.',
    starterCheckoutNote: null,
    starterPriceLabel: null,
    printShippingName: 'Free shipping (Back-to-School Week)',
    printNoteLead: 'Back-to-School Week',
    printBadgeLead: 'Back-to-School Week',
    confirmationLead: 'Because you ordered during Back-to-School Week',
    giftEmailThanks: 'Thank you for your order during Back-to-School Week!',
  },
};

export const SALE_OFFERS: readonly SaleOffer[] = [FPEA_OFFER, SPRING_2027_OFFER, SUMMER_2027_OFFER];

/** The offer with exactly this id, or null. Case and spacing must match exactly. */
export function saleOfferById(id: unknown): SaleOffer | null {
  if (typeof id !== 'string') return null;
  return SALE_OFFERS.find((o) => o.id === id) ?? null;
}

// ── Windows ────────────────────────────────────────────────────────────────

export type OfferWindowState = 'not_open' | 'open' | 'ended';

/** Where `nowMs` falls against an offer's window. */
export function offerWindowState(offer: SaleOffer, nowMs: number): OfferWindowState {
  if (!Number.isFinite(nowMs)) return 'ended';
  if (nowMs < offer.opensAtMs) return 'not_open';
  if (nowMs >= offer.endsAtMs) return 'ended';
  return 'open';
}

/**
 * The site-wide sale open at `nowMs`, or null. Never the FPEA offer, which stays on
 * /fpea. The buy boxes use this to show the sale with no code and nothing to share;
 * create-checkout still decides.
 */
export function activeSiteSale(nowMs: number): SaleOffer | null {
  return SALE_OFFERS.find((o) => o.siteWide && offerWindowState(o, nowMs) === 'open') ?? null;
}

function zonedDate(offer: SaleOffer, ms: number, opts: Intl.DateTimeFormatOptions): string {
  return new Date(ms).toLocaleDateString('en-US', { timeZone: offer.timeZone, ...opts });
}

/** "May 27, 2027": the first day, in the offer's zone. */
export function offerOpensLabel(offer: SaleOffer): string {
  return zonedDate(offer, offer.opensAtMs, { month: 'long', day: 'numeric', year: 'numeric' });
}

/** "June 5, 2027": the LAST day of the window, in the offer's zone. */
export function offerLastDayLabel(offer: SaleOffer): string {
  return zonedDate(offer, offer.endsAtMs - 1, { month: 'long', day: 'numeric', year: 'numeric' });
}

/** "June 5": the last day without the year, for running copy. */
export function offerLastDayShortLabel(offer: SaleOffer): string {
  return zonedDate(offer, offer.endsAtMs - 1, { month: 'long', day: 'numeric' });
}

// ── Pricing ────────────────────────────────────────────────────────────────

/**
 * A Starter Unit's price under a discount, in cents, from its LIST price in cents
 * (the Stripe Price's unit_amount on the server, the page's list price in the
 * browser). $39.00 at 25% -> $29.25. Rounded to the nearest cent. Throws on
 * anything that is not a positive whole number of cents, so a missing price can
 * never become $0.
 */
export function discountedStarterPriceCents(listCents: number, percent: number): number {
  if (!Number.isInteger(listCents) || listCents <= 0) {
    throw new Error(`discountedStarterPriceCents: list price must be a positive whole number of cents, got ${String(listCents)}`);
  }
  if (!Number.isFinite(percent) || percent <= 0 || percent >= 100) {
    throw new Error(`discountedStarterPriceCents: percent must be between 0 and 100, got ${String(percent)}`);
  }
  return Math.round((listCents * (100 - percent)) / 100);
}

/** The offer's Starter price in cents. Throws when the offer has no Starter discount. */
export function offerStarterPriceCents(offer: SaleOffer, listCents: number): number {
  if (offer.starterDiscountPercent == null) throw new Error(`${offer.id} has no Starter Unit discount`);
  return discountedStarterPriceCents(listCents, offer.starterDiscountPercent);
}

// ── Which Starters a printed set brings ────────────────────────────────────

export type GiftBand = 'sprouts' | 'seedlings';

/**
 * The Starter Unit band(s) each printed SET brings under a print-gift offer. Extra
 * notebooks bring nothing (they are only sold with a set, which already brings its
 * Starter). Back to Eden is not curriculum and is never part of an offer.
 * fpea-offer.test.ts checks this against luluBandsForSku in lulu-config.ts.
 */
export const GIFT_BANDS_BY_SKU: Readonly<Record<string, readonly GiftBand[]>> = {
  sprouts_print_set: ['sprouts'],
  seedlings_print_set: ['seedlings'],
  both_bands_print_set: ['sprouts', 'seedlings'],
};

/** The printed SKUs a print-gift offer applies to. A cart must contain at least one. */
export const PRINT_SET_SKUS: readonly string[] = Object.keys(GIFT_BANDS_BY_SKU);

/**
 * The Starter bands to deliver for a cart, Sprouts first, each at most once
 * (two Sprouts sets still bring one Sprouts Starter: it is a household download).
 */
export function giftBandsForSkus(skus: readonly string[]): GiftBand[] {
  const wanted = new Set<GiftBand>();
  for (const sku of skus) for (const b of GIFT_BANDS_BY_SKU[sku] ?? []) wanted.add(b);
  return (['sprouts', 'seedlings'] as const).filter((b) => wanted.has(b));
}

/** Parse the `offer_gift_starters` metadata value back into bands, ignoring anything unknown. */
export function parseGiftBands(raw: unknown): GiftBand[] {
  if (typeof raw !== 'string') return [];
  const parts = new Set(raw.split(',').map((s) => s.trim()));
  return (['sprouts', 'seedlings'] as const).filter((b) => parts.has(b));
}

function bandWords(bands: readonly GiftBand[]): string {
  const names = bands.map((b) => (b === 'sprouts' ? 'Sprouts' : 'Seedlings'));
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] ?? '';
}

/** "the Sprouts Starter Unit download" / "the Sprouts and Seedlings Starter Unit downloads". */
export function giftStarterPhrase(bands: readonly GiftBand[]): string {
  if (bands.length === 0) return 'your Starter Unit download';
  return bands.length > 1
    ? `the ${bandWords(bands)} Starter Unit downloads`
    : `the ${bandWords(bands)} Starter Unit download`;
}

// ── Request parsing and the gates (create-checkout) ───────────────────────

export type RequestedSaleOffer = { kind: 'none' } | { kind: 'offer'; offer: SaleOffer } | { kind: 'unknown' };

/**
 * What the request asked for. Absent, null and "" mean NO offer: those take the
 * normal path untouched. Any other value that is not exactly a known id is refused
 * rather than ignored, so a typo on a page can never silently charge full price to
 * someone promised a discount.
 */
export function parseRequestedSaleOffer(raw: unknown): RequestedSaleOffer {
  if (raw === undefined || raw === null || raw === '') return { kind: 'none' };
  const offer = saleOfferById(raw);
  return offer ? { kind: 'offer', offer } : { kind: 'unknown' };
}

export interface OfferRefusal {
  ok: false;
  status: number;
  code: 'OFFER_UNKNOWN' | 'OFFER_NOT_OPEN' | 'OFFER_ENDED' | 'OFFER_NOT_APPLICABLE';
  error: string;
}

export type OfferCheck = { ok: true; windowBypassed: boolean } | OfferRefusal;

export function offerUnknownRefusal(): OfferRefusal {
  return { ok: false, status: 400, code: 'OFFER_UNKNOWN', error: 'That offer is not available.' };
}

/** The offer does not include what was asked for (a print set under the spring sale, say). */
export function offerNotApplicableRefusalFor(offer: SaleOffer): OfferRefusal {
  return { ok: false, status: 400, code: 'OFFER_NOT_APPLICABLE', error: offer.copy.notApplicable };
}

/**
 * The server-side window gate. `bypassWindow` is true ONLY inside the token-gated
 * E2E twin (create-checkout-e2e, Stripe TEST mode, no real money), so a flow can be
 * proven before its window. The live function never bypasses it.
 */
export function checkOfferWindow(offer: SaleOffer, nowMs: number, opts: { bypassWindow: boolean }): OfferCheck {
  const state = offerWindowState(offer, nowMs);
  if (state === 'open') return { ok: true, windowBypassed: false };
  if (opts.bypassWindow) return { ok: true, windowBypassed: true };
  if (state === 'not_open') {
    return { ok: false, status: 403, code: 'OFFER_NOT_OPEN', error: `${offer.copy.subject} opens on ${offerOpensLabel(offer)}.` };
  }
  return {
    ok: false,
    status: 403,
    code: 'OFFER_ENDED',
    error: `${offer.copy.subject} ended on ${offerLastDayLabel(offer)}. Everything is still available at the regular price.`,
  };
}

// ── Checkout session changes (create-checkout) ─────────────────────────────
//
// Applied to a FINISHED session-params object, only when the request carried an
// offer and passed both gates. A request without an offer never reaches these, so
// its session is exactly what it was before offers existed.

// deno-lint-ignore no-explicit-any
type Params = Record<string, any>;

/** Stripe's note next to the Pay button on a print order under a print-gift offer. */
export function offerPrintCheckoutNote(offer: SaleOffer, bands: readonly GiftBand[]): string {
  if (!offer.copy.printNoteLead) throw new Error(`${offer.id} has no print gift`);
  return `${offer.copy.printNoteLead}: shipping is free, and ${giftStarterPhrase(bands)} will be emailed to you right after you pay.`;
}

/** No-stacking: the offer is the one discount. Stripe takes at most one anyway. */
function noPromotionCodes(params: Params, metadata: Record<string, string>): void {
  delete params.discounts;
  params.allow_promotion_codes = false;
  delete metadata.affiliate_promo_code;
  delete metadata.affiliate_promo_id;
}

/**
 * Stripe's checkout session lifetime for an offer session, in unix seconds. These
 * sessions get NO cart-recovery link (a recovery link is honoured by Stripe for 30
 * days, which would sell the offer weeks after it ended), so the session is clamped
 * to the window's end instead, inside Stripe's allowed 30 minutes to 24 hours. In
 * the last half hour of the window that floor wins, by at most 31 minutes.
 */
export function offerSessionExpiresAt(offer: SaleOffer, nowMs: number): number {
  const floor = nowMs + 31 * 60 * 1000;
  const ceiling = nowMs + 23 * 60 * 60 * 1000;
  const target = Math.min(ceiling, offer.endsAtMs);
  return Math.floor(Math.max(floor, target) / 1000);
}

/** Metadata every offer session carries. `offer` is what the webhook keys on. */
function stampOffer(offer: SaleOffer, metadata: Record<string, string>, windowBypassed: boolean): void {
  metadata.offer = offer.id;
  if (windowBypassed) metadata.offer_window_bypassed = 'true';
}

/**
 * A print-shop session under a print-gift offer: every shipping option charges 0
 * under a plain name, no promotion codes, the offer and its gift bands in metadata,
 * the note by the Pay button, and an expiry inside the window.
 */
export function applySalePrintOffer(
  params: Params,
  metadata: Record<string, string>,
  opts: { offer: SaleOffer; giftBands: readonly GiftBand[]; windowBypassed: boolean; nowMs: number },
): void {
  const { offer } = opts;
  if (!offer.printGift || !offer.copy.printShippingName) throw new Error(`${offer.id} has no print gift; refusing to change a print session`);
  for (const option of Array.isArray(params.shipping_options) ? params.shipping_options : []) {
    const rate = option?.shipping_rate_data;
    if (!rate) continue;
    rate.fixed_amount = { ...(rate.fixed_amount ?? {}), amount: 0, currency: rate.fixed_amount?.currency ?? 'usd' };
    rate.display_name = offer.copy.printShippingName;
  }
  noPromotionCodes(params, metadata);
  stampOffer(offer, metadata, opts.windowBypassed);
  metadata.offer_gift_starters = opts.giftBands.join(',');
  const submit = params.custom_text?.submit?.message;
  const note = offerPrintCheckoutNote(offer, opts.giftBands);
  params.custom_text = { ...(params.custom_text ?? {}), submit: { message: submit ? `${note} ${submit}` : note } };
  params.expires_at = offerSessionExpiresAt(offer, opts.nowMs);
}

/** The Stripe Price fields the Starter discount needs. */
export interface StarterPriceLike {
  unit_amount: number | null;
  currency: string;
  product: string | { id: string } | null;
  tax_behavior?: string | null;
}

/**
 * A Starter Unit session under a Starter-discount offer. The one line becomes
 * price_data on the Starter's OWN Stripe product at the offer's percent off its
 * Price's unit_amount, keeping that Price's tax behaviour when it states one
 * (Sprouts: exclusive; Seedlings: unspecified, so the account default applies
 * exactly as it does today). metadata.lookup_key is untouched, which is what sends
 * the paid session down the normal Starter path in stripe-webhook.
 */
export function applySaleStarterOffer(
  params: Params,
  metadata: Record<string, string>,
  price: StarterPriceLike,
  opts: { offer: SaleOffer; windowBypassed: boolean; nowMs: number },
): void {
  const { offer } = opts;
  if (offer.starterDiscountPercent == null || !offer.copy.starterCheckoutNote) {
    throw new Error(`${offer.id} has no Starter Unit discount; refusing to change a Starter session`);
  }
  const list = price.unit_amount;
  if (typeof list !== 'number') throw new Error('Starter Unit price has no unit_amount; refusing to guess a discount');
  const product = typeof price.product === 'string' ? price.product : price.product?.id;
  if (!product) throw new Error('Starter Unit price has no product; refusing to sell an unnamed line');
  const unit = offerStarterPriceCents(offer, list);
  const taxBehavior = price.tax_behavior === 'exclusive' || price.tax_behavior === 'inclusive' ? price.tax_behavior : null;
  params.line_items = [{
    price_data: { currency: price.currency, unit_amount: unit, product, ...(taxBehavior ? { tax_behavior: taxBehavior } : {}) },
    quantity: 1,
  }];
  noPromotionCodes(params, metadata);
  stampOffer(offer, metadata, opts.windowBypassed);
  metadata.offer_list_price_cents = String(list);
  metadata.offer_price_cents = String(unit);
  params.custom_text = { ...(params.custom_text ?? {}), submit: { message: offer.copy.starterCheckoutNote } };
  params.expires_at = offerSessionExpiresAt(offer, opts.nowMs);
}

// ── After payment ──────────────────────────────────────────────────────────

/** The offer a session (or an order's stored session) was sold under, or null. */
// deno-lint-ignore no-explicit-any
export function saleOfferFromMetadata(metadata: any): SaleOffer | null {
  if (!metadata || typeof metadata !== 'object') return null;
  return saleOfferById(metadata.offer);
}

/**
 * The print-gift offer a session was sold under, or null. This is what the webhook,
 * the receipt and the order confirmation key on: free shipping and gifted Starters.
 */
// deno-lint-ignore no-explicit-any
export function printGiftOfferFromMetadata(metadata: any): SaleOffer | null {
  const offer = saleOfferFromMetadata(metadata);
  return offer && offer.printGift ? offer : null;
}

/**
 * The starter_deliveries key for a gifted Starter. starter_deliveries is unique on
 * stripe_checkout_session_id and one print order can gift two Starters, so each
 * gift gets its own key, derived from the offer, the print order's session id and
 * the band. Deterministic on purpose: a redelivered webhook hits the unique
 * constraint and queues nothing twice. starter-download accepts this key as a
 * credential (?s=), exactly as it accepts a bought Starter's own session id;
 * deriving it needs that same session id, so the posture is unchanged.
 */
export function offerGiftDeliveryKey(offer: SaleOffer, sessionId: string, band: GiftBand): string {
  if (!offer.giftKeyPrefix) throw new Error(`${offer.id} gifts no Starter`);
  return `${offer.giftKeyPrefix}${sessionId}_${band}`;
}

/** The offer whose gift key this is, or null for a bought Starter, an ESA key or a founder gift. */
export function giftOfferForDeliveryKey(key: string | null | undefined): SaleOffer | null {
  if (typeof key !== 'string') return null;
  return SALE_OFFERS.find((o) => !!o.giftKeyPrefix && key.startsWith(o.giftKeyPrefix)) ?? null;
}
