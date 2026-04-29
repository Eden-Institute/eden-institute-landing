/**
 * Eden Pattern relationship + scoring tests — §8.1.2 (Manual v4.0).
 *
 * Covers the four invariants the matched-herbs sort + reasons rendering
 * relies on:
 *   1. computeMatchRelationship returns 'match' | 'avoid' | 'neutral'
 *      consistent with the ≥2-axis decision rule.
 *   2. reasons[] is non-empty for match/avoid and empty for neutral.
 *   3. reasons content reads as terrain-first stewardship language.
 *   4. sortKey is monotone across the relationship bands so descending
 *      sort yields match → neutral → avoid with least-aggravating avoids
 *      on top of the avoid block.
 *
 * Plus a sort-stability guard: locked rows + active pattern do NOT call
 * the classifier (their sortKey is set to the neutral constant 1000 at
 * the call site in ApothecaryHome). This is enforced by ApothecaryHome,
 * not by edenPattern; we add a regression guard for the sort-key math
 * alone here.
 */

import { describe, it, expect } from "vitest";
import {
  computeMatchRelationship,
  resolveEdenPattern,
  PATTERN_PROFILES,
  EDEN_PATTERNS,
  type EdenPatternName,
} from "@/lib/edenPattern";

const PRESSURE_COOKER: EdenPatternName = "The Pressure Cooker"; // Hot / Damp / Tense
const SPENT_CANDLE: EdenPatternName = "The Spent Candle"; // Cold / Dry / Relaxed
const STILL_WATER: EdenPatternName = "The Still Water"; // Cold / Damp / Relaxed

describe("computeMatchRelationship", () => {
  it("classifies a 3-axis rebalancing herb as match for a Hot/Damp/Tense pattern", () => {
    // Cold + Dry + Relaxant herb against Pressure Cooker (Hot/Damp/Tense)
    // → cools, dries, relaxes. All three axes rebalance.
    const detail = computeMatchRelationship(
      {
        temperature: "Cold (cooling demulcent)",
        moisture: "Drying (mild diuretic)",
        tissue_states_indicated: "Tension, Constriction, Stagnation",
      },
      PRESSURE_COOKER
    );
    expect(detail.relationship).toBe("match");
    expect(detail.rebalancingAxes).toBe(3);
    expect(detail.aggravatingAxes).toBe(0);
    expect(detail.reasons).toHaveLength(3);
    expect(detail.reasons).toContain("Cools your Hot pattern");
    expect(detail.reasons).toContain("Dries your Damp pattern");
    expect(detail.reasons).toContain("Relaxes your Tense pattern");
    expect(detail.sortKey).toBe(2000 + 10 * 3);
  });

  it("classifies a 3-axis aggravating herb as avoid for the same pattern", () => {
    // Hot + Damp + Tonic herb against Pressure Cooker (Hot/Damp/Tense).
    // Per §8.1.2 corrected classifyTone semantics: a herb indicated for
    // laxity/atrophy/deficiency is a TONIC (intrinsic action = tightens
    // tissue), so its tone axis is "Tense". Against a Tense pattern,
    // tone=Tense vs pattern=Tense → AGGRAVATING.
    // → 3 aggravating (T+M+Tone) + 0 rebalancing = avoid.
    const detail = computeMatchRelationship(
      {
        temperature: "Hot (warming pungent)",
        moisture: "Moistening (mucilaginous)",
        tissue_states_indicated: "Laxity, Atrophy, Deficiency",
      },
      PRESSURE_COOKER
    );
    expect(detail.relationship).toBe("avoid");
    expect(detail.aggravatingAxes).toBe(3);
    expect(detail.rebalancingAxes).toBe(0);
    expect(detail.reasons.length).toBe(3);
    expect(detail.reasons).toContain("Adds more heat to your Hot pattern");
    expect(detail.reasons).toContain("Adds more dampness to your Damp pattern");
    expect(detail.reasons).toContain("Tightens your already-Tense pattern");
  });

  it("classifies a single-axis-only herb as neutral", () => {
    // Cold alone, with neutral moisture and undefined tone.
    const detail = computeMatchRelationship(
      {
        temperature: "Cold",
        moisture: "Neutral",
        tissue_states_indicated: null,
      },
      PRESSURE_COOKER
    );
    expect(detail.relationship).toBe("neutral");
    expect(detail.reasons).toHaveLength(0);
    expect(detail.sortKey).toBe(1000);
  });

  it("returns the right reasons for warming a Cold pattern", () => {
    // Hot + Dry + Tonifying herb against Spent Candle (Cold/Dry/Relaxed)
    // → warms (rebalancing), dries-against-Dry (aggravating), tonifies
    //   (rebalancing). 2 reb + 1 agg = match.
    const detail = computeMatchRelationship(
      {
        temperature: "Warming carminative",
        moisture: "Drying",
        tissue_states_indicated: "Atrophy, Deficiency",
      },
      SPENT_CANDLE
    );
    expect(detail.relationship).toBe("match");
    expect(detail.reasons).toContain("Warms your Cold pattern");
    expect(detail.reasons).toContain("Tonifies your Relaxed pattern");
    // The aggravating dry-on-dry reason is NOT in the surfaced list because
    // we only show reasons that align with the winning side (match).
    expect(detail.reasons).not.toContain("Adds more dryness to your Dry pattern");
  });

  it("does not crash on null/undefined herb fields", () => {
    const detail = computeMatchRelationship(
      {
        temperature: null,
        moisture: undefined,
        tissue_states_indicated: null,
      },
      STILL_WATER
    );
    expect(detail.relationship).toBe("neutral");
    expect(detail.reasons).toHaveLength(0);
  });

  it("yields neutral when one axis matches and one rebalances (1-1 tie)", () => {
    const detail = computeMatchRelationship(
      {
        temperature: "Cold", // rebalances Hot
        moisture: "Damp", // matches Damp = aggravating
        tissue_states_indicated: null, // tone neutral
      },
      PRESSURE_COOKER
    );
    expect(detail.relationship).toBe("neutral");
    expect(detail.reasons).toHaveLength(0);
  });
});

