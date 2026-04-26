import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { PersonProfile } from "@/contexts/ActiveProfileContext";

/**
 * PatternQuizCTA — empty-state surface for a non-self person profile that
 * has no Pattern of Eden recorded yet.
 *
 * Surfacing rationale (per Manual §0.8 #39 + v3.14 Session Log):
 *   • Lock #39 forbids silent defaults — when a profile has no Pattern,
 *     we surface the inconclusive/take-quiz state, never a wrong-but-confident
 *     badge inherited from the user-level account.
 *   • For non-self profiles, only `person_profiles.eden_constitution` is
 *     authoritative. There is no legacy fallback to `profiles.constitution_type`
 *     because that column belongs to the account holder, not to the family
 *     member the picker is pointed at.
 *   • For the SELF profile, useEdenPattern falls back to
 *     `profiles.constitution_type` when person_profiles.eden_constitution is
 *     NULL (legacy onboarding bridge for accounts that pre-date PR #18).
 *
 * Routing: links to `/apothecary/quiz?profileId={id}` — the in-app
 * Pattern of Eden quiz mounted under ApothecaryLayout, gated by
 * RequireAuth + RequireTier(allow=["root","practitioner"]).
 *
 * Visual posture: tier-blind cream/serif treatment matching the rest of
 * the apothecary surfaces; no urgency tactics (Manual §0.8 #19).
 */
export function PatternQuizCTA({ profile }: { profile: PersonProfile }) {
  const href = `/apothecary/quiz?profileId=${encodeURIComponent(profile.id)}`;
  const isSelf = profile.is_self;

  return (
    <div
      className="rounded-lg border p-6 md:p-8"
      style={{
        borderColor: "hsl(var(--eden-bark) / 0.2)",
        backgroundColor: "hsl(var(--eden-cream) / 0.6)",
      }}
    >
      <p
        className="font-accent text-xs tracking-[0.2em] uppercase mb-3"
        style={{ color: "hsl(var(--eden-gold))" }}
      >
        Pattern of Eden
      </p>
      <h2
        className="font-serif text-2xl md:text-3xl font-bold mb-3"
        style={{ color: "hsl(var(--eden-forest))" }}
      >
        {isSelf
          ? "Take the Pattern of Eden quiz"
          : `Take the Pattern of Eden quiz for ${profile.name}`}
      </h2>
      <p
        className="font-body text-base leading-relaxed mb-6"
        style={{ color: "hsl(var(--eden-forest))" }}
      >
        {isSelf
          ? "Your directory personalizes once your Pattern is recorded. The quiz takes about three minutes."
          : `${profile.name} doesn't have a Pattern recorded yet. Take the twelve-question quiz to personalize the directory for them — terrain-first, not symptom-first.`}
      </p>
      <Button asChild variant="eden" size="lg">
        <Link to={href}>
          {isSelf
            ? "Begin the quiz"
            : `Begin the quiz for ${profile.name.split(" ")[0]}`}
        </Link>
      </Button>
    </div>
  );
}
