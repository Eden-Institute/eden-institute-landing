import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

interface Props {
  tier: "free" | "seed" | "root";
  displayName: string;
  /** Persona label per §0.8 v3.3 #22: tier IS the persona ladder. */
  persona: string;
  tagline: string;
  monthlyPrice: string;
  yearlyPrice: string;
  features: string[];
  highlighted?: boolean;
}

/**
 * Public-only tier card used on `/apothecary/start`. Unlike PricingTier,
 * this component never sees an authenticated session — `/start` redirects
 * authed users straight to `/apothecary`.
 *
 * Free → /auth/signup (default flow lands on /welcome-tour).
 *
 * Seed/Root → /apothecary/pricing?tier={tier}. Per v3.33 PR #51 (Lock #21
 * retired for the pricing surface), the pricing page is now public so
 * paid-tier intent links straight to it without a signup detour. The
 * `?tier=` param lets Pricing.tsx pre-highlight the chosen plan.
 */
export function PublicTierCard({
  tier,
  displayName,
  persona,
  tagline,
  monthlyPrice,
  yearlyPrice,
  features,
  highlighted,
}: Props) {
  const ctaLabel =
    tier === "free" ? "Create a free account" : `Start with ${displayName}`;

  // PR #51 v3.33: pricing is now public. Free tier still routes to signup;
  // paid tiers deep-link to public pricing with ?tier= preselection.
  const ctaTo =
    tier === "free"
      ? ROUTES.APOTHECARY_SIGNUP
      : `${ROUTES.APOTHECARY_PRICING}?tier=${tier}`;

  return (
    <div
      className={`rounded-lg p-6 flex flex-col ${
        highlighted ? "border-2" : "border"
      }`}
      style={{
        borderColor: highlighted
          ? "hsl(var(--eden-gold))"
          : "hsl(var(--border))",
        backgroundColor: highlighted
          ? "hsl(var(--background))"
          : "hsl(var(--background))",
      }}
    >
      {highlighted && (
        <p
          className="font-accent text-xs tracking-[0.3em] uppercase mb-3 text-center"
          style={{ color: "hsl(var(--eden-gold))" }}
        >
          Most chosen
        </p>
      )}
      <h3
        className="font-serif text-2xl font-bold mb-1"
        style={{ color: "hsl(var(--eden-bark))" }}
      >
        {displayName}
      </h3>
      <p
        className="font-accent text-[11px] tracking-[0.25em] uppercase mb-3"
        style={{ color: "hsl(var(--eden-gold))" }}
      >
        For {persona}
      </p>
      <p className="font-body text-sm text-muted-foreground mb-4">{tagline}</p>
      <div className="mb-6">
        <span
          className="font-serif text-4xl font-bold"
          style={{ color: "hsl(var(--eden-bark))" }}
        >
          {monthlyPrice}
        </span>
        {tier !== "free" && (
          <span className="font-body text-sm text-muted-foreground ml-1">
            /month
          </span>
        )}
        {tier !== "free" && (
          <p className="font-body text-xs text-muted-foreground mt-1">
            or {yearlyPrice}/year
          </p>
        )}
      </div>
      <ul className="space-y-3 mb-8 flex-1">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check
              className="w-4 h-4 mt-1 flex-shrink-0"
              style={{ color: "hsl(var(--eden-gold))" }}
            />
            <span className="font-body text-sm">{feature}</span>
          </li>
        ))}
      </ul>
      <Button
        variant={highlighted ? "eden" : "eden-outline"}
        size="lg"
        className="w-full"
        asChild
      >
        <Link to={ctaTo}>{ctaLabel}</Link>
      </Button>
    </div>
  );
}
