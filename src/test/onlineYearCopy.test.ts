/**
 * Online Year OY2 (punch #472): the words on the order page and on Stripe's screen are Camila's APPROVED
 * copy, word for word (docs/online-year-copy/approved.md, a verbatim snapshot of the plan file's
 * "Approved copy (Nov 23)"). The few new lines the order page needs are listed in OY_PENDING and pinned
 * here by name, so a new unreviewed line cannot slip in: each one goes to her review page first.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OY_APPROVED, OY_PENDING } from "../../web/lib/onlineYearCopy";

const root = join(__dirname, "..", "..");
const approved = readFileSync(join(root, "docs", "online-year-copy", "approved.md"), "utf8").replace(/\s+/g, " ");
const shared = readFileSync(join(root, "supabase", "functions", "_shared", "online-year-checkout.ts"), "utf8");

function strings(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (v && typeof v === "object") return Object.values(v).flatMap(strings);
  return [];
}

describe("Online Year order page copy", () => {
  it("every approved string is in the approved snapshot, word for word", () => {
    for (const s of strings(OY_APPROVED)) expect(approved, s).toContain(s.replace(/\s+/g, " "));
  });

  it("the pending (not yet approved) lines are exactly these, until she approves them", () => {
    expect(Object.keys(OY_PENDING).sort()).toEqual(["addChild", "countries", "countryLabel", "emailLabel", "removeChild", "siblingNote"]);
  });

  it("no em dashes anywhere on the page", () => {
    for (const s of [...strings(OY_APPROVED), ...strings(OY_PENDING)]) expect(s).not.toMatch(/—/);
  });

  it("Stripe's product names, descriptions and submit line come from the approved copy (Sprouts words in the snapshot)", () => {
    expect(approved).toContain("Eden's Table Online Year: Sprouts (K-2), first child");
    expect(approved).toContain("Eden's Table Online Year: Sprouts (K-2), sibling");
    expect(approved).toContain(
      "12 months of online access to all 36 weeks of Sprouts: the Teacher's Guide, the Read-Aloud Storybook, this child's Notebook pages to print, and their portfolio. For one household.",
    );
    expect(approved).toContain("12 months of this child's Sprouts Notebook pages to print and their own portfolio. Goes with an active first-child Online Year.");
    // The shared module builds those same sentences with the band swapped in.
    expect(shared).toContain("12 months of online access to all 36 weeks of ${BAND_WORD[band]}: the Teacher's Guide, the Read-Aloud Storybook, this child's Notebook pages to print, and their portfolio. For one household.");
    expect(shared).toContain("12 months of this child's ${BAND_WORD[band]} Notebook pages to print and their own portfolio. Goes with an active first-child Online Year.");
    expect(shared).toContain("'All sales final on digital products. No automatic renewal: we\\'ll email you before your year ends.'");
  });
});
