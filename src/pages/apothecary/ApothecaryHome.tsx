import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useApothecaryHerbs } from "@/hooks/useApothecaryHerbs";
import { useEdenPattern } from "@/hooks/useEdenPattern";
import { useViewedHerbs } from "@/hooks/useViewedHerbs";
import { herbParam } from "@/lib/herbLinks";
import { HerbCard } from "@/components/apothecary/HerbCard";
import { PatternMatchHero } from "@/components/apothecary/PatternMatchHero";
import { MatchedHerbsCtaPair } from "@/components/apothecary/MatchedHerbsCtaPair";
import {
  HerbDirectoryFilters,
  EMPTY_FILTERS,
  matchesFilters,
  type HerbFilterState,
} from "@/components/apothecary/HerbDirectoryFilters";
import { DirectorySkeleton } from "@/components/apothecary/DirectorySkeleton";
import { computeMatchRelationship } from "@/lib/edenPattern";
import { ROUTES } from "@/lib/routes";

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
/**
 * URL persistence (CRO Phase 3, plan §11): the filter state round-trips
 * through search params so a filtered view is shareable and survives a
 * monograph detour via browser back. Defaults are OMITTED — a pristine
 * page is a bare /apothecary. The patternHideAvoid auto-flip writes state
 * only (not the URL), so it never dirties a shareable link; any URL that
 * hydrates a non-default field defeats the pristine check and the flip
 * stays off, which is exactly right for a shared link.
 */
const SAFETY_VALUES: ReadonlyArray<HerbFilterState["populationSafety"]> = [
  "pregnancy",
  "breastfeeding",
  "children",
];

function filtersFromParams(params: URLSearchParams): HerbFilterState {
  const safeRaw = params.get("safe");
  return {
    query: params.get("q") ?? "",
    symptom: params.get("symptom"),
    action: params.get("action"),
    bodySystem: params.get("system"),
    tissueState: params.get("tissue"),
    // Validate — an unknown value would otherwise fall through
    // matchesFilters' ternary into the children_safety branch.
    populationSafety: SAFETY_VALUES.includes(
      safeRaw as HerbFilterState["populationSafety"],
    )
      ? (safeRaw as HerbFilterState["populationSafety"])
      : "all",
    patternMatchOnly: params.get("match") === "1",
    patternHideAvoid: params.get("hideAvoid") === "1",
  };
}

const FILTER_PARAM_KEYS = [
  "q",
  "symptom",
  "action",
  "system",
  "tissue",
  "safe",
  "match",
  "hideAvoid",
] as const;

/**
 * Serialize filters onto the CURRENT params — foreign params (utm_*,
 * etc.) survive a filter touch; we only own the eight filter keys.
 */
function paramsFromFilters(
  filters: HerbFilterState,
  base: URLSearchParams,
): URLSearchParams {
  const p = new URLSearchParams(base);
  for (const key of FILTER_PARAM_KEYS) p.delete(key);
  if (filters.query.trim()) p.set("q", filters.query);
  if (filters.symptom) p.set("symptom", filters.symptom);
  if (filters.action) p.set("action", filters.action);
  if (filters.bodySystem) p.set("system", filters.bodySystem);
  if (filters.tissueState) p.set("tissue", filters.tissueState);
  if (filters.populationSafety !== "all") p.set("safe", filters.populationSafety);
  if (filters.patternMatchOnly) p.set("match", "1");
  if (filters.patternHideAvoid) p.set("hideAvoid", "1");
  return p;
}

/**
 * Empty-state symptom chips (CRO Phase 3, plan §10). `complaint` values
 * are VERBATIM complaint_name strings from the live complaints table —
 * herbHasComplaint is an exact, case-sensitive match, so display labels
 * and filter values are mapped explicitly. Every entry is verified to
 * have herb links in herbs_complaints (live audit 2026-07-01: Insomnia
 * 14, Anxiety 23, Digestive upset 27, Headaches 9, Fatigue 8) — a chip
 * that filters to zero would be a broken rescue.
 */
