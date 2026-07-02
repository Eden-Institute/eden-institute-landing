import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ActiveProfileProvider } from "@/contexts/ActiveProfileContext";
import { ROUTES } from "@/lib/routes";
import ScrollToTop from "@/components/utils/ScrollToTop";
import PageViewTracker from "@/components/utils/PageViewTracker";
import MetaPixelTracker from "@/components/utils/MetaPixelTracker";
import Index from "./pages/Index";
import WhyEden from "./pages/WhyEden";
import Assessment from "./pages/Assessment";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Cookies from "./pages/Cookies";
import ConstitutionalHerbalism from "./pages/ConstitutionalHerbalism";
import NotFound from "./pages/NotFound";
import GuideSuccess from "./pages/GuideSuccess";
import Results from "./pages/Results";
import GuideLanding from "./pages/GuideLanding";
import Courses from "./pages/Courses";
import Homeschool from "./pages/Homeschool";
import HomeschoolWelcome from "./pages/HomeschoolWelcome";
import Community from "./pages/Community";
import TierTwoWaitlist from "./pages/TierTwoWaitlist";
import FounderLeads from "./pages/FounderLeads";
import { ApothecaryLayout } from "@/components/apothecary/ApothecaryLayout";
import { RequireAuth } from "@/components/apothecary/RequireAuth";
import { RequireTier } from "@/components/apothecary/RequireTier";
import ApothecaryIndex from "./pages/apothecary/ApothecaryIndex";
import HerbMonograph from "./pages/apothecary/HerbMonograph";
import Start from "./pages/apothecary/Start";
import WelcomeTour from "./pages/apothecary/WelcomeTour";
import SignUp from "./pages/apothecary/auth/SignUp";
import SignIn from "./pages/apothecary/auth/SignIn";
import Reset from "./pages/apothecary/auth/Reset";
import UpdatePassword from "./pages/apothecary/auth/UpdatePassword";
import Pricing from "./pages/apothecary/Pricing";
import Welcome from "./pages/apothecary/Welcome";
import Account from "./pages/apothecary/Account";
import ProfilesPage from "./pages/apothecary/ProfilesPage";
import Favorites from "./pages/apothecary/Favorites";
import { FeedbackButton } from "@/components/FeedbackButton";
import ConsentBanner from "@/components/ConsentBanner";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          {/* PR β (2026-05-02) — ActiveProfileProvider hoisted from
              ApothecaryLayout to global App scope.

              Why: the provider was previously mounted only inside the
              /apothecary/* layout, so navigating /apothecary → / unmounted
              it and wiped the active-profile selection in memory. Camila
              repro'd this on production: she switched the picker to her
              person-profile "Olivia" (Pattern: Frozen Knot), then clicked
              hamburger → Home, and the homepage rendered her primary
              user's Pattern (Burning Bowstring) instead of Olivia's.

              The localStorage key (eden.active_profile_id) already gave
              durable cross-session persistence; the in-memory React
              state just needed a provider that survives every route
              transition. Hoisting here makes the picker's selection
              authoritative across all surfaces — marketing, apothecary,
              guide pages — and means useEdenPattern resolves the Pattern
              of the active profile uniformly everywhere it's consumed.

              Order: AuthProvider must be ABOVE ActiveProfileProvider
              because the latter calls useAuth() to scope its
              person_profiles query to the signed-in user. Both must be
              inside QueryClientProvider for TanStack Query to work. */}
          <ActiveProfileProvider>
            {/* ScrollToTop — reset scroll on every route navigation. Lives
                inside BrowserRouter so useLocation is available. Sibling to
                <Routes> so it doesn't unmount with route transitions. */}
            <ScrollToTop />
            {/* Cookieless first-party page-view beacon (writes via record_page_view
                RPC). Sibling to <Routes> so it sees every navigation. */}
            <PageViewTracker />
            {/* Meta Pixel PageView on navigation — consent-gated (fires only
                after the visitor accepts marketing cookies). */}
            <MetaPixelTracker />
            <Routes>
              <Route path={ROUTES.HOME} element={<Index />} />
              <Route path={ROUTES.WHY_EDEN} element={<WhyEden />} />
              <Route path={ROUTES.ASSESSMENT} element={<Assessment />} />
              {/* v4.1.1 hotfix — defensive alias for the public quiz route.
                  The Navbar's state-aware CTA briefly pointed at /quiz (PR #65)
                  and PR #74 mounted the Navbar globally, exposing the dead
                  URL on every page. Real visitors clicking the CTA landed on
                  <NotFound /> and lost their attempts before any payload was
                  ever sent. /assessment is the canonical route per this file;
                  /quiz now redirects there so any stale browser cache,
                  externally-shared link, or future stray reference is
                  non-fatal. Replaces a missing-route 404 with a route the
                  router knows exists. */}
              <Route path={ROUTES.QUIZ_ALIAS} element={<Navigate to={ROUTES.ASSESSMENT} replace />} />
              <Route path={ROUTES.TERMS} element={<Terms />} />
              <Route path={ROUTES.PRIVACY} element={<Privacy />} />
              <Route path={ROUTES.COOKIES} element={<Cookies />} />
              <Route
                path={ROUTES.CONSTITUTIONAL_HERBALISM}
                element={<ConstitutionalHerbalism />}
              />
              <Route path={ROUTES.GUIDE_SUCCESS} element={<GuideSuccess />} />
              <Route path="/guide/:constitutionSlug" element={<GuideLanding />} />
              <Route path="/results/:constitutionSlug" element={<Results />} />
              <Route path={ROUTES.COURSES} element={<Courses />} />
              <Route path={ROUTES.HOMESCHOOL} element={<Homeschool />} />
              {/* /homeschool/welcome — Stripe Checkout success_url redirect
                  target for homeschool product purchases (sprouts_complete,
                  seedlings_complete, two_band_bundle). Receives session_id
                  + lookup_key query params; renders order confirmation copy
                  personalized by product. Visual confirmation only — the
                  stripe-webhook EF handles fulfillment (Supabase user
                  provisioning + bundle_buyer flag) server-side. */}
              <Route path={ROUTES.HOMESCHOOL_WELCOME} element={<HomeschoolWelcome />} />
              <Route path={ROUTES.COMMUNITY} element={<Community />} />
              <Route path={ROUTES.TIER_TWO_WAITLIST} element={<TierTwoWaitlist />} />
              {/* Founder-only lead-magnet dashboard. RequireAuth bounces anon
                  visitors to sign-in (return_to=/founder); the page itself shows
                  a restricted notice to logged-in non-founders. The real data
                  boundary is server-side: founder_lead_feed() is gated by
                  is_founder() (JWT email check), so the six other accounts get
                  "Not authorized" from the RPC regardless of the UI. */}
              <Route
                path={ROUTES.FOUNDER_LEADS}
                element={
                  <RequireAuth>
                    <FounderLeads />
                  </RequireAuth>
                }
              />
              {/* Apothecary application — Lane C Stage 6.3.4: auth-walled per §0.8 v3.3 #21.
                  v3.33 amendment (PR #51): Lock #21 RETIRED for pricing surface only —
                  /apothecary/pricing is now public per founder Q2 authorization to open
                  pricing pre-signup for conversion.
                  v3.4 amendment (CRO Phase 1, founder-approved redesign plan §2/§4):
                  Lock #21 further retired for (a) the bare /apothecary index — anon gets
                  the quiz-led ApothecaryWelcome value page instead of a signin bounce
                  (ApothecaryIndex branches on auth) — and (b) the public :herbId herb
                  monographs, which the Results matched-herb links target. Depth stays
                  gated server-side by herbs_directory_v; the auth wall remains on the
                  directory, account, profiles, favorites, and welcome surfaces. */}
              <Route path={ROUTES.APOTHECARY} element={<ApothecaryLayout />}>
                {/* Public surfaces */}
                <Route path="start" element={<Start />} />
                <Route path="auth/signup" element={<SignUp />} />
                <Route path="auth/signin" element={<SignIn />} />
                <Route path="auth/reset" element={<Reset />} />
                <Route path="auth/update-password" element={<UpdatePassword />} />
                {/* PR #51 v3.33: pricing made PUBLIC — retires Lock #21 for this surface. */}
                <Route path="pricing" element={<Pricing />} />
                {/* Index branches on auth: signed-in → ApothecaryHome
                    (directory, unchanged), anon → ApothecaryWelcome
                    (quiz-led value page). Must stay ONE index element —
                    see ApothecaryIndex docblock for why. */}
                <Route index element={<ApothecaryIndex />} />
                <Route
                  path="welcome-tour"
                  element={
                    <RequireAuth>
                      <WelcomeTour />
                    </RequireAuth>
                  }
                />
                <Route
                  path="welcome"
                  element={
                    <RequireAuth>
                      <Welcome />
                    </RequireAuth>
                  }
                />
                <Route
                  path="account"
                  element={
                    <RequireAuth>
                      <Account />
                    </RequireAuth>
                  }
                />
                {/* Stage 6.3.5 Phase B sub-task 4: Root multi-profile management.
                    Auth + tier gating is enforced by the page itself
                    (RequireAuth + RequireTier allow={["seed","root","practitioner"]}
                    per tier-cap restructure v2). */}
                <Route path="profiles" element={<ProfilesPage />} />
                {/* Stage 7.X save-favorites listing page. Auth enforced by
                    the page itself (RequireAuth); CRO Phase 3 retired the
                    RequireTier(seed+) wrapper so free users can see their
                    device-local 3-herb list (Phase 0). Schema in
                    herb_favorites table; hook + heart icon on HerbCard
                    shipped in PR #103 + #104. */}
                <Route path="favorites" element={<Favorites />} />
                {/* Stage 6.3.5 Phase B sub-task 4 Layer 1+2: in-app Pattern of
                    Eden quiz, mounted under ApothecaryLayout so the picker
                    pill is visible during the quiz. Root+ only — the Pattern
                    of Eden write path is a Root-tier clinical action per
                    Lock #40 (id-keyed Edge Functions to diagnostic_completions). */}
                <Route
                  path="quiz"
                  element={
                    <RequireAuth>
                      <RequireTier allow={["root", "practitioner"]}>
                        <Assessment />
                      </RequireTier>
                    </RequireAuth>
                  }
                />
                {/* Public herb monograph (CRO Phase 1) — /apothecary/:herbId
                    accepts the common-name slug ("marshmallow") or the H-code
                    ("H036"). React Router's ranked matching guarantees every
                    static sibling above (start, pricing, auth/*, account, …)
                    outranks this dynamic segment; the trade-off is that any
                    typo'd single-segment path lands here, so HerbMonograph
                    renders a not-found state for unknown params. Depth is
                    tier-gated server-side by herbs_directory_v. */}
                <Route path=":herbId" element={<HerbMonograph />} />
              </Route>
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            {/* v3.34 — global feedback affordance, mounted inside AuthProvider so the
                widget can include the signed-in user's email + bearer token when present. */}
            <FeedbackButton />
            <ConsentBanner />
          </ActiveProfileProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
