// supabase/functions/_shared/fpea-offer.ts
//
// The FPEA 2027 convention offer (founder decisions 2026-10-30, final). Reached by
// a QR code on the booth table at the FPEA Florida Homeschool Convention, on the
// unlisted page /fpea:
//
//   1. A Starter Unit on its own (either band): 25% off the list price, computed
//      from the real Stripe Price at checkout, never a typed amount.
//   2. Any printed curriculum set: that band's Starter Unit delivered right after
//      paying, through the normal Starter fulfilment rail, AND the whole order
//      ships free. The both-years bundle brings both Starters.
//   3. Only from 2027-05-27 00:00 through 2027-06-05 23:59:59, America/New_York.
//      create-checkout refuses the offer outside that window (OFFER_NOT_OPEN /
//      OFFER_ENDED). The page's own check is cosmetic.
//   4. A gifted Starter never mints a kit credit or a promotion code (founder law:
//      no credit until the kits are live). A PAID 25%-off Starter takes the normal
//      paid-Starter path unchanged.
//
// PURE AND DEPENDENCY-FREE, like print-pricing.ts, because it is imported by both
// sides: create-checkout, stripe-webhook (through fpea-gift.ts), the Starter
// fulfiller and its email, the receipt and the order confirmation, AND the /fpea
// page's buy boxes. Nothing here reads the environment, the clock or the network;
// callers pass the time in.
//
// No Stripe object is created for this offer. The Starter discount is an inline
// price_data line on the Starter's own Stripe product (so its tax code, its name on
// the invoice and the webhook's lookup_key dispatch are all unchanged), and free
// shipping is the same fixed-amount shipping option at 0.
//
// Copy rule: no em dashes.

/** The offer id, carried in the request body and in session metadata (`offer`). */
export const FPEA_OFFER_ID = 'fpea2027';
export type FpeaOfferId = typeof FPEA_OFFER_ID;

export const FPEA_TIME_ZONE = 'America/New_York';

/**
 * 2027-05-27 00:00:00 in New York. Late May is Eastern DAYLIGHT time, UTC-4, so
 * this is 04:00 UTC. fpea-offer.test.ts formats it back in America/New_York to
 * prove the offset rather than trusting this comment.
 */
export const FPEA_OPENS_AT_MS = Date.UTC(2027, 4, 27, 4, 0, 0);

/**
 * 2027-06-06 00:00:00 in New York (EDT, 04:00 UTC): the first instant AFTER the
 * window. The window runs through 2027-06-05 23:59:59, so this bound is exclusive.
 */
export const FPEA_ENDS_AT_MS = Date.UTC(2027, 5, 6, 4, 0, 0);

export type FpeaWindowState = 'not_open' | 'open' | 'ended';

/** Where `nowMs` falls against the window. */
export function fpeaWindowState(nowMs: number): FpeaWindowState {
  if (!Number.isFinite(nowMs)) return 'ended';
  if (nowMs < FPEA_OPENS_AT_MS) return 'not_open';
  if (nowMs >= FPEA_ENDS_AT_MS) return 'ended';
  return 'open';
}

function nyDate(ms: number, opts: Intl.DateTimeFormatOptions): string {
  return new Date(ms).toLocaleDateString('en-US', { timeZone: FPEA_TIME_ZONE, ...opts });
}

/** "May 27, 2027": the first day, in New York. */
export function fpeaOpensLabel(): string {
  return nyDate(FPEA_OPENS_AT_MS, { month: 'long', day: 'numeric', year: 'numeric' });
}

/** "June 5, 2027": the LAST day of the window, in New York. */
export function fpeaLastDayLabel(): string {
  return nyDate(FPEA_ENDS_AT_MS - 1, { month: 'long', day: 'numeric', year: 'numeric' });
}

/** "June 5": the last day without the year, for running copy. */
export function fpeaLastDayShortLabel(): string {
  return nyDate(FPEA_ENDS_AT_MS - 1, { month: 'long', day: 'numeric' });
}

// ── Pricing ────────────────────────────────────────────────────────────────

