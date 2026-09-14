// Credentials that arrive in a page URL, kept OUT of the URL.
//
// WHY. Three links put a bearer credential in the query string of a page that
// carries the Pinterest tag and GA4:
//   ?session_id=cs_...   any page. Stripe returns a buyer to success_url with it:
//                        print-order-status returns the buyer's email and ship-to
//                        for it, starter-download returns the download token,
//                        verify-session returns the paid guide.
//   ?t=<token>           /starter/downloads only. The durable download token from
//                        the Starter Unit email (supabase/functions/_shared/starter-email.ts).
//   ?k=<key>             /partner-sample only. The founding-partner sample key
//                        the founder pastes into welcome emails (api/partner-sample.ts).
// While a credential sits in the address bar, every tag on the page reads it:
// Pinterest's core.js sends loc: location.href and ref: document.referrer with
// every event, GA4 sends page_location, and the next page the visitor opens
// carries it in document.referrer.
//
// HOW. CHECKOUT_SESSION_STRIP_JS runs as the FIRST script in the <head> of every
// page (web/layouts/MarketingLayout.astro for the Astro site, index.html for the
// SPA), before the consent script, GTM, gtag('config') and the Pinterest
// snippet. It holds a small rule table, param -> the page it is a credential on
// ('*' for every page). A generic name like t or k is only touched on its own
// page, with or without a trailing slash, and left alone everywhere else. For
// each matching param it:
//   1. keeps the value for this page load in a window global,
//   2. saves it to storage so a return to the page still finds it,
//   3. removes ONLY the matched params from the address bar with
//      history.replaceState, keeping every other param byte for byte, the hash
//      and history.state.
// Storage differs by credential, because they live differently:
//   session_id  sessionStorage 'eden_checkout_session_id' = JSON { id, path } and
//               window.__edenCheckoutSession. One checkout, one tab: a reload
//               finds it, nothing outlives the tab.
//   t and k     localStorage 'eden_url_token:<param>:<page>' (sessionStorage when
//               localStorage is blocked) and window.__edenUrlTokens[same key].
//               These are durable: families and partners come back to the page
//               and bookmark it AFTER the URL has been cleaned, so a same-device
//               return to the clean URL has to keep working. A new value in the
//               URL always replaces the stored one.
// Every step is guarded: with storage blocked the params are still stripped and
// still readable from the window global for the rest of this page load.
//
// Readers: readCheckoutSessionId() and readUrlToken(param). Both read the URL
// first (in case the strip did not run), then the window global, then storage,
// and only hand a stored value back on the page it arrived on.
// web/pages/partner-sample.astro reads k in an inline script with the same order
// and the same storage key (urlTokenStorageKey("k"), passed in with define:vars).
//
// index.html cannot import this module (it runs before any bundle), so it
// carries a verbatim copy of CHECKOUT_SESSION_STRIP_JS. src/test/checkoutSession.test.ts
// fails if the copy drifts.

/** The query param Stripe fills in from {CHECKOUT_SESSION_ID}. */
export const CHECKOUT_SESSION_PARAM = "session_id";

/** sessionStorage key holding JSON { id, path }. */
export const CHECKOUT_SESSION_STORAGE_KEY = "eden_checkout_session_id";

/**
 * Durable credentials that are stripped only on one page each. Keep in step with
 * the rules table inside CHECKOUT_SESSION_STRIP_JS (the test checks it).
 */
export const URL_TOKEN_PAGES = {
  /** Starter Unit download token, from the Starter Unit email. */
  t: "/starter/downloads",
  /** Founding-partner sample key, from the partner welcome email. */
  k: "/partner-sample",
} as const;

export type UrlTokenParam = keyof typeof URL_TOKEN_PAGES;

/** Storage key prefix for URL_TOKEN_PAGES values. */
export const URL_TOKEN_STORAGE_PREFIX = "eden_url_token:";

/** localStorage / sessionStorage / window.__edenUrlTokens key for one param. */
export function urlTokenStorageKey(param: UrlTokenParam): string {
  return `${URL_TOKEN_STORAGE_PREFIX}${param}:${URL_TOKEN_PAGES[param]}`;
}

/**
 * The inline head script. Plain ES5 with no dependencies, because it runs before
 * any bundle and on every browser that can load the site. Keep it in step with
 * the constants above (the test checks the key names and the rules).
 */
