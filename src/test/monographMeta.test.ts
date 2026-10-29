// One title and description template for every monograph (founder decision
// 2026-10-28). Names are real herbs.common_name / latin_name rows.
import { describe, expect, it } from "vitest";
import { MAX_DESCRIPTION, monographDescription, monographNames, monographTitle } from "@/lib/monographMeta";

const SUFFIX = ": Traditional Uses & Safety | Eden Apothecary";

describe("monographTitle", () => {
  it("follows the template for the seven page-1 monographs", () => {
    expect(monographTitle({ common_name: "Agrimony", latin_name: "Agrimonia eupatoria" })).toBe(`Agrimony (Agrimonia eupatoria)${SUFFIX}`);
    expect(monographTitle({ common_name: "Oat Straw", latin_name: "Avena sativa" })).toBe(`Oat Straw (Avena sativa)${SUFFIX}`);
    expect(monographTitle({ common_name: "Horsetail", latin_name: "Equisetum arvense" })).toBe(`Horsetail (Equisetum arvense)${SUFFIX}`);
    expect(monographTitle({ common_name: "Anise (Aniseed)", latin_name: "Pimpinella anisum" })).toBe(`Anise (Pimpinella anisum)${SUFFIX}`);
    expect(monographTitle({ common_name: "Wild Cherry", latin_name: "Prunus serotina" })).toBe(`Wild Cherry (Prunus serotina)${SUFFIX}`);
    expect(monographTitle({ common_name: "Hyssop", latin_name: "Hyssopus officinalis" })).toBe(`Hyssop (Hyssopus officinalis)${SUFFIX}`);
    expect(monographTitle({ common_name: "Cowslip", latin_name: "Primula veris" })).toBe(`Cowslip (Primula veris)${SUFFIX}`);
  });

  it("matches the approved agrimony snippet exactly", () => {
    expect(monographTitle({ common_name: "Agrimony", latin_name: "Agrimonia eupatoria" })).toBe(
      "Agrimony (Agrimonia eupatoria): Traditional Uses & Safety | Eden Apothecary",
    );
    expect(monographDescription({ common_name: "Agrimony", latin_name: "Agrimonia eupatoria" })).toBe(
      "Agrimony (Agrimonia eupatoria): traditional uses, preparation and safety cautions, explained plainly. Part of Eden Apothecary's free herb library.",
    );
  });

  it("never leads with a Sanskrit or pinyin alias, and cuts the Latin to the binomial", () => {
    expect(monographTitle({ common_name: "Cumin (Jiraka)", latin_name: "Cuminum cyminum" })).toBe(`Cumin (Cuminum cyminum)${SUFFIX}`);
    expect(monographTitle({ common_name: "Baikal Skullcap (Huang Qin)", latin_name: "Scutellaria baicalensis" })).toBe(`Baikal Skullcap (Scutellaria baicalensis)${SUFFIX}`);
    expect(monographTitle({ common_name: "Green Tea", latin_name: "Camellia sinensis (L.) Kuntze (syn. Thea sinensis L.)" })).toBe(`Green Tea (Camellia sinensis)${SUFFIX}`);
    expect(monographTitle({ common_name: "Aloe Vera", latin_name: "Aloe vera" })).toBe(`Aloe Vera${SUFFIX}`);
    expect(monographTitle({ common_name: "Myrrh", latin_name: null })).toBe(`Myrrh${SUFFIX}`);
  });
});

describe("monographNames", () => {
  it("moves every alias to Also known as", () => {
    expect(monographNames({ common_name: "Coriander (Cilantro; Ayurvedic Dhanyaka)", latin_name: "Coriandrum sativum L." })).toEqual({
      english: "Coriander",
      latin: "Coriandrum sativum",
      aka: ["Cilantro", "Dhanyaka"],
    });
    expect(monographNames({ common_name: "Pinkroot (also Indian Pink, Maryland Pinkroot)", latin_name: "Spigelia marilandica" }).aka).toEqual([
      "Indian Pink",
      "Maryland Pinkroot",
    ]);
  });

  it("lets the English name in the row's own aliases lead a Sanskrit or Hindi name", () => {
    expect(monographNames({ common_name: "Karela (Bitter Melon)", latin_name: "Momordica charantia L." })).toEqual({
      english: "Bitter Melon",
      latin: "Momordica charantia",
      aka: ["Karela"],
    });
    expect(monographNames({ common_name: "Amalaki (Amla / Indian Gooseberry)", latin_name: "Phyllanthus emblica" })).toEqual({
      english: "Indian Gooseberry",
      latin: "Phyllanthus emblica",
      aka: ["Amalaki", "Amla"],
    });
  });

  it("keeps a name the row has no English for (founder 2026-10-28)", () => {
    expect(monographNames({ common_name: "Ashwagandha", latin_name: "Withania somnifera" }).english).toBe("Ashwagandha");
    expect(monographNames({ common_name: "Guduchi (Giloy)", latin_name: "Tinospora cordifolia" })).toEqual({
      english: "Guduchi",
      latin: "Tinospora cordifolia",
      aka: ["Giloy"],
    });
  });

  it("picks one English name from A / B, the genus giving way", () => {
    expect(monographNames({ common_name: "Platycodon / Balloon Flower (Jie Geng)", latin_name: "Platycodon grandiflorus" })).toEqual({
      english: "Balloon Flower",
      latin: "Platycodon grandiflorus",
      aka: ["Platycodon", "Jie Geng"],
    });
    expect(monographNames({ common_name: "Red Sage / Dan Shen", latin_name: "Salvia miltiorrhiza" })).toEqual({
      english: "Red Sage",
      latin: "Salvia miltiorrhiza",
      aka: ["Dan Shen"],
    });
    expect(monographNames({ common_name: "Flax / Linseed", latin_name: "Linum usitatissimum" }).english).toBe("Flax");
  });

  it("reads a qualifying parenthesis as one name", () => {
    expect(monographNames({ common_name: "Ginseng (American)", latin_name: "Panax quinquefolius" }).english).toBe("American Ginseng");
  });
});

describe("monographDescription", () => {
  it("stays under 160 characters, dropping the binomial only for a very long name pair", () => {
    const long = monographDescription({ common_name: "White Atractylodes (Bai Zhu)", latin_name: "Atractylodes macrocephala" });
    expect(long.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
    expect(long.startsWith("White Atractylodes: traditional uses")).toBe(true);
    const tree = monographDescription({ common_name: "Tree Peony Bark / Moutan (Mu Dan Pi)", latin_name: "Paeonia suffruticosa Andr." });
    expect(tree.startsWith("Tree Peony Bark (Paeonia suffruticosa):")).toBe(true);
    expect(tree.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
  });
});
