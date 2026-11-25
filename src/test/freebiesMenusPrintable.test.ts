/**
 * Free "Show what you learned" printable on /freebies (her pick 2026-11-25: Freebies page, no form).
 * The link must point at a real PDF in public/ (a static file: a missing one would 404 silently), kept small,
 * and the box carries her approved heading + opening words.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..", "..");
const page = readFileSync(join(root, "web", "pages", "freebies.astro"), "utf8");
const pdf = join(root, "public", "lead-magnets", "show-what-you-learned-menus.pdf");

describe("/freebies menus printable", () => {
  it("links the static PDF with a click beacon", () => {
    expect(page).toContain('href="/lead-magnets/show-what-you-learned-menus.pdf" data-cta="freebies-menus-pdf"');
  });
  it("the PDF exists, is a PDF, and is small enough for a phone", () => {
    expect(readFileSync(pdf).subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(statSync(pdf).size).toBeLessThan(2_000_000);
  });
  it("carries the approved heading and opening, and never names the quiz", () => {
    expect(page).toContain("Show what you learned: a menu for every wiring");
    expect(page.replace(/\s+/g, " ")).toContain("Any curriculum can fit your child. The lesson stays the same. What changes is how your child shows you what they learned.");
    const box = page.slice(page.indexOf('id="show-what-you-learned"'), page.indexOf('id="show-what-you-learned"') + 1500);
    expect(box).not.toMatch(/\/wired|quiz/i);
  });
});
