import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useApothecaryHerbs } from "@/hooks/useApothecaryHerbs";
import { useEdenPattern } from "@/hooks/useEdenPattern";
import { HerbCard } from "@/components/apothecary/HerbCard";
import { PatternMatchHero } from "@/components/apothecary/PatternMatchHero";
import { MatchedHerbsCtaPair } from "@/components/apothecary/MatchedHerbsCtaPair";
import {
  HerbDirectoryFilters,
  EMPTY_FILTERS,
  matchesFilters,
  type HerbFilterState,
} from "@/components/apothecary/HerbDirectoryFilters";
import { PageSkeleton } from "@/components/apothecary/PageSkeleton";
import { computeMatchRelationship } from "@/lib/edenPattern";

/**
 * Eden Apothecary index (`/apothecary`).
 *
 * Stage 6.3.5 — Symptom-Doorway Filter Rebuild + Stage 6.3.6 visible-but-
 * gated unified directory. Reads `herbs_directory_v` for all 100 herbs;
 * tier-conditional column population (Band 1 always, Band 2 unlocked rows
 * for anon/free + all rows for Seed+, Band 3 Seed+ only across all rows).
 *
 * The four-axis filter primitives (Symptom · Action · Body system→tissue ·
 * Clinical safety) plus the Pattern of Eden constitutional overlay live in
 * `HerbDirectoryFilters`. Pattern matching is computed client-side in
 * `@/lib/edenPattern` from herbs.temperature × moisture × tissue states.
 *
 * §8.1.2 (Manual v4.0) — Matched-Herbs Scoring + Sort + Reasons.
 * When the active user has a resolved Eden Pattern, the directory now:
 *   1. Sorts the visible array by `MatchRelationshipDetail.sortKey` desc —
 *      match rows surface first, then neutral, then avoid (least-aggravating
 *      avoids on top of the avoid block for a readable gradient).
 *   2. Defaults `patternHideAvoid` ON for the first page render — terrain-
 *      first means a Pattern-aware user sees a Pattern-aligned directory by
 *      default. The "Hide aggravators" chip stays user-toggleable; flipping
 *      it off restores the full sorted set with avoid badges intact.
 * Default-flip is per-mount, not persisted. Once the user touches any
 * filter (including toggling the chip back on), `EMPTY_FILTERS` is the
 * baseline going forward.
 *
 * §8.1.4 PR 4 — Matched-Herbs CTA Pair.
 * When activePattern resolves, render <MatchedHerbsCtaPair> below the grid
 * (and below the upgrade aside for non-subscribers). The component
 * self-suppresses when activePattern is null. Replaces the removed §8.1.5
 * formulary slot — formularies are now Practitioner-tier-only per the
 * 2026-04-29 binding decision.
 *
 * Active user's Eden Pattern (when known) drives both the filter overlay
 * UI, the sort order, the per-card Match/Avoid badges, AND the new
 * "matches because…" stewardship-language reasons surfaced under the
 * badge. The pattern is read from `profiles.constitution_type` via
 * `useEdenPattern`. Unknown / unmapped values resolve to null — the UI
 * degrades gracefully (no badge, no sort, take-the-quiz affordance
 * surfaces in the upgrade aside).
 *
 * Per Locked Decision §0.8 #4 the DB view is the sole read surface; RLS
 * and the view's CASE expressions enforce gating server-side.
 *
 * Routed herb detail (`/apothecary/:herb_id`) + `contraindications_clinical_v`
 * view migration land in Stage 6.4.
 */
