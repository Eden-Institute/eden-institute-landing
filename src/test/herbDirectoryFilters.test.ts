import { describe, expect, it } from "vitest";
import {
  matchesFilters,
  EMPTY_FILTERS,
} from "@/components/apothecary/HerbDirectoryFilters";
import type { HerbRow } from "@/hooks/useApothecaryHerbs";
import type { CuratedHerbPatternRow } from "@/lib/herbVerdict";

/**
 * The pattern chips must judge rows through resolveHerbVerdict — the same
 * resolver that renders the badge — never the raw equal-vote computation.
 *
 * The defect these tests pin down: "Hide aggravators" auto-flips ON for any
 * pattern holder, and the filter re-ran the raw vote, so 21 curated
 * match/conditional pairings (including Nettle × The Spent Candle, the herb
 * the original reader complaint was about) were deleted from the grid while
 * their own badges said the opposite.
 */

/** Minimal row: only the fields matchesFilters actually reads. */
function row(overrides: Partial<HerbRow>): HerbRow {
  return {
    herb_id: "H000",
    common_name: "Test Herb",
    is_locked: false,
    temperature: null,
    moisture: null,
    tissue_states_indicated: null,
    complaint_names: [],
    ...overrides,
  } as unknown as HerbRow;
}

const curatedRow = (
  relationship: string,
  extra: Partial<CuratedHerbPatternRow> = {},
): CuratedHerbPatternRow => ({
  relationship,
  derivation: "curated",
  benefit_note: "Reader-facing why.",
  condition_note: null,
  primary_citation: { work: "King's American Dispensatory", year: "1898" },
  secondary_citation: { work: "WHO Monograph", year: "1999" },
  ...extra,
});

// Axes that the equal-vote rule scores AVOID for The Spent Candle (a cold,
// dry, depleted pattern): a cooling, drying herb aggravates two of three.
// This is the Nettle shape.
const COMPUTED_AVOID_AXES = {
  temperature: "Cool. Mildly cooling.",
  moisture: "Dry",
  tissue_states_indicated: null,
};

describe("pattern chips judge through the resolver, not the raw vote", () => {
  const hideAvoid = { ...EMPTY_FILTERS, patternHideAvoid: true };
  const matchOnly = { ...EMPTY_FILTERS, patternMatchOnly: true };

  it("Hide aggravators can NEVER hide an uncurated herb — a computed avoid downgrades to neutral", () => {
    const nettleShaped = row({ herb_id: "H042", ...COMPUTED_AVOID_AXES });
    expect(
      matchesFilters(nettleShaped, {
        filters: hideAvoid,
        activePattern: "The Spent Candle",
        curatedVerdicts: new Map(),
      }),
    ).toBe(true);
  });

  it("Hide aggravators keeps a curated CONDITIONAL herb whose raw vote says avoid (the Nettle case)", () => {
    const nettle = row({ herb_id: "H042", ...COMPUTED_AVOID_AXES });
    const curated = new Map([["H042", curatedRow("conditional")]]);
    expect(
      matchesFilters(nettle, {
        filters: hideAvoid,
        activePattern: "The Spent Candle",
        curatedVerdicts: curated,
      }),
    ).toBe(true);
  });

  it("Hide aggravators DOES hide a curated, cited avoid — evidence-backed rejection is what the filter is for", () => {
    const herb = row({ herb_id: "H099" });
    const curated = new Map([["H099", curatedRow("avoid")]]);
    expect(
      matchesFilters(herb, {
        filters: hideAvoid,
        activePattern: "The Spent Candle",
        curatedVerdicts: curated,
      }),
    ).toBe(false);
  });

  it("Show only matches keeps curated conditional rows — they badge as Match, with care", () => {
    const herb = row({ herb_id: "H036", ...COMPUTED_AVOID_AXES });
    const curated = new Map([["H036", curatedRow("conditional")]]);
    expect(
      matchesFilters(herb, {
        filters: matchOnly,
        activePattern: "The Spent Candle",
        curatedVerdicts: curated,
      }),
    ).toBe(true);
  });

  it("Show only matches keeps a curated match whose raw vote says avoid", () => {
    const herb = row({ herb_id: "H051", ...COMPUTED_AVOID_AXES });
    const curated = new Map([["H051", curatedRow("match")]]);
    expect(
      matchesFilters(herb, {
        filters: matchOnly,
        activePattern: "The Spent Candle",
        curatedVerdicts: curated,
      }),
    ).toBe(true);
  });

  it("Show only matches still drops a computed neutral", () => {
    const herb = row({ herb_id: "H100" });
    expect(
      matchesFilters(herb, {
        filters: matchOnly,
        activePattern: "The Spent Candle",
        curatedVerdicts: new Map(),
      }),
    ).toBe(false);
  });

  it("locked rows stay exempt from pattern hiding regardless of verdict", () => {
    const locked = row({
      herb_id: "H101",
      is_locked: true,
      ...COMPUTED_AVOID_AXES,
    });
    const curated = new Map([["H101", curatedRow("avoid")]]);
    expect(
      matchesFilters(locked, {
        filters: hideAvoid,
        activePattern: "The Spent Candle",
        curatedVerdicts: curated,
      }),
    ).toBe(true);
  });
});
