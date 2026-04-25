import { useState } from "react";
import { X, Search, Info } from "lucide-react";
import type { HerbRow } from "@/hooks/useApothecaryHerbs";
import type { Tier } from "@/hooks/useCurrentTier";
import {
  type EdenPatternName,
  computeMatchRelationship,
} from "@/lib/edenPattern";

/**
 * Stage 6.3.5 — four-axis filter rebuild.
 *
 * Replaces the Stage 6.3.6 holdover (Temperature / Part Used / Plant Family /
 * Taste) with the four-axis filter primitives locked in §0.8 #26:
 *
 *   1. Symptom            — Free+
 *   2. Action             — Seed+
 *   3. Body system /      — Seed+ (system) → Root+ (tissue state)
 *      tissue state
 *   4. Clinical safety    — Free+ (population safety) → Root+ (drug interactions)
 *
 *   + Pattern of Eden constitutional overlay (Seed+) — surfaces Match-only /
 *     Hide-aggravators chips when the active profile has a Pattern.
 *
 * Tier-progressive depth (§0.8 #26):
 *   Free          → Symptom + Population safety
 *   Seed          → + Action + Body system + Pattern of Eden overlay
 *   Root          → + Tissue state + (Drug interactions on the card)
 *   Practitioner  → + Organ drill-down + Refer thresholds (Stage 6.4)
 *
 * Vocabulary ladder (§0.8 #27):
 *   Free  → plain phrase first, formal term in parens
 *   Seed  → formal term first, plain gloss
 *   Root+ → formal vocabulary primary
 *
 * Symptom-doorway pedagogy (§0.8 #20): at Free tier a small "What does this
 * do?" affordance appears next to a selected symptom, opening an inline
 * action-concept reveal — meets the new mama at her starting vocabulary
 * and trains the action-vocabulary by exposure rather than lecture.
 *
 * Pattern overlay: when a Seed+ user has an active EdenPatternName the
 * filter surface shows two toggle chips:
 *   • "Show only matches"          — keep only herbs that rebalance the Pattern
 *   • "Hide aggravators"           — drop herbs that aggravate the Pattern
 * Either chip may be on independently. Both off = no Pattern filtering
 * (Match/Avoid badges still render on the cards via HerbCard).
 *
 * The filter facets read what is available at the caller's tier:
 *   • Symptom names              ← Band 1 `complaint_names text[]` (always visible)
 *   • Action / Body system       ← Band 3 `actions_rel` / `systems_rel` (Seed+)
 *   • Tissue state               ← Band 3 `tissue_states_indicated_rel` (Seed+)
 *   • Population safety          ← Band 2 `pregnancy/breastfeeding/children_safety`
 * Locked rows (Free/anon callers viewing Seed-tier herbs) have NULL Band 2
 * and Band 3 fields. They still match symptom filters via `complaint_names`
 * and render as locked cards in the result grid, preserving visible-but-
 * gated.
 */

export interface HerbFilterState {
  query: string;
  symptom: string | null;
  action: string | null;
  bodySystem: string | null;
  tissueState: string | null;
  populationSafety: PopulationFilter;
  patternMatchOnly: boolean;
  patternHideAvoid: boolean;
}

export type PopulationFilter =
  | "all"
  | "pregnancy"
  | "breastfeeding"
  | "children";

export const EMPTY_FILTERS: HerbFilterState = {
  query: "",
  symptom: null,
  action: null,
  bodySystem: null,
  tissueState: null,
  populationSafety: "all",
  patternMatchOnly: false,
  patternHideAvoid: false,
};

interface HerbDirectoryFiltersProps {
  herbs: HerbRow[];
  filters: HerbFilterState;
  onChange: (next: HerbFilterState) => void;
  visibleCount: number;
  totalCount: number;
  tier: Tier | undefined;
  /** Active user's Eden Pattern, when known. Drives the Match/Avoid overlay UI. */
  activePattern: EdenPatternName | null;
}

