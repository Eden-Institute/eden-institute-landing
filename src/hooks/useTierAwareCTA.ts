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
 * PR η fix #4: shortened the journey-step "guide" label from
 *   "Get your <Pattern> Deep-Dive Guide — $14"
 * to
 *   "Get the <Pattern> Guide — $14"
 * because the longer pattern names (OVERFLOWING CUP, SPENT CANDLE,
 * BURNING BOWSTRING) overflowed the JourneyCTA primary button on a
 * 375px viewport once the eden Button variant uppercased + tracked
 * the label. Same change applied to the value-ladder consumer in
 * src/pages/Index.tsx so both surfaces stay in lockstep.
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
  | "practitioner-waitlist"
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
  tier: SubscriptionTier | null;
  guidePurchased: boolean;
  amazonKitUrl: string | null;
}

export const FOUNDATIONS_COURSE_URL =
  "https://learn.edeninstitute.health/course/back-to-eden1";

export function computeTierAwareCTAs(
  args: ComputeTierAwareCTAsArgs,
): TierAwareCTAs {
  const { hasUser, pattern, tier, guidePurchased, amazonKitUrl } = args;
  const hasPattern = !!pattern;

  // ─── Upgrade CTA ───
  let upgrade: TierAwareCTA | null;
  if (!hasUser || !hasPattern) {
    upgrade = {
      label: "Take the Quiz — see your Pattern",
      shortLabel: "Take the quiz",
      href: ROUTES.ASSESSMENT,
    };
  } else if (tier === "seed") {
    upgrade = {
      label: "Upgrade to Root — up to 10 family profiles + deeper diagnostic",
      shortLabel: "Upgrade to Root",
      href: "/apothecary/pricing#tier-root",
    };
  } else if (tier === "root") {
    upgrade = {
      label:
        "Join the Practitioner Waitlist — clinical formulas + dose schedules + contraindications",
      shortLabel: "Practitioner waitlist",
      href: "/apothecary#practitioner-waitlist",
    };
  } else if (tier === "free" || tier === null) {
    upgrade = {
      label:
        "Upgrade to Seed — full clinical study for all 100 herbs",
      shortLabel: "Upgrade to Seed",
      href: "/apothecary/pricing#tier-seed",
    };
  } else {
    upgrade = null;
  }

  // ─── Guide CTA ───
  // PR η fix #4: "Get the <Pattern> Guide — $14" canonical label.
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
        label: `Get the ${patternShort} Guide — $4.99`,
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
  if (!hasUser || !hasPattern || !pattern) {
    next = {
      label: "Take the free Pattern quiz",
      href: ROUTES.ASSESSMENT,
      kind: "quiz",
    };
  } else if (tier === "free" || tier === null) {
    next = {
      label: "Upgrade to Seed — full clinical study for all 100 herbs",
      href: "/apothecary/pricing#tier-seed",
      kind: "upgrade-seed",
    };
  } else if (tier === "seed") {
    next = {
      label: "Upgrade to Root — up to 10 family profiles + deeper diagnostic",
      href: "/apothecary/pricing#tier-root",
      kind: "upgrade-root",
    };
  } else if (tier === "root") {
    next = {
      label: "Join the Practitioner waitlist",
      href: "/apothecary#practitioner-waitlist",
      kind: "practitioner-waitlist",
    };
  } else {
    next = {
      label: "Open your Apothecary",
      href: ROUTES.APOTHECARY,
      kind: "terminal",
    };
  }

  const course: TierAwareCTA = {
    label: hasUser
      ? "Continue your studies — The Foundations Course"
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
    tier: (tier as SubscriptionTier | null) ?? null,
    guidePurchased,
    amazonKitUrl,
  });
}
