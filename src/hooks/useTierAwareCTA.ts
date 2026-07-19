import { useAuth } from "@/contexts/AuthContext";
import { useEdenPattern } from "@/hooks/useEdenPattern";
import { useCurrentTier } from "@/hooks/useCurrentTier";
import { ROUTES } from "@/lib/routes";
import { patternNameToSlug, getAmazonKitUrl } from "@/lib/amazonKitUrls";
import type { EdenPatternName } from "@/lib/edenPattern";

/**
 * Tier-aware CTA state machine.
 *
 * The Eden Institute funnel surfaces several conversion CTAs that depend
 * on the visitor's auth state, resolved Pattern, subscription tier, and
 * whether they've already purchased the Deep-Dive Guide for their
 * Pattern.
 *
 * Guide labels are kept short ("Get the <Pattern> Guide ($4.99)")
 * because the longer pattern names (OVERFLOWING CUP, SPENT CANDLE,
 * BURNING BOWSTRING) overflow the JourneyCTA primary button on a
 * 375px viewport once the eden Button variant uppercases + tracks
 * the label. The value-ladder consumer in src/pages/Index.tsx stays
 * in lockstep.
 */

export type SubscriptionTier = "free" | "seed" | "root" | "practitioner";

export interface TierAwareCTA {
  label: string;
  /** Compact label for tight surfaces (nav pill). Falls back to `label`. */
  shortLabel?: string;
  href: string;
  external?: boolean;
}

export type JourneyKind =
  | "quiz"
  | "guide"
  | "upgrade-seed"
  | "upgrade-root"
  | "upgrade-practitioner"
  | "terminal";

export interface JourneyStep extends TierAwareCTA {
  kind: JourneyKind;
}

export interface JourneyState {
  next: JourneyStep;
  course: TierAwareCTA;
}

export interface TierAwareCTAs {
  upgrade: TierAwareCTA | null;
  guide: TierAwareCTA;
  amazonKit: TierAwareCTA | null;
  journey: JourneyState;
}

export interface ComputeTierAwareCTAsArgs {
  hasUser: boolean;
  pattern: EdenPatternName | null;
  /** Resolved tier; `undefined` while the tier query is still loading. */
  tier: SubscriptionTier | null | undefined;
  guidePurchased: boolean;
  amazonKitUrl: string | null;
}

const FOUNDATIONS_COURSE_URL =
  "https://learn.edeninstitute.health/course/back-to-eden1";

