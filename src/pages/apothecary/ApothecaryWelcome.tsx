import { Link } from "react-router-dom";
import { Leaf, Shield, Smartphone, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorldviewBand } from "@/components/landing/WorldviewBand";
import { TierComparison } from "@/components/apothecary/TierComparison";
import { useDocumentMeta } from "@/lib/useDocumentMeta";
import { ROUTES } from "@/lib/routes";

/**
 * ApothecaryWelcome — what an ANONYMOUS visitor sees at bare /apothecary
 * (CRO Phase 1, v3.4 amendment to Lock §0.8 #21: anon traffic to the app's
 * front door gets a quiz-led value page, never a sign-in form).
 *
 * Successor to the old AppPage marketing page, which was dead code — its
 * flat route lost React Router's ranked matching to the layout's
 * RequireAuth index, so anon /apothecary bounced to signin. This renders
 * as the layout INDEX branch for signed-out users (see ApothecaryIndex),
 * inside ApothecaryLayout, so it must NOT mount its own Navbar/Footer.
 *
 * Conversion order per the approved redesign plan: quiz first (the
 * universal entry, no account needed), then what the app is, then the
 * tiers. Signed-in users never see this — ApothecaryIndex renders
 * ApothecaryHome for them.
 */
export default function ApothecaryWelcome() {
  useDocumentMeta({
    title: "Eden Apothecary | Constitutional Herb Guide | The Eden Institute",
    description:
      "Find your body pattern with the free 2-minute quiz and meet the herbs that fit it. Rooted in Biblical terrain medicine. Built for Christian families.",
    canonical: "https://edeninstitute.health/apothecary",
  });

  return (
    <div className="bg-background">
      {/* ── Hero: the quiz is the single primary action ── */}
      <section
        className="py-20 md:py-28 px-6"
        style={{ backgroundColor: "hsl(var(--eden-cream))" }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <p
            className="font-accent text-sm tracking-[0.3em] uppercase mb-6"
            style={{ color: "hsl(var(--eden-gold))" }}
          >
            Eden Apothecary
          </p>
          <h1
            className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6"
            style={{ color: "hsl(var(--eden-bark))" }}
          >
            Which of the eight body patterns
            <br />
            <span className="italic">did God design you with?</span>
          </h1>
          <div
            className="w-16 h-px mx-auto my-8"
            style={{ backgroundColor: "hsl(var(--eden-gold))" }}
          />
          <p className="font-body text-lg text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
            Take the free 2-minute Pattern of Eden quiz and meet the herbs
            that fit your constitution. Rooted in Biblical terrain medicine.
            Built for Christian families.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="eden" size="xl" asChild>
              <Link to={ROUTES.ASSESSMENT} data-cta="apothecary-quiz-hero">
                Take the 2-Minute Quiz
              </Link>
            </Button>
            <Button variant="eden-outline" size="xl" asChild>
              <a href="#tiers" data-cta="apothecary-hero-see-plans">
                See Plans
              </a>
            </Button>
          </div>
          <p className="font-body text-xs text-muted-foreground mt-4">
            No account needed to start. Already have one?{" "}
            <Link
              to={ROUTES.APOTHECARY_SIGNIN}
              className="underline underline-offset-4 hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            .
          </p>
        </div>
      </section>

      <WorldviewBand caption="On the source of vital force" headline={null} />

      {/* ── What the app is ── */}
      <section className="py-16 px-6 bg-background">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2
              className="font-serif text-3xl font-bold mb-4"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              Built Around Your Body Pattern
            </h2>
            <p className="font-body text-muted-foreground max-w-2xl mx-auto">
              Eight body patterns. One personalised herb library. Terrain
              intelligence, not symptom lookup.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div
              className="rounded-lg p-6 border"
              style={{
                borderColor: "hsl(var(--border))",
                backgroundColor: "hsl(var(--eden-cream) / 0.4)",
              }}
            >
              <Smartphone
                className="w-7 h-7 mb-4"
                style={{ color: "hsl(var(--eden-gold))" }}
              />
              <h3
                className="font-serif text-base font-semibold mb-2"
                style={{ color: "hsl(var(--eden-bark))" }}
              >
                Body Pattern Quiz
              </h3>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">
                Discover your innate body pattern in 2 minutes. All 8 patterns
                mapped to herbs, tissues, and tendencies.
              </p>
            </div>
            <div
              className="rounded-lg p-6 border"
              style={{
                borderColor: "hsl(var(--border))",
                backgroundColor: "hsl(var(--eden-cream) / 0.4)",
              }}
            >
              <Leaf
                className="w-7 h-7 mb-4"
                style={{ color: "hsl(var(--eden-gold))" }}
              />
              <h3
                className="font-serif text-base font-semibold mb-2"
                style={{ color: "hsl(var(--eden-bark))" }}
              >
                Herb Library
              </h3>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">
                100 herb monographs with terrain intelligence: energetics,
                tissue affinities, body pattern matches, and safety notes.
              </p>
            </div>
            <div
              className="rounded-lg p-6 border"
              style={{
                borderColor: "hsl(var(--border))",
                backgroundColor: "hsl(var(--eden-cream) / 0.4)",
              }}
            >
              <Shield
                className="w-7 h-7 mb-4"
                style={{ color: "hsl(var(--eden-gold))" }}
              />
              <h3
                className="font-serif text-base font-semibold mb-2"
                style={{ color: "hsl(var(--eden-bark))" }}
              >
                Biblical Foundation
              </h3>
              {/* Customer copy only — the internal editorial rule this
                  reflects (classical observation in, theological attribution
                  out) is Lock #44; the register citation stays out of the UI. */}
              <p className="font-body text-sm text-muted-foreground leading-relaxed">
                Yahweh as the source of vital force, named plainly. Classical
                pattern observation honored across traditions, anchored in
                Scripture alone.
              </p>
            </div>
            <div
              className="rounded-lg p-6 border"
              style={{
                borderColor: "hsl(var(--border))",
                backgroundColor: "hsl(var(--eden-cream) / 0.4)",
              }}
            >
              <Star
                className="w-7 h-7 mb-4"
                style={{ color: "hsl(var(--eden-gold))" }}
              />
              <h3
                className="font-serif text-base font-semibold mb-2"
                style={{ color: "hsl(var(--eden-bark))" }}
              >
                Course Integration
              </h3>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">
                Built as the clinical companion to the Eden Institute courses,
                so what you study in class is at your fingertips in the
                kitchen.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Public tier pricing — anchored by id="tiers" + id="tier-{id}" so
          the hero "See Plans" anchor and useTierAwareCTA deep links both
          resolve. */}
      <TierComparison
        eyebrow="Pricing"
        heading={
          <>
            Pricing for every season{" "}
            <span className="italic">of stewardship.</span>
          </>
        }
        lead="See exactly what's inside each tier before you sign up. All hundred herbs at every tier. Depth is what you unlock."
        background="cream"
      />

      {/* ── Closing: quiz again, the one primary action ── */}
      <section
        className="py-20 px-6"
        style={{ backgroundColor: "hsl(var(--eden-forest))" }}
      >
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-serif text-3xl font-bold mb-4 text-white">
            Start With Your Pattern
          </h2>
          <p
            className="font-body text-lg mb-8 leading-relaxed"
            style={{ color: "rgba(255,255,255,0.85)" }}
          >
            The quiz is free, takes 2 minutes, and needs no account. Your
            result shows the herbs matched to your body pattern, and a free
            account saves it so the directory reads against it.
          </p>
          <Button
            variant="eden-outline"
            size="xl"
            className="border-white text-white hover:bg-white hover:text-foreground"
            asChild
          >
            <Link to={ROUTES.ASSESSMENT} data-cta="apothecary-quiz-bottom">
              Take the 2-Minute Quiz
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
