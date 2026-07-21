/**
 * Herb verdict resolver tests — the guard on the bug that reached production.
 *
 * A Spent Candle reader was shown a red AVOID banner on ginger and nettle,
 * the two herbs their own paid deep-dive guide recommends most emphatically,
 * and no badge at all on hawthorn and marshmallow, which it also recommends.
 *
 * The invariants below are the ones that make that impossible to reintroduce:
 *
 *   1. NEVER COMPUTE AN AVOID. The single most important test in the repo's
 *      clinical surface. Measured against the founder's 80 curriculum
 *      recommendations, the equal-vote model agrees 67% of the time and the
 *      best model buildable from the existing columns reaches 82%. A red
 *      "avoid" warning on a health product requires evidence, so it requires
 *      a curated cited row. Computed avoids downgrade to neutral and fall
 *      silent.
 *   2. Curated data outranks computed, always — that bridge is where the
 *      clinical judgment and the Lock #43 citations live, and the whole
 *      original defect was that no client code read it.
 *   3. Conditional survives intact with its condition text, because the
 *      materia medica's honest answer for ginger-in-a-dry-pattern is
 *      "yes, in small dose, with a demulcent" and neither match nor avoid
 *      can carry that.
 *   4. Curated verdicts sort above computed ones at equal relationship.
 */

import { describe, it, expect } from "vitest";
import {
  resolveHerbVerdict,
  type CuratedHerbPatternRow,
} from "@/lib/herbVerdict";

/**
 * Ginger's live values from public.herbs (H019). Hot + Dry, and its
 * tissue_states mention "Stagnation", which the tone classifier reads as a
 * relaxant action. Against the Spent Candle (Cold / Dry / Relaxed) that is
 * one rebalancing axis and two aggravating — so the equal-vote model returns
 * "avoid", which is exactly the production bug.
 */
const GINGER = {
  temperature: "Hot",
  moisture: "Dry",
  tissue_states_indicated: "Cold, Dampness, Stagnation, Nausea",
};

/** Marshmallow (H036): Cool + Moist, treats Dryness. */
const MARSHMALLOW = {
  temperature: "Cool",
  moisture: "Moist",
  tissue_states_indicated: "Dryness, Inflammation, Irritation, Heat",
};

describe("safety rule: a computed verdict may never say avoid", () => {
  it("downgrades ginger's computed avoid to neutral for the Spent Candle", () => {
    const v = resolveHerbVerdict(GINGER, "The Spent Candle", null);
    // Regression guard for the exact reported defect.
    expect(v.relationship).not.toBe("avoid");
    expect(v.relationship).toBe("neutral");
    expect(v.source).toBe("computed");
  });

  it("suppresses the aggravation reasons on a downgraded avoid", () => {
    // Those strings assert the herb aggravates the pattern — the very claim
    // we just decided we cannot make without citations. Showing them while
    // hiding the badge would be the same accusation in smaller type.
    const v = resolveHerbVerdict(GINGER, "The Spent Candle", null);
    expect(v.reasons).toEqual([]);
  });

  it("never returns avoid for ANY herb/pattern combination without curation", () => {
    const patterns = [
      "The Burning Bowstring", "The Open Flame", "The Pressure Cooker",
      "The Overflowing Cup", "The Drawn Bowstring", "The Spent Candle",
      "The Frozen Knot", "The Still Water",
    ] as const;
    const herbs = [GINGER, MARSHMALLOW, {
      temperature: "Cold", moisture: "Dry",
      tissue_states_indicated: "Damp-Heat, Infection, Toxicity",
    }];
    for (const pattern of patterns) {
      for (const herb of herbs) {
        const v = resolveHerbVerdict(herb, pattern, null);
        expect(v.relationship, `${pattern} / ${herb.temperature}`).not.toBe("avoid");
      }
    }
  });

  it("sorts a downgraded avoid below a genuine neutral", () => {
    const downgraded = resolveHerbVerdict(GINGER, "The Spent Candle", null);
    const genuineNeutral = resolveHerbVerdict(
      { temperature: null, moisture: null, tissue_states_indicated: null },
      "The Spent Candle",
      null,
    );
    expect(downgraded.sortKey).toBeLessThan(genuineNeutral.sortKey);
  });
});