describe("sortKey ordering", () => {
  it("is strictly higher for match than for neutral", () => {
    const matchDetail = computeMatchRelationship(
      {
        temperature: "Cold",
        moisture: "Drying",
        tissue_states_indicated: "Tension",
      },
      PRESSURE_COOKER
    );
    const neutralDetail = computeMatchRelationship(
      {
        temperature: null,
        moisture: null,
        tissue_states_indicated: null,
      },
      PRESSURE_COOKER
    );
    expect(matchDetail.sortKey).toBeGreaterThan(neutralDetail.sortKey);
  });

  it("is strictly higher for neutral than for avoid", () => {
    const neutralDetail = computeMatchRelationship(
      {
        temperature: null,
        moisture: null,
        tissue_states_indicated: null,
      },
      PRESSURE_COOKER
    );
    const avoidDetail = computeMatchRelationship(
      {
        temperature: "Hot",
        moisture: "Moistening",
        tissue_states_indicated: null, // tone neutral; 2 agg / 0 reb → avoid
      },
      PRESSURE_COOKER
    );
    expect(neutralDetail.sortKey).toBeGreaterThan(avoidDetail.sortKey);
  });

  it("ranks 3-axis match above 2-axis match (more rebalancing wins)", () => {
    const threeAxis = computeMatchRelationship(
      {
        temperature: "Cold",
        moisture: "Drying",
        tissue_states_indicated: "Tension, Constriction",
      },
      PRESSURE_COOKER
    );
    const twoAxis = computeMatchRelationship(
      {
        temperature: "Cold",
        moisture: "Drying",
        tissue_states_indicated: null,
      },
      PRESSURE_COOKER
    );
    expect(threeAxis.relationship).toBe("match");
    expect(twoAxis.relationship).toBe("match");
    expect(threeAxis.sortKey).toBeGreaterThan(twoAxis.sortKey);
  });

  it("ranks least-aggravating avoid above worst avoid (readable gradient)", () => {
    // 2 agg / 1 reb avoid (net = -1). Tension-indicated herb is RELAXANT
    // → tone="Relaxed". Pattern.tone=Tense → opposite → REBALANCING.
    const lessBad = computeMatchRelationship(
      {
        temperature: "Hot", // agg
        moisture: "Moistening", // agg
        tissue_states_indicated: "Tension", // herb is relaxant → tone=Relaxed → reb vs Tense
      },
      PRESSURE_COOKER
    );
    // 3 agg / 0 reb avoid (net = -3). Laxity-indicated herb is TONIC
    // → tone="Tense". Pattern.tone=Tense → same → AGGRAVATING.
    const worst = computeMatchRelationship(
      {
        temperature: "Hot", // agg
        moisture: "Moistening", // agg
        tissue_states_indicated: "Laxity", // herb is tonic → tone=Tense → agg vs Tense
      },
      PRESSURE_COOKER
    );
    expect(lessBad.relationship).toBe("avoid");
    expect(worst.relationship).toBe("avoid");
    expect(lessBad.sortKey).toBeGreaterThan(worst.sortKey);
  });
});

