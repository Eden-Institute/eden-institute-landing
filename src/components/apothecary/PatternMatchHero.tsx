import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useDiagnosticProfile } from "@/hooks/useDiagnosticProfile";
import { PATTERN_PROFILES } from "@/lib/edenPattern";
import { type DiagnosticProfile, hasFullDiagnosticDepth } from "@/lib/diagnosticProfile";

/**
 * PatternMatchHero — personalization card on the Apothecary directory home.
 *
 * Stage 6.3.5 Phase B sub-task 3 (v1). Per the strategic-pivot architecture
 * in Manual v3.8, this hero ships as a FORWARD-COMPATIBLE SHELL: it reads
 * from the layered DiagnosticProfile contract and renders whichever layers
 * are populated. v1 surfaces LAYER 1 only (Eden Pattern + axis readings);
 * Layers 2-4 (Galenic temperament, tissue state profile, vital force) are
 * conditionally rendered when the Root-tier deep diagnostic populates them.
 * Zero rip-out when the deeper layers ship — the consuming JSX already
 * handles them.
 *
 * Three render branches by user state:
 *   • Anon visitor: noop (the apothecary surface itself is auth-walled per
 *     §0.8 #19 — anon will never see this).
 *   • Authed user without resolved Pattern: take-the-quiz CTA (12-q quiz
 *     at /assessment).
 *   • Authed user with resolved Pattern: Pattern card with axis readings,
 *     plus conditional Layer 2-4 cards when populated, plus Root-tier
 *     upgrade affordance for non-Root users (deferred until /apothecary/
 *     profile/quiz exists; v1 surfaces only the conservative "deeper
 *     diagnostic coming" copy).
 *
 * Mobile-aware per project_mobile_wrapping_roadmap.md: no hover-only
 * interactions, no right-clicks, all tap targets ≥ 44px, responsive Tailwind
 * utilities throughout.
 */
