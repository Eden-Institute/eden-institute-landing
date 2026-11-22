// The Wired preview pass on a phone: a one-time link that saves the pass and leaves no trace in the URL.
//
// WHY. While the quiz is dark (WIRED_ENABLED off), the wired-* functions answer only a request that
// carries the x-wired-preview header, and web/lib/wiredApi.ts sends it from localStorage
// "eden_wired_preview". Nothing could put the pass there on a phone, so the founder's phone run
// (Wired QA I1-I2) had no way in. Founder tap via Lane NP, 2026-11-22: "Phone link by QR".
//
// HOW. /wired#preview=<pass> (any /wired page). The pass rides after the #, which a browser never
// sends to a server, so it is in no request, no Vercel log and no Referer. WIRED_PREVIEW_STRIP_JS runs
// as an inline <head> script on /wired pages, right after the checkout-session strip and BEFORE the
// consent script, GTM, gtag('config') or the Pinterest tag can read location.href. It:
//   1. removes the hash from the address bar with history.replaceState (path and query kept),
//   2. then saves the pass to localStorage "eden_wired_preview" (or removes it for #preview=clear).
// Strip first: with storage blocked the pass is still wiped from the URL. Nothing visible changes and
// nothing is sent anywhere; a URL without #preview= is left exactly as it is.
//
// The key names must stay equal to PREVIEW_KEY / PILOT_KEY in web/lib/wiredApi.ts (src/test/wiredPreviewLink.test.ts).

/** The hash parameter: /wired#preview=<pass>. */
export const WIRED_PREVIEW_HASH_PARAM = "preview";

/** The value that wipes the saved pass: /wired#preview=clear. */
export const WIRED_PREVIEW_CLEAR = "clear";

/** localStorage key read by web/lib/wiredApi.ts (PREVIEW_KEY). */
export const WIRED_PREVIEW_STORAGE_KEY = "eden_wired_preview";

/**
 * 2026-11-22 testers-only pilot: the "You're in" email's button is /wired#pilot=<her pilot pass> (a signed token,
 * supabase/functions/_shared/wired-pilot-pass.ts). Same treatment: wiped from the address bar first, then saved under
 * this key, which web/lib/wiredApi.ts sends as the x-wired-pass header.
 */
export const WIRED_PILOT_HASH_PARAM = "pilot";
export const WIRED_PILOT_STORAGE_KEY = "eden_wired_pilot";

/** Only pages under this path act on the hash. */
export const WIRED_PREVIEW_PATH_PREFIX = "/wired";

/**
 * The inline head script. Plain ES5 with no dependencies, because it runs before any bundle.
 * Keep the literals in step with the constants above (the test checks them).
 */
export const WIRED_PREVIEW_STRIP_JS = `(function () {
  try {
    var hash = window.location.hash;
    if (!hash) return;
    var key = hash.indexOf('#preview=') === 0 ? 'eden_wired_preview' : hash.indexOf('#pilot=') === 0 ? 'eden_wired_pilot' : '';
    if (!key) return;
    var path = window.location.pathname;
    if (path !== '/wired' && path.indexOf('/wired/') !== 0) return;
    var raw = hash.slice(hash.indexOf('=') + 1);
    var pass = raw;
    try { pass = decodeURIComponent(raw); } catch (e) {}
    window.history.replaceState(window.history.state, '', path + window.location.search);
    try {
      if (pass === 'clear') window.localStorage.removeItem(key);
      else if (pass) window.localStorage.setItem(key, pass);
    } catch (e) {}
  } catch (e) {}
})();`;

/** True for the pages that carry the script (the layout uses it at build time). */
export function isWiredPath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, "") || "/";
  return p === WIRED_PREVIEW_PATH_PREFIX || p.startsWith(`${WIRED_PREVIEW_PATH_PREFIX}/`);
}
