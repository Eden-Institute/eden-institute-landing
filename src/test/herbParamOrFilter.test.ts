import { describe, expect, it } from "vitest";
import { findHerbByParam, herbParam, herbParamOrFilter } from "@/lib/herbLinks";

// The one-herb page (/apothecary/:herbId) asks herbs_directory_v for the rows
// herbParamOrFilter matches, then picks with findHerbByParam. It must land on
// the same herb that findHerbByParam picks from the WHOLE directory, or the
// page would render a different herb than it did before.

const DIRECTORY = [
  { herb_id: "H001", common_name: "Aloe Vera" },
  { herb_id: "H004", common_name: "Bacopa (Brahmi)" },
  { herb_id: "H020", common_name: "Hibiscus" },
  { herb_id: "H036", common_name: "Marshmallow" },
  { herb_id: "H050", common_name: "Rose" },
  { herb_id: "H051", common_name: "Rose Hips" },
  { herb_id: "H052", common_name: "Rosemary" },
  { herb_id: "H120", common_name: "Job's Tears / Coix (Yi Yi Ren)" },
  { herb_id: "H200", common_name: "Aged Tangerine Peel (Chen Pi)" },
].sort((a, b) => a.common_name.localeCompare(b.common_name));

/** What PostgREST returns for the filter: ilike, `*` as the wildcard. */
function applyOrFilter(filter: string) {
  const ilike = (pattern: string) =>
    new RegExp(
      "^" + pattern.split("*").map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$",
      "i",
    );
  const [idPart, namePart] = filter.split(",");
  const idRe = ilike(idPart.replace("herb_id.ilike.", ""));
  const nameRe = ilike(namePart.replace("common_name.ilike.", ""));
  return DIRECTORY.filter((h) => idRe.test(h.herb_id) || nameRe.test(h.common_name));
}

describe("herbParamOrFilter", () => {
  const params = [
    ...DIRECTORY.map((h) => herbParam(h)),
    ...DIRECTORY.map((h) => h.herb_id),
    ...DIRECTORY.map((h) => h.herb_id.toLowerCase()),
    "ROSE",
    "rose-hip",
    "pricng",
    "h999",
  ];

  for (const param of params) {
    it(`resolves "${param}" to the same herb as the full directory`, () => {
      const filter = herbParamOrFilter(param);
      expect(filter).not.toBeNull();
      const candidates = applyOrFilter(filter as string);
      expect(findHerbByParam(candidates, param)).toEqual(findHerbByParam(DIRECTORY, param));
    });
  }

  it("matches a few rows, not the directory", () => {
    expect(applyOrFilter(herbParamOrFilter("rose") as string).map((h) => h.common_name)).toEqual([
      "Rose",
      "Rose Hips",
      "Rosemary",
    ]);
    expect(applyOrFilter(herbParamOrFilter("bacopa-brahmi") as string)).toHaveLength(1);
  });

  it("returns null for anything no slug or H-code can be, so raw URL text never reaches the filter", () => {
    for (const bad of [undefined, "", "rose,herb_id.neq.x", "rose)", "a.b", "rose--hips", "-rose", "rosé", "a*"]) {
      expect(herbParamOrFilter(bad)).toBeNull();
      expect(findHerbByParam(DIRECTORY, bad)).toBeUndefined();
    }
  });
});