const EMPTY_STATE_SYMPTOMS: ReadonlyArray<{ label: string; complaint: string }> = [
  { label: "Sleep", complaint: "Insomnia" },
  { label: "Anxiety", complaint: "Anxiety" },
  { label: "Digestion", complaint: "Digestive upset" },
  { label: "Headaches", complaint: "Headaches" },
  { label: "Fatigue", complaint: "Fatigue" },
];

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
  const { viewed, viewedOrder } = useViewedHerbs();

  // Per-mount default: when an active Pattern is known, hide aggravators by
  // default. The user can toggle this off — once any filter touch happens
  // they own the state going forward (no further auto-flips). Implemented
  // as a state-init function so it runs once at mount.
  // CRO Phase 3: the initializer hydrates from the URL, so a shared or
  // bookmarked filtered view restores itself (and, being non-pristine,
  // suppresses the auto-flip — right for shared links).
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<HerbFilterState>(() =>
    filtersFromParams(searchParams),
  );

  // The last query string THIS component wrote. When searchParams changes
  // to something else, the change came from outside (nav Home/logo click,
  // browser Back/Forward) and state must re-hydrate — otherwise the URL
  // and the grid silently diverge. Compared as strings rather than
  // re-serializing current filters because the state-only patternHideAvoid
  // auto-flip legitimately makes state differ from the URL.
  const lastWrittenSearch = useRef<string>(searchParams.toString());
  // Pending debounced URL write for keystrokes (see handleFiltersChange).
  const pendingUrlWrite = useRef<number | null>(null);

  const writeUrl = (next: HerbFilterState) => {
    const params = paramsFromFilters(next, searchParams);
    lastWrittenSearch.current = params.toString();
    setSearchParams(params, { replace: true });
  };

  // User-driven filter changes sync the URL (replace, not push — filter
  // twiddling shouldn't pollute browser history). Query keystrokes are
  // DEBOUNCED: Safari throttles history.replaceState (~100 calls/30s) and
  // a fast typist would hit it; everything else writes immediately. The
  // auto-flip below deliberately does NOT go through this.
  const handleFiltersChange = (next: HerbFilterState) => {
    setFilters(next);
    if (pendingUrlWrite.current !== null) {
      window.clearTimeout(pendingUrlWrite.current);
      pendingUrlWrite.current = null;
    }
    const onlyQueryChanged =
      next.query !== filters.query &&
      next.symptom === filters.symptom &&
      next.action === filters.action &&
      next.bodySystem === filters.bodySystem &&
      next.tissueState === filters.tissueState &&
      next.populationSafety === filters.populationSafety &&
      next.patternMatchOnly === filters.patternMatchOnly &&
      next.patternHideAvoid === filters.patternHideAvoid;
    if (onlyQueryChanged) {
      pendingUrlWrite.current = window.setTimeout(() => {
        pendingUrlWrite.current = null;
        writeUrl(next);
      }, 300);
    } else {
      writeUrl(next);
    }
  };
  useEffect(
    () => () => {
      if (pendingUrlWrite.current !== null) {
        window.clearTimeout(pendingUrlWrite.current);
      }
    },
    [],
  );

  // External URL change (Link navigation or popstate): re-hydrate state so
  // the grid follows the URL — a Home/logo click while filtered resets the
  // grid, and Back/Forward actually do something.
  useEffect(() => {
    const current = searchParams.toString();
    if (current === lastWrittenSearch.current) return;
    lastWrittenSearch.current = current;
    setFilters(filtersFromParams(searchParams));
  }, [searchParams]);

  // A shared URL from a subscriber can carry Seed+/Root+ facets (action /
  // system / tissue). For a non-subscriber those facets have no visible
  // control and empty option lists, so they'd produce an unexplained
  // zero-result grid — drop them once the tier resolves.
  useEffect(() => {
    if (!tier || isSubscriber) return;
    if (!filters.action && !filters.bodySystem && !filters.tissueState) return;
    const next = {
      ...filters,
      action: null,
      bodySystem: null,
      tissueState: null,
    };
    setFilters(next);
    writeUrl(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, isSubscriber, filters]);

  // Apply the default-flip the first time activePattern resolves to non-null
  // (the hook returns null synchronously, then async-resolves). Guard with a
  // local flag so subsequent activePattern changes (e.g., picker switch)
  // don't override the user's manual filter state.
  const [hasAppliedPatternDefault, setHasAppliedPatternDefault] = useState(false);
  useEffect(() => {
    if (hasAppliedPatternDefault) return;
    if (!activePattern) return;
    // Don't override if the user (or a hydrated URL) has already touched
    // filters. Split into two pristineness levels so the flip doesn't RACE
    // the tier-strip effect: for a non-subscriber a shared URL's Seed+
    // facets are about to be stripped — if the flag were consumed while
    // they're still present, the same link would nondeterministically
    // hide-avoid or not depending on which query (tier vs pattern)
    // resolves first.
    const nonFacetPristine =
      filters.query === EMPTY_FILTERS.query &&
      filters.symptom === EMPTY_FILTERS.symptom &&
      filters.populationSafety === EMPTY_FILTERS.populationSafety &&
      filters.patternMatchOnly === EMPTY_FILTERS.patternMatchOnly &&
      filters.patternHideAvoid === EMPTY_FILTERS.patternHideAvoid;
    const facetsPristine =
      filters.action === EMPTY_FILTERS.action &&
      filters.bodySystem === EMPTY_FILTERS.bodySystem &&
      filters.tissueState === EMPTY_FILTERS.tissueState;
    if (nonFacetPristine && facetsPristine) {
      setFilters((prev) => ({ ...prev, patternHideAvoid: true }));
      setHasAppliedPatternDefault(true);
    } else if (!nonFacetPristine) {
      // Genuinely user-meaningful state — the default never applies.
      setHasAppliedPatternDefault(true);
    }
    // else: only tier-gated facets are set. Leave the flag unconsumed —
    // if the strip effect clears them (non-subscriber), the flip applies
    // deterministically on the next pass; if they're a subscriber's own
    // facets, this effect keeps no-opping, which is the correct "shared
    // URL defeats the flip" behavior.
  }, [activePattern, hasAppliedPatternDefault, filters]);

  const visible = useMemo(() => {
    const filtered = herbs.filter((h) =>
      matchesFilters(h, { filters, activePattern })
    );
    if (!activePattern) return filtered;
    // Pattern-aware sort. CRO Phase 2: locked rows are no longer pinned at
    // neutral — the view exposes temperature/moisture on every row, so a
    // locked match sorts into the match band with the rest (tissue axis is
    // still Seed-gated, so locked rows score from two axes — the documented
    // degraded mode). Until the Phase 2 view migration runs, locked axes
    // are NULL and score neutral (sortKey 1000), the old behavior.
    const scored = filtered.map((herb) => {
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

  // CRO Phase 2: how many locked rows survive the current narrowing. Feeds
  // the safety-filter conversion line ("guidance for N more herbs opens
  // with Seed"). Cheap over ~108 rows; no memo needed.
  const lockedVisibleCount = visible.filter(
    (h) => h.is_locked === true
  ).length;

  // CRO Phase 3 retention: exposure progress. Studied = viewed ∩ current
  // directory (stale ids from removed herbs never inflate the count).
  // The Pattern hook counts over the RAW herbs array, not `visible` — the
  // number must not mutate as the user filters.
  const studiedCount = herbs.filter(
    (h) => h.herb_id !== null && viewed.has(h.herb_id)
  ).length;
  const unexploredMatches = useMemo(() => {
    if (!activePattern) return 0;
    return herbs.filter(
      (h) =>
        h.herb_id !== null &&
        !viewed.has(h.herb_id) &&
        computeMatchRelationship(
          {
            temperature: h.temperature ?? null,
            moisture: h.moisture ?? null,
            tissue_states_indicated: h.tissue_states_indicated ?? null,
          },
          activePattern
        ).relationship === "match"
    ).length;
    // `viewed` is derived from viewedOrder; keying on the array keeps the
    // memo honest without re-running per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [herbs, activePattern, viewedOrder]);
  const patternShort = activePattern
    ? activePattern.replace(/^The\s+/i, "")
    : null;

  // Recently-viewed strip — most recent first, resolved against the loaded
  // directory, capped for one row of chips.
  const recentlyViewed = viewedOrder
    .map((id) => herbs.find((h) => h.herb_id === id))
    .filter((h): h is NonNullable<typeof h> => !!h)
    .slice(0, 5);

  if (isLoading) return <DirectorySkeleton />;

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
          {/* CRO Phase 3: exposure progress. Denominator is the live
              directory count for numeric consistency with the "{visible}
              of {total} herbs" line in the filter panel below. */}
          {studiedCount > 0 && (
            <p
              className="font-body text-sm mt-4"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              You've studied{" "}
              <span className="font-medium">{studiedCount}</span> of{" "}
              {herbs.length} herbs.
              {patternShort && unexploredMatches > 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  Your {patternShort} matches {unexploredMatches} more you
                  haven't opened.
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

      {/* CRO Phase 3: pick the thread back up. */}
      {recentlyViewed.length > 0 && (
        <section className="px-6" aria-label="Recently viewed herbs">
          <div className="max-w-6xl mx-auto pt-8">
            {/* Darker gold than the --eden-gold token: 12px text on the
                light background needs ≥4.5:1 (the token lands at ~2.3:1). */}
            <p
              className="font-accent text-[11px] tracking-[0.25em] uppercase mb-2"
              style={{ color: "hsl(40, 60%, 34%)" }}
            >
              Recently viewed
            </p>
            <div className="flex flex-wrap gap-2">
              {recentlyViewed.map((h) => (
                <Link
                  key={h.herb_id}
                  to={ROUTES.APOTHECARY_HERB(herbParam(h))}
                  data-cta="home-recently-viewed"
                  className="inline-flex items-center min-h-[44px] px-3 py-1 rounded-full font-body text-sm border bg-background transition-colors hover:border-[hsl(var(--eden-gold))]"
                  style={{
                    borderColor: "hsl(var(--border))",
                    color: "hsl(var(--eden-bark))",
                  }}
                >
                  {h.common_name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="px-6 py-10">
        <div className="max-w-6xl mx-auto space-y-8">
          <HerbDirectoryFilters
            herbs={herbs}
            filters={filters}
            onChange={handleFiltersChange}
            visibleCount={visible.length}
            totalCount={herbs.length}
            lockedVisibleCount={lockedVisibleCount}
            tier={tier}
            activePattern={activePattern}
          />

          {visible.length === 0 ? (
            /* CRO Phase 3 (plan §10): a dead end becomes a doorway —
               real symptom chips, the Pattern shortcut, and a reset. */
            <div
              className="rounded-lg border p-10 text-center"
              style={{ borderColor: "hsl(var(--border))" }}
            >
              <p
                className="font-serif text-lg font-semibold mb-2"
                style={{ color: "hsl(var(--eden-bark))" }}
              >
                No exact match.
              </p>
              <p className="font-body text-sm text-muted-foreground mb-5">
                Try one of these common starting points, or clear the
                filters and browse the whole directory.
              </p>
              <div className="flex flex-wrap gap-2 justify-center mb-6">
                {EMPTY_STATE_SYMPTOMS.map((s) => (
                  <button
                    key={s.complaint}
                    type="button"
                    data-cta="empty-state-symptom"
                    onClick={() =>
                      handleFiltersChange({
                        ...EMPTY_FILTERS,
                        symptom: s.complaint,
                      })
                    }
                    className="inline-flex items-center min-h-[44px] px-3 py-1 rounded-full font-body text-sm border bg-background transition-colors hover:border-[hsl(var(--eden-gold))]"
                    style={{
                      borderColor: "hsl(var(--border))",
                      color: "hsl(var(--eden-bark))",
                      // The global mobile rule `section button { display:block;
                      // width:100% }` would stack these as full-width bars —
                      // inline style keeps them chips.
                      display: "inline-flex",
                      width: "auto",
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {patternShort && (
                  /* Label is tier-honest: for free users, locked cards stay
                     listed under "matches only" (Phase 2's never-hide rule),
                     so the button promises ordering, not exclusivity. */
                  <Button
                    variant="eden"
                    size="sm"
                    data-cta="empty-state-pattern-matches"
                    onClick={() =>
                      handleFiltersChange({
                        ...EMPTY_FILTERS,
                        patternMatchOnly: true,
                      })
                    }
                  >
                    {isSubscriber
                      ? `See the herbs that match your ${patternShort}`
                      : `Put your ${patternShort} matches first`}
                  </Button>
                )}
                <Button
                  variant="eden-outline"
                  size="sm"
                  onClick={() => handleFiltersChange(EMPTY_FILTERS)}
                >
                  Clear filters
                </Button>
              </div>
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
                  <Link to={`${ROUTES.APOTHECARY_PRICING}#tier-seed`}>
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