const labelClass =
  "font-accent text-[11px] tracking-[0.25em] uppercase mb-1.5 block";
const selectClass =
  "w-full rounded-md border bg-background px-3 py-1.5 text-sm font-body focus:outline-none focus:ring-1";

const isSubscriberTier = (t: Tier | undefined) =>
  t === "seed" || t === "root" || t === "practitioner";
const isRootOrAbove = (t: Tier | undefined) =>
  t === "root" || t === "practitioner";

// ---------------------------------------------------------------------------
// Symptom-doorway action concept reveal — Free tier teaching surface.
// Each entry maps a symptom (or symptom family) to the underlying herbal-
// action concept, in plain-first vocabulary. The reveal opens inline when a
// Free user has a symptom selected and clicks the "What does this do?"
// affordance. Per §0.8 #20: "Meets the new mama where her mind starts; trains
// terrain-first thinking by use, not by lecture." This is intentionally a
// tiny curated set — the full action vocabulary unlocks at Seed.
// ---------------------------------------------------------------------------
const SYMPTOM_DOORWAY: Record<
  string,
  { plain: string; formal: string; teaches: string }
> = {
  "Fever management": {
    plain: "Help the body break a fever",
    formal: "Diaphoretic / Febrifuge",
    teaches:
      "Herbs that help the body release excess heat through the skin — moving the fever through rather than suppressing it.",
  },
  "Cough, dry/unproductive": {
    plain: "Soothe and moisten dry tissue",
    formal: "Demulcent",
    teaches:
      "Herbs that coat and soothe inflamed, dry mucus membranes — the throat and lungs welcome them like a calm rain after drought.",
  },
  "Cough, productive": {
    plain: "Loosen and move stuck mucus",
    formal: "Expectorant",
    teaches:
      "Herbs that thin and move congested mucus so the body can clear it — turning a stuck cough into a productive one.",
  },
  Anxiety: {
    plain: "Settle a wired nervous system",
    formal: "Anxiolytic / Nervine",
    teaches:
      "Herbs that calm a stressed, over-firing nervous system — softening the edge without dulling the mind.",
  },
  Insomnia: {
    plain: "Quiet the body for sleep",
    formal: "Hypnotic / Sedative",
    teaches:
      "Herbs that lower the body's gear for rest — slowing thought, easing tension, letting sleep arrive on its own.",
  },
  Constipation: {
    plain: "Move the bowels",
    formal: "Laxative / Aperient",
    teaches:
      "Herbs that gently restart sluggish elimination — supporting the body's own peristaltic rhythm rather than forcing it.",
  },
  "Bloating / flatulence": {
    plain: "Settle digestive gas",
    formal: "Carminative",
    teaches:
      "Aromatic herbs that warm and move stuck digestion — the body's clue is the sigh of relief after a cup of fennel or ginger tea.",
  },
  "Cold/flu onset": {
    plain: "Support the body at the first signs of a cold",
    formal: "Diaphoretic / Antiviral",
    teaches:
      "Herbs that meet a virus at the door — warming the body, opening the pores, letting the immune system work without a fight.",
  },
};

