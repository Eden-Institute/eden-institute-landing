import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTierAwareCTA } from "@/hooks/useTierAwareCTA";

/**
 * JourneyCTA — the dominant next-step prompt + 2 always-visible secondary
 * CTAs (Foundations Course + per-Pattern Amazon kit).
 *
 * Replaces the 7 scattered, hasPattern-pivoted CTAs that PR #106 stitched
 * across Index.tsx. Camila's 2026-05-02 spec collapses the homepage's
 * CTA surface to a single dominant action driven by the customer-journey
 * state machine in useTierAwareCTA().
 *
 * Customer-journey order:
 *   Pattern quiz → $14 Deep-Dive Guide → Foundations Course
 *   (untrackable in our funnel — surfaced as always-visible) → Seed
 *   → Root → Practitioner waitlist → terminal.
 *
 * The dominant slot walks the order and surfaces whichever step the
 * visitor hasn't completed yet. Completed steps disappear from the
 * dominant slot so the page isn't cluttered. The Foundations Course
 * stays permanently in the secondary slot because we cannot track
 * LearnWorlds enrollment from our Stripe webhook — confirmed
 * 2026-05-02 by live $0-test that LearnWorlds runs charges through its
 * own Stripe and never fires events to our stripe-webhook EF.
 *
 * Active-profile awareness: the underlying useEdenPattern resolves the
 * active person_profile's Pattern via ActiveProfileContext (App-scope
 * per PR β). Switching the picker to a non-self profile changes the
 * dominant CTA's Pattern label and the Amazon-kit URL on this surface
 * without any prop wiring. Tier (Seed/Root/Practitioner) remains
 * user-level — switching profiles never changes the upgrade ladder
 * destination.
 *
 * Visual style: gold-on-bark primary button matching the existing Hero
 * CTA, eden-forest underline-on-hover secondaries, FTC affiliate
 * disclosure when the Amazon slot renders. No emojis, no "wellness"
 * voice — stewardship-anchored, terrain-over-symptom, biblically
 * framed per the institute style guide.
 */
export function JourneyCTA() {
  const { journey, amazonKit } = useTierAwareCTA();
  const { next, course } = journey;

  // The quiz step preserves the legacy Hero "No email required" reassurance
  // — it's the only entry-point step where account creation might be
  // perceived as a friction. All later steps already imply auth.
  const isQuizStep = next.kind === "quiz";

  return (
    <div
      className="flex flex-col items-center gap-4"
      data-component="journey-cta"
      aria-label="Your next step at Eden Institute"
    >
      {/* Dominant primary CTA — always internal route, so always Link. */}
      <Button
        asChild
        variant="eden"
        size="xl"
        className="min-h-[48px] text-sm sm:text-base px-4 sm:px-8 max-w-[90vw] whitespace-normal leading-snug"
        style={{
          backgroundColor: "hsl(var(--eden-gold))",
          color: "hsl(var(--eden-bark))",
        }}
      >
        <Link
          to={next.href}
          data-cta="journey-next"
          data-journey-kind={next.kind}
        >
          {next.label} →
        </Link>
      </Button>

      {/* Quiz acquisition reassurance — preserved from the prior Hero copy. */}
      {isQuizStep && (
        <p
          className="font-body text-sm"
          style={{ color: "hsl(var(--eden-sage))" }}
        >
          No email required to start.
        </p>
      )}

      {/* Always-visible secondary CTAs: Foundations Course (always) +
          per-Pattern Amazon kit (only when a Pattern is resolved). Both
          external — open in new tab; Amazon carries rel="sponsored" per
          Google's affiliate-disclosure attribute. */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-x-4 gap-y-2 mt-1">
        <a
          href={course.href}
          target="_blank"
          rel="noopener noreferrer"
          data-cta="journey-course"
          aria-label={`${course.label} (opens in a new tab)`}
          className="font-body text-sm font-semibold underline-offset-4 hover:underline inline-flex items-center gap-1.5"
          style={{ color: "hsl(var(--eden-forest))" }}
        >
          {course.label}
          <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        </a>
        {amazonKit && (
          <>
            <span
              aria-hidden="true"
              className="hidden sm:inline font-serif text-base leading-none"
              style={{ color: "hsl(var(--eden-gold))" }}
            >
              ·
            </span>
            <a
              href={amazonKit.href}
              target="_blank"
              rel="noopener noreferrer sponsored"
              data-cta="journey-amazon-kit"
              aria-label={`${amazonKit.label} (opens in a new tab)`}
              className="font-body text-sm font-semibold underline-offset-4 hover:underline inline-flex items-center gap-1.5"
              style={{ color: "hsl(var(--eden-forest))" }}
            >
              {amazonKit.label}
              <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            </a>
          </>
        )}
      </div>

      {/* FTC affiliate disclosure — matches MatchedHerbsCtaPair (PR #72)
          and Navbar (PR #98) wording for cross-surface consistency. Only
          renders when the Amazon slot is visible. */}
      {amazonKit && (
        <p
          className="font-body text-xs italic text-center max-w-md"
          style={{ color: "hsl(var(--eden-sage))" }}
        >
          Affiliate links — Eden Institute earns a small commission at no
          extra cost to you.
        </p>
      )}
    </div>
  );
}

export default JourneyCTA;
