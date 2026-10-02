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

export const PRODUCTION_HOST_PATTERN = "/^(www\\.)?edeninstitute\\.health$/";

const PRODUCTION_HOST_RE = /^(www\.)?edeninstitute\.health$/;

/** True only on the live site. Never throws; false outside a browser. */
export function isProductionHost(hostname?: string): boolean {
  try {
    const h = hostname ?? (typeof window !== "undefined" ? window.location.hostname : "");
    return PRODUCTION_HOST_RE.test(h);
  } catch {
    return false;
  }
}
