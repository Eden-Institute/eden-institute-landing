import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CheckoutButton } from "./CheckoutButton";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentTier, Tier } from "@/hooks/useCurrentTier";
import { ROUTES } from "@/lib/routes";

interface Props {
  tier: "free" | "seed" | "root";
  displayName: string;
  tagline: string;
  monthlyPrice: string;
  yearlyPrice: string;
  monthlyLookupKey?: string; // undefined for free
  yearlyLookupKey?: string;  // undefined for free
  features: string[];
  billingCycle: "monthly" | "yearly";
  highlighted?: boolean;
}

const tierRank: Record<Tier, number> = {
  anon: -1,
  free: 0,
  seed: 1,
  root: 2,
  practitioner: 3,
};

/**
 * Subscribe-CTA card for a single tier. Handles four states:
 * - Anonymous visitor: CTA links to signup (Free) or checkout-via-signup (paid)
 * - Authenticated free user: CTA invokes create-checkout for paid tiers; "Your plan" for free
 * - Authenticated current-tier: "Your current plan" label, disabled
 * - Authenticated on a different paid tier: "Manage in account" (Stage 5 Customer Portal)
 */
export function PricingTier({
  tier,
  displayName,
  tagline,
  monthlyPrice,
  yearlyPrice,
  monthlyLookupKey,
  yearlyLookupKey,
  features,
  billingCycle,
  highlighted,
}: Props) {
  const { user } = useAuth();
  const { data: currentTier } = useCurrentTier();

  const price = billingCycle === "monthly" ? monthlyPrice : yearlyPrice;
  const lookupKey =
    billingCycle === "monthly" ? monthlyLookupKey : yearlyLookupKey;
  const cycleLabel = billingCycle === "monthly" ? "/month" : "/year";

  const isAuthed = !!user;
  const thisIsCurrent = currentTier === tier;
  const thisIsFree = tier === "free";

  // Determine CTA content
  let cta: React.ReactNode;
  if (thisIsFree) {
    if (!isAuthed) {
      cta = (
        <Button variant="eden-outline" size="lg" className="w-full" asChild>
          <Link to={ROUTES.APOTHECARY_SIGNUP}>Create a free account</Link>
        </Button>
      );
    } else if (thisIsCurrent) {
      cta = (
        <Button variant="eden-outline" size="lg" className="w-full" disabled>
          Your current plan
        </Button>
      );
    } else {
      cta = (
        <Button variant="eden-outline" size="lg" className="w-full" disabled>
          Included with paid plan
        </Button>
      );
    }
  } else {
    // Seed or Root
    if (thisIsCurrent) {
      cta = (
        <Button variant="eden-outline" size="lg" className="w-full" disabled>
          Your current plan
        </Button>
      );
    } else if (
      isAuthed &&
      currentTier &&
      tierRank[currentTier] > tierRank[tier]
    ) {
      // User is on a HIGHER tier than this card — shouldn't downgrade from pricing page
      cta = (
        <Button variant="eden-outline" size="lg" className="w-full" disabled>
          Manage in account
        </Button>
      );
    } else if (lookupKey) {
      // Anon → sends to signup; Authed-free → starts checkout
      cta = (
        <CheckoutButton
          lookupKey={lookupKey}
          variant={highlighted ? "eden" : "eden-outline"}
          size="lg"
          className="w-full"
        >
          {`Start ${displayName}`}
        </CheckoutButton>
      );
    } else {
      cta = null;
    }
  }

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
          ? "hsl(var(--eden-cream))"
          : "hsl(var(--background))",
      }}
    >
      {highlighted && (
        <p
          className="font-accent text-xs tracking-[0.3em] uppercase mb-3 text-center"
          style={{ color: "hsl(var(--eden-gold))" }}
        >
          Recommended
        </p>
      )}
      <h3
        className="font-serif text-2xl font-bold mb-2"
        style={{ color: "hsl(var(--eden-bark))" }}
      >
        {displayName}
      </h3>
      <p className="font-body text-sm text-muted-foreground mb-4">{tagline}</p>
      <div className="mb-6">
        <span
          className="font-serif text-4xl font-bold"
          style={{ color: "hsl(var(--eden-bark))" }}
        >
          {price}
        </span>
        {tier !== "free" && (
          <span className="font-body text-sm text-muted-foreground ml-1">
            {cycleLabel}
          </span>
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

      {cta}
    </div>
  );
}
