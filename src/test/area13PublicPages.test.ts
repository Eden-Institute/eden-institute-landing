/**
 * 2026-11-17, Lane 2 deep audit area 13 (every public page).
 *
 * P1: the herb page's "Open <herb> in the Apothecary" button must wrap. The shared button is whitespace-nowrap with
 * 48px side padding, and with long herb names it ran off a 375px screen on 77 of 299 herb pages.
 *
 * P2: Odyssey moved its help center from /hc/en-us (every old link 404, its home page included) to /en/articles.
 * No ESA page may point back at the retired help center or at Wyoming's withdrawn expense-guidance PDF.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ESA_STATES } from "../../web/lib/esaStates";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const hrefs = [...JSON.stringify(ESA_STATES).matchAll(/"href":"([^"]+)"/g)].map((m) => m[1]);

describe("area 13 P2: ESA source links", () => {
  it("found the ESA links at all (guards against a vacuous pass)", () => {
    expect(hrefs.length).toBeGreaterThan(40);
  });

  it("never points at Odyssey's retired help center or the withdrawn Wyoming PDF", () => {
    expect(hrefs.filter((h) => h.includes("support.withodyssey.com/hc/"))).toEqual([]);
    expect(hrefs.filter((h) => h.includes("Allowable-and-Disallowable-Expense-Guidance"))).toEqual([]);
  });

  it("uses Odyssey's new article addresses, full slug, for every Odyssey guide", () => {
    const odyssey = hrefs.filter((h) => h.includes("withodyssey.com"));
    expect(odyssey).toHaveLength(11);
    for (const h of odyssey) expect(h).toMatch(/^https:\/\/support\.withodyssey\.com\/en\/articles\/\d+-[a-z0-9-]+$/);
  });
});

describe("area 13 P1: herb page Apothecary button", () => {
  const page = readFileSync("web/pages/herbs/[slug].astro", "utf8");
  const m = page.match(/data-cta="herb-open-apothecary" class=\{cn\(buttonVariants\(\{ variant: "outline", size: "xl" \}\), "([^"]+)"\)\}/);

  it("is still the outline xl button with its own extra classes", () => {
    expect(m).not.toBeNull();
  });

  it("wraps, grows in height and never gets wider than its row", () => {
    const cls = cn(buttonVariants({ variant: "outline", size: "xl" }), m![1]).split(" ");
    expect(cls).toContain("whitespace-normal");
    expect(cls).not.toContain("whitespace-nowrap");
    expect(cls).toContain("h-auto");
    expect(cls).not.toContain("h-14");
    expect(cls).toContain("max-w-full");
    expect(cls).toContain("px-6");
    expect(cls).not.toContain("px-12");
  });

  it("leaves the shared button as it is", () => {
    expect(buttonVariants({ variant: "outline", size: "xl" })).toContain("whitespace-nowrap");
  });
});
