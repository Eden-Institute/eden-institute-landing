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
// CONSENT. These are first-party values describing how someone reached this site,
// not cross-site identifiers; SiteAnalytics records the same fields to page_views.
// The 30-day copy follows the founder's consent model for default-on measurement
// (consent.ts, 2026-09-13: "run by default, Decline turns it off"): a visitor
// whose stored choice is "denied" gets the tab-only copy and nothing persistent,
// and any persistent copy is removed. Anything that IS a cross-site identifier
// stays in fbAttribution.ts, which is consent-gated and must remain so.

import { getMarketingConsent } from "./consent";

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
 * Same first-touch value a signup gets. Wrapped so that nothing here can ever stop
 * a buyer from reaching Stripe: on any failure it returns {} and checkout proceeds
 * unattributed.
 */
export function getCheckoutAttribution(): Attribution {
  try {
    return getAttribution();
  } catch {
    return {};
  }
}
