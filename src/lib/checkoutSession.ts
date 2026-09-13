// The Stripe Checkout session id on a post-checkout page, kept OUT of the URL.
//
// WHY. Stripe returns a buyer to success_url with ?session_id=cs_... and that id
// is a bearer credential: print-order-status returns the buyer's email and
// ship-to for it, starter-download returns the download token, verify-session
// returns the paid guide. While it sits in the address bar, every tag on the
// page reads it: Pinterest's core.js sends loc: location.href and
// ref: document.referrer with every event, GA4 sends page_location, and the next
// page the buyer opens carries it in document.referrer.
//
// HOW. CHECKOUT_SESSION_STRIP_JS runs as the FIRST script in the <head> of every
// page (web/layouts/MarketingLayout.astro for the Astro site, index.html for the
// SPA), before the consent script, GTM, gtag('config') and the Pinterest
// snippet. When the URL has a session_id it:
//   1. keeps the id for this page load in window.__edenCheckoutSession,
//   2. saves it to sessionStorage under CHECKOUT_SESSION_STORAGE_KEY, together
//      with the path it arrived on, so a reload of that page in the same tab
//      still finds it (sessionStorage is per tab and never sent anywhere),
//   3. removes ONLY session_id from the address bar with history.replaceState,
//      keeping every other query param byte for byte, and the hash.
// Every step is guarded: with sessionStorage blocked the id is still stripped
// and still readable from the window global for the rest of this page load.
//
// readCheckoutSessionId() is how the pages read it back: the URL first (in case
// the strip did not run), then the window global, then sessionStorage. The
// stored copies are returned only on the same path they arrived on, so a thank
// you page never picks up an id meant for a different page.
//
// index.html cannot import this module (it runs before any bundle), so it
// carries a verbatim copy of CHECKOUT_SESSION_STRIP_JS. src/test/checkoutSession.test.ts
// fails if the copy drifts.

/** The query param Stripe fills in from {CHECKOUT_SESSION_ID}. */
export const CHECKOUT_SESSION_PARAM = "session_id";

/** sessionStorage key holding JSON { id, path }. */
export const CHECKOUT_SESSION_STORAGE_KEY = "eden_checkout_session_id";

/**
 * The inline head script. Plain ES5 with no dependencies, because it runs before
 * any bundle and on every browser that can load the site. Keep it in step with
 * the constants above (the test checks the key names).
 */
export const CHECKOUT_SESSION_STRIP_JS = `(function () {
  try {
    var search = window.location.search;
    if (!search || search.length < 2) return;
    var parts = search.slice(1).split('&');
    var kept = [];
    var id = '';
    var found = false;
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (part === '') continue;
      var eq = part.indexOf('=');
      var rawKey = eq === -1 ? part : part.slice(0, eq);
      var key = rawKey;
      try { key = decodeURIComponent(rawKey.replace(/\\+/g, ' ')); } catch (e) {}
      if (key !== 'session_id') { kept.push(part); continue; }
      found = true;
      if (!id && eq !== -1) {
        var rawVal = part.slice(eq + 1);
        try { id = decodeURIComponent(rawVal.replace(/\\+/g, ' ')); } catch (e) { id = rawVal; }
      }
    }
    if (!found) return;
    var path = window.location.pathname;
    if (id) {
      var entry = { id: id, path: path };
      window.__edenCheckoutSession = entry;
      try { window.sessionStorage.setItem('eden_checkout_session_id', JSON.stringify(entry)); } catch (e) {}
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