describe("curated data is canon", () => {
  const curatedMatch: CuratedHerbPatternRow = {
    relationship: "match",
    derivation: "curated",
    rationale: "Founder-approved pairing; warm cardiac tonic.",
    benefit_note: "Hawthorn nourishes and strengthens the heart.",
    primary_citation: { work: "King's American Dispensatory", year: "1898" },
    secondary_citation: { work: "WHO Monograph", year: "1999" },
  };

  it("lets a curated match override a computed neutral", () => {
    const v = resolveHerbVerdict(MARSHMALLOW, "The Spent Candle", curatedMatch);
    expect(v.relationship).toBe("match");
    expect(v.source).toBe("curated");
  });

  it("prefers the reader-facing benefit note over the mechanical rationale", () => {
    const v = resolveHerbVerdict(MARSHMALLOW, "The Spent Candle", curatedMatch);
    expect(v.reasons[0]).toBe("Hawthorn nourishes and strengthens the heart.");
  });

  it("falls back to the rationale when no benefit note is authored yet", () => {
    const v = resolveHerbVerdict(MARSHMALLOW, "The Spent Candle", {
      ...curatedMatch,
      benefit_note: null,
    });
    expect(v.reasons[0]).toBe("Founder-approved pairing; warm cardiac tonic.");
  });

  it("DOES allow avoid when it comes from a curated row", () => {
    // The counterpart to the safety rule: evidence-backed rejection is
    // exactly what the red flag is for.
    const v = resolveHerbVerdict(GINGER, "The Open Flame", {
      relationship: "avoid",
      derivation: "curated",
      rationale: "Warming stimulant reinforces an already hot pattern.",
      primary_citation: { work: "King's American Dispensatory" },
    });
    expect(v.relationship).toBe("avoid");
    expect(v.source).toBe("curated");
    expect(v.hasCitations).toBe(true);
  });

  it("sorts a curated match above a computed match", () => {
    const computed = resolveHerbVerdict(MARSHMALLOW, "The Frozen Knot", null);
    const curated = resolveHerbVerdict(MARSHMALLOW, "The Frozen Knot", curatedMatch);
    expect(curated.sortKey).toBeGreaterThan(computed.sortKey);
  });

  it("reports hasCitations false when a curated row carries none", () => {
    const v = resolveHerbVerdict(MARSHMALLOW, "The Spent Candle", {
      relationship: "match",
      derivation: "curated",
      rationale: "uncited",
    });
    expect(v.hasCitations).toBe(false);
  });

  it("ignores a curated row with an unrecognised relationship value", () => {
    // Guards against a bad migration or hand-edit putting garbage in the
    // enum column and silently changing what readers are told.
    const v = resolveHerbVerdict(MARSHMALLOW, "The Spent Candle", {
      relationship: "definitely-take-this",
      derivation: "curated",
    });
    expect(v.source).toBe("computed");
  });
});

describe("conditional verdicts", () => {
  const gingerConditional: CuratedHerbPatternRow = {
    relationship: "conditional",
    derivation: "curated",
    benefit_note:
      "The gentle warmth that restarts cold digestion — a match, not a bonfire.",
    condition_note:
      "Small dose, best paired with a demulcent such as marshmallow; fresh root preferred over dried in a dry pattern.",
    primary_citation: { work: "King's American Dispensatory", year: "1898" },
  };

  it("carries the condition text through intact", () => {
    const v = resolveHerbVerdict(GINGER, "The Spent Candle", gingerConditional);
    expect(v.relationship).toBe("conditional");
    expect(v.conditionNote).toContain("demulcent");
  });

  it("sorts conditional between match and neutral", () => {
    const conditional = resolveHerbVerdict(GINGER, "The Spent Candle", gingerConditional);
    const match = resolveHerbVerdict(MARSHMALLOW, "The Spent Candle", {
      relationship: "match",
      derivation: "curated",
    });
    const neutral = resolveHerbVerdict(GINGER, "The Spent Candle", null);
    expect(conditional.sortKey).toBeLessThan(match.sortKey);
    expect(conditional.sortKey).toBeGreaterThan(neutral.sortKey);
  });

  it("leaves conditionNote null for non-conditional verdicts", () => {
    const v = resolveHerbVerdict(MARSHMALLOW, "The Spent Candle", {
      relationship: "match",
      derivation: "curated",
      condition_note: "should be ignored for a match",
    });
    expect(v.relationship).toBe("match");
    expect(v.conditionNote).toBe("should be ignored for a match");
    // (carried, not invented — the UI decides whether to render it)
  });
});

describe("degraded and missing data", () => {
  it("handles null axis columns without throwing", () => {
    const v = resolveHerbVerdict(
      { temperature: null, moisture: null, tissue_states_indicated: null },
      "The Spent Candle",
      null,
    );
    expect(v.relationship).toBe("neutral");
    expect(v.source).toBe("computed");
  });

  it("treats undefined curated the same as null", () => {
    const a = resolveHerbVerdict(GINGER, "The Spent Candle", null);
    const b = resolveHerbVerdict(GINGER, "The Spent Candle", undefined);
    expect(a).toEqual(b);
  });
});

describe("derivation gate: computed rows in the bridge are NOT canon", () => {
  /**
   * The bridge table is not curated-only. As of 2026-07-21 it holds 2,292
   * surfaced rows with derivation='computed_energetics', including 922
   * surfaced "avoid" verdicts, generated by a SQL mirror of the equal-vote
   * algorithm — each carrying citations, which is how they satisfied the
   * surfacing constraint.
   *
   * If the resolver trusted row-existence rather than derivation, wiring the
   * client to the bridge would surface 922 machine-generated red flags with
   * sources attached — the reported bug, laundered into looking authoritative.
   */
  it("ignores a computed_energetics avoid row entirely", () => {
    const v = resolveHerbVerdict(GINGER, "The Spent Candle", {
      relationship: "avoid",
      derivation: "computed_energetics",
      rationale: "hot reinforces...; dry reinforces...",
      primary_citation: { work: "King's American Dispensatory" },
      secondary_citation: { work: "Hoffmann - Medical Herbalism" },
    });
    expect(v.relationship).not.toBe("avoid");
    expect(v.source).toBe("computed");
    expect(v.hasCitations).toBe(false);
  });

  it("ignores a computed_energetics match row too (no laundering either way)", () => {
    const v = resolveHerbVerdict(MARSHMALLOW, "The Frozen Knot", {
      relationship: "match",
      derivation: "computed_energetics",
      benefit_note: "should not surface",
    });
    expect(v.source).toBe("computed");
    expect(v.benefitNote).toBeNull();
  });

  it("ignores a row with a missing derivation", () => {
    const v = resolveHerbVerdict(GINGER, "The Spent Candle", {
      relationship: "avoid",
      rationale: "no derivation declared",
    });
    expect(v.source).toBe("computed");
    expect(v.relationship).not.toBe("avoid");
  });
});
