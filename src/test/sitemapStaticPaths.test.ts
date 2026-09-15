/**
 * Drift guard for the hand-maintained sitemap list. Every non-dynamic page under
 * web/pages that is indexable must appear in STATIC_PATHS, and every entry in
 * STATIC_PATHS must be an existing indexable page.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { STATIC_PATHS } from "../../web/lib/sitemapStaticPaths";

const pagesDir = join(__dirname, "..", "..", "web", "pages");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function routeFor(file: string): string {
  const parts = relative(pagesDir, file).split(sep);
  parts[parts.length - 1] = parts[parts.length - 1].replace(/\.astro$/, "");
  if (parts[parts.length - 1] === "index") parts.pop();
  return "/" + parts.join("/");
}

/** Template part only (after the closing frontmatter fence), so `// noindex:` comments do not count. */
function isNoindex(source: string): boolean {
  const fences = source.split(/^---\s*$/m);
  const template = fences.length >= 3 ? fences.slice(2).join("---") : source;
  return /\snoindex(=\{true\})?(?=[\s>/])/.test(template);
}

describe("sitemap STATIC_PATHS", () => {
  it("matches the indexable, non-dynamic pages in web/pages", () => {
    const pages = walk(pagesDir).filter(
      (f) => f.endsWith(".astro") && !relative(pagesDir, f).includes("["),
    );
    // Guard against a blind check that reads nothing and passes.
    expect(pages.length).toBeGreaterThan(10);

    const indexable = pages
      .filter((f) => !isNoindex(readFileSync(f, "utf8")))
      .map(routeFor);

    expect(
      [...indexable].sort(),
      "web/pages and web/lib/sitemapStaticPaths.ts disagree: add the page to STATIC_PATHS, or mark it noindex if it must stay out of search.",
    ).toEqual([...STATIC_PATHS].sort());
  });
});
