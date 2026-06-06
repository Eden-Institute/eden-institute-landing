import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { Smartphone, Leaf, Shield, Star } from "lucide-react";
import { WorldviewBand } from "@/components/landing/WorldviewBand";
import { TierComparison } from "@/components/apothecary/TierComparison";
import { useDocumentMeta } from "@/lib/useDocumentMeta";
import { ROUTES } from "@/lib/routes";

const AppPage = () => {
  useDocumentMeta({
    title: "Eden Apothecary — Constitutional Herb Guide | The Eden Institute",
    description:
      "Eden Apothecary matches herbs to your body pattern — your body's innate constitution — so you're never guessing. Rooted in Biblical terrain medicine. Built for Christian families.",
    canonical: "https://edeninstitute.health/apothecary",
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="py-20 md:py-28 px-6" style={{ backgroundColor: "hsl(var(--eden-cream))" }}>
        <div className="max-w-4xl mx-auto text-center">
          <p className="font-accent text-sm tracking-[0.3em] uppercase mb-6" style={{ color: "hsl(var(--eden-gold))" }}>
            Eden Apothecary
          </p>
          <h1
            className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6"
            style={{ color: "hsl(var(--eden-bark))" }}
          >
            Your Constitutional Herb Guide.
            <br />
            <span className="italic">In Your Pocket.</span>
          </h1>
          <div className="w-16 h-px mx-auto my-8" style={{ backgroundColor: "hsl(var(--eden-gold))" }} />
          <p className="font-body text-lg text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
            Eden Apothecary matches herbs to your body pattern — your body's innate constitution — so you're never
            guessing. Rooted in Biblical terrain medicine. Built for Christian families.
          </p>
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-body mb-8"
            style={{ backgroundColor: "hsl(var(--eden-gold) / 0.12)", color: "hsl(var(--eden-gold))" }}
          >
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: "hsl(var(--eden-gold))" }}
            />
            Available now — free to start
          </div>
          {/* The app is live. Primary CTA opens the real tier-select / onboarding
              surface (/apothecary/start) where visitors create a free account and
              choose a plan; secondary jumps to the in-page tier comparison. */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="eden" size="xl" asChild>
              <Link to={ROUTES.APOTHECARY_START} data-cta="apothecary-start-hero">
                Start Free
              </Link>
            </Button>
            <Button variant="eden-outline" size="xl" asChild>
              <a href="#tiers" data-cta="apothecary-hero-see-plans">
                See Plans
              </a>
            </Button>
          </div>
        </div>
      </section>

      <WorldviewBand caption="On the source of vital force" headline={null} />

      <section className="py-16 px-6 bg-background">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl font-bold mb-4" style={{ color: "hsl(var(--eden-bark))" }}>
              Built Around Your Body Pattern
            </h2>
            <p className="font-body text-muted-foreground max-w-2xl mx-auto">
              Eight body patterns. One personalised herb library. Terrain intelligence, not symptom lookup.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="rounded-lg p-6 border" style={{ borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--eden-cream) / 0.4)" }}>
              <Smartphone className="w-7 h-7 mb-4" style={{ color: "hsl(var(--eden-gold))" }} />
              <h3 className="font-serif text-base font-semibold mb-2" style={{ color: "hsl(var(--eden-bark))" }}>
                Body Pattern Quiz
              </h3>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">
                Discover your innate body pattern in 2 minutes. All 8 patterns mapped to herbs, tissues, and tendencies.
              </p>
            </div>
            <div className="rounded-lg p-6 border" style={{ borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--eden-cream) / 0.4)" }}>
              <Leaf className="w-7 h-7 mb-4" style={{ color: "hsl(var(--eden-gold))" }} />
              <h3 className="font-serif text-base font-semibold mb-2" style={{ color: "hsl(var(--eden-bark))" }}>
                Herb Library
              </h3>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">
                70+ herbs with terrain intelligence — energetics, tissue affinities, body pattern matches, and safety notes.
              </p>
            </div>
            <div className="rounded-lg p-6 border" style={{ borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--eden-cream) / 0.4)" }}>
              <Shield className="w-7 h-7 mb-4" style={{ color: "hsl(var(--eden-gold))" }} />
              <h3 className="font-serif text-base font-semibold mb-2" style={{ color: "hsl(var(--eden-bark))" }}>
                Biblical Foundation
              </h3>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">
                Yahweh as the source of vital force, named plainly. Classical pattern observation across traditions, with theological attribution stripped per Lock #44.
              </p>
            </div>
            <div className="rounded-lg p-6 border" style={{ borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--eden-cream) / 0.4)" }}>
              <Star className="w-7 h-7 mb-4" style={{ color: "hsl(var(--eden-gold))" }} />
              <h3 className="font-serif text-base font-semibold mb-2" style={{ color: "hsl(var(--eden-bark))" }}>
                Course Integration
              </h3>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">
                Eden Institute graduates unlock deeper clinical herb data — making the app a living practicum, not just a reference.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Public Apothecary tier pricing — four-tier comparison
          (Free / Seed / Root / Practitioner) with prices, persona
          labels, taglines, and feature lists. Anchored by
          id="tier-{free|seed|root|practitioner}" so existing
          useTierAwareCTA upgrade hrefs continue to resolve. */}
      <TierComparison
        eyebrow="Pricing"
        heading={
          <>
            Pricing for every season{" "}
            <span className="italic">of stewardship.</span>
          </>
        }
        lead="See exactly what's inside each tier before you sign up. Hundred herbs at every tier. Depth is what you unlock."
        background="cream"
      />

      <section className="py-20 px-6" style={{ backgroundColor: "hsl(var(--eden-forest))" }}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-serif text-3xl font-bold mb-4 text-white">Start Today</h2>
          <p className="font-body text-lg mb-8 leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>
            Your herbs, matched to your body pattern — available now. Create a free account in minutes, and upgrade to
            Seed or Root whenever you're ready for more depth.
          </p>
          <Button
            variant="eden-outline"
            size="xl"
            className="border-white text-white hover:bg-white hover:text-foreground"
            asChild
          >
            <Link to={ROUTES.APOTHECARY_START} data-cta="apothecary-start-bottom">
              Start Free →
            </Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default AppPage;