function computeTierAwareCTAs(
  args: ComputeTierAwareCTAsArgs,
): TierAwareCTAs {
  const { hasUser, pattern, tier, guidePurchased, amazonKitUrl } = args;
  const hasPattern = !!pattern;

  // ─── Upgrade CTA ───
  // Practitioner is the top tier: no upsell, ever. Short-circuit before the
  // no-Pattern branch so a signed-in practitioner who never took the consumer
  // quiz doesn't get a "Take the quiz" nav pill. While the tier query is still
  // resolving for a signed-in user (tier === undefined) suppress the slot too,
  // so a practitioner never flashes an upsell before their tier snaps in.
  // Genuinely anonymous visitors (hasUser === false) still get the quiz CTA.
  let upgrade: TierAwareCTA | null;
  if (tier === "practitioner") {
    upgrade = null;
  } else if (hasUser && tier === undefined) {
    upgrade = null;
  } else if (!hasUser || !hasPattern) {
    upgrade = {
      label: "Take the Quiz: see your Pattern",
      shortLabel: "Take the quiz",
      href: ROUTES.ASSESSMENT,
    };
  } else if (tier === "seed") {
    upgrade = {
      label: "Unlock drug interactions, source citations, and profiles for your whole circle",
      shortLabel: "Go deeper",
      href: "/apothecary/pricing#tier-root",
    };
  } else if (tier === "root") {
    upgrade = {
      label:
        "Go Practitioner: one-screen clinical matching, formulary builder, case files. Founding rate locked for life",
      shortLabel: "Go Practitioner",
      href: "/apothecary/pricing#tier-practitioner",
    };
  } else {
    // free / anon (resolved)
    upgrade = {
      label:
        "Unlock the full clinical picture: actions, tissue states, and safety for all 300 herbs",
      shortLabel: "Unlock more",
      href: "/apothecary/pricing#tier-seed",
    };
  }

  // ─── Guide CTA ───
  // Canonical label: "Get the <Pattern> Guide ($4.99)".
  let guide: TierAwareCTA;
  if (!hasUser || !hasPattern || !pattern) {
    guide = {
      label: "Get the $4.99 Guide",
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
        label: `Get the ${patternShort} Guide ($4.99)`,
        href: `/guide/${slug}`,
      };
    }
  }

  // ─── Amazon Kit CTA ───
  let amazonKit: TierAwareCTA | null = null;
  if (hasUser && hasPattern && pattern && amazonKitUrl) {
    const patternShort = pattern.replace(/^The\s+/i, "");
    amazonKit = {
      label: `Shop your ${patternShort} kit on Amazon`,
      href: amazonKitUrl,
      external: true,
    };
  }

  // ─── Journey: dominant next-step CTA ───
  // Subscription-primary (founder decision 2026-07-02): for a free user with a
  // Pattern, the dominant next step is the Seed subscription, NOT the one-off
  // $4.99 guide. The guide is still offered on the Results page (secondary to
  // Seed there), but it no longer occupies the dominant homepage/Account slot,
  // so the highest-traffic surfaces steer toward recurring LTV.
  let next: JourneyStep;
  if (tier === "practitioner" || (hasUser && tier === undefined)) {
    // Top tier (or tier still resolving for a signed-in user): no upsell or
    // quiz step. Send them into the app instead of flashing an upgrade CTA.
    next = {
      label: "Open your Apothecary",
      href: ROUTES.APOTHECARY,
      kind: "terminal",
    };
  } else if (!hasUser || !hasPattern || !pattern) {
    next = {
      label: "Take the free Pattern quiz",
      href: ROUTES.ASSESSMENT,
      kind: "quiz",
    };
  } else if (tier === "seed") {
    next = {
      label: "Unlock drug interactions, source citations, and profiles for your whole circle",
      href: "/apothecary/pricing#tier-root",
      kind: "upgrade-root",
    };
  } else if (tier === "root") {
    next = {
      label: "Go Practitioner at the founding rate",
      href: "/apothecary/pricing#tier-practitioner",
      kind: "upgrade-practitioner",
    };
  } else {
    // free / anon (resolved): steer toward the entry subscription.
    next = {
      label: "Unlock the full clinical picture: actions, tissue states, and safety for all 300 herbs",
      href: "/apothecary/pricing#tier-seed",
      kind: "upgrade-seed",
    };
  }

  const course: TierAwareCTA = {
    label: hasUser
      ? "Continue your studies: The Foundations Course"
      : "Begin the Foundations Course",
    href: FOUNDATIONS_COURSE_URL,
    external: true,
  };

  return {
    upgrade,
    guide,
    amazonKit,
    journey: { next, course },
  };
}

export function useTierAwareCTA(): TierAwareCTAs {
  const { user } = useAuth();
  const { data: pattern } = useEdenPattern();
  // Tier comes from the lightweight current_user_tier RPC (not the 100-row
  // directory fetch) so this hook is cheap to consume from global chrome
  // like ApothecaryNav on every app route.
  const { data: tier } = useCurrentTier();

  const slug = pattern ? patternNameToSlug(pattern) : null;
  // A stored verified Stripe session id (set by the /guide page after purchase)
  // marks this pattern's guide as owned, so we suppress the buy CTA.
  const guidePurchased =
    typeof window !== "undefined" && slug
      ? !!window.localStorage.getItem(`guide_session_${slug}`)
      : false;
  const amazonKitUrl = getAmazonKitUrl(pattern ?? null);

  return computeTierAwareCTAs({
    hasUser: !!user,
    pattern: pattern ?? null,
    // Pass the tier through untouched: `undefined` means the tier query is
    // still loading, which the state machine distinguishes from resolved-free
    // so top-tier users never see an upsell flash.
    tier: tier as SubscriptionTier | undefined,
    guidePurchased,
    amazonKitUrl,
  });
}
