import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/why-eden" element={<WhyEden />} />
            <Route path="/assessment" element={<Assessment />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/cookies" element={<Cookies />} />
            <Route
              path="/constitutional-herbalism"
              element={<ConstitutionalHerbalism />}
            />
            <Route path="/guide/success" element={<GuideSuccess />} />
            <Route path="/guide/:constitutionSlug" element={<GuideLanding />} />
            <Route path="/results/:constitutionSlug" element={<Results />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/app" element={<AppPage />} />
            <Route path="/homeschool" element={<Homeschool />} />
            <Route path="/community" element={<Community />} />
            <Route path="/tier-2-waitlist" element={<TierTwoWaitlist />} />
            {/* Apothecary application — Lane C Stage 6.3.4: auth-walled per §0.8 v3.3 #21. */}
            <Route path="/apothecary" element={<ApothecaryLayout />}>
              {/* Public surfaces */}
              <Route path="start" element={<Start />} />
              <Route path="auth/signup" element={<SignUp />} />
              <Route path="auth/signin" element={<SignIn />} />
              <Route path="auth/reset" element={<Reset />} />
              <Route path="auth/update-password" element={<UpdatePassword />} />
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
                path="pricing"
                element={
                  <RequireAuth>
                    <Pricing />
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
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
