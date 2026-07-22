/**
 * Regression guard for the energetics classifier inversion (found 2026-07-21).
 *
 * The `temperature` and `moisture` columns hold descriptive prose. The first
 * clause carries the verdict; the rest explains it, and explaining routinely
 * names the OPPOSITE pole, either to say what the herb is not or to record a
 * tradition that classes it the other way.
 *
 * classifyTemperature and classifyMoisture used to substring-match the whole
 * string, testing hot/damp before cold/dry. That inverted 11 temperature and
 * 9 moisture readings in production, always in the same direction, and it hit
 * precisely the BEST-documented records: the more carefully a herb's
 * energetics were written up, the more likely it was misread.
 *
 * Barberry is the worst case and is the anchor of this file. It is stored Cold
 * and Dry, and was matched as Hot and Damp, so it was offered to exactly the
 * constitutions it should be held back from.
 *
 * The values below are copied verbatim from production (project
 * noeqztssupewjidpvhar) on 2026-07-21. Do not tidy them; the explanatory prose
 * IS the thing under test.
 */

import { describe, it, expect } from "vitest";
import { computeMatchRelationship } from "@/lib/edenPattern";

/** Stored Cold + Dry. Both clauses go on to name heat and damp. */
const BARBERRY = {
  temperature:
    "Cold. A classic cold, clearing bitter; King's American Dispensatory and the Eclectics used it to cool and drain a hot, congested, bilious liver.",
  moisture:
    "Dry. The bitter, astringent bark drains and dries damp, boggy, congested tissue rather than moistening it.",
  tissue_states_indicated:
    "Excess heat and damp-heat above all: a hot, congested, bilious terrain with a sluggish, backed-up liver and gallbladder. Stagnation of bile and portal blood.",
};

/** Stored Cool, then immediately cites the classical hot potency. */
const GUDUCHI = {
  temperature:
    "Cool (functional). Classical Ayurveda assigns Guduchi a hot potency (ushna virya), yet its signature clinical role is antipyretic and Pitta-pacifying and it is the premier remedy for fevers, inflammation, and heat, so in the Western energetic column encoded here it reads as cooling in effect.",
  moisture:
    "Neutral. A bitter alterative with a drying, toxin-clearing tendency that is offset by its unctuous (snigdha) rasayana quality and sweet post-digestive effect, so on balance it is neither markedly drying nor moistening.",
  tissue_states_indicated: "Excess heat and heat with toxicity: fevers, inflamed and autoimmune heat.",
};

/** Stored Warm + Dry. The moisture clause literally says "dries damp". */
const SUMMER_SAVORY = {
  temperature:
    "Warm. A pungent, aromatic culinary stimulant that warms a cold, sluggish, gas-bound digestion and gently promotes a sweat in a cold, damp chest.",
  moisture:
    "Dry. A warming, aromatic, astringent herb that dries damp and scatters gas; the carvacrol-thymol oil and the herb's astringency dry a boggy, loose, over-relaxed mucosa rather than moisten it.",
  tissue_states_indicated: "Cold, sluggish, atonic digestion. Laxity and relaxation of the gut.",
};

describe("energetics classifier reads the leading clause, not the whole prose", () => {
  it("classifies Barberry against The Pressure Cooker as a match, not an avoid", () => {
    // The Pressure Cooker is Hot / Damp / Tense. Barberry is Cold / Dry, so it
    // rebalances two axes. Read whole-string it came out Hot / Damp, which
    // aggravated two axes and produced 'avoid' — the exact inversion.
    const result = computeMatchRelationship(BARBERRY, "The Pressure Cooker");
    expect(result.relationship).toBe("match");
    expect(result.rebalancingAxes).toBeGreaterThanOrEqual(2);
  });

  it("does not aggravate a Hot pattern with a herb whose value opens Cold", () => {
    const result = computeMatchRelationship(BARBERRY, "The Overflowing Cup"); // Hot / Damp / Relaxed
    expect(result.relationship).not.toBe("avoid");
  });

  it("reads Guduchi as cooling even though its value cites the classical hot potency", () => {
    // Stored Cool with an explicit "hot potency (ushna virya)" in the same
    // sentence. Guduchi rebalances a Hot pattern; it must not aggravate one.
    const hot = computeMatchRelationship(GUDUCHI, "The Open Flame"); // Hot / Dry / Relaxed
    const cold = computeMatchRelationship(GUDUCHI, "The Drawn Bowstring"); // Cold / Dry / Tense
    expect(hot.rebalancingAxes).toBeGreaterThan(hot.aggravatingAxes);
    expect(cold.aggravatingAxes).toBeGreaterThan(0);
  });

  it('reads "dries damp" as drying', () => {
    // Isolate the moisture axis by holding the other two constant: The Pressure
    // Cooker and The Burning Bowstring are both Hot / Tense and differ ONLY in
    // moisture (Damp vs Dry). A Dry herb must rebalance the Damp pattern and
    // reinforce the Dry one, so it scores exactly one more rebalancing axis
    // against the Damp pattern.
    //
    // Whole-string matching saw the phrase "dries damp" and classified Summer
    // Savory as Damp, which inverted both comparisons.
    const vsDamp = computeMatchRelationship(SUMMER_SAVORY, "The Pressure Cooker");
    const vsDry = computeMatchRelationship(SUMMER_SAVORY, "The Burning Bowstring");
    expect(vsDamp.rebalancingAxes).toBe(vsDry.rebalancingAxes + 1);
    expect(vsDry.aggravatingAxes).toBe(vsDamp.aggravatingAxes + 1);
  });

  it("still classifies plain single-word values correctly", () => {
    // The fix must not regress the 280 records that store a bare token.
    const plain = {
      temperature: "Cool",
      moisture: "Dry",
      tissue_states_indicated: "Tension and constriction",
    };
    const result = computeMatchRelationship(plain, "The Burning Bowstring"); // Hot / Dry / Tense
    // Cool rebalances Hot; Dry reinforces Dry; relaxant action rebalances Tense.
    expect(result.rebalancingAxes).toBeGreaterThanOrEqual(2);
    expect(result.relationship).toBe("match");
  });

  it("treats a genuinely neutral leading clause as neutral", () => {
    // Poria stores "Neutral. Classically balanced (ping), neither warming nor
    // cooling, so Fu Ling can be added to hot and cold formulas alike."
    const poria = {
      temperature:
        "Neutral. Classically balanced (ping), neither warming nor cooling, so Fu Ling can be added to hot and cold formulas alike.",
      moisture: "Dry",
      tissue_states_indicated: "Dampness and fluid accumulation",
    };
    const hot = computeMatchRelationship(poria, "The Open Flame");
    const cold = computeMatchRelationship(poria, "The Frozen Knot");
    // A neutral temperature counts toward neither bucket, so the temperature
    // axis must contribute nothing in either direction.
    expect(hot.rebalancingAxes + hot.aggravatingAxes).toBe(cold.rebalancingAxes + cold.aggravatingAxes);
  });
});
