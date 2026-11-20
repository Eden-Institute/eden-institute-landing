// Wired quiz W5: the curriculum workbook -> wired_admin_import rows. Columns, as in
// Wired_Quiz_Curriculum_Database.xlsx 2026-11-19 (Curricula + ESA by state tabs).
import { describe, it, expect } from "vitest";
import { mapCurricula, mapEsa, parseCsv } from "../lib/wiredImport";

const CURRICULA = [
  '"Yellow = Claude fills, Green = Camila decides. Row 3 is a FORMAT EXAMPLE (not imported).",,,',
  "curriculum_id,name,publisher,product_url,approach,format,subjects,grade_min,grade_max,domains_served,prep_load,price_usd,price_basis,extra_child_usd,price_source_url,price_checked_date,multi_age,faith_alignment,affiliate_url,is_affiliate,eden_band,coming_soon,esa_states_yes,dm_name,dm_role,dm_email,dm_source_url,last_verified_date,vetting_notes,camila_decision,row_status",
  'C000,"Eden\'s Table: Sprouts (grades K-2) Printed Curriculum Set",Rooted in Faith Ventures LLC,https://edeninstitute.health/homeschool,,Complete for one subject,Science; Bible,K,2,Cultivator; Maker; Storyteller,Open-and-go,249,Per family set (one-time),39.99,,2026-11-18,Yes,Christian (explicit),,No,Sprouts,No,1,n/a,,,,2026-11-18,"+$12 shipping, siblings share",,EXAMPLE',
  'C001,"The Good and the Beautiful, ""Science""",TGTB,https://example.com/tgtb,Charlotte Mason,Complete,Science,K,5,Cultivator; Designer,Light,"$1,089.50",Per family per year,,,,Yes,Christian (explicit),https://aff.example/t,Yes,,No,3,Jane Doe,Owner,jane@example.com,https://example.com/about,2026-11-18 10:00,"line one\nline two",Approve,Ready for Camila',
  "C002,Rejected One,X,https://x.example,,,Math,3,8,Organizer,Moderate,0,Free,,,,No,Secular / neutral,,No,,No,0,,,,,2026-11-18,,Reject,Ready for Camila",
  "C003,No Price Yet,Y,https://y.example,Classical,,History; Bible,6,12,Seeker; Storyteller,Heavy,,,,,,No,Christian-friendly,,No,,No,0,,,,,,,,Draft (Claude)",
  "C004,Blank Top Grade,Z,https://z.example,Online / video,,Math,3,,Organizer,Open-and-go (about 0-10 min of parent prep a day),48.95,Per child per year,,,,No,Secular / neutral,,No,,No,0,,,,,2026-11-18,,,Ready for Camila",
].join("\n");

const ESA = [
  "One row per curriculum per state.,,,",
  "curriculum_id,curriculum_name,state,program,eligible,verified_date,source_url,notes,row_status",
  "C000,Eden,AZ,Arizona ESA,Yes,2026-11-18,https://x,example,EXAMPLE",
  'C001,TGTB,fl,"Florida FES-EO",Yes,2026-11-18,https://fl.example,"ok, verified",',
  "C001,TGTB,TN,TN EFS,Unknown,,,,",
].join("\r\n");

describe("parseCsv", () => {
  it("handles quotes, doubled quotes, commas and newlines inside quotes, CRLF", () => {
    expect(parseCsv('a,"b,c","d ""e""","f\ng"\r\nh,i,,j')).toEqual([["a", "b,c", 'd "e"', "f\ng"], ["h", "i", "", "j"]]);
  });
});

