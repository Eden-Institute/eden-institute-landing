import { useState } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import { PUBLIC_TIERS, type PublicTierSpec } from "@/lib/apothecaryTiers";
import PractitionerWaitlistModal from "@/components/landing/PractitionerWaitlistModal";

interface TierCardProps {
  tier: PublicTierSpec;
  onPractitionerWaitlist: () => void;
}

/**
 * One column in the four-column TierComparison grid.
 *
 * CTA wiring (per surface decisions):
 *   - Free          → /apothecary/auth/signup (matches PublicTierCard).
 *   - Seed / Root   → /apothecary/pricing?tier={id} (preselects on the
 *                     auth-aware subscribe flow; matches PR #51 v3.33
 *                     wiring used by PublicTierCard).
 *   - Practitioner  → opens PractitionerWaitlistModal in place. Matches
 *                     the PR ι (iota) dual-CTA pattern in Navbar so the
 *                     waitlist conversion path is single-click on every
 *                     surface that exposes the Practitioner tier.
 *
 * Anchor id="tier-{id}" preserves deep-link compatibility with the
 * existing useTierAwareCTA upgrade slot hrefs (e.g. #tier-seed,
 * #tier-root) that have shipped in production.
 */
function TierCard({ tier, onPractitionerWaitlist }: TierCardProps) {
  const isPractitioner = tier.id === "practitioner";
  const isFree = tier.id === "free";

  let cta: React.ReactNode;
  if (isPractitioner) {
    cta = (
      <Button
        variant="eden-outline"
        size="lg"
        className="w-full"
        onClick={onPractitionerWaitlist}
        data-cta={`tier-comparison-${tier.id}`}
      >
        Join the Practitioner Waitlist
      </Button>
    );
  } else if (isFree) {
    cta = (
      <Button variant="eden-outline" size="lg" className="w-full" asChild>
        <Link
          to={ROUTES.APOTHECARY_SIGNUP}
          data-cta={`tier-comparison-${tier.id}`}
        >
          Create a free account
        </Link>
      </Button>
    );
  } else {
    cta = (
      <Button variant="eden-outline" size="lg" className="w-full" asChild>
        <Link
          to={`${ROUTES.APOTHECARY_PRICING}?tier=${tier.id}`}
          data-cta={`tier-comparison-${tier.id}`}
        >
          Start with {tier.displayName}
        </Link>
      </Button>
    );
  }

  return (
    <div
      id={`tier-${tier.id}`}
      className="rounded-lg p-6 flex flex-col border h-full"
      style={{
        borderColor: "hsl(var(--border))",
        backgroundColor: "hsl(var(--background))",
      }}
    >
      <p
        className="font-accent text-[11px] tracking-[0.25em] uppercase mb-2"
        style={{ color: "hsl(var(--eden-gold))" }}
      >
        For {tier.persona}
      </p>
      <h3
        className="font-serif text-2xl font-bold mb-1"
        style={{ color: "hsl(var(--eden-bark))" }}
      >
        {tier.displayName}
      </h3>
      <p className="font-body text-sm text-muted-foreground mb-4">
        {tier.tagline}
      </p>
      <div className="mb-2">
        {tier.monthlyPrice ? (
          <span
            className="font-serif text-4xl font-bold"
            style={{ color: "hsl(var(--eden-bark))" }}
          >
            {tier.monthlyPrice}
          </span>
        ) : (
          <span
            className="font-serif text-2xl font-semibold"
            style={{ color: "hsl(var(--eden-bark))" }}
          >
            Waitlist
          </span>
        )}
      </div>
      <p className="font-body text-xs text-muted-foreground mb-6 leading-relaxed">
        {tier.availability}
      </p>
      <ul className="space-y-3 mb-8 flex-1">
        {tier.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check
              className="w-4 h-4 mt-1 flex-shrink-0"
              style={{ color: "hsl(var(--eden-gold))" }}
            />
            <span className="font-body text-sm leading-relaxed">{feature}</span>
          </li>
        ))}
      </ul>
      {cta}
    </div>
  );
}

interface TierComparisonProps {
  /** Section eyebrow (defaults to "Tiers"). */
  eyebrow?: string;
  /** Section heading. Defaults to a calm, expectation-setting line. */
  heading?: React.ReactNode;
  /** Lead paragraph under the heading. Defaults to a one-line summary. */
  lead?: React.ReactNode;
  /** Section background. "cream" for visual breaks; "background" otherwise. */
  background?: "background" | "cream";
}

/**
 * Public Apothecary tier comparison.
 *
 * Renders all four tiers — Free, Seed, Root, Practitioner — with
 * prices, persona labels, taglines, and feature lists. Anchored by
 * id="tier-{free|seed|root|practitioner}" so existing deep-link hrefs
 * from useTierAwareCTA continue to resolve.
 *
 * Tone discipline (per Camila's brief 2026-05-03):
 *   - No emojis.
 *   - No "BEST VALUE!" / "MOST POPULAR" badges, no fake urgency.
 *   - Free is positioned as a real entry point, not a teaser.
 *   - Practitioner is framed as clinical-grade, not "premium".
 *
 * Tier-feature copy lives in @/lib/apothecaryTiers (single source of
 * truth for public marketing surfaces; the auth-aware subscribe flow
 * in Pricing.tsx keeps its own copy because it also wires monthly↔
 * yearly toggle and Stripe lookupKey).
 */
export function TierComparison({
  eyebrow = "Tiers",
  heading,
  lead,
  background = "background",
}: TierComparisonProps = {}) {
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  const bgColor =
    background === "cream"
      ? "hsl(var(--eden-cream))"
      : "hsl(var(--background))";

  return (
    <section
      id="tiers"
      className="py-16 md:py-20 px-6"
      style={{ backgroundColor: bgColor }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10 md:mb-12">
          <p
            className="font-accent text-sm tracking-[0.3em] uppercase mb-3"
            style={{ color: "hsl(var(--eden-gold))" }}
          >
            {eyebrow}
          </p>
          <h2
            className="font-serif text-3xl md:text-4xl font-bold leading-tight mb-4"
            style={{ color: "hsl(var(--eden-bark))" }}
          >
            {heading ?? (
              <>
                See what's in each tier{" "}
                <span className="italic">before you sign up.</span>
              </>
            )}
          </h2>
          <p className="font-body text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            {lead ??
              "All hundred herbs at every tier. Depth is what you unlock. Free stays free. Practitioner is clinical-grade and opens end of 2027."}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PUBLIC_TIERS.map((tier) => (
            <TierCard
              key={tier.id}
              tier={tier}
              onPractitionerWaitlist={() => setWaitlistOpen(true)}
            />
          ))}
        </div>
      </div>
      <PractitionerWaitlistModal
        open={waitlistOpen}
        onOpenChange={setWaitlistOpen}
        surface="tier_comparison_practitioner"
      />
    </section>
  );
}

export default TierComparison;
