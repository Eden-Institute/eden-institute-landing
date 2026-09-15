/**
 * src/lib/routes.ts — single source of truth for client-side route paths.
 *
 * Why this exists
 * ───────────────
 * On 2026-04-29 the global Navbar's "Take the Quiz" CTA pointed at /quiz
 * (introduced in PR #65 "state-aware Navbar CTA"). The actual route
 * registered in App.tsx is /assessment. PR #74 mounted the Navbar globally
 * across 8 additional pages, exposing the dead URL site-wide, and 4
 * real-traffic quiz submissions were lost in a 24h window before the 404
 * was caught. Hotfix: PR #75.
 *
 * That class of bug — a string literal that LOOKS like a real route but
 * isn't — cannot be caught at compile time when routes are typed as raw
 * string literals scattered across 30+ callsites. This module makes route
 * naming structurally sound:
 *
 *   import { ROUTES } from "@/lib/routes";
 *   <Link to={ROUTES.ASSESSMENT}>…</Link>          // ✅ compiles
 *   <Link to={ROUTES.QIUZ}>…</Link>                 // ❌ TS error: typo
 *   navigate(ROUTES.RESULTS("pressure-cooker"))     // ✅ parameterized
 *
 * App.tsx <Route path={...}> reads from this module (nested Apothecary
 * children via childPath()), so any rename touches one file; routes.test.ts
 * fails if a registered path drifts.
 *
 * Add a route?  Add it here AND add the matching <Route> in App.tsx.
 * Rename a route? Rename in here; the compiler tells you what else to fix.
 */

/**
 * ROUTES — the canonical client-side route table.
 *
 * String values: literal paths the React Router knows.
 * Function values: parameterized helpers; pass the slug/id to get the path.
 */
export const ROUTES = {
  // ── Public SPA surfaces (see ASTRO_PAGES for Astro-served marketing pages) ──
  // "/" is served by Astro (web/pages/index.astro). The SPA has no homepage; its "/" route only hands a stray client-side navigation to the real page (components/utils/HomeRedirect.tsx). Reach it with a full navigation (<a href>), never <Link>.
  HOME: "/",
  ASSESSMENT: "/assessment",
  CONSTITUTIONAL_HERBALISM: "/constitutional-herbalism",
  HOMESCHOOL_WELCOME: "/homeschool/welcome",
  TIER_TWO_WAITLIST: "/tier-2-waitlist",

  // ── Founder / admin (auth-walled; server-gated by is_founder()) ──
  FOUNDER_LEADS: "/founder",
  // FOUNDER_STUDIO ("/studio") removed 2026-07-26. The Ad Studio was retired at the
  // founder's request. Its route, 20 source files, 10 test files, 3 edge functions
  // and 8 tables were removed together; see chore/remove-studio.

  // Practitioner clinical workspace (Phase 3), launched 2026-07-09: linked
  // from ApothecaryNav for practitioner-tier users. Server boundary:
  // practitioner-clinical EF gates on subscription_tier=practitioner
  // (founder allowlisted for support/verification).
  PRACTITIONER_CLINIC: "/practitioner",

  // ── Legal ──
  TERMS: "/terms",
  PRIVACY: "/privacy",
  COOKIES: "/cookies",

  // ── Guide / results funnel ──
  GUIDE_SUCCESS: "/guide/success",
  GUIDE: (slug: string) => `/guide/${slug}` as const,
  RESULTS: (slug: string) => `/results/${slug}` as const,

  // ── Apothecary marketing ──
  APOTHECARY: "/apothecary",
  APOTHECARY_START: "/apothecary/start",
  APOTHECARY_PRICING: "/apothecary/pricing",
  /**
   * Public herb monograph (CRO Phase 1). `slugOrId` accepts either the
   * derived common-name slug ("marshmallow", the canonical share URL) or
   * the H-code herb_id ("H036") — HerbMonograph resolves both. Slugs come
   * from herbSlug() in src/lib/herbLinks.ts.
   */
  APOTHECARY_HERB: (slugOrId: string) => `/apothecary/${slugOrId}` as const,

  // ── Apothecary auth ──
  APOTHECARY_SIGNUP: "/apothecary/auth/signup",
  APOTHECARY_SIGNIN: "/apothecary/auth/signin",
  APOTHECARY_RESET: "/apothecary/auth/reset",
  APOTHECARY_UPDATE_PASSWORD: "/apothecary/auth/update-password",

  // ── Apothecary auth-walled ──
  APOTHECARY_WELCOME_TOUR: "/apothecary/welcome-tour",
  APOTHECARY_WELCOME: "/apothecary/welcome",
  APOTHECARY_ACCOUNT: "/apothecary/account",
  APOTHECARY_PROFILES: "/apothecary/profiles",
  APOTHECARY_FAVORITES: "/apothecary/favorites",  // Stage 7.X save-favorites (auth required; Seed gate retired in CRO Phase 3, see App.tsx)
  APOTHECARY_QUIZ: "/apothecary/quiz",  // Root + Practitioner only

  // ── Aliases & redirects (declared here, redirected in App.tsx) ──
  /**
   * v4.1.1 hotfix (PR #75): Navbar briefly pointed at /quiz instead of
   * /assessment. App.tsx redirects this alias to ASSESSMENT so external
   * links and stale browser caches keep working.
   */
  QUIZ_ALIAS: "/quiz",
} as const;

/**
 * Pages built and served by ASTRO (web/pages/*.astro). They are NOT React
 * Router routes. Use only in a plain <a href> or window.location, never in
 * <Link to> or navigate(); the router has no <Route> for them and renders
 * NotFound.
 */
export const ASTRO_PAGES = {
  WHY_EDEN: "/why-eden",
  COURSES: "/courses",
  HOMESCHOOL: "/homeschool",
  COMMUNITY: "/community",
} as const;

/**
 * Relative child segment for a nested <Route> under `parent` (default
 * /apothecary). Throws if `full` is not under `parent`, so a rename that
 * breaks nesting fails in tests instead of 404ing in production.
 */
export function childPath(full: string, parent: string = ROUTES.APOTHECARY): string {
  const prefix = `${parent}/`;
  if (!full.startsWith(prefix)) {
    throw new Error(`route ${full} is not nested under ${parent}`);
  }
  return full.slice(prefix.length);
}
