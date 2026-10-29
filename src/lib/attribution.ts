// First-touch signup attribution: where a subscriber actually came from.
//
// WHY THIS EXISTS. `resend-waitlist` has always read and stored `utm_source`,
// `utm_medium`, `utm_campaign`, `referrer` and `source_url` (index.ts:551-555,
// :622-626). The signup form never sent any of them. It posted firstName, email,
// audienceId, source, fbEventId and marketingConsent, and stopped.
//
// The result, measured 2026-08-28: of 1,731 signups, ZERO carried a utm_source,
// ZERO carried a referrer, and four carried a source_url. Every pin, post, ad and
// email ever published was unattributable at the point that matters, which is the
// signup. The only reason the August traffic drop could be diagnosed at all is
// that SiteAnalytics writes UTMs to a DIFFERENT table (page_views), and even that
// only measures visits, never conversions.
//
// FIRST TOUCH, NOT LAST. A visitor lands on /freebies?utm_source=pinterest, reads,
// clicks through to /homeschool, and only then opens the modal. By that point the
// query string is long gone and document.referrer says edeninstitute.health. Last
// touch would credit the site with its own conversion, which is how a channel that
// works can look like it does nothing. So the first attributed touch wins and is
// held in sessionStorage, with a 30-day copy described below.
//
// 30 DAYS, NOT ONE TAB (founder request 2026-09-28). The makers market wall is
// scan-now-buy-later: someone scans a herb label at Miss Lucille's, closes the tab,
// and orders from home that evening. Tab-scoped storage lost the source every time.
// So the first touch is ALSO kept in localStorage for 30 days, still first touch:
// a later tagged visit inside that window does not overwrite it.
//
// LAST MARKED TOUCH, BESIDE IT (founder approved 2026-10-18). First touch alone
// never credits the email or Friday note that brought a buyer BACK to buy. So
// checkout also carries the most recent MARKED arrival: a visit that came in with
// UTMs, an ad click id, or a link from another site. Direct visits, bookmarks and
// any click inside this site never count, so the site still cannot credit itself.
// Held 90 days (founder choice, matching the Google ad click), same consent rule.
// First touch is untouched by any of this. See captureLastTouch below.
//
// CONSENT. These are first-party values describing how someone reached this site,
// not cross-site identifiers; SiteAnalytics records the same fields to page_views.
// The 30-day copy follows the founder's consent model for default-on measurement
// (consent.ts, 2026-09-13: "run by default, Decline turns it off"): a visitor
// whose stored choice is "denied" gets the tab-only copy and nothing persistent,
// and any persistent copy is removed. Anything that IS a cross-site identifier
// stays in fbAttribution.ts, which is consent-gated and must remain so.

import { getMarketingConsent } from "./consent";
import { readGaVisitor, type GaVisitor } from "./gaVisitor";

const KEY = "eden_first_touch_v1";
const PERSIST_KEY = "eden_first_touch_30d_v1";
export const FIRST_TOUCH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface Attribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  referrer?: string;
  source_url?: string;
}

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

// GOOGLE CLICK IDS (2026-10-15). A Google Ads click lands with ?gclid= (or
// gbraid / wbraid on iOS). The id is kept so the checkout can carry it into the
// Stripe session metadata (supabase/functions/_shared/purchase-attribution.ts),
// which lets a sale be matched to its ad click later. Unlike the first touch, the
// LATEST ad click wins, held 90 days to match the Google Ads Purchase action's
// click-through window. It is an advertising identifier, so it follows the Google
// tags' consent rule: kept unless the visitor clicked Decline, and Decline removes
// it. Only checkout reads it; signups never send it. fbclid is not kept here: Meta
// gets that click as fbc, gated on Accept (fbAttribution.ts).
const GOOGLE_CLICK_KEY = "eden_google_click_v1";
export const GOOGLE_CLICK_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const GOOGLE_CLICK_KEYS = ["gclid", "gbraid", "wbraid"] as const;

export type GoogleClickIds = Partial<Record<(typeof GOOGLE_CLICK_KEYS)[number], string>>;

// LAST MARKED TOUCH (2026-10-18). The newest marked arrival wins, held 90 days.
// The tab copy always exists; the 90-day copy follows the same consent rule as the
// first touch. Both carry `at`, so the newer of the two is the last touch (another
// tab may have recorded a later arrival).
const LAST_KEY = "eden_last_touch_v1";
const LAST_PERSIST_KEY = "eden_last_touch_90d_v1";
export const LAST_TOUCH_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/** Ad click ids that mark an arrival. Only the NAME is kept (`click: "gclid"`),
 *  never the id: the Google ids are kept separately above, and fbclid stays with
 *  the consent-gated fbc in fbAttribution.ts. */
const CLICK_MARKER_KEYS = ["gclid", "gbraid", "wbraid", "fbclid"] as const;
export type ClickMarker = (typeof CLICK_MARKER_KEYS)[number];

export interface LastTouch extends Attribution {
  click?: ClickMarker;
}

/** Referrers that are a step of our own flows, never a marketing source: this
 *  site, and the payment pages a buyer is sent to and back from. Matched on the
 *  host or any subdomain of it. */
