// Pinterest tag conversion events: lead, addtocart, checkout.
//
// THE BASE TAG IS NOT LOADED HERE. It loads inline in
// web/layouts/MarketingLayout.astro (pintrk('load') then pintrk('page')) on
// every Astro marketing page. Where it does not run (SPA routes, which never
// load it), window.pintrk is absent and every call here is a silent no-op. When
// an ad blocker stops core.js, the inline stub still exists and simply queues
// the call, which is equally harmless.
//
// CONSENT (founder decision 2026-09-13: run by default, Decline turns it off).
// The tag and these events run for a visitor who has not chosen yet. Once the
// visitor clicks Decline (stored "denied"), every function here is a no-op, on
// top of pintrk('setconsent', false), which the banner sends on the click
// (src/lib/consent.ts applyTagConsent) and the layout re-sends on every page
// load before pintrk('page').
//
// ENHANCED MATCH WAITS FOR ACCEPT. A hashed email is personal data used for ad
// matching, so it is attached ONLY when the visitor has granted marketing
// consent in the cookie banner, the same gate the Meta Pixel
// (web/components/islands/SiteAnalytics.tsx) and the server-side Meta Lead
// (resend-waitlist, marketingConsent) already use. The raw email never leaves
// this module: it is trimmed, lowercased and SHA-256 hashed in the browser with
// crypto.subtle, and only the hex digest reaches pintrk. Nothing is logged.
//
// HOW THE EMAIL IS ATTACHED. pintrk('set', { em }) runs through the same
// partner-data merge as the options argument of pintrk('load', id, { em }),
// and every later 'track' call on the page carries that partner data. Read in
// Pinterest's live tag library (s.pinimg.com/ct/lib/main.e47a302d.js) on
// 2026-09-13; confirm with Pinterest Tag Helper if the library changes.
//
// NO STRIPE SESSION IDS. The Checkout session id Stripe puts in a thank-you URL
// is a bearer credential (print-order-status returns the buyer's email and
// ship-to with it, starter-download returns the download token), so it is never
// sent as an event field. checkoutRef() turns it into a one-way reference
// instead. The tag also sends the page URL (loc) and referrer (ref) with every
// event, so the id is taken out of the address bar before the tag loads, by the
// first head script (src/lib/checkoutSession.ts).
//
// Event names are Pinterest's standard names in lowercase, as in Pinterest's own
// code examples. The tag lowercases the name before matching it.

import { getMarketingConsent } from "@/lib/consent";

export type PinEvent = "lead" | "addtocart" | "checkout";

export interface PinLineItem {
  product_id?: string;
  product_name?: string;
  product_price?: number;
  product_quantity?: number;
}

export interface PinEventData {
  value?: number;
  currency?: string;
  order_quantity?: number;
  order_id?: string;
  /** Same id a future Conversions API call would send, so Pinterest dedupes the pair. */
  event_id?: string;
  lead_type?: string;
  line_items?: PinLineItem[];
}

type Pintrk = (...args: unknown[]) => void;

function getPintrk(): Pintrk | null {
  if (typeof window === "undefined") return null;
  const p = (window as unknown as { pintrk?: unknown }).pintrk;
  return typeof p === "function" ? (p as Pintrk) : null;
}

/** True once the visitor has clicked Decline. Everything here stops. */
function declined(): boolean {
  return getMarketingConsent() === "denied";
}

/** Pinterest's documented normalization for an email before hashing. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Lowercase hex SHA-256, or null where crypto.subtle is unavailable (non-HTTPS). */
export async function sha256Hex(input: string): Promise<string | null> {
  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return null;
    const digest = await subtle.digest("SHA-256", new TextEncoder().encode(input));
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

/** Length of the checkout reference: 32 hex characters, 128 bits. */
export const CHECKOUT_REF_LENGTH = 32;

/**
 * The one-way reference Pinterest gets in place of a Stripe Checkout session id:
 * the first 32 hex characters of SHA-256(session id). A future Pinterest
 * Conversions API call must derive its event_id the same way to dedupe against
 * these browser events. Null where crypto.subtle is unavailable.
 */
export async function checkoutRef(sessionId: string): Promise<string | null> {
  if (!sessionId) return null;
  const hex = await sha256Hex(sessionId);
  return hex ? hex.slice(0, CHECKOUT_REF_LENGTH) : null;
}

/** Cents to a dollar amount as a plain number, e.g. 26100 -> 261. */
export function centsToValue(cents: number): number {
  return Math.round(cents) / 100;
}

/**
 * Enhanced match. Attaches the hashed email to the tag so the NEXT event carries
 * it. Does nothing without marketing consent, without the tag, or without a
 * usable address. Never throws and never rejects, so callers can chain on it.
 */
export async function pinSetHashedEmail(email: string | null | undefined): Promise<void> {
  try {
    if (!email || getMarketingConsent() !== "granted") return;
    if (!getPintrk()) return;
    const normalized = normalizeEmail(email);
    if (!normalized.includes("@")) return;
    const em = await sha256Hex(normalized);
    // Consent is read again after the await: a Decline in between wins.
    if (em && getMarketingConsent() === "granted") getPintrk()?.("set", { em });
  } catch {
    // Analytics never break the page.
  }
}

/** Fire a Pinterest event. Silent no-op when the tag is absent or the visitor declined. */
export function pinTrack(event: PinEvent, data: PinEventData): void {
  try {
    if (declined()) return;
    getPintrk()?.("track", event, data);
  } catch {
    // Analytics never break the page.
  }
}

/** Keys already fired on this page load, for browsers that block localStorage. */
const firedThisPage = new Set<string>();

/**
 * Fire an event at most once for this key on this browser, so reloading or
 * reopening a confirmation page, even days later in a new tab, never reports a
 * second sale. The key lives in localStorage; where that is blocked, an
 * in-memory set still limits it to once per page load. A visitor who declined
 * fires nothing and nothing is stored.
 */
export function pinTrackOnce(dedupeKey: string, event: PinEvent, data: PinEventData): void {
  if (declined()) return;
  const key = `pintrk_${event}_${dedupeKey}`;
  if (firedThisPage.has(key)) return;
  firedThisPage.add(key);
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
  } catch {
    // Storage unavailable (private mode, blocked site data): the in-memory set
    // above is the guard for this page load.
  }
  pinTrack(event, data);
}

/**
 * Checkout, reported once per order on this browser.
 *
 * `sessionId` is the Stripe Checkout session id the thank-you page was reached
 * with (readCheckoutSessionId in src/lib/checkoutSession.ts). It never
 * reaches Pinterest: event_id is checkoutRef(sessionId), and order_id is the
 * page's own order number when it has one (/books) or the same reference when
 * it does not (/starter). The localStorage dedupe key is the reference too, so
 * the raw id is not stored either. Without crypto.subtle there is no safe id to
 * send, so nothing is reported.
 *
 * `email`, when given, is attached as a hash only with marketing consent (see
 * pinSetHashedEmail). Never throws and never rejects.
 */
export async function pinCheckoutOnce(
  sessionId: string,
  data: Omit<PinEventData, "event_id" | "lead_type">,
  email?: string | null,
): Promise<void> {
  try {
    if (!sessionId || declined() || !getPintrk()) return;
    const ref = await checkoutRef(sessionId);
    if (!ref) return;
    await pinSetHashedEmail(email);
    pinTrackOnce(ref, "checkout", { ...data, order_id: data.order_id || ref, event_id: ref });
  } catch {
    // Analytics never break the page.
  }
}
