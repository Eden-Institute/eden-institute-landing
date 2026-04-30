import { useAuth } from "@/contexts/AuthContext";
import { useEdenPattern } from "@/hooks/useEdenPattern";
import { useApothecaryHerbs } from "@/hooks/useApothecaryHerbs";
import { ROUTES } from "@/lib/routes";
import { patternNameToSlug, getAmazonKitUrl } from "@/lib/amazonKitUrls";
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
 * isn't overwhelmed. The Amazon kit slot also surfaces ONE link —
 * the per-Pattern affiliate URL.
 */

export type SubscriptionTier = "free" | "seed" | "root" | "practitioner";

export interface TierAwareCTA {
  /** Visible CTA copy. May interpolate the visitor's Pattern name. */
  label: string;
  /** Destination URL (internal route, hash anchor, or external). */
  href: string;
  /** True for external destinations (e.g. Amazon affiliate links). */
  external?: boolean;
}

export interface TierAwareCTAs {
  /**
   * Tier-step-up prompt. Null when the visitor is at the top of the
   * currently-available tier ladder (Practitioner once it ships, or
   * unauthed states with no Pattern — wait, those still get a Take-the-
   * Quiz upgrade prompt). The hamburger menu hides the slot entirely
   * when this is null — don't render an empty button.
   *
   * Root tier surfaces the Practitioner Waitlist CTA (the practitioner
   * tier is the next step up, but it isn't open yet — Lock #49 says
   * end of 2027). Once Practitioner enrollment opens, flip this to
   * an actual upgrade route.
   */
  upgrade: TierAwareCTA | null;
  /**
   * Deep-Dive Guide CTA. Always returns a value — anon / no-Pattern
   * visitors are routed to /assessment to first resolve a Pattern
   * (because the guide is Pattern-specific).
   */
  guide: TierAwareCTA;
  /**
   * Per-Pattern Amazon affiliate kit link. Null for anon / no-Pattern
   * visitors (no Pattern → no specific kit to point at). Otherwise
   * carries the tagged Amazon URL.
   */
  amazonKit: TierAwareCTA | null;
}

export interface ComputeTierAwareCTAsArgs {
  hasUser: boolean;
  pattern: EdenPatternName | null;
  tier: SubscriptionTier | null;
  /** Whether the visitor has already purchased the guide for their Pattern. */
  guidePurchased: boolean;
  /**
   * Resolved Amazon kit URL (with affiliate tag appended). Null when no
   * Pattern, or no mapping for the Pattern. Computed by the React hook
   * via getAmazonKitUrl() so the pure reducer below stays free of
   * cross-module side effects.
   */
  amazonKitUrl: string | null;
}

/**
 * Pure state-machine reducer. Given the inputs, return the
 * (upgrade, guide, amazonKit) CTA tuple the hamburger should render.
 * Trivially unit-testable; the React hook below is a thin wrapper.
 */
export function computeTierAwareCTAs(
  args: ComputeTierAwareCTAsArgs,
): TierAwareCTAs {
  const { hasUser, pattern, tier, guidePurchased, amazonKitUrl } = args;
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
    // Seed user with Pattern — next step up is Root. Hash anchor uses
    // the `tier-` prefix to avoid colliding with index.html's React
    // mount point <div id="root">.
    upgrade = {
      label: "Upgrade to Root — 5 family profiles + deeper diagnostic",
      href: "/apothecary/pricing#tier-root",
    };
  } else if (tier === "root") {
    // Root user with Pattern — already at the top of the OPEN tier
    // ladder. The next step (Practitioner) doesn't open until end of
    // 2027 per Lock #49, so we route them to the existing Practitioner
    // Waitlist signup form on /apothecary (rendered by
    // MatchedHerbsCtaPair, anchored at #practitioner-waitlist).
    //
    // When Practitioner enrollment actually opens, flip this href to
    // "/apothecary/pricing#tier-practitioner" and label to
    // "Upgrade to Practitioner — …".
    upgrade = {
      label:
        "Join the Practitioner Waitlist — clinical formulas + dose schedules + contraindications",
      href: "/apothecary#practitioner-waitlist",
    };
  } else if (tier === "free" || tier === null) {
    // Free (or tier query still loading after auth resolves) with
    // Pattern — next step up is Seed. We surface ONE feature only per
    // spec: full clinical study for all 100 herbs.
    upgrade = {
      label:
        "Upgrade to Seed — full clinical study for all 100 herbs",
      href: "/apothecary/pricing#tier-seed",
    };
  } else {
    // Practitioner — already at the top of the tier ladder. No
    // upgrade prompt; the slot is suppressed in the UI.
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

  return { upgrade, guide, amazonKit };
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
 *
 * Amazon kit URL: getAmazonKitUrl() inherits Pattern resolution from
 * useEdenPattern() — which IS profile-aware (reads the active profile's
 * eden_constitution when the picker context is mounted). On marketing
 * surfaces where the picker isn't mounted, the user-level
 * profiles.constitution_type is the source. Both branches return a
 * valid Pattern → valid kit URL, so the hamburger CTA "just works"
 * across surfaces.
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
  const amazonKitUrl = getAmazonKitUrl(pattern ?? null);

  return computeTierAwareCTAs({
    hasUser: !!user,
    pattern: pattern ?? null,
    tier: (tier as SubscriptionTier | null) ?? null,
    guidePurchased,
    amazonKitUrl,
  });
}
