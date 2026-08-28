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
// works can look like it does nothing. So the first attributed touch of the session
// wins and is held in sessionStorage.
//
// CONSENT. Not gated, deliberately, and consistent with how this codebase already
// treats the same data: SiteAnalytics records these exact fields to page_views as a
// "cookieless first-party page view (no consent required)". These are first-party
// values describing how someone reached this site, not cross-site identifiers, and
// they live in sessionStorage rather than a cookie, so they are scoped to one tab
// and disappear when it closes. Anything that IS a cross-site identifier stays in
// fbAttribution.ts, which is consent-gated and must remain so.

const KEY = "eden_first_touch_v1";

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

/** sessionStorage throws in some privacy modes and in embedded webviews. Every
 *  access is wrapped: attribution is analytics, and analytics never breaks a signup. */
function readStore(): Attribution | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Attribution) : null;
  } catch {
    return null;
  }
}

function writeStore(value: Attribution): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

/**
 * Record how this visitor arrived, if it has not been recorded already.
 *
 * Safe to call on every page load. The FIRST call that finds a real signal wins;
 * later navigations within the same session never overwrite it. A page with no
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
