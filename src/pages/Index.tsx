import HeroSection from "@/components/landing/HeroSection";
import ProblemSection from "@/components/landing/ProblemSection";
import FrameworkSection from "@/components/landing/FrameworkSection";
import BooksSection from "@/components/landing/BooksSection";
import CourseSection from "@/components/landing/CourseSection";
import AppSection from "@/components/landing/AppSection";
import LeadFunnelSection from "@/components/landing/LeadFunnelSection";
import TheologicalSection from "@/components/landing/TheologicalSection";
import FinalCTASection from "@/components/landing/FinalCTASection";
import Footer from "@/components/landing/Footer";

const Index = () => {
  return (
    <main className="min-h-screen">
      <HeroSection />
      <ProblemSection />
      <FrameworkSection />
      <BooksSection />
      <CourseSection />
      <AppSection />
      <LeadFunnelSection />
      <TheologicalSection />
      <FinalCTASection />
      <Footer />
    </main>
  );
};

export default Index;