function distinct(values: Array<string | null | undefined>): string[] {
  const set = new Set<string>();
  for (const v of values) {
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed) set.add(trimmed);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function namesFromRel(
  rel: unknown,
  field: "action_name" | "system_name" | "state_name"
): string[] {
  if (!Array.isArray(rel)) return [];
  return rel
    .map((entry) => {
      if (entry && typeof entry === "object" && field in entry) {
        const v = (entry as Record<string, unknown>)[field];
        return typeof v === "string" ? v : null;
      }
      return null;
    })
    .filter((v): v is string => typeof v === "string");
}

function herbHasAction(herb: HerbRow, action: string): boolean {
  return namesFromRel(herb.actions_rel, "action_name").includes(action);
}
function herbHasBodySystem(herb: HerbRow, system: string): boolean {
  return namesFromRel(herb.systems_rel, "system_name").includes(system);
}
function herbHasTissueState(herb: HerbRow, state: string): boolean {
  return namesFromRel(herb.tissue_states_indicated_rel, "state_name").includes(state);
}
function herbHasComplaint(herb: HerbRow, complaint: string): boolean {
  const names = (herb as unknown as { complaint_names?: unknown }).complaint_names;
  if (!Array.isArray(names)) return false;
  return (names as string[]).includes(complaint);
}

// ---------------------------------------------------------------------------
// Filter component
// ---------------------------------------------------------------------------
export function HerbDirectoryFilters({
  herbs,
  filters,
  onChange,
  visibleCount,
  totalCount,
  tier,
  activePattern,
}: HerbDirectoryFiltersProps) {
  const subscriber = isSubscriberTier(tier);
  const rootOrAbove = isRootOrAbove(tier);
  const [doorwayOpen, setDoorwayOpen] = useState(false);

  // Symptom names — Band 1 (always available across tiers).
  const symptoms = distinct(
    herbs.flatMap((h) => {
      const names = (h as unknown as { complaint_names?: unknown }).complaint_names;
      return Array.isArray(names) ? (names as string[]) : [];
    })
  );
  // Action / system / tissue-state — Band 3 (Seed+ only).
  const actions = subscriber
    ? distinct(herbs.flatMap((h) => namesFromRel(h.actions_rel, "action_name")))
    : [];
  const bodySystems = subscriber
    ? distinct(herbs.flatMap((h) => namesFromRel(h.systems_rel, "system_name")))
    : [];
  const tissueStates = rootOrAbove
    ? distinct(
        herbs.flatMap((h) =>
          namesFromRel(h.tissue_states_indicated_rel, "state_name")
        )
      )
    : [];

  const hasActiveFilters =
    filters.query.trim().length > 0 ||
    filters.symptom !== null ||
    filters.action !== null ||
    filters.bodySystem !== null ||
    filters.tissueState !== null ||
    filters.populationSafety !== "all" ||
    filters.patternMatchOnly ||
    filters.patternHideAvoid;

  const symptomDoorwayEntry = filters.symptom
    ? SYMPTOM_DOORWAY[filters.symptom]
    : null;

  return (
    <section
      aria-label="Herb directory filters"
      className="rounded-lg border p-5"
      style={{
        borderColor: "hsl(var(--border))",
        backgroundColor: "hsl(var(--eden-cream) / 0.3)",
      }}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div className="flex-1 relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={filters.query}
            onChange={(e) => onChange({ ...filters, query: e.target.value })}
            placeholder="Search by common name, Latin name, or plant family…"
            className="w-full rounded-md border bg-background pl-9 pr-3 py-2 text-sm font-body focus:outline-none focus:ring-1"
            style={{ borderColor: "hsl(var(--border))" }}
            aria-label="Search herbs"
          />
        </div>
        <p
          className="font-accent text-[11px] tracking-[0.2em] uppercase whitespace-nowrap"
          style={{ color: "hsl(var(--eden-bark))" }}
          aria-live="polite"
        >
          {visibleCount} of {totalCount} herbs
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Axis 1 — Symptom (Free+) */}
        <div>
          <label className={labelClass} htmlFor="filter-symptom">
            {subscriber ? "Symptom" : "What's bothering you? (Symptom)"}
          </label>
          <select
            id="filter-symptom"
            value={filters.symptom ?? ""}
            onChange={(e) => {
              setDoorwayOpen(false);
              onChange({ ...filters, symptom: e.target.value || null });
            }}
            className={selectClass}
            style={{ borderColor: "hsl(var(--border))" }}
          >
            <option value="">All</option>
            {symptoms.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {!subscriber && symptomDoorwayEntry && (
            <button
              type="button"
              onClick={() => setDoorwayOpen((v) => !v)}
              className="mt-2 inline-flex items-center gap-1 font-accent uppercase tracking-[0.15em] text-[10px] hover:opacity-70"
              style={{ color: "hsl(var(--eden-gold))" }}
              aria-expanded={doorwayOpen}
            >
              <Info className="w-3 h-3" />
              {doorwayOpen ? "Hide explanation" : "What does this do?"}
            </button>
          )}
        </div>

        {/* Axis 2 — Action (Seed+) */}
        <div>
          <label className={labelClass} htmlFor="filter-action">
            Action
          </label>
          {subscriber ? (
            <select
              id="filter-action"
              value={filters.action ?? ""}
              onChange={(e) =>
                onChange({ ...filters, action: e.target.value || null })
              }
              className={selectClass}
              style={{ borderColor: "hsl(var(--border))" }}
            >
              <option value="">All</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          ) : (
            <p className="font-body text-xs italic text-muted-foreground py-2" aria-disabled="true">
              Action filters open with Seed.
            </p>
          )}
        </div>

        {/* Axis 3 — Body system (Seed+) and Tissue state (Root+) */}
        <div>
          <label className={labelClass} htmlFor="filter-body-system">
            {rootOrAbove ? "Body system / tissue" : "Body system"}
          </label>
          {subscriber ? (
            <div className="space-y-2">
              <select
                id="filter-body-system"
                value={filters.bodySystem ?? ""}
                onChange={(e) =>
                  onChange({ ...filters, bodySystem: e.target.value || null })
                }
                className={selectClass}
                style={{ borderColor: "hsl(var(--border))" }}
              >
                <option value="">All systems</option>
                {bodySystems.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {rootOrAbove && (
                <select
                  id="filter-tissue-state"
                  value={filters.tissueState ?? ""}
                  onChange={(e) =>
                    onChange({ ...filters, tissueState: e.target.value || null })
                  }
                  className={selectClass}
                  style={{ borderColor: "hsl(var(--border))" }}
                  aria-label="Tissue state"
                >
                  <option value="">All tissue states</option>
                  {tissueStates.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <p className="font-body text-xs italic text-muted-foreground py-2" aria-disabled="true">
              Body-system filters open with Seed.
            </p>
          )}
        </div>

        {/* Axis 4 — Population safety (Free+) */}
        <div>
          <label className={labelClass} htmlFor="filter-population">
            {subscriber ? "Safety" : "Safe for"}
          </label>
          <select
            id="filter-population"
            value={filters.populationSafety}
            onChange={(e) =>
              onChange({
                ...filters,
                populationSafety: e.target.value as PopulationFilter,
              })
            }
            className={selectClass}
            style={{ borderColor: "hsl(var(--border))" }}
          >
            <option value="all">Anyone</option>
            <option value="pregnancy">Pregnancy</option>
            <option value="breastfeeding">Breastfeeding</option>
            <option value="children">Children</option>
          </select>
        </div>
      </div>

      {!subscriber && symptomDoorwayEntry && doorwayOpen && (
        <div
          className="mt-4 rounded-md border p-4"
          style={{
            borderColor: "hsl(var(--eden-gold) / 0.4)",
            backgroundColor: "hsl(var(--eden-cream) / 0.5)",
          }}
        >
          <p
            className="font-accent text-[10px] tracking-[0.25em] uppercase mb-1"
            style={{ color: "hsl(var(--eden-gold))" }}
          >
            Why these herbs help
          </p>
          <p
            className="font-serif text-sm font-semibold mb-1"
            style={{ color: "hsl(var(--eden-bark))" }}
          >
            {symptomDoorwayEntry.plain}{" "}
            <span className="font-body text-muted-foreground italic font-normal">
              ({symptomDoorwayEntry.formal})
            </span>
          </p>
          <p className="font-body text-sm leading-relaxed">
            {symptomDoorwayEntry.teaches}
          </p>
        </div>
      )}

      {subscriber && activePattern && (
        <div
          className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t"
          style={{ borderColor: "hsl(var(--border))" }}
        >
          <p
            className="font-accent text-[10px] tracking-[0.25em] uppercase"
            style={{ color: "hsl(var(--eden-gold))" }}
          >
            Your Pattern: {activePattern}
          </p>
          <button
            type="button"
            onClick={() =>
              onChange({ ...filters, patternMatchOnly: !filters.patternMatchOnly })
            }
            className={`text-xs font-body px-2.5 py-1 rounded-full border transition ${
              filters.patternMatchOnly
                ? "bg-[hsl(var(--eden-gold)/0.15)] border-[hsl(var(--eden-gold))]"
                : "border-[hsl(var(--border))] hover:bg-[hsl(var(--eden-cream)/0.5)]"
            }`}
            aria-pressed={filters.patternMatchOnly}
          >
            Show only matches
          </button>
          <button
            type="button"
            onClick={() =>
              onChange({ ...filters, patternHideAvoid: !filters.patternHideAvoid })
            }
            className={`text-xs font-body px-2.5 py-1 rounded-full border transition ${
              filters.patternHideAvoid
                ? "bg-[hsl(var(--destructive)/0.1)] border-[hsl(var(--destructive)/0.6)]"
                : "border-[hsl(var(--border))] hover:bg-[hsl(var(--eden-cream)/0.5)]"
            }`}
            aria-pressed={filters.patternHideAvoid}
          >
            Hide aggravators
          </button>
        </div>
      )}

      {hasActiveFilters && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setDoorwayOpen(false);
              onChange(EMPTY_FILTERS);
            }}
            className="flex items-center gap-1 font-accent uppercase tracking-[0.2em] text-[11px] hover:opacity-70"
            style={{ color: "hsl(var(--eden-bark))" }}
          >
            <X className="w-3 h-3" />
            Clear filters
          </button>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Predicate (used by ApothecaryHome to filter the herb list).
// ---------------------------------------------------------------------------
export interface MatchesFiltersOptions {
  filters: HerbFilterState;
  activePattern: EdenPatternName | null;
}

export function matchesFilters(
  herb: HerbRow,
  options: MatchesFiltersOptions
): boolean {
  const { filters, activePattern } = options;

  const q = filters.query.trim().toLowerCase();
  if (q.length > 0) {
    const haystack = [
      herb.common_name,
      herb.latin_name,
      herb.plant_family,
      herb.pronunciation,
    ]
      .filter((v): v is string => typeof v === "string")
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }

  if (filters.symptom && !herbHasComplaint(herb, filters.symptom)) return false;

  if (filters.action) {
    if (herb.is_locked) return false;
    if (!herbHasAction(herb, filters.action)) return false;
  }

  if (filters.bodySystem) {
    if (herb.is_locked) return false;
    if (!herbHasBodySystem(herb, filters.bodySystem)) return false;
  }

  if (filters.tissueState) {
    if (herb.is_locked) return false;
    if (!herbHasTissueState(herb, filters.tissueState)) return false;
  }

  if (filters.populationSafety !== "all") {
    const safetyField =
      filters.populationSafety === "pregnancy"
        ? herb.pregnancy_safety
        : filters.populationSafety === "breastfeeding"
        ? herb.breastfeeding_safety
        : herb.children_safety;
    if (typeof safetyField !== "string") return false;
    const lower = safetyField.toLowerCase();
    if (
      lower.includes("avoid") ||
      lower.includes("contraindicat") ||
      lower.includes("do not")
    ) {
      return false;
    }
  }

  if (
    activePattern &&
    (filters.patternMatchOnly || filters.patternHideAvoid) &&
    !herb.is_locked
  ) {
    const detail = computeMatchRelationship(
      {
        temperature: herb.temperature ?? null,
        moisture: herb.moisture ?? null,
        tissue_states_indicated: herb.tissue_states_indicated ?? null,
      },
      activePattern
    );
    if (filters.patternMatchOnly && detail.relationship !== "match") return false;
    if (filters.patternHideAvoid && detail.relationship === "avoid") return false;
  }

  return true;
}