const OWN_HOSTS = ["edeninstitute.health"];
const CHECKOUT_HOSTS = ["stripe.com", "stripe.network", "link.com", "klarna.com", "affirm.com", "afterpay.com"];

/** sessionStorage and localStorage throw in some privacy modes and in embedded
 *  webviews. Every access is wrapped: attribution is analytics, and analytics never
 *  breaks a signup or a checkout. */
function persistAllowed(): boolean {
  return getMarketingConsent() !== "denied";
}

function readPersisted(): Attribution | null {
  try {
    if (!persistAllowed()) {
      window.localStorage.removeItem(PERSIST_KEY);
      return null;
    }
    const raw = window.localStorage.getItem(PERSIST_KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw) as { v?: Attribution; exp?: number };
    if (!rec || typeof rec.exp !== "number" || !rec.v || rec.exp <= Date.now()) {
      window.localStorage.removeItem(PERSIST_KEY);
      return null;
    }
    return rec.v;
  } catch {
    return null;
  }
}

function readStore(): Attribution | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Attribution;
  } catch {
    /* fall through to the 30-day copy */
  }
  return readPersisted();
}

function writeStore(value: Attribution): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* ignore */
  }
  try {
    if (persistAllowed()) {
      window.localStorage.setItem(
        PERSIST_KEY,
        JSON.stringify({ v: value, exp: Date.now() + FIRST_TOUCH_TTL_MS }),
      );
    }
  } catch {
    /* ignore */
  }
}

/**
 * Record how this visitor arrived, if it has not been recorded already.
 *
 * Safe to call on every page load. The FIRST call that finds a real signal wins;
 * later navigations, and later visits within 30 days, never overwrite it. A page with no
 * UTMs and no external referrer stores nothing, so a visitor who arrives cold and
 * only later clicks a tagged link still gets attributed to that link.
 */
export function captureFirstTouch(): void {
  if (typeof window === "undefined") return;
  captureGoogleClick();
  captureLastTouch();
  if (readStore()) return;

  const params = new URLSearchParams(window.location.search);
  const found: Attribution = {};
  for (const k of UTM_KEYS) {
    const v = params.get(k);
    if (v) found[k] = v.slice(0, 200);
  }

  // An external referrer is a real signal even with no UTMs at all: it is how
  // Facebook and Pinterest traffic can be told apart from direct.
  const ref = document.referrer || "";
  let externalRef = "";
  if (ref) {
    try {
      if (new URL(ref).hostname !== window.location.hostname) {
        externalRef = ref.slice(0, 500);
      }
    } catch {
      /* malformed referrer, treat as absent */
    }
  }

  if (Object.keys(found).length === 0 && !externalRef) return;

  if (externalRef) found.referrer = externalRef;
  found.source_url = (window.location.origin + window.location.pathname).slice(0, 500);
  writeStore(found);
}

/**
 * The attribution to send with a signup.
 *
 * Falls back to capturing the CURRENT url first, so a visitor who landed on a
 * tagged link and submitted without navigating is still attributed even if no
 * page-load hook ran on that surface.
 */
export function getAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  captureFirstTouch();
  return readStore() ?? {};
}

/**
 * The attribution to send with a PURCHASE: the create-checkout request body carries
 * it as `attribution: getCheckoutAttribution()`, create-checkout sanitizes it into
 * the Stripe session metadata (attr_utm_source, ...), and stripe-webhook copies it
 * onto the order. See supabase/functions/_shared/purchase-attribution.ts.
 *
 * Same first-touch value a signup gets, plus the last marked touch as `last`
 * (create-checkout stamps it as attr_last_*), plus the GA4 visitor as `ga`
 * (src/lib/gaVisitor.ts; stamped as ga_*, so stripe-webhook can report the sale).
 * Wrapped so that nothing here can ever stop a buyer from reaching Stripe: on any
 * failure it returns {} and checkout proceeds unattributed.
 */
export function getCheckoutAttribution(): Attribution & GoogleClickIds & { last?: LastTouch; ga?: GaVisitor } {
  try {
    const first = getAttribution();
    const last = readLastTouch();
    const ga = readGaVisitor();
    return { ...first, ...readGoogleClick(), ...(last ? { last } : {}), ...(Object.keys(ga).length ? { ga } : {}) };
  } catch {
    return {};
  }
}

let lastTouchSeenThisPage = false;

/** Tests simulate a new page load with this; a real page load gets a fresh module. */
export function resetLastTouchForTests(): void {
  lastTouchSeenThisPage = false;
}

function hostMatches(host: string, list: readonly string[]): boolean {
  return list.some((h) => host === h || host.endsWith(`.${h}`));
}

/**
 * True only for a fresh arrival on this page. A reload or a back/forward visit
 * replays an old arrival, and an in-app route change keeps the ORIGINAL
 * document.referrer, so neither is a new touch. Without Navigation Timing (old
 * browsers, tests) the arrival is taken as fresh.
 */
