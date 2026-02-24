import { useState } from "react";
import { Button } from "@/components/ui/button";
import heroBg from "@/assets/hero-botanical.jpg";
import WaitlistModal from "./WaitlistModal";

const COURSE_AUDIENCE_ID = "89e7bfad-5e08-44c6-9a5c-ff8e9cf8ee1d";

const HeroSection = () => {
  const [courseModal, setCourseModal] = useState(false);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
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
        <p className="font-accent text-lg tracking-[0.3em] uppercase gold-text mb-12 animate-fade-in">
          Back to Eden. Back to Truth.
        </p>

        <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-foreground leading-tight mb-8 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          Herbal Medicine, Restored to Its
          <br />
          <span className="italic">Biblical Foundation.</span>
        </h1>

        <div className="eden-divider" />

        <p className="font-body text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed animate-fade-in" style={{ animationDelay: '0.4s' }}>
          A constitutional and energetics-based framework for reading the body, matching the plant, and stewarding health according to design&nbsp;— not suppression.
        </p>

        <blockquote className="scripture-block text-base md:text-lg text-muted-foreground max-w-2xl mx-auto mb-12 text-left animate-fade-in" style={{ animationDelay: '0.5s' }}>
          "And God said, 'Behold, I have given you every plant yielding seed that is on the face of all the earth, and every tree with seed in its fruit. You shall have them for food.'"
          <footer className="mt-3 text-sm not-italic tracking-wider uppercase text-muted-foreground/60 font-body">
            — Genesis 1:29 (NASB)
          </footer>
        </blockquote>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in" style={{ animationDelay: '0.6s' }}>
          <a href="https://www.amazon.com/s?k=back+to+eden+series+eden+institute" target="_blank" rel="noopener noreferrer">
            <Button variant="eden" size="xl">
              → Explore the Series
            </Button>
          </a>
          <Button variant="eden-outline" size="xl" onClick={() => setCourseModal(true)}>
            → Join the Foundations Course Waitlist
          </Button>
        </div>

        <p className="mt-20 font-accent text-sm tracking-[0.4em] uppercase text-muted-foreground">
          The Eden Institute
        </p>
      </div>

      <WaitlistModal
        open={courseModal}
        onOpenChange={setCourseModal}
        audienceId={COURSE_AUDIENCE_ID}
        title="Join the Foundations Course Waitlist"
      />
    </section>
  );
};

export default HeroSection;
