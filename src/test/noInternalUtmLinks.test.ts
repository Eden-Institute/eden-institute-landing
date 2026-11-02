// Links between the site's own pages never carry UTM tags (hard gate, 2026-10-28).
// A tag on an internal link starts a new GA session credited to the tag and erases
// the visitor's real source: the post-signup pop-up's utm_source=modal did exactly
// that to every new family until this date. Such clicks are events instead
// (trackInternalLinkClick). This sweeps every page and component.
import { describe, expect, it } from "vitest";

const sources = {
  ...import.meta.glob("../../web/**/*.{astro,tsx,ts}", { query: "?raw", import: "default", eager: true }),
  ...import.meta.glob("../**/*.{tsx,ts}", { query: "?raw", import: "default", eager: true }),
} as Record<string, string>;

// An href / to / data-*-href value on our own site (absolute or root-relative) with utm_.
const INTERNAL_TAGGED = /(?:href|to|data-[a-z-]*href)\s*=\s*\{?\s*["'`](?:https?:\/\/(?:www\.)?edeninstitute\.health)?\/[^"'`]*[?&]utm_/gi;

describe("internal links", () => {
  it("swept a real number of files", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(100);
  });

  it("carry no utm_ tags", () => {
    const hits: string[] = [];
    for (const [file, src] of Object.entries(sources)) {
      if (file.includes("/test/")) continue;
      for (const m of src.matchAll(INTERNAL_TAGGED)) hits.push(`${file}: ${m[0]}`);
    }
    expect(hits).toEqual([]);
  });
});
