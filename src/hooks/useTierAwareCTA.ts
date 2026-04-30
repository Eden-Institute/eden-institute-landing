import { useAuth } from "@/contexts/AuthContext";
import { useEdenPattern } from "@/hooks/useEdenPattern";
import { useApothecaryHerbs } from "@/hooks/useApothecaryHerbs";
import { ROUTES } from "@/lib/routes";
import { patternNameToSlug } from "@/lib/amazonKitUrls";
import type { EdenPatternName } from "@/lib/edenPattern";

/**
 * Tier-aware CTA state machine.
 *
 * The Eden Institute funnel surfaces several conversion CTAs that depend
 * on the visitor's auth state, resolved Pattern, subscription tier, and
 * whether they've already purchased the Deep-Dive Guide for their
 * Pattern. Before this hook, the mobile hamburger menu rendered an
 * unconditional "Take the Quiz" + "$14 Guide" pair regardless of who
 * the visitor was — which means a Root-tier user with a resolved
 * Pattern saw the same prompts as an anon visitor.
 *
 * Camila's 2026-04-30 spec defines the desired state matrix; this
 * module is the single source of truth. Pure computeTierAwareCTAs() is
 * exported for direct testing; useTierAwareCTA() is the React wrapper.
 *
 * Constraint per spec: ONE upgrade CTA per menu open. The label
 * highlights ONE feature (not a multi-feature list) so the visitor
 * isn't overwhelmed.
 */

export type SubscriptionTier = "free" | "seed" | "root" | "practitioner";

export interface TierAwareCTA {
  /** Visible CTA copy. May interpolate the visitor's Pattern name. */
  label: string;
  /** Destination URL (internal route or hash anchor; not external). */
  href: string;
}

export interface TierAwareCTAs {
  /**
   * Tier-step-up prompt. Null when the visitor is at the top of the
   * currently-available tier ladder (Root or Practitioner). The hamburger
   * menu hides the slot entirely when this is null — don't render an
   * empty button.
   */
  upgrade: TierAwareCTA | null;
  /**
   * Deep-Dive Guide CTA. Always returns a value — anon / no-Pattern
   * visitors are routed to /assessment to first resolve a Pattern
   * (because the guide is Pattern-specific).
   */
  guide: TierAwareCTA;
}

export interface ComputeTierAwareCTAsArgs {
  hasUser: boolean;
  pattern: EdenPatternName | null;
  tier: SubscriptionTier | null;
  /** Whether the visitor has already purchased the guide for their Pattern. */
  guidePurchased: boolean;
}

/**
 * Pure state-machine reducer. Given the four inputs, return the
 * (upgrade, guide) CTA pair the hamburger should render. Trivially
 * unit-testable; the React hook below is a thin wrapper.
 */
export function computeTierAwareCTAs(
  args: ComputeTierAwareCTAsArgs,
): TierAwareCTAs {
  const { hasUser, pattern, tier, guidePurchased } = args;
  const hasPattern = !!pattern;

  // ─── Upgrade CTA ───
  let upgrade: TierAwareCTA | null;
  if (!hasUser || !hasPattern) {
    // Anon, or authed without a resolved Pattern — the funnel must
    // resolve a Pattern before any tier upgrade pitch makes sense.
    upgrade = {
      label: "Take the Quiz — see your Pattern",
      href: ROUTES.ASSESSMENT,
    };
  } else if (tier === "seed") {
    // Seed user with Pattern — next step up is Root.
    upgrade = {
      label: "Upgrade to Root — 5 family profiles + deeper diagnostic",
      href: "/apothecary/pricing#root",
    };
  } else if (tier === "free" || tier === null) {
    // Free (or tier query still loading after auth resolves) with
    // Pattern — next step up is Seed. We surface ONE feature only per
    // spec: full clinical study for all 100 herbs.
    upgrade = {
      label:
        "Upgrade to Seed — full clinical study for all 100 herbs",
      href: "/apothecary/pricing#seed",
    };
  } else {
    // Root or Practitioner — already at the top of the available tier
    // ladder. No upgrade prompt; the slot is suppressed in the UI.
    upgrade = null;
  }

  // ─── Guide CTA ───
  let guide: TierAwareCTA;
  if (!hasUser || !hasPattern || !pattern) {
    // No Pattern resolved yet — the guide is Pattern-specific so we
    // route the visitor through /assessment first.
    guide = {
      label: "Get the $14 Guide",
      href: ROUTES.ASSESSMENT,
    };
  } else {
    const slug = patternNameToSlug(pattern);
    const patternShort = pattern.replace(/^The\s+/i, "");
    if (guidePurchased) {
      guide = {
        label: `View your ${patternShort} guide`,
        href: `/guide/${slug}`,
      };
    } else {
      guide = {
        label: `Get your ${patternShort} guide — $14`,
        href: `/guide/${slug}`,
      };
    }
  }

  return { upgrade, guide };
}

/**
 * React hook — reads the live auth state, Pattern, tier, and
 * guide-purchase flag, then delegates to the pure state machine.
 *
 * Safe to call from any component (incl. globally-mounted Navbar).
 * Both useEdenPattern and useApothecaryHerbs are TanStack-Query-backed
 * and resolve null/empty for anon visitors; the queries fire only
 * when an authenticated user is present.
 *
 * Guide-purchase check reads the localStorage flag that GuideLanding
 * writes after a successful verify-session call. The actual paywall
 * is still enforced server-side inside GuideLanding regardless of
 * what label the Navbar shows.
 */
export function useTierAwareCTA(): TierAwareCTAs {
  const { user } = useAuth();
  const { data: pattern } = useEdenPattern();
  const { tier } = useApothecaryHerbs();

  const slug = pattern ? patternNameToSlug(pattern) : null;
  const guidePurchased =
    typeof window !== "undefined" && slug
      ? window.localStorage.getItem(`guide_purchased_${slug}`) === "true"
      : false;

  return computeTierAwareCTAs({
    hasUser: !!user,
    pattern: pattern ?? null,
    tier: (tier as SubscriptionTier | null) ?? null,
    guidePurchased,
  });
}