export const CHECKOUT_SESSION_STRIP_JS = `(function () {
  try {
    var search = window.location.search;
    if (!search || search.length < 2) return;
    var path = window.location.pathname;
    var page = path;
    try { page = decodeURIComponent(path); } catch (e) {}
    while (page.length > 1 && page.charAt(page.length - 1) === '/') page = page.slice(0, -1);
    var rules = { session_id: '*', t: '/starter/downloads', k: '/partner-sample' };
    var has = Object.prototype.hasOwnProperty;
    var parts = search.slice(1).split('&');
    var kept = [];
    var values = {};
    var found = false;
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (part === '') continue;
      var eq = part.indexOf('=');
      var rawKey = eq === -1 ? part : part.slice(0, eq);
      var key = rawKey;
      try { key = decodeURIComponent(rawKey.replace(/\\+/g, ' ')); } catch (e) {}
      if (!has.call(rules, key) || (rules[key] !== '*' && rules[key] !== page)) { kept.push(part); continue; }
      found = true;
      if (!values[key] && eq !== -1) {
        var rawVal = part.slice(eq + 1);
        try { values[key] = decodeURIComponent(rawVal.replace(/\\+/g, ' ')); } catch (e) { values[key] = rawVal; }
      }
    }
    if (!found) return;
    if (values.session_id) {
      var entry = { id: values.session_id, path: path };
      window.__edenCheckoutSession = entry;
      try { window.sessionStorage.setItem('eden_checkout_session_id', JSON.stringify(entry)); } catch (e) {}
    }
    for (var name in values) {
      if (!has.call(values, name) || name === 'session_id' || !values[name]) continue;
      var slot = 'eden_url_token:' + name + ':' + rules[name];
      try { (window.__edenUrlTokens = window.__edenUrlTokens || {})[slot] = values[name]; } catch (e) {}
      try {
        window.localStorage.setItem(slot, values[name]);
        try { window.sessionStorage.removeItem(slot); } catch (e) {}
      } catch (e) {
        try { window.localStorage.removeItem(slot); } catch (e2) {}
        try { window.sessionStorage.setItem(slot, values[name]); } catch (e2) {}
      }
    }
    window.history.replaceState(window.history.state, '', path + (kept.length ? '?' + kept.join('&') : '') + window.location.hash);
  } catch (e) {}
})();`;

interface StoredCheckoutSession {
  id: string;
  path: string;
}

function isStored(v: unknown): v is StoredCheckoutSession {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as StoredCheckoutSession).id === "string" &&
    (v as StoredCheckoutSession).id !== "" &&
    typeof (v as StoredCheckoutSession).path === "string"
  );
}

/** "/books/thank-you/" and "/books/thank-you" are the same page. */
function samePath(a: string, b: string): boolean {
  const norm = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);
  return norm(a) === norm(b);
}

/**
 * The Stripe Checkout session id for the current page, or null. URL first, then
 * this page load's window global, then sessionStorage (same tab, same path only).
 * Never throws.
 */
export function readCheckoutSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const fromUrl = new URLSearchParams(window.location.search).get(CHECKOUT_SESSION_PARAM);
    if (fromUrl) return fromUrl;
  } catch {
    // fall through to the stored copies
  }
  const path = window.location.pathname;
  const fromWindow = (window as unknown as { __edenCheckoutSession?: unknown }).__edenCheckoutSession;
  if (isStored(fromWindow) && samePath(fromWindow.path, path)) return fromWindow.id;
  try {
    const raw = window.sessionStorage.getItem(CHECKOUT_SESSION_STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isStored(parsed) && samePath(parsed.path, path)) return parsed.id;
    }
  } catch {
    // Storage blocked or a malformed value: nothing to restore.
  }
  return null;
}

/** The page a pathname is, the way the strip script compares it. */
function pageOf(pathname: string): string {
  let page = pathname;
  try {
    page = decodeURIComponent(pathname);
  } catch {
    // keep the raw path
  }
  while (page.length > 1 && page.endsWith("/")) page = page.slice(0, -1);
  return page;
}

/**
 * A durable URL credential (?t= on /starter/downloads, ?k= on /partner-sample)
 * for the current page, or null. Only answers on that param's own page. Order:
 * the URL (first non-empty value), then this page load's window global, then
 * localStorage, then sessionStorage. Never throws.
 */
export function readUrlToken(param: UrlTokenParam): string | null {
  if (typeof window === "undefined") return null;
  try {
    if (pageOf(window.location.pathname) !== URL_TOKEN_PAGES[param]) return null;
  } catch {
    return null;
  }
  try {
    for (const value of new URLSearchParams(window.location.search).getAll(param)) {
      if (value) return value;
    }
  } catch {
    // fall through to the stored copies
  }
  const key = urlTokenStorageKey(param);
  try {
    const tokens = (window as unknown as { __edenUrlTokens?: unknown }).__edenUrlTokens;
    if (typeof tokens === "object" && tokens !== null) {
      const value = (tokens as Record<string, unknown>)[key];
      if (typeof value === "string" && value) return value;
    }
  } catch {
    // fall through to storage
  }
  for (const area of ["localStorage", "sessionStorage"] as const) {
    try {
      const value = window[area].getItem(key);
      if (value) return value;
    } catch {
      // Storage blocked: try the next one.
    }
  }
  return null;
}
