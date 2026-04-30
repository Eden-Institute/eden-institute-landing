import { useState } from "react";
import { PricingTier } from "@/components/apothecary/PricingTier";
import { useDocumentMeta } from "@/lib/useDocumentMeta";

type BillingCycle = "monthly" | "yearly";

export default function Pricing() {
  useDocumentMeta({
    title: "Pricing | Eden Apothecary",
    description:
      "Free access to the herb directory and constitutional quiz. Seed and Root tiers open the full clinical depth — actions, tissue states, and contraindications for every herb.",
    canonical: "https://edeninstitute.health/apothecary/pricing",
  });

  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  return (
    <div>
      <section
        className="py-16 md:py-20 px-6"
        style={{ backgroundColor: "hsl(var(--eden-cream))" }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <p
            className="font-accent text-sm tracking-[0.3em] uppercase mb-4"
            style={{ color: "hsl(var(--eden-gold))" }}
          >
            Choose your plan
          </p>
          <h1
            className="font-serif text-4xl md:text-5xl font-bold leading-tight mb-6"
            style={{ color: "hsl(var(--eden-bark))" }}
          >
            App plans for every stage
            <br />
            <span className="italic">of the practice.</span>
          </h1>
          <p className="font-body text-lg text-muted-foreground max-w-2xl mx-auto">
            Free access to the herb directory and constitutional quiz. Paid
            tiers open the full clinical depth — actions, tissue states, and
            contraindications for every herb.
          </p>
        </div>
      </section>

      <section className="py-12 px-6 bg-background">
        <div className="max-w-5xl mx-auto">
          <div className="flex justify-center mb-10">
            <div
              className="inline-flex rounded-sm border p-1"
              style={{ borderColor: "hsl(var(--border))" }}
            >
              <button
                onClick={() => setCycle("monthly")}
                className={`px-5 py-2 text-sm font-body transition-colors rounded-sm ${
                  cycle === "monthly" ? "" : "text-muted-foreground"
                }`}
                style={
                  cycle === "monthly"
                    ? {
                        backgroundColor: "hsl(var(--eden-forest))",
                        color: "hsl(var(--eden-parchment))",
                      }
                    : {}
                }
              >
                Monthly
              </button>
              <button
                onClick={() => setCycle("yearly")}
                className={`px-5 py-2 text-sm font-body transition-colors rounded-sm ${
                  cycle === "yearly" ? "" : "text-muted-foreground"
                }`}
                style={
                  cycle === "yearly"
                    ? {
                        backgroundColor: "hsl(var(--eden-forest))",
                        color: "hsl(var(--eden-parchment))",
                      }
                    : {}
                }
              >
                Yearly
                <span
                  className="ml-2 font-accent text-[10px] tracking-[0.2em] uppercase"
                  style={{ color: "hsl(var(--eden-gold))" }}
                >
                  Save
                </span>
              </button>
            </div>
          </div>

          {/* Tier card wrappers carry id attributes so deep-link hashes
              (#free / #seed / #root) scroll directly to the right card
              via the global ScrollToTop hook (PR #92). The Navbar's
              tier-aware CTA pair points at /apothecary/pricing#seed and
              #root for Free/Seed users; without these IDs the hash
              would resolve to nothing and stay at page top. */}
          <div className="grid md:grid-cols-3 gap-6">
            <div id="free">
              <PricingTier
                tier="free"
                displayName="Free"
                tagline="Start exploring the framework."
                monthlyPrice="$0"
                yearlyPrice="$0"
                features={[
                  "50 herb monographs (basic profile)",
                  "Constitutional quiz + result",
                  "The Five Tenets overview",
                  "Read-only contraindications (high + absolute)",
                ]}
                billingCycle={cycle}
              />
            </div>

            <div id="seed">
              <PricingTier
                tier="seed"
                displayName="Seed"
                tagline="Clinical depth for students and self-directed learners."
                monthlyPrice="$7.99"
                yearlyPrice="$79.99"
                monthlyLookupKey="seed_monthly"
                yearlyLookupKey="seed_yearly"
                features={[
                  "All 100 herbs with clinical depth",
                  "Actions, tissue states, energetics",
                  "Full contraindication library",
                  "Save and revisit your constitutional result",
                ]}
                billingCycle={cycle}
                highlighted
              />
            </div>

            <div id="root">
              <PricingTier
                tier="root"
                displayName="Root"
                tagline="Deeper practice — full junctions, dimensions, and citations."
                monthlyPrice="$24.99"
                yearlyPrice="$249.99"
                monthlyLookupKey="root_monthly"
                yearlyLookupKey="root_yearly"
                features={[
                  "Everything in Seed",
                  "All 12 herb-to-dimension junction tables",
                  "Source citations and classical materia medica links",
                  "Priority access to new herbs and clinical overlays",
                ]}
                billingCycle={cycle}
              />
            </div>
          </div>

          <div className="text-center mt-12">
            <p
              className="font-accent text-xs tracking-[0.3em] uppercase mb-2"
              style={{ color: "hsl(var(--eden-gold))" }}
            >
              Practitioner tier
            </p>
            <p className="font-body text-sm text-muted-foreground max-w-xl mx-auto">
              Formula builder and full clinical practice tools unlock at the
              end of 2027, alongside the Tier 3 curriculum launch. Not yet
              available for subscription.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
