import { Button } from "@/components/ui/button";
import heroBg from "@/assets/hero-botanical.jpg";

const HeroSection = () => {
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
        {/* Top tagline */}
        <p className="font-accent text-lg tracking-[0.3em] uppercase gold-text mb-12 animate-fade-in">
          Back to Eden. Back to Truth.
        </p>

        <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-foreground leading-tight mb-8 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          Herbal Medicine, Restored to Its
          <br />
          <span className="italic">Biblical Foundation.</span>
        </h1>

        <div className="eden-divider" />

        <p className="font-body text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-12 leading-relaxed animate-fade-in" style={{ animationDelay: '0.4s' }}>
          A constitutional and energetics-based framework for reading the body, matching the plant, and stewarding health according to design&nbsp;— not suppression.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in" style={{ animationDelay: '0.6s' }}>
          <Button variant="eden" size="xl">
            → Take the Constitution Assessment
          </Button>
          <Button variant="eden-outline" size="xl">
            → Join the App Beta Waitlist
          </Button>
        </div>

        {/* Institute name */}
        <p className="mt-20 font-accent text-sm tracking-[0.4em] uppercase text-muted-foreground">
          The Eden Institute
        </p>
      </div>
    </section>
  );
};

export default HeroSection;
