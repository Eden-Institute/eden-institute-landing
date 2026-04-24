import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentTier } from "@/hooks/useCurrentTier";
import { useHerbsPublic } from "@/hooks/useHerbsPublic";
import { HerbCard } from "@/components/apothecary/HerbCard";
import {
  HerbDirectoryFilters,
  EMPTY_FILTERS,
  matchesFilters,
  type HerbFilterState,
} from "@/components/apothecary/HerbDirectoryFilters";
import { PageSkeleton } from "@/components/apothecary/PageSkeleton";

/**
 * Eden Apothecary index (`/apothecary`). Stage 6.2 — anon / free-tier herb
 * directory.
 *
 * Reads from `public.herbs_public` (50 basic monographs, no junction data).
 * Per Locked Decision §0.8 the view is the only client-facing read surface;
 * RLS + view filter enforce tier gating at the DB layer.
 *
 * Seed+ expansion (full 100-herb clinical overlay via `herbs_clinical_v`)
 * lands in Stage 6.3; routed herb-detail pages in Stage 6.4. For v1 each card
 * expands in place to render the full herbs_public row.
 */
export default function ApothecaryHome() {
  const { user } = useAuth();
  const { data: tier } = useCurrentTier();
  const { data: herbs, isLoading, isError, error } = useHerbsPublic();

  const [filters, setFilters] = useState<HerbFilterState>(EMPTY_FILTERS);

  const list = herbs ?? [];
  const visible = useMemo(
    () => list.filter((h) => matchesFilters(h, filters)),
    [list, filters]
  );

  const isSubscriber =
    tier === "seed" || tier === "root" || tier === "practitioner";

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
            A clinical reasoning partner rather than a symptom index. Each
            monograph is anchored to constitutional patterns, tissue states,
            and stewardship — never to disease names.
          </p>
        </div>
      </section>

      <section className="px-6 py-10">
        <div className="max-w-6xl mx-auto space-y-8">
          <HerbDirectoryFilters
            herbs={list}
            filters={filters}
            onChange={setFilters}
            visibleCount={visible.length}
            totalCount={list.length}
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
                  Seed opens 50 additional herbs and every clinical overlay.
                </h2>
                <p className="font-body text-sm text-muted-foreground max-w-xl">
                  Tissue state indications, actions, constitutional matches,
                  organ system affinities, preparation methods, TCM and
                  Ayurvedic frameworks, and a full safety layer including
                  drug-herb interactions.
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