/** Starter Unit discount at FPEA, percent. */
export const FPEA_STARTER_DISCOUNT_PERCENT = 25;

/**
 * The FPEA price of a Starter Unit, in cents, from its LIST price in cents
 * (the Stripe Price's unit_amount on the server, STARTER_BANDS on the page).
 * $39.00 -> $29.25. Rounded to the nearest cent. Throws on anything that is not
 * a positive whole number of cents, so a missing price can never become $0.
 */
export function fpeaStarterPriceCents(listCents: number): number {
  if (!Number.isInteger(listCents) || listCents <= 0) {
    throw new Error(`fpeaStarterPriceCents: list price must be a positive whole number of cents, got ${String(listCents)}`);
  }
  return Math.round((listCents * (100 - FPEA_STARTER_DISCOUNT_PERCENT)) / 100);
}

// ── Which Starters a printed set brings ────────────────────────────────────

export type FpeaGiftBand = 'sprouts' | 'seedlings';

/**
 * The Starter Unit band(s) each printed SET brings under the offer. Extra
 * notebooks bring nothing (they are only sold with a set, which already brings
 * its Starter). Back to Eden is not curriculum and is not part of the offer.
 * fpea-offer.test.ts checks this against luluBandsForSku in lulu-config.ts.
 */
export const FPEA_GIFT_BANDS_BY_SKU: Readonly<Record<string, readonly FpeaGiftBand[]>> = {
  sprouts_print_set: ['sprouts'],
  seedlings_print_set: ['seedlings'],
  both_bands_print_set: ['sprouts', 'seedlings'],
};

/** The printed SKUs the offer applies to. A cart must contain at least one. */
export const FPEA_PRINT_SET_SKUS: readonly string[] = Object.keys(FPEA_GIFT_BANDS_BY_SKU);

/**
 * The Starter bands to deliver for a cart, Sprouts first, each at most once
 * (two Sprouts sets still bring one Sprouts Starter: it is a household download).
 */
export function fpeaGiftBands(skus: readonly string[]): FpeaGiftBand[] {
  const wanted = new Set<FpeaGiftBand>();
  for (const sku of skus) for (const b of FPEA_GIFT_BANDS_BY_SKU[sku] ?? []) wanted.add(b);
  return (['sprouts', 'seedlings'] as const).filter((b) => wanted.has(b));
}

/** Parse the `offer_gift_starters` metadata value back into bands, ignoring anything unknown. */
export function parseGiftBands(raw: unknown): FpeaGiftBand[] {
  if (typeof raw !== 'string') return [];
  const parts = new Set(raw.split(',').map((s) => s.trim()));
  return (['sprouts', 'seedlings'] as const).filter((b) => parts.has(b));
}

// ── Request parsing and the window gate (create-checkout) ─────────────────

export type RequestedOffer = { kind: 'none' } | { kind: 'fpea' } | { kind: 'unknown' };

/**
 * What the request asked for. Absent, null and "" mean NO offer, which is every
 * request the site has ever sent: those take the normal path untouched. Any other
 * value that is not exactly the FPEA id is refused rather than ignored, so a typo
 * on a page can never silently charge full price to someone promised a discount.
 */
