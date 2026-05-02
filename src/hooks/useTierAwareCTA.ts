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
 * Camila's 2026-04-30 spec defines the desired (upgrade, guide, amazonKit)
 * matrix; the 2026-05-02 spec adds a `journey` field for PR β's
 * dominant-next-step CTA on the homepage. Pure computeTierAwareCTAs() is
 * exported for direct testing; useTierAwareCTA() is the React wrapper.
 *
 * Active-profile awareness: this hook composes useEdenPattern, which
 * itself consults ActiveProfileContext to resolve the Pattern of the
 * currently-active person_profile (or the user-level Pattern when no
 * profile is active). Per PR β the ActiveProfileProvider is mounted at
 * App scope so the active selection persists across every route — the
 * homepage's JourneyCTA reads the same Pattern that the apothecary
 * picker last selected. Tier (subscription_tier) remains user-level
 * regardless of active profile.
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

/**
 * Discriminator for the dominant journey step. Lets consumers (analytics,
 * styling) branch on which point in the customer-journey order the
 * visitor is currently surfaced at, without re-deriving the state.
 */
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
  /**
   * The single dominant next-step CTA. Drives PR β's JourneyCTA on the
   * homepage. Walks the canonical customer-journey order — Pattern quiz
   * → $14 Deep-Dive Guide → Foundations Course (untrackable, surfaced
   * via the always-visible `course` slot below) → Seed → Root →
   * Practitioner waitlist → terminal — and surfaces whichever step the
   * visitor hasn't completed yet. Completed steps disappear from this
   * slot so the page isn't cluttered.
   *
   * Notably skips the Foundations Course when picking the dominant
   * step. Course-completion is currently architecturally unobservable:
   * LearnWorlds runs charges through its own Stripe and never fires
   * events to our stripe-webhook EF, so quiz_completions.purchased_
   * course will not flip true via the current architecture (confirmed
   * 2026-05-02 by live $0-test). Treating Course as a permanent
   * always-visible CTA below sidesteps the false-completion problem;
   * proper tracking is post-launch work via the LearnWorlds REST API
   * or LearnWorlds-native webhooks.
   */
  next: JourneyStep;
  /**
   * Foundations Course CTA. Always rendered alongside the dominant CTA
   * regardless of journey state, because completion is currently
   * untrackable (see above). Copy pivots between "Begin" (anon /
   * unauthed) and "Continue" (authed) but the destination is the same
   * external LearnWorlds URL.
   */
  course: TierAwareCTA;
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
  /**
   * PR β (2026-05-02): customer-journey state for the dominant
   * next-step CTA used by JourneyCTA on the homepage. See JourneyState.
   */
  journey: JourneyState;
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

/** External LearnWorlds URL for the Foundations Course. Single source of
 *  truth across hooks and components. Mirror in src/pages/Index.tsx and
 *  src/components/journey/JourneyCTA.tsx imports the constant from here
 *  rather than re-declaring the URL. */
export const FOUNDATIONS_COURSE_URL =
  "https://learn.edeninstitute.health/course/back-to-eden1";

/**
 * Pure state-machine reducer. Given the inputs, return the
 * (upgrade, guide, amazonKit, journey) tuple consumers should render.
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

  // ─── Journey: dominant next-step CTA ───
  // Walk the canonical customer-journey order. The first un-completed
  // step wins the dominant slot. Foundations Course is intentionally
  // skipped (untrackable) and surfaced via the always-visible `course`
  // slot instead.
  let next: JourneyStep;
  if (!hasUser || !hasPattern || !pattern) {
    // No Pattern yet — entry point.
    next = {
      label: "Take the free Pattern quiz",
      href: ROUTES.ASSESSMENT,
      kind: "quiz",
    };
  } else if (!guidePurchased) {
    // Pattern resolved, guide not yet purchased — Step 2 of the funnel.
    const slug = patternNameToSlug(pattern);
    const patternShort = pattern.replace(/^The\s+/i, "");
    next = {
      label: `Get your ${patternShort} Deep-Dive Guide — $14`,
      href: `/guide/${slug}`,
      kind: "guide",
    };
  } else if (tier === "free" || tier === null) {
    // Pattern + guide done, on Free tier — promote to Seed.
    next = {
      label: "Upgrade to Seed — full clinical study for all 100 herbs",
      href: "/apothecary/pricing#tier-seed",
      kind: "upgrade-seed",
    };
  } else if (tier === "seed") {
    // Seed → Root.
    next = {
      label: "Upgrade to Root — 5 family profiles + deeper diagnostic",
      href: "/apothecary/pricing#tier-root",
      kind: "upgrade-root",
    };
  } else if (tier === "root") {
    // Root → Practitioner waitlist (Practitioner enrollment opens end
    // of 2027 per Lock #49). Anchored at the existing waitlist form on
    // /apothecary (MatchedHerbsCtaPair).
    next = {
      label: "Join the Practitioner waitlist",
      href: "/apothecary#practitioner-waitlist",
      kind: "practitioner-waitlist",
    };
  } else {
    // Practitioner — top of the open ladder. Direct them into their
    // Apothecary as the operative "next step" so the dominant slot
    // never renders empty for the deepest tier.
    next = {
      label: "Open your Apothecary",
      href: ROUTES.APOTHECARY,
      kind: "terminal",
    };
  }

  // Course copy pivots between "Begin" (no auth) and "Continue" (authed).
  // Both work whether the visitor has actually enrolled in LearnWorlds or
  // not — we cannot detect enrollment from the current architecture.
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

/**
 * React hook — reads the live auth state, Pattern, tier, and
 * guide-purchase flag, then delegates to the pure state machine.
 *
 * Safe to call from any component (incl. globally-mounted Navbar and
 * the homepage JourneyCTA). Both useEdenPattern and useApothecaryHerbs
 * are TanStack-Query-backed and resolve null/empty for anon visitors;
 * the queries fire only when an authenticated user is present.
 *
 * Active-profile resolution: useEdenPattern reads ActiveProfileContext
 * (mounted at App scope per PR β), so the Pattern returned here is the
 * active profile's Pattern across every surface. Switching profiles
 * via the picker on /apothecary updates the Pattern that JourneyCTA
 * surfaces on / on the next render. Tier remains user-level — only
 * the Pattern (and consequently the per-Pattern Amazon kit URL) swaps.
 *
 * Guide-purchase check reads the localStorage flag that GuideLanding
 * writes after a successful verify-session call. The actual paywall
 * is still enforced server-side inside GuideLanding regardless of
 * what label the Navbar shows. Note: localStorage is per-Pattern
 * (key `guide_purchased_<slug>`), so when an alternate profile is
 * active the check reads that profile's Pattern slug — i.e. Olivia's
 * Frozen-Knot CTA shows "Get your Frozen Knot guide" even if Camila
 * already bought her own Burning Bowstring guide. User-level "all
 * guides" tracking is a separate concern outside PR β scope.
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
