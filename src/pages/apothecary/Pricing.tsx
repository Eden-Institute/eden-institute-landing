import { useEffect, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { PricingTier } from "@/components/apothecary/PricingTier";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { trackCta } from "@/lib/trackCta";
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

  // A #tier-free / #tier-seed / #tier-root deep link (from Start, the tier
  // comparison, and in-app upgrade CTAs) pre-highlights the chosen card. The
  // global ScrollToTop hook handles scrolling to the anchor. Defaults to Seed,
  // the recommended plan, when there is no valid hash.
  const { hash } = useLocation();
  const highlightedTier =
    hash === "#tier-free" ? "free" : hash === "#tier-root" ? "root" : "seed";

  // Auto-resume a checkout the visitor started before signing up. CheckoutButton
  // sends anon clicks to signup with return_to=/apothecary/pricing?checkout=<key>;
  // once they're authed and land back here, kick off create-checkout for that
  // plan so their paid intent survives the signup / email-confirmation detour.
  const { user, session } = useAuth();
  const [searchParams] = useSearchParams();
  const [resuming, setResuming] = useState(false);
  // The auto-resume effect re-runs whenever the session object identity
  // changes (token refresh emits a fresh session), so guard the one-shot
  // checkout-start event AND the resume attempt itself to once per checkout
  // key — otherwise a token refresh while the visitor lingers on the error
  // path double-counts the funnel and re-invokes create-checkout.
  const resumedCheckout = useRef<string | null>(null);
  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (!checkout || !user || !session) return;
    if (resumedCheckout.current === checkout) return;
    resumedCheckout.current = checkout;
    let cancelled = false;
    setResuming(true);
    // Funnel moment (CRO Phase 4): this checkout starts programmatically
    // (post-signup auto-resume) — no click exists for the delegated
    // tracker to see, so the event fires at the invoke site (once, guarded
    // by resumedCheckout above).
    trackCta("checkout-start", { lookupKey: checkout });
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("create-checkout", {
          body: { lookup_key: checkout },
        });
        if (error) throw error;
        if (data?.url && !cancelled) {
          window.location.href = data.url;
          return;
        }
        throw new Error("Checkout session missing redirect URL");
      } catch (err) {
        if (!cancelled) {
          toast.error(
            err instanceof Error ? err.message : "Could not resume checkout",
          );
          setResuming(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, user, session]);

  return (
    <div>
      {resuming && (
        <div
          className="px-6 py-3 text-center font-body text-sm"
          style={{
            backgroundColor: "hsl(var(--eden-forest))",
            color: "hsl(var(--eden-parchment))",
          }}
          role="status"
        >
          Resuming your checkout…
        </div>
      )}
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
              (#tier-free / #tier-seed / #tier-root) scroll directly to
              the right card via the global ScrollToTop hook (PR #92).
              The `tier-` prefix avoids collision with index.html's
              <div id="root"> React mount point — a bare id="root" here
              would resolve to the React root container (scrollY=0)
              rather than the Root pricing card. */}
          <div className="grid md:grid-cols-3 gap-6">
            <div id="tier-free">
              <PricingTier
                tier="free"
                displayName="Free"
                tagline="Start exploring the framework."
                monthlyPrice="$0"
                yearlyPrice="$0"
                features={[
                  "All 100 herb monographs (basic profile)",
                  "Constitutional quiz + result",
                  "The Five Tenets overview",
                  "Read-only contraindications (high + absolute)",
                ]}
                billingCycle={cycle}
                highlighted={highlightedTier === "free"}
              />
            </div>

            <div id="tier-seed">
              <PricingTier
                tier="seed"
                displayName="Seed"
                tagline="Clinical depth for students and self-directed learners."
                monthlyPrice="$7.99"
                yearlyPrice="$79.99"
                monthlyLookupKey="seed_monthly"
                yearlyLookupKey="seed_yearly"
                features={[
                  "The full clinical study for all 100 herbs",
                  "Actions, tissue states, energetics",
                  "Full contraindication library",
                  "Profiles for up to 5 family members",
                  "Save and revisit your constitutional result",
                ]}
                billingCycle={cycle}
                highlighted={highlightedTier === "seed"}
              />
            </div>

            <div id="tier-root">
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
                  "Profiles for up to 10 family members",
                  "All 12 herb-to-dimension junction tables",
                  "Source citations and classical materia medica links",
                  "Priority access to new herbs and clinical overlays",
                ]}
                billingCycle={cycle}
                highlighted={highlightedTier === "root"}
              />
            </div>
          </div>

          <div className="text-center mt-8 space-y-1">
            <p
              className="font-accent text-xs tracking-[0.25em] uppercase"
              style={{ color: "hsl(var(--eden-gold))" }}
            >
              Founding member pricing
            </p>
            <p className="font-body text-sm text-muted-foreground max-w-xl mx-auto">
              Subscribe now and your rate stays locked for as long as you keep your plan, even when prices rise. Cancel anytime; your Pattern and saved herbs stay with your free account.
            </p>
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