export function parseRequestedOffer(raw: unknown): RequestedOffer {
  if (raw === undefined || raw === null || raw === '') return { kind: 'none' };
  if (raw === FPEA_OFFER_ID) return { kind: 'fpea' };
  return { kind: 'unknown' };
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

export function offerNotApplicableRefusal(): OfferRefusal {
  return {
    ok: false,
    status: 400,
    code: 'OFFER_NOT_APPLICABLE',
    error: 'The FPEA convention offer is for the printed curriculum sets and the Starter Units.',
  };
}

/**
 * The server-side window gate. `bypassWindow` is true ONLY inside the token-gated
 * E2E twin (create-checkout-e2e, Stripe TEST mode, no real money), so the whole
 * flow can be proven before May. The live function never bypasses it.
 */
export function checkFpeaWindow(nowMs: number, opts: { bypassWindow: boolean }): OfferCheck {
  const state = fpeaWindowState(nowMs);
  if (state === 'open') return { ok: true, windowBypassed: false };
  if (opts.bypassWindow) return { ok: true, windowBypassed: true };
  if (state === 'not_open') {
    return { ok: false, status: 403, code: 'OFFER_NOT_OPEN', error: `The FPEA convention offer opens on ${fpeaOpensLabel()}.` };
  }
  return {
    ok: false,
    status: 403,
    code: 'OFFER_ENDED',
    error: `The FPEA convention offer ended on ${fpeaLastDayLabel()}. Everything is still available at the regular price.`,
  };
}

// ── Checkout session changes (create-checkout) ─────────────────────────────
//
// Applied to a FINISHED session-params object, only when the request carried the
// offer and passed the gate. A request without the offer never reaches these, so
// its session is exactly what it was before this file existed.

// deno-lint-ignore no-explicit-any
type Params = Record<string, any>;

/** Shipping line name in Stripe Checkout for an FPEA print order. */
export const FPEA_SHIPPING_NAME = 'Free shipping (FPEA convention offer)';

function bandWords(bands: readonly FpeaGiftBand[]): string {
  const names = bands.map((b) => (b === 'sprouts' ? 'Sprouts' : 'Seedlings'));
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] ?? '';
}

/** "the Sprouts Starter Unit download" / "the Sprouts and Seedlings Starter Unit downloads". */
export function giftStarterPhrase(bands: readonly FpeaGiftBand[]): string {
  if (bands.length === 0) return 'your Starter Unit download';
  return bands.length > 1
    ? `the ${bandWords(bands)} Starter Unit downloads`
    : `the ${bandWords(bands)} Starter Unit download`;
}

/** Added to Stripe's own note next to the Pay button on an FPEA print order. */
export function fpeaPrintCheckoutNote(bands: readonly FpeaGiftBand[]): string {
  return `FPEA convention offer: shipping is free, and ${giftStarterPhrase(bands)} will be emailed to you right after you pay.`;
}

/** Stripe's note next to the Pay button on an FPEA Starter Unit. */
export const FPEA_STARTER_CHECKOUT_NOTE =
  `FPEA convention price: ${FPEA_STARTER_DISCOUNT_PERCENT}% off the Starter Unit. Your download link is on the next page and in your email.`;

/** No-stacking: the offer is the one discount. Stripe takes at most one anyway. */
function noPromotionCodes(params: Params, metadata: Record<string, string>): void {
  delete params.discounts;
  params.allow_promotion_codes = false;
  delete metadata.affiliate_promo_code;
  delete metadata.affiliate_promo_id;
}

/**
 * Stripe's checkout session lifetime for an FPEA session, in unix seconds. These
 * sessions get NO cart-recovery link (a recovery link is honoured by Stripe for 30
 * days, which would sell the offer weeks after it ended), so the session is
 * clamped to the window's end instead, inside Stripe's allowed 30 minutes to 24
 * hours. In the last half hour of the window that floor wins, by at most 31
 * minutes.
 */
export function fpeaSessionExpiresAt(nowMs: number): number {
  const floor = nowMs + 31 * 60 * 1000;
  const ceiling = nowMs + 23 * 60 * 60 * 1000;
  const target = Math.min(ceiling, FPEA_ENDS_AT_MS);
  return Math.floor(Math.max(floor, target) / 1000);
}

/** Metadata every FPEA session carries. `offer` is what the webhook keys on. */
function stampOffer(metadata: Record<string, string>, windowBypassed: boolean): void {
  metadata.offer = FPEA_OFFER_ID;
  if (windowBypassed) metadata.offer_window_bypassed = 'true';
}

/**
 * A print-shop session under the offer: every shipping option charges 0 under a
 * plain name, no promotion codes, the offer and its gift bands in metadata, the
 * note by the Pay button, and an expiry inside the window.
 */
