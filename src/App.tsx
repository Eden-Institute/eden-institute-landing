import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ROUTES } from "@/lib/routes";
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
import AppPage from "./pages/AppPage";
import Homeschool from "./pages/Homeschool";
import Community from "./pages/Community";
import TierTwoWaitlist from "./pages/TierTwoWaitlist";
import { ApothecaryLayout } from "@/components/apothecary/ApothecaryLayout";
import { RequireAuth } from "@/components/apothecary/RequireAuth";
import { RequireTier } from "@/components/apothecary/RequireTier";
import ApothecaryHome from "./pages/apothecary/ApothecaryHome";
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
import { FeedbackButton } from "@/components/FeedbackButton";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
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
            <Route path={ROUTES.APOTHECARY} element={<AppPage />} />
            <Route path={ROUTES.HOMESCHOOL} element={<Homeschool />} />
            <Route path={ROUTES.COMMUNITY} element={<Community />} />
            <Route path={ROUTES.TIER_TWO_WAITLIST} element={<TierTwoWaitlist />} />
            {/* Apothecary application — Lane C Stage 6.3.4: auth-walled per §0.8 v3.3 #21.
                v3.33 amendment (PR #51): Lock #21 RETIRED for pricing surface only —
                /apothecary/pricing is now public per founder Q2 authorization to open
                pricing pre-signup for conversion. All other auth-walled surfaces preserved. */}
            <Route path={ROUTES.APOTHECARY} element={<ApothecaryLayout />}>
              {/* Public surfaces */}
              <Route path="start" element={<Start />} />
              <Route path="auth/signup" element={<SignUp />} />
              <Route path="auth/signin" element={<SignIn />} />
              <Route path="auth/reset" element={<Reset />} />
              <Route path="auth/update-password" element={<UpdatePassword />} />
              {/* PR #51 v3.33: pricing made PUBLIC — retires Lock #21 for this surface. */}
              <Route path="pricing" element={<Pricing />} />
              {/* Auth-walled surfaces */}
              <Route
                index
                element={
                  <RequireAuth>
                    <ApothecaryHome />
                  </RequireAuth>
                }
              />
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
                  (RequireAuth + RequireTier allow={["root","practitioner"]}). */}
              <Route path="profiles" element={<ProfilesPage />} />
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
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          {/* v3.34 — global feedback affordance, mounted inside AuthProvider so the
              widget can include the signed-in user's email + bearer token when present. */}
          <FeedbackButton />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