export function PatternMatchHero() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useDiagnosticProfile();

  // Anon: this surface is auth-walled per §0.8 #19. Return null and let the
  // route's RequireAuth handle the unauthenticated case.
  if (!user) return null;

  // Loading: render a minimal skeleton so layout doesn't shift.
  if (isLoading) {
    return (
      <section
        className="px-6 py-8 md:py-10 mb-8 rounded"
        style={{ backgroundColor: "hsl(var(--eden-cream))" }}
      >
        <div
          className="max-w-5xl mx-auto h-24 animate-pulse rounded"
          style={{ backgroundColor: "hsl(var(--eden-cream-dark, var(--eden-cream)))" }}
          aria-hidden
        />
      </section>
    );
  }

  // Authed without a resolved Pattern — surface the take-the-quiz affordance.
  if (!profile) {
    return (
      <section
        className="px-6 py-10 md:py-12 mb-8 rounded"
        style={{ backgroundColor: "hsl(var(--eden-cream))" }}
      >
        <div className="max-w-5xl mx-auto md:flex md:items-center md:justify-between gap-8">
          <div className="md:max-w-2xl">
            <p
              className="font-accent text-xs tracking-[0.3em] uppercase mb-3"
              style={{ color: "hsl(var(--eden-gold))" }}
            >
              Personalize your directory
            </p>
            <h2
              className="font-serif text-2xl md:text-3xl font-bold mb-3"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              Discover your Pattern to unlock match badges across all 100 herbs.
            </h2>
            <p
              className="font-body text-sm md:text-base leading-relaxed"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              Two minutes. Twelve questions across three classical axes
              (Temperature, Moisture, Tone). Your result reveals which of the
              eight Eden Patterns governs your terrain — and from there, every
              herb in the directory shows whether it rebalances or aggravates
              your specific Pattern.
            </p>
          </div>
          <div className="mt-6 md:mt-0 md:flex-shrink-0">
            <Button asChild variant="eden" size="xl" className="min-h-[44px]">
              <Link to="/assessment">→ Take the Body Pattern Quiz</Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  // Authed with a resolved Pattern — render the layered profile card.
  return <ResolvedProfileCard profile={profile} />;
}

/* ---------------- Resolved-profile branch ---------------- */

function ResolvedProfileCard({ profile }: { profile: DiagnosticProfile }) {
  const patternProfile = PATTERN_PROFILES[profile.edenPattern];

  return (
    <section
      className="px-6 py-10 md:py-12 mb-8 rounded"
      style={{ backgroundColor: "hsl(var(--eden-cream))" }}
    >
      <div className="max-w-5xl mx-auto">
        {/* LAYER 1 — Eden Pattern (always rendered) */}
        <div className="md:flex md:items-start md:justify-between gap-8 mb-2">
          <div className="md:max-w-2xl">
            <p
              className="font-accent text-xs tracking-[0.3em] uppercase mb-2"
              style={{ color: "hsl(var(--eden-gold))" }}
            >
              Your Pattern
            </p>
            <h2
              className="font-serif text-3xl md:text-4xl font-bold mb-3"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              {profile.edenPattern}
            </h2>
            <p
              className="font-body text-sm md:text-base mb-4"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              <span className="font-medium">Axes:</span>{" "}
              {profile.edenAxes.temperature} · {profile.edenAxes.moisture} ·{" "}
              {profile.edenAxes.tone}
            </p>
            <p
              className="font-body text-sm md:text-base leading-relaxed"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              {patternProfile.summary}
            </p>
          </div>
        </div>

        {/* LAYER 2 — Galenic Temperament (conditional, undefined in v1) */}
        {profile.galenicTemperament && (
          <div
            className="mt-6 pt-6 border-t"
            style={{ borderColor: "hsl(40, 20%, 80%)" }}
          >
            <p
              className="font-accent text-xs tracking-[0.3em] uppercase mb-2"
              style={{ color: "hsl(var(--eden-gold))" }}
            >
              Galenic Temperament
            </p>
            <p
              className="font-body text-sm md:text-base"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              {profile.galenicTemperament}
            </p>
          </div>
        )}

        {/* LAYER 3 — Tissue State Profile (conditional, undefined in v1) */}
        {profile.tissueStateProfile &&
          Object.keys(profile.tissueStateProfile).length > 0 && (
            <div
              className="mt-6 pt-6 border-t"
              style={{ borderColor: "hsl(40, 20%, 80%)" }}
            >
              <p
                className="font-accent text-xs tracking-[0.3em] uppercase mb-2"
                style={{ color: "hsl(var(--eden-gold))" }}
              >
                Tissue State Profile
              </p>
              <dl className="font-body text-sm md:text-base grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                {Object.entries(profile.tissueStateProfile).map(
                  ([system, state]) => (
                    <div key={system}>
                      <dt className="inline font-medium capitalize">
                        {system}:{" "}
                      </dt>
                      <dd
                        className="inline"
                        style={{ color: "hsl(var(--eden-bark))" }}
                      >
                        {state}
                      </dd>
                    </div>
                  ),
                )}
              </dl>
            </div>
          )}

        {/* LAYER 4 — Vital Force (conditional, undefined in v1) */}
        {profile.vitalForce && (
          <div
            className="mt-6 pt-6 border-t"
            style={{ borderColor: "hsl(40, 20%, 80%)" }}
          >
            <p
              className="font-accent text-xs tracking-[0.3em] uppercase mb-2"
              style={{ color: "hsl(var(--eden-gold))" }}
            >
              Vital Force
            </p>
            <p
              className="font-body text-sm md:text-base capitalize"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              {profile.vitalForce}
            </p>
          </div>
        )}

        {/* Upgrade narrative when not yet on deep diagnostic. v1 surfaces
            conservative copy only — the deep-diagnostic upgrade endpoint
            ships in a later PR (Manual v3.8 strategic pivot). */}
        {!hasFullDiagnosticDepth(profile) && (
          <p
            className="font-body text-xs italic mt-6 pt-4 border-t"
            style={{
              color: "hsl(30, 10%, 40%, 0.8)",
              borderColor: "hsl(40, 20%, 80%)",
            }}
          >
            Your Pattern is the entry-tier reading. A deeper four-layer
            diagnostic — Galenic temperament, tissue state profile by organ
            system, and vital force overlay — is in active development for
            Root tier. Each layer is anchored to public-domain Western
            classical sources (Galen, Cook, Scudder, Felter).
          </p>
        )}
      </div>
    </section>
  );
}

export default PatternMatchHero;