export function applyFpeaPrintOffer(
  params: Params,
  metadata: Record<string, string>,
  opts: { giftBands: readonly FpeaGiftBand[]; windowBypassed: boolean; nowMs: number },
): void {
  for (const option of Array.isArray(params.shipping_options) ? params.shipping_options : []) {
    const rate = option?.shipping_rate_data;
    if (!rate) continue;
    rate.fixed_amount = { ...(rate.fixed_amount ?? {}), amount: 0, currency: rate.fixed_amount?.currency ?? 'usd' };
    rate.display_name = FPEA_SHIPPING_NAME;
  }
  noPromotionCodes(params, metadata);
  stampOffer(metadata, opts.windowBypassed);
  metadata.offer_gift_starters = opts.giftBands.join(',');
  const submit = params.custom_text?.submit?.message;
  const note = fpeaPrintCheckoutNote(opts.giftBands);
  params.custom_text = { ...(params.custom_text ?? {}), submit: { message: submit ? `${note} ${submit}` : note } };
  params.expires_at = fpeaSessionExpiresAt(opts.nowMs);
}

/** The Stripe Price fields the Starter discount needs. */
export interface StarterPriceLike {
  unit_amount: number | null;
  currency: string;
  product: string | { id: string } | null;
  tax_behavior?: string | null;
}

/**
 * A Starter Unit session under the offer. The one line becomes price_data on the
 * Starter's OWN Stripe product at 25% off its Price's unit_amount, keeping that
 * Price's tax behaviour when it states one (Sprouts: exclusive; Seedlings:
 * unspecified, so the account default applies exactly as it does today).
 * metadata.lookup_key is untouched, which is what sends the paid session down the
 * normal Starter path in stripe-webhook.
 */
export function applyFpeaStarterOffer(
  params: Params,
  metadata: Record<string, string>,
  price: StarterPriceLike,
  opts: { windowBypassed: boolean; nowMs: number },
): void {
  const list = price.unit_amount;
  if (typeof list !== 'number') throw new Error('Starter Unit price has no unit_amount; refusing to guess a discount');
  const product = typeof price.product === 'string' ? price.product : price.product?.id;
  if (!product) throw new Error('Starter Unit price has no product; refusing to sell an unnamed line');
  const unit = fpeaStarterPriceCents(list);
  const taxBehavior = price.tax_behavior === 'exclusive' || price.tax_behavior === 'inclusive' ? price.tax_behavior : null;
  params.line_items = [{
    price_data: { currency: price.currency, unit_amount: unit, product, ...(taxBehavior ? { tax_behavior: taxBehavior } : {}) },
    quantity: 1,
  }];
  noPromotionCodes(params, metadata);
  stampOffer(metadata, opts.windowBypassed);
  metadata.offer_list_price_cents = String(list);
  metadata.offer_price_cents = String(unit);
  params.custom_text = { ...(params.custom_text ?? {}), submit: { message: FPEA_STARTER_CHECKOUT_NOTE } };
  params.expires_at = fpeaSessionExpiresAt(opts.nowMs);
}

// ── After payment ──────────────────────────────────────────────────────────

/** True when a session (or an order's stored session) was sold under the FPEA offer. */
// deno-lint-ignore no-explicit-any
export function isFpeaOfferMetadata(metadata: any): boolean {
  return !!metadata && typeof metadata === 'object' && metadata.offer === FPEA_OFFER_ID;
}

/**
 * The starter_deliveries key for a gifted Starter. starter_deliveries is unique on
 * stripe_checkout_session_id and one print order can gift two Starters, so each
 * gift gets its own key, derived from the print order's session id and the band.
 * Deterministic on purpose: a redelivered webhook hits the unique constraint and
 * queues nothing twice. starter-download accepts this key as a credential (?s=),
 * exactly as it accepts a bought Starter's own session id; deriving it needs that
 * same session id, so the posture is unchanged.
 */
export const FPEA_GIFT_KEY_PREFIX = 'fpea_';
export function fpeaGiftDeliveryKey(sessionId: string, band: FpeaGiftBand): string {
  return `${FPEA_GIFT_KEY_PREFIX}${sessionId}_${band}`;
}
export function isFpeaGiftDeliveryKey(key: string | null | undefined): boolean {
  return typeof key === 'string' && key.startsWith(FPEA_GIFT_KEY_PREFIX);
}
