import { X, Search } from "lucide-react";
import type { HerbRow } from "@/hooks/useApothecaryHerbs";

export interface HerbFilterState {
  query: string;
  temperature: string | null;
  partUsed: string | null;
  plantFamily: string | null;
  taste: string | null;
}

export const EMPTY_FILTERS: HerbFilterState = {
  query: "",
  temperature: null,
  partUsed: null,
  plantFamily: null,
  taste: null,
};

interface HerbDirectoryFiltersProps {
  herbs: HerbRow[];
  filters: HerbFilterState;
  onChange: (next: HerbFilterState) => void;
  visibleCount: number;
  totalCount: number;
}

/**
 * Fields shared by both `herbs_public` and `herbs_clinical_v` — safe to read
 * regardless of whether the caller is on the anon or Seed+ code path.
 */
type SharedTextField =
  | "temperature"
  | "part_used"
  | "plant_family"
  | "taste";

function readText(row: HerbRow, field: SharedTextField): string | null {
  const value = (row as Record<string, unknown>)[field];
  return typeof value === "string" ? value : null;
}

function distinctValues(
  herbs: HerbRow[],
  field: SharedTextField
): string[] {
  const set = new Set<string>();
  for (const h of herbs) {
    const v = readText(h, field);
    if (typeof v === "string" && v.trim().length > 0) set.add(v.trim());
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/**
 * Extract individual taste tokens from comma-separated values
 * (e.g., "Bitter, Astringent, Sweet" → ["Astringent", "Bitter", "Sweet"]).
 */
function distinctTastes(herbs: HerbRow[]): string[] {
  const set = new Set<string>();
  for (const h of herbs) {
    const v = readText(h, "taste");
    if (typeof v === "string") {
      for (const token of v.split(/[,/]/)) {
        const t = token.trim();
        if (t.length > 0) set.add(t);
      }
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

const labelClass =
  "font-accent text-[11px] tracking-[0.25em] uppercase mb-1.5 block";

const selectClass =
  "w-full rounded-md border bg-background px-3 py-1.5 text-sm font-body focus:outline-none focus:ring-1";

export function HerbDirectoryFilters({
  herbs,
  filters,
  onChange,
  visibleCount,
  totalCount,
}: HerbDirectoryFiltersProps) {
  const temperatures = distinctValues(herbs, "temperature");
  const partsUsed = distinctValues(herbs, "part_used");
  const plantFamilies = distinctValues(herbs, "plant_family");
  const tastes = distinctTastes(herbs);

  const hasActiveFilters =
    filters.query.trim().length > 0 ||
    filters.temperature !== null ||
    filters.partUsed !== null ||
    filters.plantFamily !== null ||
    filters.taste !== null;

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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className={labelClass} htmlFor="filter-temperature">
            Temperature
          </label>
          <select
            id="filter-temperature"
            value={filters.temperature ?? ""}
            onChange={(e) =>
              onChange({
                ...filters,
                temperature: e.target.value || null,
              })
            }
            className={selectClass}
            style={{ borderColor: "hsl(var(--border))" }}
          >
            <option value="">All</option>
            {temperatures.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="filter-part-used">
            Part Used
          </label>
          <select
            id="filter-part-used"
            value={filters.partUsed ?? ""}
            onChange={(e) =>
              onChange({ ...filters, partUsed: e.target.value || null })
            }
            className={selectClass}
            style={{ borderColor: "hsl(var(--border))" }}
          >
            <option value="">All</option>
            {partsUsed.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="filter-plant-family">
            Plant Family
          </label>
          <select
            id="filter-plant-family"
            value={filters.plantFamily ?? ""}
            onChange={(e) =>
              onChange({
                ...filters,
                plantFamily: e.target.value || null,
              })
            }
            className={selectClass}
            style={{ borderColor: "hsl(var(--border))" }}
          >
            <option value="">All</option>
            {plantFamilies.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="filter-taste">
            Taste
          </label>
          <select
            id="filter-taste"
            value={filters.taste ?? ""}
            onChange={(e) =>
              onChange({ ...filters, taste: e.target.value || null })
            }
            className={selectClass}
            style={{ borderColor: "hsl(var(--border))" }}
          >
            <option value="">All</option>
            {tastes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
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

/**
 * Pure filter predicate — applied client-side to the in-memory herb list.
 * Reads only fields that exist on both HerbPublicRow and HerbClinicalRow.
 */
export function matchesFilters(
  herb: HerbRow,
  filters: HerbFilterState
): boolean {
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
  if (filters.temperature && herb.temperature !== filters.temperature)
    return false;
  if (filters.partUsed && herb.part_used !== filters.partUsed) return false;
  if (filters.plantFamily && herb.plant_family !== filters.plantFamily)
    return false;
  if (filters.taste) {
    const tokens =
      typeof herb.taste === "string"
        ? herb.taste.split(/[,/]/).map((t) => t.trim())
        : [];
    if (!tokens.includes(filters.taste)) return false;
  }
  return true;
}
