import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/why-eden" element={<WhyEden />} />
          <Route path="/assessment" element={<Assessment />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/cookies" element={<Cookies />} />
          <Route path="/constitutional-herbalism" element={<ConstitutionalHerbalism />} />
          <Route path="/guide/success" element={<GuideSuccess />} />
          <Route path="/guide/:constitutionSlug" element={<GuideLanding />} />
          <Route path="/results/:constitutionSlug" element={<Results />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/app" element={<AppPage />} />
          <Route path="/homeschool" element={<Homeschool />} />
          <Route path="/community" element={<Community />} />
          <Route path="/tier-2-waitlist" element={<TierTwoWaitlist />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
