// web/lib/partnerPromo.ts
//
// 2026-11-17 (Lane 2 deep audit area 9, C1; founder tap "Yes, build + ship"): a partner's link with
// ?promo=CODE (edeninstitute.health/books?promo=LIZ10) carries the code into checkout on the pages
// selling today: books, printed sets and the Starter. Before this only the paused kit preorder box
// read ?promo=, so a follower who only clicked a partner's link paid full price and the partner
// earned nothing (commission follows the code on the order).
//
// create-checkout already pre-applies a promo_code on every branch and falls back to Stripe's own
// "Add promotion code" field for an unknown or inactive code, so a wrong code never blocks a
// purchase. The code is remembered for the visit (sessionStorage), so a family who lands on /books
// and buys on /starter still gets it. Callers never send it together with an `offer` (the FPEA
// convention offer carries its own pricing).

export const PARTNER_PROMO_KEY = "eden_partner_promo";

const SHAPE = /^[A-Za-z0-9][A-Za-z0-9_-]{1,39}$/;

/** A code as typed in a link, upper-cased, or "" when it is not code-shaped. */
export function cleanPromoCode(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const v = raw.trim();
  return SHAPE.test(v) ? v.toUpperCase() : "";
}

interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function sessionStore(): KeyValueStore | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null; // storage blocked (private mode, strict settings): the URL still works
  }
}

/**
 * The partner code for this visit: ?promo= on the current URL wins (and is remembered), else the
 * one remembered earlier in the visit, else "". Never throws.
 */
export function partnerPromoCode(
  search: string = typeof window !== "undefined" ? window.location.search : "",
  store: KeyValueStore | null = sessionStore(),
): string {
  let fromUrl = "";
  try {
    fromUrl = cleanPromoCode(new URLSearchParams(search).get("promo"));
  } catch {
    fromUrl = "";
  }
  if (fromUrl) {
    try {
      store?.setItem(PARTNER_PROMO_KEY, fromUrl);
    } catch {
      // storage full or blocked: this page's checkout still gets the code
    }
    return fromUrl;
  }
  try {
    return cleanPromoCode(store?.getItem(PARTNER_PROMO_KEY) ?? "");
  } catch {
    return "";
  }
}

/** The body fragment a buy box spreads into its create-checkout request. Empty with an offer. */
export function partnerPromoBody(code: string, offer?: unknown): { promo_code?: string } {
  return code && !offer ? { promo_code: code } : {};
}
