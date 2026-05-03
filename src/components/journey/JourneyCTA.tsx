import { useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTierAwareCTA } from "@/hooks/useTierAwareCTA";
import PractitionerWaitlistModal from "@/components/landing/PractitionerWaitlistModal";

const PRACTITIONER_WAITLIST_ANCHOR = "/apothecary#practitioner-waitlist";

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
 *
 * ─────────────────────────────────────────────────────────────────
 * PR ι (iota) — dual-CTA waitlist pattern.
 * ─────────────────────────────────────────────────────────────────
 *
 * When the dominant journey step resolves to "practitioner-waitlist"
 * the dominant slot now renders TWO CTAs side-by-side (stacked on
 * mobile): a primary modal-trigger button that opens the email-form
 * modal directly (1-click), and a secondary "Learn More" link routing
 * to /apothecary#practitioner-waitlist for visitors who want to read
 * the inline descriptive copy first. Collapses the previous flow:
 *   Link → /apothecary navigation → scroll past the full herb
 *   directory → reach the inline form → submit
 * which Camila clocked as a structural 2-click conversion path on
 * profile switch.
 *
 * Tier-agnostic by design: the switch is on next.kind, not on the
 * user's subscription tier. Per Camila's PR ι clarification
 * (2026-05-02), the 2-click flow shows up on every tier that supports
 * multi-profile switching — Seed (up to 5 profiles), Root (up to 10),
 * and Practitioner (up to 500) — so the fix must not be tier-gated.
 * Today useTierAwareCTA only resolves the "practitioner-waitlist"
 * kind for Root, but the dual-CTA branch here will fire for any tier
 * the state machine surfaces it to without further code changes.
 *
 * Foundations Course + Amazon kit secondaries are journey context,
 * not the dual-CTA waitlist pair, and remain unchanged.
 */
export function JourneyCTA() {
  const { journey, amazonKit } = useTierAwareCTA();
  const { next, course } = journey;
  const [practitionerModalOpen, setPractitionerModalOpen] = useState(false);

  // The quiz step preserves the legacy Hero "No email required" reassurance
  // — it's the only entry-point step where account creation might be
  // perceived as a friction. All later steps already imply auth.
  const isQuizStep = next.kind === "quiz";

  // PR ι (iota): tier-agnostic switch on journey kind. Practitioner-
  // waitlist surfaces become a 1-click modal-trigger + Learn More
  // sibling regardless of which tier resolved the step.
  const isPractitionerStep = next.kind === "practitioner-waitlist";

  return (
    <div
      className="flex flex-col items-center gap-4"
      data-component="journey-cta"
      aria-label="Your next step at Eden Institute"
    >
      {isPractitionerStep ? (
        // PR ι: dual-CTA pair for the practitioner-waitlist step. Stacked
        // on <sm, side-by-side on sm+. Primary opens the modal directly,
        // secondary routes to the inline matched-herbs form so visitors
        // who want descriptive context before signup keep that path.
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 w-full max-w-[90vw]">
          <Button
            type="button"
            variant="eden"
            size="xl"
            onClick={() => setPractitionerModalOpen(true)}
            data-cta="journey-next"
            data-journey-kind={next.kind}
            className="min-h-[48px] text-sm sm:text-base px-4 sm:px-8 whitespace-normal leading-snug"
            style={{
              backgroundColor: "hsl(var(--eden-gold))",
              color: "hsl(var(--eden-bark))",
            }}
          >
            {next.label} →
          </Button>
          <Button
            asChild
            variant="eden-outline"
            size="xl"
            className="min-h-[48px] text-sm sm:text-base px-4 sm:px-6 whitespace-normal leading-snug"
          >
            <Link
              to={PRACTITIONER_WAITLIST_ANCHOR}
              data-cta="journey-next-learn-more"
              data-journey-kind={next.kind}
            >
              Learn More
            </Link>
          </Button>
        </div>
      ) : (
        // Dominant primary CTA — internal route, so always Link.
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
      )}

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

      {/* PR ι (iota): mounted at the JourneyCTA root so the modal is
          reachable from any surface that consumes <JourneyCTA />
          (homepage hero, /apothecary/account). Only opens when the
          practitioner-waitlist branch above triggers it. */}
      <PractitionerWaitlistModal
        open={practitionerModalOpen}
        onOpenChange={setPractitionerModalOpen}
        surface="journey_cta_practitioner_step"
      />
    </div>
  );
}

export default JourneyCTA;
