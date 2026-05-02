import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  useJourneyAwareQuizCTA,
  type UseJourneyAwareQuizCTAOptions,
} from "@/hooks/useJourneyAwareQuizCTA";

/**
 * JourneyAwareQuizCTA — thin Button-rendering wrapper around the
 * useJourneyAwareQuizCTA hook for the common case where a marketing
 * surface wants a journey-aware quiz CTA with the standard shadcn
 * Button styling.
 *
 * When the consuming surface needs custom non-Button styling (e.g.
 * WhyEden's "forest-pill" Link with backgroundColor + padding inline
 * styles), drop down to the hook directly and render however you want.
 *
 * Routing: always internal Link to either /assessment (no Pattern) or
 * /guide/<slug> (Pattern resolved). data-cta and data-journey-kind
 * attributes mirror JourneyCTA's analytics surface for cross-component
 * funnel analytics.
 */
interface Props extends UseJourneyAwareQuizCTAOptions {
  /**
   * Pass-through Button variant. Matches the shadcn Button variants used
   * across the existing pages: "eden" (filled gold), "eden-outline"
   * (gold border), "eden-gold" (gold fill, used on Constitutional
   * Herbalism). Other variants will pass through but aren't documented
   * here — keep call sites within the institute's brand palette.
   */
  variant?: "eden" | "eden-outline" | "eden-gold";
  /** Pass-through Button size. Marketing CTAs typically use "xl". */
  size?: "lg" | "xl";
  /** Optional className passthrough for inline overrides (e.g. text size). */
  className?: string;
}

export function JourneyAwareQuizCTA({
  variant = "eden",
  size = "xl",
  className,
  noPatternLabel,
}: Props) {
  const cta = useJourneyAwareQuizCTA({ noPatternLabel });

  return (
    <Button asChild variant={variant} size={size} className={className}>
      <Link
        to={cta.href}
        data-cta="journey-aware-quiz"
        data-journey-kind={cta.kind}
      >
        {cta.label}
      </Link>
    </Button>
  );
}

export default JourneyAwareQuizCTA;
