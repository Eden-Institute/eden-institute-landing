/**
 * Guide ↔ Apothecary consistency — the acceptance test for the reported defect.
 *
 * THE BUG: a reader whose quiz classified them as the Spent Candle bought the
 * deep-dive guide, which recommends ginger ("the spark that begins to re-light
 * the candle") and nettle ("foundational"), then opened the Apothecary and
 * found both under a red AVOID banner. Hawthorn and marshmallow — also
 * recommended by that guide — showed no badge at all.
 *
 * Two systems were deciding the same clinical question independently: the
 * guide reasons from the clinically decisive axis, the Apothecary recomputed
 * a 2-of-3 equal-weight vote in the browser. Measured against the curriculum's
 * 80 recommendations, that vote endorsed 54 and contradicted 26 — eleven of
 * them with a red flag on a herb the reader's own paid guide recommends.
 *
 * WHAT THIS FILE LOCKS DOWN
 * The guide files are the source of the recommendations, so they are imported
 * here directly rather than duplicated — if a herb is added to or removed from
 * a pattern's roster, this test sees it on the next run and no fixture drifts.
 *
 *   1. The Apothecary must NEVER show "avoid" for a herb the guide recommends,
 *      unless that avoid comes from curated, cited evidence. This is the
 *      reported bug stated as an invariant.
 *   2. Every guide herb carries constitutionalMatch prose — the "how does this
 *      help me" text whose absence was the other half of the complaint.
 *   3. A curated verdict always beats the computed one, so curation actually
 *      reaches the reader (the original bridge sat unread by any client code).
 *   4. A curated row must be genuinely curated: derivation='computed_energetics'
 *      rows in the bridge are the equal-vote algorithm's own output and must
 *      not be laundered into looking evidence-backed.
 */

import { describe, it, expect } from "vitest";
import { spentCandleGuide } from "../../supabase/functions/_shared/guide/guide-content-spent-candle";
import { burningBowstringGuide } from "../../supabase/functions/_shared/guide/guide-content-burning-bowstring";
import { resolveHerbVerdict } from "@/lib/herbVerdict";
import type { EdenPatternName } from "@/lib/edenPattern";

/**
 * Live axis values from public.herbs for the herbs under test. Kept as a
 * fixture because the assertions are about the RESOLVER's behaviour given
 * real data, not about the database being reachable from a unit test.
 */
const HERB_AXES: Record<
  string,
  { temperature: string; moisture: string; tissue_states_indicated: string }
> = {
  Ginger: {
    temperature: "Hot",
    moisture: "Dry",
    tissue_states_indicated: "Cold, Dampness, Stagnation, Nausea",
  },
  Nettle: {
    temperature: "Cool",
    moisture: "Dry",
    tissue_states_indicated: "Deficiency (nutritive), Inflammation, Allergic excess",
  },
  Hawthorn: {
    temperature: "Warm",
    moisture: "Neutral",
    tissue_states_indicated: "Heart Qi/Blood deficiency, Cold cardiovascular stagnation",
  },
  "Marshmallow Root": {
    temperature: "Cool",
    moisture: "Moist",
    tissue_states_indicated: "Dryness, Inflammation, Irritation, Heat",
  },
  "Licorice Root": {
    temperature: "Neutral",
    moisture: "Moist",
    tissue_states_indicated: "Dryness, Inflammation, Deficiency, Adrenal fatigue",
  },
  Chamomile: {
    temperature: "Cool",
    moisture: "Dry",
    tissue_states_indicated: "Tension, Spasm, Inflammation, Irritability",
  },
};

