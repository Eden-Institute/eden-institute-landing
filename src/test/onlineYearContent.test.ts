import { describe, expect, it } from "vitest";
import { STANDARDS, WEEK_SCRIPTURE } from "../../web/lib/onlineYearContent";

// Pins the Online Year content data (OY0) to what the printed books say, so a regeneration that drops or garbles a
// week fails CI. Spot values were read off the printed Week at a Glance pages (2026-11-28).
describe("Online Year content data", () => {
  it("has a verse and a reference for all 36 weeks of both bands", () => {
    for (const band of ["sprouts", "seedlings"] as const) {
      for (let w = 1; w <= 36; w++) {
        const s = WEEK_SCRIPTURE[band][w];
        expect(s, `${band} week ${w}`).toBeDefined();
        expect(s.verse.length, `${band} week ${w} verse`).toBeGreaterThan(15);
        expect(s.ref, `${band} week ${w} ref`).toMatch(/^(\d )?[A-Z][a-z]+ \d+:\d+(-\d+)?$/);
      }
    }
  });

  it("matches the printed pages it was read from", () => {
    expect(WEEK_SCRIPTURE.sprouts[1]).toEqual({ verse: "I am fearfully and wonderfully made; wonderful are Your works.", ref: "Psalm 139:14" });
    expect(WEEK_SCRIPTURE.sprouts[16].ref).toBe("Genesis 2:3");
    expect(WEEK_SCRIPTURE.sprouts[36].ref).toBe("Psalm 65:11");
    expect(WEEK_SCRIPTURE.seedlings[1].ref).toBe("Psalm 100:3");
    expect(WEEK_SCRIPTURE.seedlings[16].ref).toBe("Isaiah 58:11");
    expect(WEEK_SCRIPTURE.seedlings[36].ref).toBe("Malachi 4:2");
  });

  it("carries each band's standards list from its Teacher's Guide back matter", () => {
    const count = (band: "sprouts" | "seedlings") => STANDARDS[band].reduce((n, g) => n + g.items.length, 0);
    expect(count("sprouts")).toBe(71);
    expect(count("seedlings")).toBe(98);
    const codes = (band: "sprouts" | "seedlings") => STANDARDS[band].flatMap((g) => g.items.map((i) => i.code));
    expect(codes("sprouts")).toEqual(expect.arrayContaining(["RF.K-1.1", "K.CC.A.1", "K-LS1-1", "2-PS1-4", "VA:Cn10.1.K-2"]));
    expect(codes("seedlings")).toEqual(expect.arrayContaining(["RL.3-5.2", "3.OA.A.1-D.9", "5-PS1-3", "NHES 7.5.2/3", "ACTFL 4.1"]));
    for (const band of ["sprouts", "seedlings"] as const) {
      for (const g of STANDARDS[band]) for (const i of g.items) expect(i.text.length, `${band} ${i.code}`).toBeGreaterThan(3);
    }
  });

  it("uses no em dashes (house copy rule)", () => {
    expect(JSON.stringify({ WEEK_SCRIPTURE, STANDARDS })).not.toMatch(/—/);
  });
});
