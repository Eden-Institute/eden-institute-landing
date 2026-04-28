import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useApothecaryHerbs } from "@/hooks/useApothecaryHerbs";
import { useEdenPattern } from "@/hooks/useEdenPattern";
import { HerbCard } from "@/components/apothecary/HerbCard";
import { PatternMatchHero } from "@/components/apothecary/PatternMatchHero";
import {
  HerbDirectoryFilters,
  EMPTY_FILTERS,
  matchesFilters,
  type HerbFilterState,
} from "@/components/apothecary/HerbDirectoryFilters";
import { PageSkeleton } from "@/components/apothecary/PageSkeleton";

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
 * Active user's Eden Pattern (when known) drives both the filter overlay
 * UI and the per-card Match/Avoid badges. The pattern is read from
 * `profiles.constitution_type` via `useEdenPattern`. Unknown / unmapped
 * values resolve to null — the UI degrades gracefully (no badge, take-the-
 * quiz affordance surfaces in the upgrade aside).
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
  const [filters, setFilters] = useState<HerbFilterState>(EMPTY_FILTERS);

  const visible = useMemo(
    () => herbs.filter((h) => matchesFilters(h, { filters, activePattern })),
    [herbs, filters, activePattern]
  );

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
                  Unlock the full materia medica
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
        </div>
      </section>
    </div>
  );
}
