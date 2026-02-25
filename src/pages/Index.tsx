import HeroSection from "@/components/landing/HeroSection";
import WhyDifferentSection from "@/components/landing/WhyDifferentSection";
import BooksSection from "@/components/landing/BooksSection";
import AppSection from "@/components/landing/AppSection";
import Footer from "@/components/landing/Footer";

const Index = () => {
  return (
    <main className="min-h-screen">
      <HeroSection />
      <WhyDifferentSection />
      <BooksSection />
      <AppSection />
      <Footer />
    </main>
  );
};

export default Index;
