/**
 * Single source of truth for client-side route paths.
 *
 * Import from here instead of writing string literals in <Link to="..."> or
 * useNavigate(). App.tsx <Route path={...}> reads from the same module —
 * so a missing or renamed entry is a compile error, not a runtime 404.
 *
 * v4.1.1 hotfix (PR #75) caught one Navbar miswiring at 4 lost real-traffic
 * submissions. This module makes that class of bug structurally impossible.
 */

export const ROUTES = {
  // Public marketing
  HOME: "/",
  WHY_EDEN: "/why-eden",
  ASSESSMENT: "/assessment", // canonical public quiz
  CONSTITUTIONAL_HERBALISM: "/constitutional-herbalism",
  COURSES: "/courses",
  HOMESCHOOL: "/homeschool",
  COMMUNITY: "/community",
  TIER_TWO_WAITLIST: "/tier-2-waitlist",

  // Legal
  TERMS: "/terms",
  PRIVACY: "/privacy",
  COOKIES: "/cookies",

  // Guide / results funnel (parameterized)
  GUIDE_SUCCESS: "/guide/success",
  GUIDE: (slug: string) => `/guide/${slug}`,
  RESULTS: (slug: string) => `/results/${slug}`,

  // Apothecary marketing
  APOTHECARY: "/apothecary",
  APOTHECARY_START: "/apothecary/start",
  APOTHECARY_PRICING: "/apothecary/pricing",

  // Apothecary auth
  APOTHECARY_SIGNUP: "/apothecary/auth/signup",
  APOTHECARY_SIGNIN: "/apothecary/auth/signin",
  APOTHECARY_RESET: "/apothecary/auth/reset",
  APOTHECARY_UPDATE_PASSWORD: "/apothecary/auth/update-password",

  // Apothecary auth-walled
  APOTHECARY_WELCOME_TOUR: "/apothecary/welcome-tour",
  APOTHECARY_WELCOME: "/apothecary/welcome",
  APOTHECARY_ACCOUNT: "/apothecary/account",
  APOTHECARY_PROFILES: "/apothecary/profiles",
  APOTHECARY_QUIZ: "/apothecary/quiz", // Root+Practitioner only

  // Aliases (route declared but redirects elsewhere — see App.tsx)
  QUIZ_ALIAS: "/quiz", // redirects to ASSESSMENT (v4.1.1 hotfix guard)
} as const;
