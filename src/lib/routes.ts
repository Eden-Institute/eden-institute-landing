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
 * App.tsx <Route path={...}> reads from the same module — so any rename
 * touches one file and the compiler points at every consumer.
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
  // ── Public marketing surfaces ──
  HOME: "/",
  WHY_EDEN: "/why-eden",
  ASSESSMENT: "/assessment",
  CONSTITUTIONAL_HERBALISM: "/constitutional-herbalism",
  COURSES: "/courses",
  HOMESCHOOL: "/homeschool",
  COMMUNITY: "/community",
  TIER_TWO_WAITLIST: "/tier-2-waitlist",

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
  APOTHECARY_QUIZ: "/apothecary/quiz",  // Root + Practitioner only

  // ── Aliases & redirects (declared here, redirected in App.tsx) ──
  /**
   * v4.1.1 hotfix (PR #75): Navbar briefly pointed at /quiz instead of
   * /assessment. App.tsx redirects this alias to ASSESSMENT so external
   * links and stale browser caches keep working.
   */
  QUIZ_ALIAS: "/quiz",
} as const;

/** Convenience type — keys of the ROUTES table. */
export type RouteKey = keyof typeof ROUTES;
