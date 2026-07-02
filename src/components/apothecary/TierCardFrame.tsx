import type { ReactNode } from "react";

interface TierCardFrameProps {
  /** Emphasized card: gold border-2 + optional badge banner. */
  highlighted?: boolean;
  /** Banner text shown at the top when highlighted (omit for no banner). */
  badgeLabel?: string;
  /**
   * Background when highlighted. "cream" matches the auth-aware PricingTier;
   * "background" (default) matches the marketing PublicTierCard, which keeps a
   * plain background even when highlighted.
   */
  highlightBackground?: "cream" | "background";
  /** Stretch to fill the grid row (the TierComparison four-column layout). */
  fullHeight?: boolean;
  /** Optional anchor id for deep-linking (e.g. #tier-seed). */
  id?: string;
  children: ReactNode;
}

/**
 * Shared outer shell for the tier cards (PricingTier, PublicTierCard,
 * TierComparison). Owns only the frame that was duplicated across all three —
 * the rounded/bordered container, the highlight border/background, and the
 * "Recommended" / "Most chosen" badge banner. Each card passes its own distinct
 * body (heading, price, features, CTA) as children, so the body markup is
 * unchanged. Class order is preserved to keep rendered output byte-identical.
 */
export function TierCardFrame({
  highlighted = false,
  badgeLabel,
  highlightBackground = "background",
  fullHeight = false,
  id,
  children,
}: TierCardFrameProps) {
  return (
    <div
      id={id}
      className={`rounded-lg p-6 flex flex-col ${
        highlighted ? "border-2" : "border"
      }${fullHeight ? " h-full" : ""}`}
      style={{
        borderColor: highlighted
          ? "hsl(var(--eden-gold))"
          : "hsl(var(--border))",
        backgroundColor:
          highlighted && highlightBackground === "cream"
            ? "hsl(var(--eden-cream))"
            : "hsl(var(--background))",
      }}
    >
      {highlighted && badgeLabel && (
        <p
          className="font-accent text-xs tracking-[0.3em] uppercase mb-3 text-center"
          style={{ color: "hsl(var(--eden-gold))" }}
        >
          {badgeLabel}
        </p>
      )}
      {children}
    </div>
  );
}