describe("a guide-recommended herb is never flagged Avoid without evidence", () => {
  it("covers the four herbs from the original report (Spent Candle)", () => {
    const pattern: EdenPatternName = "The Spent Candle";
    for (const name of ["Ginger", "Nettle", "Hawthorn", "Marshmallow Root"]) {
      const axes = HERB_AXES[name];
      const verdict = resolveHerbVerdict(axes, pattern, null);
      expect(
        verdict.relationship,
        `${name} is recommended by the Spent Candle guide but the Apothecary said avoid`,
      ).not.toBe("avoid");
    }
  });

  it("holds for every herb in the Spent Candle roster we have axes for", () => {
    const pattern: EdenPatternName = "The Spent Candle";
    const covered = spentCandleGuide.chapterFour.herbs.filter(
      (h) => HERB_AXES[h.name],
    );
    expect(covered.length).toBeGreaterThan(0);
    for (const herb of covered) {
      const verdict = resolveHerbVerdict(HERB_AXES[herb.name], pattern, null);
      expect(verdict.relationship, `${herb.name} / Spent Candle`).not.toBe("avoid");
    }
  });

  it("holds for the Burning Bowstring roster too (not a one-pattern fix)", () => {
    const pattern: EdenPatternName = "The Burning Bowstring";
    const covered = burningBowstringGuide.chapterFour.herbs.filter(
      (h) => HERB_AXES[h.name],
    );
    expect(covered.length).toBeGreaterThan(0);
    for (const herb of covered) {
      const verdict = resolveHerbVerdict(HERB_AXES[herb.name], pattern, null);
      expect(verdict.relationship, `${herb.name} / Burning Bowstring`).not.toBe("avoid");
    }
  });
});

describe("every guide recommendation is fully described", () => {
  // The second half of the complaint: hawthorn and marshmallow were
  // recommended with no account of HOW they help a Spent Candle. That prose
  // exists in the guide and is ported to herbs_eden_patterns.benefit_note by
  // 20260721150000_benefit_note_prose_port.sql.
  for (const guide of [spentCandleGuide, burningBowstringGuide]) {
    it(`${guide.nickname}: all 10 herbs carry constitutionalMatch prose`, () => {
      const herbs = guide.chapterFour.herbs;
      expect(herbs).toHaveLength(10);
      for (const herb of herbs) {
        expect(herb.constitutionalMatch, `${herb.name} has no prose`).toBeTruthy();
        expect(
          herb.constitutionalMatch.length,
          `${herb.name} prose is too short to explain anything`,
        ).toBeGreaterThan(80);
      }
    });
  }
});

describe("curated evidence reaches the reader", () => {
  it("a curated verdict overrides the computed one", () => {
    // The original defect was not that the data was wrong — the corrected
    // rows already existed in herbs_eden_patterns. It was that no client
    // code read them.
    const v = resolveHerbVerdict(HERB_AXES.Ginger, "The Spent Candle", {
      relationship: "conditional",
      derivation: "curated",
      benefit_note: "The gentle warmth that restarts cold digestion.",
      condition_note: "Small dose, paired with a demulcent; fresh preferred over dried.",
      primary_citation: { work: "King's American Dispensatory", year: "1898" },
      secondary_citation: { work: "WHO Monograph", year: "1999" },
    });
    expect(v.source).toBe("curated");
    expect(v.relationship).toBe("conditional");
    expect(v.conditionNote).toContain("demulcent");
    expect(v.reasons[0]).toContain("gentle warmth");
  });

  it("a computed_energetics row is NOT treated as evidence", () => {
    // The bridge holds 2,292 surfaced computed rows including 922 "avoid"
    // verdicts, each carrying citations. Trusting them would surface the
    // original bug with sources attached, which is worse than the bug.
    const v = resolveHerbVerdict(HERB_AXES.Ginger, "The Spent Candle", {
      relationship: "avoid",
      derivation: "computed_energetics",
      rationale: "machine-derived axis vote",
      primary_citation: { work: "King's American Dispensatory" },
      secondary_citation: { work: "Hoffmann" },
    });
    expect(v.source).toBe("computed");
    expect(v.relationship).not.toBe("avoid");
  });
});
