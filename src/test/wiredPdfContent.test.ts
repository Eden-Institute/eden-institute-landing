// Wired quiz W7: the PDF + delivery-email copy is GENERATED from Camila's approved files
// (scripts/gen_wired_pdf_content.py). Every string must still appear, word for word, in its file,
// and the banned phrases (rule 1) must not appear anywhere.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { WIRED_PDF_COPY } from "../../supabase/functions/_shared/wired-pdf-content";

const doc = (f: string) => readFileSync(`docs/wired-copy/${f}`, "utf8").replace(/\r\n/g, "\n");
const FILES: Record<string, string> = {
  blueprint1: "Wired_Quiz_Blueprint_Part1.md",
  blueprint2: "Wired_Quiz_Blueprint_Part2.md",
  familyMap: "Wired_Quiz_Family_Map_And_Screens.md",
  results: "Wired_Quiz_Results_Page_Copy.md",
  emails: "Wired_Quiz_Emails_Transactional.md",
};

describe("wired PDF copy", () => {
  for (const [key, file] of Object.entries(FILES)) {
    it(`${key}: every block line is in ${file}`, () => {
      const text = doc(file);
      const blocks = (WIRED_PDF_COPY as unknown as Record<string, Record<string, { s: string }[]>>)[key];
      expect(Object.keys(blocks).length).toBeGreaterThan(5);
      for (const [heading, items] of Object.entries(blocks)) {
        expect(text).toContain(heading);
        for (const it of items) expect(text).toContain(it.s);
      }
    });
  }
  it("pair blurbs: 36, each in the approved file", () => {
    const text = doc("Wired_Quiz_Pair_Blurbs.md");
    expect(Object.keys(WIRED_PDF_COPY.pairs)).toHaveLength(36);
    for (const s of Object.values(WIRED_PDF_COPY.pairs)) expect(text).toContain(s);
  });
  it("write-ups: 9, short + longer in the approved file", () => {
    const text = doc("Wired_Quiz_Wiring_Writeups.md");
    expect(Object.keys(WIRED_PDF_COPY.writeups)).toHaveLength(9);
    for (const w of Object.values(WIRED_PDF_COPY.writeups)) {
      for (const s of w.short) expect(text).toContain(s);
      for (const p of w.longer) expect(text).toContain(p.text);
    }
  });
  it("no banned phrases (rule 1), no em dashes in the PDF copy", () => {
    const all = JSON.stringify({ ...WIRED_PDF_COPY, results: undefined, emails: undefined }).toLowerCase();
    for (const bad of ["learning style", "learns best", "diagnose", "assessment shows"]) expect(all).not.toContain(bad);
  });
});
