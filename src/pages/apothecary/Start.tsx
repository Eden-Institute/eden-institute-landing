import { Link } from "react-router-dom";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PublicTierCard } from "@/components/apothecary/PublicTierCard";
import { Button } from "@/components/ui/button";

/**
 * Public tier-select landing page (`/apothecary/start`).
 *
 * Per Locked Decision §0.8 v3.3 #21–#22:
 *   "Apothecary access pattern is auth-walled. The marketing landing page
 *    is a tier-select gate that doubles as email capture."
 *
 * Surface: hero → product peek → three tier cards (Free / Seed / Root) →
 * FAQ. Practitioner is hidden until end of 2027 per §0.8.
 *
 * Authenticated visitors hitting this URL are redirected straight to the
 * directory so the tier-select isn't shown to people who already chose.
 */
export default function Start() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate("/apothecary", { replace: true });
    }
  }, [user, loading, navigate]);

  return (
    <div>
      {/* Hero */}
      <section
        className="py-16 md:py-24 px-6"
        style={{ backgroundColor: "hsl(var(--eden-cream))" }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <p
            className="font-accent text-xs tracking-[0.3em] uppercase mb-4"
            style={{ color: "hsl(var(--eden-gold))" }}
          >
            Eden Apothecary
          </p>
          <h1
            className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6"
            style={{ color: "hsl(var(--eden-bark))" }}
          >
            A clinical reasoning partner,{" "}
            <span className="italic">not a symptom index.</span>
          </h1>
          <p className="font-body text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-8">
            One hundred herbs anchored to constitutional patterns, tissue
            states, and stewardship — taught the way the body actually
            organizes itself.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="eden" size="lg" asChild>
              <Link to="/apothecary/auth/signup">Create your free account</Link>
            </Button>
            <Button variant="eden-outline" size="lg" asChild>
              <Link to="/apothecary/auth/signin">Sign in</Link>
            </Button>
          </div>
          <p className="font-body text-xs text-muted-foreground mt-4">
            Free for as long as you'd like. Upgrade when you're ready for
            clinical depth.
          </p>
        </div>
      </section>

      {/* Product peek */}
      <section
        className="py-14 px-6"
        style={{ backgroundColor: "hsl(var(--background))" }}
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p
              className="font-accent text-xs tracking-[0.3em] uppercase mb-3"
              style={{ color: "hsl(var(--eden-gold))" }}
            >
              Inside the Apothecary
            </p>
            <h2
              className="font-serif text-2xl md:text-3xl font-semibold leading-tight"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              Three doorways into the same materia medica.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <article
              className="rounded-lg p-6 border"
              style={{ borderColor: "hsl(var(--border))" }}
            >
              <p
                className="font-accent text-[11px] tracking-[0.3em] uppercase mb-2"
                style={{ color: "hsl(var(--eden-gold))" }}
              >
                Symptom doorway
              </p>
              <h3
                className="font-serif text-lg font-semibold mb-2"
                style={{ color: "hsl(var(--eden-bark))" }}
              >
                Start where your mind starts.
              </h3>
              <p className="font-body text-sm text-muted-foreground">
                Fever, cough, sleeplessness. Tap a symptom and see the
                terrain it points to — and the herbal action that addresses
                it.
              </p>
            </article>
            <article
              className="rounded-lg p-6 border"
              style={{ borderColor: "hsl(var(--border))" }}
            >
              <p
                className="font-accent text-[11px] tracking-[0.3em] uppercase mb-2"
                style={{ color: "hsl(var(--eden-gold))" }}
              >
                The Pattern of Eden
              </p>
              <h3
                className="font-serif text-lg font-semibold mb-2"
                style={{ color: "hsl(var(--eden-bark))" }}
              >
                Eight constitutional patterns.
              </h3>
              <p className="font-body text-sm text-muted-foreground">
                A 3-axis terrain model — Temperature, Moisture, Tone —
                grounded in Hebrews 8:5. Find your pattern, then steward
                it.
              </p>
            </article>
            <article
              className="rounded-lg p-6 border"
              style={{ borderColor: "hsl(var(--border))" }}
            >
              <p
                className="font-accent text-[11px] tracking-[0.3em] uppercase mb-2"
                style={{ color: "hsl(var(--eden-gold))" }}
              >
                Clinical safety
              </p>
              <h3
                className="font-serif text-lg font-semibold mb-2"
                style={{ color: "hsl(var(--eden-bark))" }}
              >
                Contraindications, never hidden.
              </h3>
              <p className="font-body text-sm text-muted-foreground">
                High and absolute cautions are visible at every tier.
                Pregnancy, lactation, drug interactions, and refer
                thresholds surface where they belong — at the herb.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* Tier cards */}
      <section
        className="py-16 px-6"
        style={{ backgroundColor: "hsl(var(--eden-cream))" }}
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p
              className="font-accent text-sm tracking-[0.3em] uppercase mb-3"
              style={{ color: "hsl(var(--eden-gold))" }}
            >
              Choose your tier
            </p>
            <h2
              className="font-serif text-3xl md:text-4xl font-bold leading-tight mb-3"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              All hundred herbs at every tier. <br />
              <span className="italic">Depth is what you unlock.</span>
            </h2>
            <p className="font-body text-sm text-muted-foreground max-w-2xl mx-auto">
              We don't gate herbs by count. We gate by the depth of the
              monograph and the clinical overlays you can read against it.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <PublicTierCard
              tier="free"
              displayName="Free"
              persona="The homeschool mama"
              tagline="Identity, energetics, and population safety for every herb."
              monthlyPrice="$0"
              yearlyPrice="$0"
              features={[
                "All 100 herb monographs (basic profile)",
                "The Pattern of Eden quiz + your result",
                "The Five Tenets overview",
                "Pregnancy, lactation, and absolute cautions",
              ]}
            />
            <PublicTierCard
              tier="seed"
              displayName="Seed"
              persona="The Institute student"
              tagline="Clinical depth — actions, tissue states, constitutional matches."
              monthlyPrice="$7.99"
              yearlyPrice="$79.99"
              features={[
                "Unlock clinical body of every monograph",
                "Tissue state indications and energetic actions",
                "Western clinical and Pattern of Eden constitutional overlays",
                "Save your constitutional result and revisit it",
              ]}
              highlighted
            />
            <PublicTierCard
              tier="root"
              displayName="Root"
              persona="The seasoned lay herbalist"
              tagline="Drug interactions, refer thresholds, sources."
              monthlyPrice="$24.99"
              yearlyPrice="$249.99"
              features={[
                "Everything in Seed",
                "Herb-drug interaction surfaces",
                "Refer-out thresholds with mechanism rationale",
                "Source citations and classical materia medica links",
              ]}
            />
          </div>
          <div className="text-center mt-10">
            <p
              className="font-accent text-xs tracking-[0.3em] uppercase mb-2"
              style={{ color: "hsl(var(--eden-gold))" }}
            >
              Practitioner tier
            </p>
            <p className="font-body text-sm text-muted-foreground max-w-xl mx-auto">
              Formula builder and full clinical practice tools unlock
              alongside the Tier 3 curriculum at the end of 2027. Held
              until then on purpose.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section
        className="py-16 px-6"
        style={{ backgroundColor: "hsl(var(--background))" }}
      >
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p
              className="font-accent text-xs tracking-[0.3em] uppercase mb-3"
              style={{ color: "hsl(var(--eden-gold))" }}
            >
              Common questions
            </p>
            <h2
              className="font-serif text-2xl md:text-3xl font-semibold"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              Before you make an account.
            </h2>
          </div>
          <dl className="space-y-8">
            {FAQ_ITEMS.map((item) => (
              <div key={item.q}>
                <dt
                  className="font-serif text-lg font-semibold mb-2"
                  style={{ color: "hsl(var(--eden-bark))" }}
                >
                  {item.q}
                </dt>
                <dd className="font-body text-sm text-muted-foreground leading-relaxed">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
          <div className="text-center mt-12">
            <Button variant="eden" size="lg" asChild>
              <Link to="/apothecary/auth/signup">
                Create your free account
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

const FAQ_ITEMS = [
  {
    q: "What is Eden Apothecary?",
    a: "A terrain-based clinical decision-support app for the body's own categories — temperature, moisture, tone, tissue state, organ system. Built as the clinical companion to the Eden Institute curriculum. Educational, not therapeutic.",
  },
  {
    q: "Do I need an account?",
    a: "Yes. Every visitor signs in so we can show you herbs against your own constitutional pattern, save your quiz result, and surface tier-appropriate clinical depth. Free accounts stay free for as long as you'd like.",
  },
  {
    q: "What's the difference between the tiers?",
    a: "All hundred herbs are visible at every tier. Tiers govern monograph depth: Free shows identity and population safety; Seed unlocks the clinical body — actions, tissue states, constitutional matches; Root adds drug-interaction surfaces, refer thresholds, and source citations.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Self-serve cancellation lives inside your account. You keep access through the end of the period you've already paid for, then drop back to Free. No phone calls, no friction.",
  },
  {
    q: "Is the Apothecary medical advice?",
    a: "No. It is educational and reasoning support — terrain-first framing, contraindication awareness, and stewardship language. Clinical decisions remain between you and your practitioner.",
  },
  {
    q: "What does \"Biblical framework\" mean for the app?",
    a: "Eden is a stewardship-based, anti-reductionist worldview. The Pattern of Eden draws its name from Hebrews 8:5 — make everything according to the pattern shown to you. The framing is not bolted-on language; it shapes how the materia medica is organized and taught.",
  },
];