describe("resolveEdenPattern", () => {
  it("resolves canonical Pattern names verbatim", () => {
    for (const name of EDEN_PATTERNS) {
      expect(resolveEdenPattern(name)).toBe(name);
    }
  });

  it("resolves axis-label triples to the matching pattern", () => {
    expect(resolveEdenPattern("Hot / Damp / Tense")).toBe(PRESSURE_COOKER);
    expect(resolveEdenPattern("Cold / Dry / Relaxed")).toBe(SPENT_CANDLE);
  });

  it("resolves kebab-case slugs from the quiz pipeline", () => {
    expect(resolveEdenPattern("pressure-cooker")).toBe(PRESSURE_COOKER);
    expect(resolveEdenPattern("the-pressure-cooker")).toBe(PRESSURE_COOKER);
    expect(resolveEdenPattern("spent-candle")).toBe(SPENT_CANDLE);
    expect(resolveEdenPattern("still-water")).toBe(STILL_WATER);
  });

  it("returns null on unknown / falsy input rather than guessing", () => {
    expect(resolveEdenPattern(null)).toBeNull();
    expect(resolveEdenPattern(undefined)).toBeNull();
    expect(resolveEdenPattern("")).toBeNull();
    expect(resolveEdenPattern("kapha")).toBeNull(); // Eastern label, out of scope
    expect(resolveEdenPattern("phlegmatic")).toBeNull(); // Galenic, not Eden
  });
});

describe("PATTERN_PROFILES integrity", () => {
  it("covers all 8 Patterns with full 3-axis composition", () => {
    expect(Object.keys(PATTERN_PROFILES).sort()).toEqual(
      [...EDEN_PATTERNS].sort()
    );
    for (const name of EDEN_PATTERNS) {
      const p = PATTERN_PROFILES[name];
      expect(p.temperature).toMatch(/^(Hot|Cold)$/);
      expect(p.moisture).toMatch(/^(Dry|Damp)$/);
      expect(p.tone).toMatch(/^(Tense|Relaxed)$/);
      expect(p.summary.length).toBeGreaterThan(20);
      expect(p.anchorVerse).toBe("Hebrews 8:5");
    }
  });

  it("has 8 unique axis triples (no two patterns collide)", () => {
    const triples = new Set<string>();
    for (const p of Object.values(PATTERN_PROFILES)) {
      triples.add(`${p.temperature}/${p.moisture}/${p.tone}`);
    }
    expect(triples.size).toBe(8);
  });
});
