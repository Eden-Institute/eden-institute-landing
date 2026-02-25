import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import heroBg from "@/assets/hero-botanical.jpg";
import WaitlistModal from "./WaitlistModal";
import AssessmentModal from "./AssessmentModal";

const APP_AUDIENCE_ID = "cebd3478-b344-41b7-98c8-8bcf0e0108da";

const HeroSection = () => {
  const [appModal, setAppModal] = useState(false);
  const [assessmentModal, setAssessmentModal] = useState(false);

  useEffect(() => {
    if (window.location.hash === "#assessment") {
      setAssessmentModal(true);
    }
  }, []);

  return (
    <section id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 parchment-texture" />
        <img
          src={heroBg}
          alt="Botanical engravings"
          className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-multiply"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/80" />
      </div>

      {/* Content */}
      <div className="relative z-10 eden-container text-center section-padding">
        <p className="font-accent text-base md:text-lg tracking-[0.3em] uppercase gold-text mb-8 md:mb-12 animate-fade-in">
          Back to Eden. Back to Truth.
        </p>

        <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl font-bold text-foreground leading-tight mb-6 md:mb-8 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          Herbal Medicine, Restored to Its
          <br />
          <span className="italic">Biblical Foundation.</span>
        </h1>

        <div className="eden-divider" />

        <p className="font-body text-base md:text-lg lg:text-xl text-muted-foreground max-w-3xl mx-auto mb-6 md:mb-8 leading-relaxed animate-fade-in" style={{ animationDelay: '0.4s' }}>
          A constitutional and energetics-based framework for reading the body, matching the plant, and stewarding health according to design&nbsp;— not suppression.
        </p>

        <blockquote className="scripture-block text-sm md:text-base lg:text-lg text-muted-foreground max-w-2xl mx-auto mb-8 md:mb-12 text-left animate-fade-in border-secondary-foreground" style={{ animationDelay: '0.5s' }}>
          "And God said, 'Behold, I have given you every plant yielding seed that is on the face of all the earth, and every tree with seed in its fruit. You shall have them for food.'"
          <footer className="mt-3 text-sm not-italic tracking-wider uppercase text-muted-foreground/60 font-body">
            — Genesis 1:29 (NASB)
          </footer>
        </blockquote>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 md:gap-4 animate-fade-in" style={{ animationDelay: '0.6s' }}>
          <Button variant="eden" size="xl" className="w-full sm:w-auto min-h-[48px]" onClick={() => setAssessmentModal(true)}>
            → Discover Your Constitutional Type
          </Button>
          <a href="https://www.amazon.com/s?k=back+to+eden+series+eden+institute" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
            <Button variant="eden-outline" size="xl" className="w-full min-h-[48px]">
              → Explore the Books
            </Button>
          </a>
          <Button variant="eden-outline" size="xl" className="w-full sm:w-auto min-h-[48px]" onClick={() => setAppModal(true)}>
            → Join the App Beta
          </Button>
        </div>

        <p className="mt-12 md:mt-20 font-accent text-sm tracking-[0.4em] uppercase text-muted-foreground">
          The Eden Institute
        </p>
      </div>

      <AssessmentModal open={assessmentModal} onOpenChange={setAssessmentModal} />

      <WaitlistModal
        open={appModal}
        onOpenChange={setAppModal}
        audienceId={APP_AUDIENCE_ID}
        title="Join the App Beta Waitlist"
      />
    </section>
  );
};

export default HeroSection;
