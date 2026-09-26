import { describe, expect, it } from "vitest";
import {
  CURRICULUM_HERB_MATCHES,
  UNMATCHED_CURRICULUM_WEEKS,
  curriculumWeeksForHerb,
  herbIdForCurriculumWeek,
  scopeAndSequenceHref,
} from "@/lib/curriculumHerbs";
import { herbBinomial, herbTitleName } from "@/lib/herbLinks";
import { SEEDLINGS_WEEKS, SPROUTS_WEEKS } from "../../web/lib/scopeAndSequence";

const weeks = {
  sprouts: SPROUTS_WEEKS.map((w) => w.week),
  seedlings: SEEDLINGS_WEEKS.map((w) => w.week),
};

describe("curriculum herb matches", () => {
  it("accounts for every one of the 72 weeks exactly once, matched or unmatched", () => {
    const keys = [...CURRICULUM_HERB_MATCHES, ...UNMATCHED_CURRICULUM_WEEKS].map((m) => `${m.band}-${m.week}`);
    expect(new Set(keys).size).toBe(keys.length);
    const expected = [
      ...weeks.sprouts.map((w) => `sprouts-${w}`),
      ...weeks.seedlings.map((w) => `seedlings-${w}`),
    ];
    expect(expected).toHaveLength(72);
    expect([...keys].sort()).toEqual([...expected].sort());
  });

  it("maps each herb to one week at most within a band", () => {
    const seen = new Set<string>();
    for (const m of CURRICULUM_HERB_MATCHES) {
      const key = `${m.band}-${m.herbId}`;
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
      expect(m.herbId).toMatch(/^H\d{3}$/);
    }
  });

  it("gives every unmatched week a reason", () => {
    for (const u of UNMATCHED_CURRICULUM_WEEKS) expect(u.reason.length).toBeGreaterThan(10);
  });

  it("looks weeks up by herb and herbs up by week", () => {
    expect(curriculumWeeksForHerb("H102")).toEqual([{ band: "sprouts", week: 23, herbId: "H102", via: "latin" }]);
    expect(curriculumWeeksForHerb("H300")).toEqual([]);
    expect(curriculumWeeksForHerb(null)).toEqual([]);
    expect(herbIdForCurriculumWeek("seedlings", 1)).toBe("H013");
    expect(herbIdForCurriculumWeek("sprouts", 33)).toBeNull();
    expect(scopeAndSequenceHref("seedlings")).toBe("/homeschool/scope-and-sequence#seedlings");
  });
});

describe("herbTitleName", () => {
  it("leads with the common name and puts the binomial in parentheses", () => {
    expect(herbTitleName({ common_name: "Marshmallow", latin_name: "Althaea officinalis" })).toBe(
      "Marshmallow (Althaea officinalis)",
    );
    expect(herbTitleName({ common_name: "Peppermint", latin_name: "Mentha x piperita" })).toBe(
      "Peppermint (Mentha x piperita)",
    );
  });

  it("keeps a common name that already carries a second name, with no double parenthesis", () => {
    expect(herbTitleName({ common_name: "Aged Tangerine Peel (Chen Pi)", latin_name: "Citrus reticulata" })).toBe(
      "Aged Tangerine Peel (Chen Pi)",
    );
  });

  it("cuts author abbreviations and synonym notes from the Latin", () => {
    expect(
      herbTitleName({ common_name: "Green Tea", latin_name: "Camellia sinensis (L.) Kuntze (syn. Thea sinensis L.)" }),
    ).toBe("Green Tea (Camellia sinensis)");
    expect(herbBinomial("Phyllanthus niruri L.")).toBe("Phyllanthus niruri");
    expect(herbBinomial("Ferula assa-foetida")).toBe("Ferula assa-foetida");
  });

  it("does not repeat a Latin name that equals the common name, and copes with no Latin", () => {
    expect(herbTitleName({ common_name: "Aloe Vera", latin_name: "Aloe vera" })).toBe("Aloe Vera");
    expect(herbTitleName({ common_name: "Myrrh", latin_name: null })).toBe("Myrrh");
  });
});
