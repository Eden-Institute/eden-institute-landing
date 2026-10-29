// Third-party tags run only on the live site (founder brief 2026-10-02).
//
// Vercel preview deployments (*.vercel.app) and localhost serve the same pages,
// and without this every preview click landed in GA4, GTM and Meta as if it were
// a real visitor. GA4 has a hostname filter as a backstop; the Meta Pixel has
// none. So the Google tag, GTM, the Pinterest tag, the Meta Pixel and the Google
// Customer Reviews opt-in all load only when the page is served from
// edeninstitute.health (or www.).
//
// The inline head scripts in web/layouts/MarketingLayout.astro and index.html
// run before any bundle, so they carry the same pattern as a literal and set
// window.__edenTagsLive. src/test/productionHost.test.ts fails if either copy
// drifts from PRODUCTION_HOST_PATTERN.
//
// The cookieless first-party page view (record_page_view) is not a third-party
// tag and is not affected.
//
// Test sessions too (2026-10-28). End-to-end runs (e2e_check / test, claude_e2e)
// reached the live GA property, because they ARE the live site. The tags now also
// stay off when:
//   - navigator.webdriver is true (a browser driven by automation)
//   - localStorage holds eden_e2e_token (the E2E test switch, r_e2e_test_switch)
//   - this tab arrived on a link tagged utm_source=e2e_check or claude_e2e, or
//     utm_medium=test; remembered in sessionStorage 'eden-test-session' for the rest
//     of the tab, so the return from Stripe to the thank-you page stays untracked
// TEST_SESSION_GUARD_JS is the inline copy the head scripts run right after setting
// __edenTagsLive; isTestSession() is the same rule for bundled code.

export const PRODUCTION_HOST_PATTERN = "/^(www\\.)?edeninstitute\\.health$/";

const PRODUCTION_HOST_RE = /^(www\.)?edeninstitute\.health$/;

/** Inline head copy of isTestSession(). index.html carries it as a literal;
 *  src/test/productionHost.test.ts fails if either copy drifts. */
export const TEST_SESSION_GUARD_JS =
  "try { var edenQ = new URLSearchParams(window.location.search); if (/^(e2e_check|claude_e2e)$/.test(edenQ.get('utm_source') || '') || edenQ.get('utm_medium') === 'test') sessionStorage.setItem('eden-test-session', '1'); if (navigator.webdriver || localStorage.getItem('eden_e2e_token') || sessionStorage.getItem('eden-test-session') === '1') window.__edenTagsLive = false; } catch (e) {}";

const TEST_SESSION_KEY = "eden-test-session";
const E2E_SOURCES = /^(e2e_check|claude_e2e)$/;

/** True in an automated or end-to-end test session. Never throws. */
export function isTestSession(): boolean {
  try {
    if (typeof window === "undefined") return false;
    const q = new URLSearchParams(window.location.search);
    if (E2E_SOURCES.test(q.get("utm_source") ?? "") || q.get("utm_medium") === "test") {
      sessionStorage.setItem(TEST_SESSION_KEY, "1");
    }
    return Boolean(
      navigator.webdriver ||
        localStorage.getItem("eden_e2e_token") ||
        sessionStorage.getItem(TEST_SESSION_KEY) === "1",
    );
  } catch {
    return false;
  }
}

/** The live site, and not a test session: where third-party tags may load. */
export function thirdPartyTagsAllowed(): boolean {
  return isProductionHost() && !isTestSession();
}

/** True only on the live site. Never throws; false outside a browser. */
export function isProductionHost(hostname?: string): boolean {
  try {
    const h = hostname ?? (typeof window !== "undefined" ? window.location.hostname : "");
    return PRODUCTION_HOST_RE.test(h);
  } catch {
    return false;
  }
}