function isFreshArrival(): boolean {
  try {
    const nav = window.performance?.getEntriesByType?.("navigation")?.[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (!nav) return true;
    if (nav.type === "reload" || nav.type === "back_forward") return false;
    return !nav.name || new URL(nav.name).pathname === window.location.pathname;
  } catch {
    return true;
  }
}

/**
 * Record this arrival as the last marked touch, if it is one.
 *
 * Runs once per page load (captureFirstTouch calls it, and both page-view hooks
 * call that). A marked arrival carries UTMs, an ad click id, or a referrer from
 * another site. Anything referred by this site is internal navigation and never
 * counts, even when the link carries UTMs (the post-signup buttons are tagged
 * utm_source=modal). A return from Stripe or Klarna is not a source either.
 */
export function captureLastTouch(): void {
  try {
    if (typeof window === "undefined" || lastTouchSeenThisPage) return;
    lastTouchSeenThisPage = true;
    if (!isFreshArrival()) return;

    let refHost = "";
    const ref = document.referrer || "";
    if (ref) {
      try {
        refHost = new URL(ref).hostname.toLowerCase();
      } catch {
        /* malformed referrer, treat as absent */
      }
    }
    if (refHost && (refHost === window.location.hostname.toLowerCase() || hostMatches(refHost, OWN_HOSTS))) return;

    const params = new URLSearchParams(window.location.search);
    const found: LastTouch = {};
    for (const k of UTM_KEYS) {
      const v = params.get(k);
      if (v) found[k] = v.slice(0, 200);
    }
    const click = CLICK_MARKER_KEYS.find((k) => params.get(k));
    if (click) found.click = click;
    if (refHost && !hostMatches(refHost, CHECKOUT_HOSTS)) found.referrer = ref.slice(0, 500);

    if (Object.keys(found).length === 0) return;
    found.source_url = (window.location.origin + window.location.pathname).slice(0, 500);
    writeLastTouch(found);
  } catch {
    /* attribution never breaks a page */
  }
}

interface LastTouchRecord {
  v?: LastTouch;
  at?: number;
  exp?: number;
}

function writeLastTouch(value: LastTouch): void {
  const now = Date.now();
  const rec = JSON.stringify({ v: value, at: now, exp: now + LAST_TOUCH_TTL_MS });
  try {
    window.sessionStorage.setItem(LAST_KEY, rec);
  } catch {
    /* ignore */
  }
  try {
    if (persistAllowed()) window.localStorage.setItem(LAST_PERSIST_KEY, rec);
  } catch {
    /* ignore */
  }
}

/** A stored record if it is well formed and unexpired; a bad one is removed. */
function readLastRecord(storage: Storage, key: string): LastTouchRecord | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const rec = JSON.parse(raw) as LastTouchRecord;
    if (!rec || !rec.v || typeof rec.at !== "number" || typeof rec.exp !== "number" || rec.exp <= Date.now()) {
      storage.removeItem(key);
      return null;
    }
    return rec;
  } catch {
    return null;
  }
}

/** The last marked touch: the newer of the tab copy and the 90-day copy. */
function readLastTouch(): LastTouch | null {
  let tab: LastTouchRecord | null = null;
  let kept: LastTouchRecord | null = null;
  try {
    tab = readLastRecord(window.sessionStorage, LAST_KEY);
  } catch {
    /* ignore */
  }
  try {
    if (persistAllowed()) {
      kept = readLastRecord(window.localStorage, LAST_PERSIST_KEY);
    } else {
      window.localStorage.removeItem(LAST_PERSIST_KEY);
    }
  } catch {
    /* ignore */
  }
  const newest = tab && kept ? ((kept.at ?? 0) > (tab.at ?? 0) ? kept : tab) : (tab ?? kept);
  return newest?.v ?? null;
}

/** Store the Google click ids on this URL, if any. The latest click wins. */
function captureGoogleClick(): void {
  try {
    if (!persistAllowed()) {
      window.localStorage.removeItem(GOOGLE_CLICK_KEY);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const ids: GoogleClickIds = {};
    for (const k of GOOGLE_CLICK_KEYS) {
      const v = params.get(k);
      if (v) ids[k] = v.slice(0, 200);
    }
    if (Object.keys(ids).length === 0) return;
    window.localStorage.setItem(
      GOOGLE_CLICK_KEY,
      JSON.stringify({ v: ids, exp: Date.now() + GOOGLE_CLICK_TTL_MS }),
    );
  } catch {
    /* ignore */
  }
}

/** The stored Google click ids, or {} when none, expired, or after Decline. */
function readGoogleClick(): GoogleClickIds {
  try {
    if (!persistAllowed()) {
      window.localStorage.removeItem(GOOGLE_CLICK_KEY);
      return {};
    }
    const raw = window.localStorage.getItem(GOOGLE_CLICK_KEY);
    if (!raw) return {};
    const rec = JSON.parse(raw) as { v?: GoogleClickIds; exp?: number };
    if (!rec || typeof rec.exp !== "number" || !rec.v || rec.exp <= Date.now()) {
      window.localStorage.removeItem(GOOGLE_CLICK_KEY);
      return {};
    }
    return rec.v;
  } catch {
    return {};
  }
}