describe("mapCurricula", () => {
  const { rows, skipped } = mapCurricula(CURRICULA);
  it("finds the header under the colour-key line, skips the EXAMPLE and the Rejected row", () => {
    expect(rows.map((r) => r.sheet_id)).toEqual(["C001", "C003", "C004"]);
    expect(skipped).toBe(2);
  });
  it("maps every field the database keeps", () => {
    expect(rows[0]).toEqual({
      sheet_id: "C001", name: 'The Good and the Beautiful, "Science"', publisher: "TGTB", url: "https://example.com/tgtb",
      approach: "Charlotte Mason", subjects: ["Science"], grade_min: 0, grade_max: 5, domains_served: ["cultivator", "designer"],
      prep_load: "Light", price_cents: 108950, price_basis: "Per family per year", multi_age: true, faith_alignment: "Christian (explicit)",
      affiliate_url: "https://aff.example/t", is_affiliate: true, eden_band: undefined, coming_soon: false, last_verified_at: "2026-11-18",
      dm_name: "Jane Doe", dm_role: "Owner", dm_email: "jane@example.com", dm_source_url: "https://example.com/about",
    });
  });
  it("an unknown price stays null (never 'within budget'), grades 6-12 parse", () => {
    expect(rows[1].price_cents).toBeNull();
    expect([rows[1].grade_min, rows[1].grade_max]).toEqual([6, 12]);
    expect(rows[1].last_verified_at).toBeUndefined();
  });
  it("a blank grade stays null, never K (the real workbook's C019 had a blank top grade); prep keeps only the level name", () => {
    const r = rows.find((x) => x.sheet_id === "C004")!;
    expect([r.grade_min, r.grade_max]).toEqual([3, null]);
    expect(r.prep_load).toBe("Open-and-go");
    expect(r.price_cents).toBe(4895);
  });
  it("refuses a file with no header row", () => {
    expect(() => mapCurricula("a,b\n1,2")).toThrow(/header row/);
  });
  it("2026-11-20 columns: screen_based Yes/No (blank = leave alone) and price_covers (blank = leave alone)", () => {
    const head = CURRICULA.split("\n")[1] + ",resource_type,screen_based,price_covers";
    const csv = [
      head,
      'C010,Veritas Press,VP,https://v.example,Classical,,History,2,12,Seeker,Moderate,249,Per subject per year,,,,No,Christian (explicit),,No,,No,0,,,,,2026-11-20,,Approve,Ready for Camila,Curriculum,Yes,"One subject for one year, online classes"',
      "C011,Math Book,MB,https://m.example,Mastery,,Math,1,6,Organizer,Light,40,Per level,,,,No,Secular / neutral,,No,,No,0,,,,,2026-11-20,,Approve,Ready for Camila,Curriculum,No,",
      "C012,Not Asked Yet,NA,https://n.example,Mastery,,Math,1,6,Organizer,Light,40,Per level,,,,No,Secular / neutral,,No,,No,0,,,,,2026-11-20,,Approve,Ready for Camila,,,",
    ].join("\n");
    const [vp, mb, na] = mapCurricula(csv).rows;
    expect([vp.screen_based, vp.price_covers]).toEqual([true, "One subject for one year, online classes"]);
    expect([vp.resource_type, mb.resource_type, na.resource_type]).toEqual(["Curriculum", "Curriculum", undefined]);
    expect([mb.screen_based, mb.price_covers]).toEqual([false, undefined]);
    expect([na.screen_based, na.price_covers]).toEqual([undefined, undefined]);
    // JSON for wired_admin_import: a blank cell sends no key, so the stored value is kept.
    expect(Object.keys(JSON.parse(JSON.stringify(na)))).not.toContain("screen_based");
    expect(Object.keys(JSON.parse(JSON.stringify(mb)))).not.toContain("price_covers");
  });
});

describe("mapEsa", () => {
  it("maps state rows; Yes/No/Unknown -> yes/no/unknown; skips the EXAMPLE", () => {
    const { rows, skipped } = mapEsa(ESA);
    expect(skipped).toBe(1);
    expect(rows).toEqual([
      { sheet_id: "C001", state: "FL", program: "Florida FES-EO", eligible: "yes", verified_at: "2026-11-18", source_url: "https://fl.example", notes: "ok, verified" },
      { sheet_id: "C001", state: "TN", program: "TN EFS", eligible: "unknown", verified_at: undefined, source_url: undefined, notes: undefined },
    ]);
  });
});
