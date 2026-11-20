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
// 2026-11-20: the offer now lives in the registry in sale-offers.ts (FPEA_OFFER),
// next to the two site-wide sale weeks that reuse its mechanics. This file keeps
// every FPEA export it always had, as thin wrappers over that registry, so the
// /fpea page and anything else that names FPEA keeps working unchanged. Every FPEA
// value and string is exactly what it was.
//
// PURE AND DEPENDENCY-FREE (its one import is pure too), because both sides import
// it. Nothing here reads the environment, the clock or the network.
//
// Copy rule: no em dashes.

import {
  FPEA_OFFER,
  FPEA_OFFER_ID,
  GIFT_BANDS_BY_SKU,
  type GiftBand,
  type OfferCheck,
  type OfferRefusal,
  type OfferWindowState,
  PRINT_SET_SKUS,
  type StarterPriceLike,
  applySalePrintOffer,
  applySaleStarterOffer,
  checkOfferWindow,
  giftBandsForSkus,
  offerGiftDeliveryKey,
  offerLastDayLabel,
  offerLastDayShortLabel,
  offerNotApplicableRefusalFor,
  offerOpensLabel,
  offerPrintCheckoutNote,
  offerSessionExpiresAt,
  offerStarterPriceCents,
  offerWindowState,
} from './sale-offers.ts';

export { giftStarterPhrase, offerUnknownRefusal, parseGiftBands } from './sale-offers.ts';
export type { OfferCheck, OfferRefusal, StarterPriceLike };

/** The offer id, carried in the request body and in session metadata (`offer`). */
export { FPEA_OFFER_ID };
export type FpeaOfferId = typeof FPEA_OFFER_ID;

export const FPEA_TIME_ZONE = FPEA_OFFER.timeZone;

/** 2027-05-27 00:00:00 in New York (EDT, UTC-4, so 04:00 UTC). */
export const FPEA_OPENS_AT_MS = FPEA_OFFER.opensAtMs;

/** 2027-06-06 00:00:00 in New York (EDT): the first instant AFTER the window (exclusive). */
export const FPEA_ENDS_AT_MS = FPEA_OFFER.endsAtMs;

export type FpeaWindowState = OfferWindowState;

/** Where `nowMs` falls against the window. */
export function fpeaWindowState(nowMs: number): FpeaWindowState {
  return offerWindowState(FPEA_OFFER, nowMs);
}

/** "May 27, 2027": the first day, in New York. */
export function fpeaOpensLabel(): string {
  return offerOpensLabel(FPEA_OFFER);
}

/** "June 5, 2027": the LAST day of the window, in New York. */
export function fpeaLastDayLabel(): string {
  return offerLastDayLabel(FPEA_OFFER);
}

/** "June 5": the last day without the year, for running copy. */
export function fpeaLastDayShortLabel(): string {
  return offerLastDayShortLabel(FPEA_OFFER);
}

// ── Pricing ────────────────────────────────────────────────────────────────

/** Starter Unit discount at FPEA, percent. */
export const FPEA_STARTER_DISCOUNT_PERCENT = FPEA_OFFER.starterDiscountPercent as number;

/** The FPEA price of a Starter Unit, in cents, from its LIST price in cents. $39.00 -> $29.25. */
export function fpeaStarterPriceCents(listCents: number): number {
  return offerStarterPriceCents(FPEA_OFFER, listCents);
}

// ── Which Starters a printed set brings ────────────────────────────────────

export type FpeaGiftBand = GiftBand;
export const FPEA_GIFT_BANDS_BY_SKU = GIFT_BANDS_BY_SKU;
export const FPEA_PRINT_SET_SKUS = PRINT_SET_SKUS;
export const fpeaGiftBands = giftBandsForSkus;

// ── Request parsing and the window gate ───────────────────────────────────

export type RequestedOffer = { kind: 'none' } | { kind: 'fpea' } | { kind: 'unknown' };

/**
 * FPEA only: absent, null and "" mean no offer; exactly the FPEA id is the offer;
 * anything else is unknown. create-checkout uses parseRequestedSaleOffer in
 * sale-offers.ts, which also knows the site-wide sale weeks.
 */
export function parseRequestedOffer(raw: unknown): RequestedOffer {
  if (raw === undefined || raw === null || raw === '') return { kind: 'none' };
  if (raw === FPEA_OFFER_ID) return { kind: 'fpea' };
  return { kind: 'unknown' };
}

export function offerNotApplicableRefusal(): OfferRefusal {
  return offerNotApplicableRefusalFor(FPEA_OFFER);
}

/** The server-side window gate for FPEA. See checkOfferWindow in sale-offers.ts. */
export function checkFpeaWindow(nowMs: number, opts: { bypassWindow: boolean }): OfferCheck {
  return checkOfferWindow(FPEA_OFFER, nowMs, opts);
}

// ── Checkout session changes ───────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
type Params = Record<string, any>;

/** Shipping line name in Stripe Checkout for an FPEA print order. */
export const FPEA_SHIPPING_NAME = FPEA_OFFER.copy.printShippingName as string;

/** Added to Stripe's own note next to the Pay button on an FPEA print order. */
export function fpeaPrintCheckoutNote(bands: readonly FpeaGiftBand[]): string {
  return offerPrintCheckoutNote(FPEA_OFFER, bands);
}

/** Stripe's note next to the Pay button on an FPEA Starter Unit. */
export const FPEA_STARTER_CHECKOUT_NOTE = FPEA_OFFER.copy.starterCheckoutNote as string;

export function fpeaSessionExpiresAt(nowMs: number): number {
  return offerSessionExpiresAt(FPEA_OFFER, nowMs);
}

export function applyFpeaPrintOffer(
  params: Params,
  metadata: Record<string, string>,
  opts: { giftBands: readonly FpeaGiftBand[]; windowBypassed: boolean; nowMs: number },
): void {
  applySalePrintOffer(params, metadata, { ...opts, offer: FPEA_OFFER });
}

export function applyFpeaStarterOffer(
  params: Params,
  metadata: Record<string, string>,
  price: StarterPriceLike,
  opts: { windowBypassed: boolean; nowMs: number },
): void {
  applySaleStarterOffer(params, metadata, price, { ...opts, offer: FPEA_OFFER });
}

// ── After payment ──────────────────────────────────────────────────────────

/** True when a session (or an order's stored session) was sold under the FPEA offer. */
// deno-lint-ignore no-explicit-any
export function isFpeaOfferMetadata(metadata: any): boolean {
  return !!metadata && typeof metadata === 'object' && metadata.offer === FPEA_OFFER_ID;
}

/** starter_deliveries key prefix for an FPEA gifted Starter. See offerGiftDeliveryKey. */
export const FPEA_GIFT_KEY_PREFIX = FPEA_OFFER.giftKeyPrefix as string;
export function fpeaGiftDeliveryKey(sessionId: string, band: FpeaGiftBand): string {
  return offerGiftDeliveryKey(FPEA_OFFER, sessionId, band);
}
export function isFpeaGiftDeliveryKey(key: string | null | undefined): boolean {
  return typeof key === 'string' && key.startsWith(FPEA_GIFT_KEY_PREFIX);
}
