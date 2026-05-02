import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useDiagnosticProfile } from "@/hooks/useDiagnosticProfile";
import { PATTERN_PROFILES } from "@/lib/edenPattern";
import { ROUTES } from "@/lib/routes";
import { type DiagnosticProfile, hasFullDiagnosticDepth } from "@/lib/diagnosticProfile";
import { useActiveProfileOptional } from "@/contexts/ActiveProfileContext";

/**
 * PatternMatchHero — personalization card on the Apothecary directory home.
 *
 * v4 (2026-05-02 PR #109) — non-self CTA URL routing fix. PR #108 added the
 * active-profile-aware copy + ?profileId=... query string but pointed the
 * URL at ROUTES.ASSESSMENT (= /assessment, the PUBLIC marketing-quiz route
 * which is NOT wrapped in ApothecaryLayout and therefore has no
 * ActiveProfileContext provider). With profileCtx always null on
 * /assessment, Assessment.tsx's targetProfile resolution returned null,
 * diagnosticMode evaluated to false, and the page silently fell through to
 * marketing-mode auto-submit — writing via resend-waitlist +
 * record-quiz-completion using user.email instead of the sub-profile id.
 * The new v14 record-quiz-completion treats UNIQUE(lower(email)) conflicts
 * as 200 no-op, so the silent failure left zero data captured for the
 * sub-profile. Net effect: the apothecary kept asking the user to take the
 * quiz again forever for non-self profiles.
 *
 * v4 fix: route non-self CTA at ROUTES.APOTHECARY_QUIZ (= /apothecary/quiz)
 * instead. That route IS wrapped in ApothecaryLayout (so ActiveProfileContext
 * is available, targetProfile resolves, diagnosticMode engages, and the
 * record-diagnostic-completion id-keyed write fires per Lock #40). It is
 * also gated by RequireTier(["root","practitioner"]) which matches the
 * design intent: sub-profile clinical writes are a Root-tier feature.
 *
 * Self-profile CTA keeps ROUTES.ASSESSMENT — the public marketing quiz is
 * correct for first-time self Pattern resolution by anon visitors and by
 * authed users on any tier.
 *
 * v3 (2026-05-02 PR #83) — empty-state branch is active-profile-aware:
 *   - Reads useActiveProfileOptional + the isEmptyForActiveProfile signal
 *     from useDiagnosticProfile (signal was previously ignored, causing the
 *     empty-state UI to render identically whether the user themselves had
 *     no Pattern or whether a non-self active profile lacked a Pattern).
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
 * Mobile-aware per project_mobile_wrapping_roadmap.md: no hover-only
 * interactions, no right-clicks, all tap targets ≥ 44px, responsive Tailwind
 * utilities throughout.
 */
export function PatternMatchHero() {
  const { user } = useAuth();
  const { data: profile, isLoading, isEmptyForActiveProfile } = useDiagnosticProfile();
  const profileCtx = useActiveProfileOptional();
  const activeProfile = profileCtx?.activeProfile ?? null;

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
    // Empty state has two flavors:
    //   1. Non-self active profile lacks a Pattern → "Take the quiz for
    //      {name}" + URL pointing at /apothecary/quiz?profileId=... so the
    //      diagnostic-mode pipeline (record-diagnostic-completion, id-keyed)
    //      writes the result to the sub-profile's person_profiles row.
    //   2. User themselves has no Pattern (or no active-profile context) →
    //      generic copy + URL at /assessment (marketing-mode flow).
    const isNonSelfEmpty =
      isEmptyForActiveProfile &&
      activeProfile !== null &&
      activeProfile.is_self === false;

    const targetName = isNonSelfEmpty ? activeProfile?.name ?? "this profile" : null;

    // v4 (PR #109): non-self CTA routes to the in-app diagnostic quiz
    // (/apothecary/quiz) instead of the public marketing quiz (/assessment).
    // The in-app route is the only one wrapped in ApothecaryLayout (which
    // provides ActiveProfileContext) and is gated to root/practitioner
    // tier per Lock #40. Self CTA keeps the public route.
    const ctaHref = isNonSelfEmpty
      ? `${ROUTES.APOTHECARY_QUIZ}?profileId=${activeProfile!.id}`
      : ROUTES.ASSESSMENT;

    const ctaLabel = isNonSelfEmpty
      ? `→ Take the Quiz for ${targetName}`
      : "→ Take the Body Pattern Quiz";

    const heading = isNonSelfEmpty
      ? `Discover ${targetName}'s Pattern to unlock match badges across all 100 herbs.`
      : "Discover your Pattern to unlock match badges across all 100 herbs.";

    const subhead = isNonSelfEmpty
      ? `Two minutes. Twelve questions across three classical axes (Temperature, Moisture, Tone). The result reveals which of the eight Eden Patterns governs ${targetName}'s terrain — and from there, every herb in the directory shows whether it rebalances or aggravates ${targetName}'s specific Pattern.`
      : "Two minutes. Twelve questions across three classical axes (Temperature, Moisture, Tone). Your result reveals which of the eight Eden Patterns governs your terrain — and from there, every herb in the directory shows whether it rebalances or aggravates your specific Pattern.";

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
              {isNonSelfEmpty
                ? `Personalize ${targetName}'s view`
                : "Personalize your directory"}
            </p>
            <h2
              className="font-serif text-2xl md:text-3xl font-bold mb-3"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              {heading}
            </h2>
            <p
              className="font-body text-sm md:text-base leading-relaxed"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              {subhead}
            </p>
          </div>
          <div className="mt-6 md:mt-0 md:flex-shrink-0">
            <Button asChild variant="eden" size="xl" className="min-h-[44px]">
              <Link to={ctaHref}>{ctaLabel}</Link>
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

        {profile.galenicTemperament && (
          <div className="mt-6 pt-6 border-t" style={{ borderColor: "hsl(40, 20%, 80%)" }}>
            <p className="font-accent text-xs tracking-[0.3em] uppercase mb-2" style={{ color: "hsl(var(--eden-gold))" }}>Galenic Temperament</p>
            <p className="font-body text-sm md:text-base" style={{ color: "hsl(var(--eden-bark))" }}>{profile.galenicTemperament}</p>
          </div>
        )}

        {profile.tissueStateProfile && Object.keys(profile.tissueStateProfile).length > 0 && (
          <div className="mt-6 pt-6 border-t" style={{ borderColor: "hsl(40, 20%, 80%)" }}>
            <p className="font-accent text-xs tracking-[0.3em] uppercase mb-2" style={{ color: "hsl(var(--eden-gold))" }}>Tissue State Profile</p>
            <dl className="font-body text-sm md:text-base grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
              {Object.entries(profile.tissueStateProfile).map(([system, state]) => (
                <div key={system}>
                  <dt className="inline font-medium capitalize">{system}: </dt>
                  <dd className="inline" style={{ color: "hsl(var(--eden-bark))" }}>{state}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {profile.vitalForce && (
          <div className="mt-6 pt-6 border-t" style={{ borderColor: "hsl(40, 20%, 80%)" }}>
            <p className="font-accent text-xs tracking-[0.3em] uppercase mb-2" style={{ color: "hsl(var(--eden-gold))" }}>Vital Force</p>
            <p className="font-body text-sm md:text-base capitalize" style={{ color: "hsl(var(--eden-bark))" }}>{profile.vitalForce}</p>
          </div>
        )}

        {!hasFullDiagnosticDepth(profile) && (
          <p className="font-body text-xs italic mt-6 pt-4 border-t" style={{ color: "hsl(30, 10%, 40%, 0.8)", borderColor: "hsl(40, 20%, 80%)" }}>
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