export default function ApothecaryHome() {
  const { user } = useAuth();
  const {
    tier,
    isSubscriber,
    data: herbs,
    isLoading,
    isError,
    error,
  } = useApothecaryHerbs();
  const { data: activePattern } = useEdenPattern();

  // Per-mount default: when an active Pattern is known, hide aggravators by
  // default. The user can toggle this off — once any filter touch happens
  // they own the state going forward (no further auto-flips). Implemented
  // as a state-init function so it runs once at mount.
  const [filters, setFilters] = useState<HerbFilterState>(() => EMPTY_FILTERS);

  // Apply the default-flip the first time activePattern resolves to non-null
  // (the hook returns null synchronously, then async-resolves). Guard with a
  // local flag so subsequent activePattern changes (e.g., picker switch)
  // don't override the user's manual filter state.
  const [hasAppliedPatternDefault, setHasAppliedPatternDefault] = useState(false);
  useEffect(() => {
    if (hasAppliedPatternDefault) return;
    if (!activePattern) return;
    setFilters((prev) => {
      // Don't override if the user has already touched filters between mount
      // and pattern-resolve (rare race, but cheap to guard).
      const isPristine =
        prev.query === EMPTY_FILTERS.query &&
        prev.symptom === EMPTY_FILTERS.symptom &&
        prev.action === EMPTY_FILTERS.action &&
        prev.bodySystem === EMPTY_FILTERS.bodySystem &&
        prev.tissueState === EMPTY_FILTERS.tissueState &&
        prev.populationSafety === EMPTY_FILTERS.populationSafety &&
        prev.patternMatchOnly === EMPTY_FILTERS.patternMatchOnly &&
        prev.patternHideAvoid === EMPTY_FILTERS.patternHideAvoid;
      if (!isPristine) return prev;
      return { ...prev, patternHideAvoid: true };
    });
    setHasAppliedPatternDefault(true);
  }, [activePattern, hasAppliedPatternDefault]);

  const visible = useMemo(() => {
    const filtered = herbs.filter((h) =>
      matchesFilters(h, { filters, activePattern })
    );
    if (!activePattern) return filtered;
    // Pattern-aware sort. Score each unlocked row; locked rows score as
    // neutral (sortKey 1000) so they stay grouped in the middle band rather
    // than promoted/demoted by guesswork.
    const scored = filtered.map((herb) => {
      if (herb.is_locked) {
        return { herb, sortKey: 1000 };
      }
      const detail = computeMatchRelationship(
        {
          temperature: herb.temperature ?? null,
          moisture: herb.moisture ?? null,
          tissue_states_indicated: herb.tissue_states_indicated ?? null,
        },
        activePattern
      );
      return { herb, sortKey: detail.sortKey };
    });
    scored.sort((a, b) => b.sortKey - a.sortKey);
    return scored.map((x) => x.herb);
  }, [herbs, filters, activePattern]);

  if (isLoading) return <PageSkeleton />;

  if (isError) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <h1
          className="font-serif text-2xl font-semibold mb-3"
          style={{ color: "hsl(var(--eden-bark))" }}
        >
          We could not load the directory
        </h1>
        <p className="font-body text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Please refresh the page."}
        </p>
      </div>
    );
  }

  // PR #50 (v3.33 Pass 2 marketing): "partner" -> "app" per Lock #47.
  const subtitle = isSubscriber
    ? "The full materia medica — 100 monographs with tissue-state indications, organ system affinity, constitutional matches, and safety overlays."
    : "A clinical reasoning app rather than a symptom index. Each monograph is anchored to constitutional patterns, tissue states, and stewardship — never to disease names.";

  const tierBadge = isSubscriber
    ? tier === "practitioner"
      ? "Practitioner tier"
      : tier === "root"
      ? "Root tier"
      : "Seed tier"
    : null;

  return (
    <div>
      <section
        className="py-12 md:py-16 px-6"
        style={{ backgroundColor: "hsl(var(--eden-cream))" }}
      >
        <div className="max-w-5xl mx-auto">
          <p
            className="font-accent text-xs tracking-[0.3em] uppercase mb-4"
            style={{ color: "hsl(var(--eden-gold))" }}
          >
            Eden Apothecary
          </p>
          <h1
            className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mb-4"
            style={{ color: "hsl(var(--eden-bark))" }}
          >
            Materia medica, <span className="italic">terrain-first.</span>
          </h1>
          <p className="font-body text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed">
            {subtitle}
          </p>
          {tierBadge && (
            <p
              className="font-accent text-[11px] tracking-[0.25em] uppercase mt-5"
              style={{ color: "hsl(var(--eden-gold))" }}
            >
              Viewing as {tierBadge}
              {activePattern && (
                <span className="ml-2 text-muted-foreground">
                  · Your Pattern: {activePattern}
                </span>
              )}
            </p>
          )}
        </div>
      </section>

      <section className="px-6">
        <div className="max-w-6xl mx-auto pt-8">
          <PatternMatchHero />
        </div>
      </section>

      <section className="px-6 py-10">
        <div className="max-w-6xl mx-auto space-y-8">
          <HerbDirectoryFilters
            herbs={herbs}
            filters={filters}
            onChange={setFilters}
            visibleCount={visible.length}
            totalCount={herbs.length}
            tier={tier}
            activePattern={activePattern}
          />

          {visible.length === 0 ? (
            <div
              className="rounded-lg border p-10 text-center"
              style={{ borderColor: "hsl(var(--border))" }}
            >
              <p
                className="font-serif text-lg font-semibold mb-2"
                style={{ color: "hsl(var(--eden-bark))" }}
              >
                No herbs match these filters.
              </p>
              <p className="font-body text-sm text-muted-foreground">
                Try clearing a filter or widening your search.
              </p>
            </div>
          ) : (
            <div
              className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
              aria-label="Herb directory"
            >
              {visible.map((herb) => (
                <HerbCard
                  key={herb.herb_id ?? herb.common_name ?? Math.random()}
                  herb={herb}
                  activePattern={activePattern}
                />
              ))}
            </div>
          )}

          {!isSubscriber && (
            <aside
              className="rounded-lg border p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              style={{
                borderColor: "hsl(var(--eden-gold) / 0.4)",
                backgroundColor: "hsl(var(--eden-cream) / 0.5)",
              }}
            >
              <div>
                <p
                  className="font-accent text-[11px] tracking-[0.3em] uppercase mb-2"
                  style={{ color: "hsl(var(--eden-gold))" }}
                >
                  Open the full materia medica
                </p>
                <h2
                  className="font-serif text-xl md:text-2xl font-semibold leading-tight mb-2"
                  style={{ color: "hsl(var(--eden-bark))" }}
                >
                  Seed opens the full study for all 100 herbs.
                </h2>
                <p className="font-body text-sm text-muted-foreground max-w-xl">
                  How each herb acts in the body, who it suits, how to prepare
                  it, and how to use it safely — including drug-herb
                  interactions and special-population guidance.
                </p>
              </div>
              <div className="flex gap-3 shrink-0">
                <Button variant="eden" size="lg" asChild>
                  <Link to="/apothecary/pricing">
                    {user ? "Choose a plan" : "Start with Seed"}
                  </Link>
                </Button>
              </div>
            </aside>
          )}

          {/* §8.1.4 PR 4 — bottom CTA pair (Practitioner waitlist + Amazon kit).
              Self-suppresses when no Pattern is resolved. Replaces removed
              §8.1.5 formulary slot per the 2026-04-29 Practitioner-tier
              scoping decision. */}
          <MatchedHerbsCtaPair activePattern={activePattern} />
        </div>
      </section>
    </div>
  );
}
