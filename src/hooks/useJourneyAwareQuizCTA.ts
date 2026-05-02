import { useEdenPattern } from "@/hooks/useEdenPattern";
import { patternNameToSlug } from "@/lib/amazonKitUrls";
import { ROUTES } from "@/lib/routes";

/**
 * useJourneyAwareQuizCTA — small reusable hook that resolves a
 * "Take the Quiz" / "Continue with your Pattern" CTA tuple for marketing
 * surfaces.
 *
 * Used by WhyEden, Courses, and ConstitutionalHerbalism (PR ζ sweep) to
 * replace 5 inline `Take the Free Body Pattern Quiz` CTAs that didn't
 * pivot when the active person-profile already had a resolved Pattern.
 * The pattern is the same one used by Index.tsx's value-ladder
 * Deep-Dive Guide tile (PR ε) and JourneyCTA's primary CTA — same
 * resolver, same canonical guide route.
 *
 * Active-profile awareness: useEdenPattern reads ActiveProfileContext
 * (mounted at App scope per PR β, hydration-gated per PR δ). Switching
 * the picker on /apothecary and navigating to any marketing surface
 * that consumes this hook will re-render with the active profile's
 * Pattern.
 *
 * Result shape:
 *   - hasPattern=false → label = caller-supplied (or default), href = /assessment.
 *     `kind: "quiz"` for analytics filtering.
 *   - hasPattern=true  → label = `Get your <Pattern> Deep-Dive Guide — $14 →`,
 *     href = `/guide/<slug>` (matches useTierAwareCTA.journey.next.href
 *     for the guide step exactly). `kind: "guide"`.
 *
 * Per PR ε spec we intentionally do NOT consult
 * `quiz_completions.purchased_guide` to suppress the guide CTA when an
 * active non-self profile is selected — that column is email-keyed and
 * can't distinguish per-Pattern purchases (Olivia's Frozen Knot guide
 * is a separate purchase from Camila's Burning Bowstring guide).
 * Per-Pattern purchase suppression remains a separate follow-up.
 */
export interface JourneyAwareQuizCTA {
  label: string;
  href: string;
  /** Discriminator: which step in the customer journey this CTA represents. */
  kind: "quiz" | "guide";
  /** True when the active profile has a resolved Pattern. */
  hasPattern: boolean;
}

export interface UseJourneyAwareQuizCTAOptions {
  /**
   * Override the default no-Pattern label. Useful when the surface
   * consumes the hook in a context where "Take the Free Body Pattern
   * Quiz →" reads awkwardly (e.g. "Discover Your Body Pattern — Take
   * the Free Quiz" preserves Constitutional Herbalism's existing voice).
   * Defaults to "Take the Free Body Pattern Quiz →" if not provided.
   */
  noPatternLabel?: string;
}

export function useJourneyAwareQuizCTA(
  options?: UseJourneyAwareQuizCTAOptions,
): JourneyAwareQuizCTA {
  const { data: pattern } = useEdenPattern();

  if (pattern) {
    const slug = patternNameToSlug(pattern);
    const patternShort = pattern.replace(/^The\s+/i, "");
    return {
      label: `Get your ${patternShort} Deep-Dive Guide — $14 →`,
      href: `/guide/${slug}`,
      kind: "guide",
      hasPattern: true,
    };
  }

  return {
    label: options?.noPatternLabel ?? "Take the Free Body Pattern Quiz →",
    href: ROUTES.ASSESSMENT,
    kind: "quiz",
    hasPattern: false,
  };
}
