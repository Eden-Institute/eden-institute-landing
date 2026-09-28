// The Google Fonts stylesheet loads from a <link> in the <head>, never from an
// @import in src/index.css, so it downloads in parallel with the site CSS
// instead of after it. See src/lib/fonts.ts.
import { describe, expect, it } from "vitest";
import { GOOGLE_FONTS_HREF } from "@/lib/fonts";
import indexHtml from "../../index.html?raw";
import indexCss from "../index.css?raw";
import marketingLayout from "../../web/layouts/MarketingLayout.astro?raw";

const headOf = (html: string) => html.slice(0, html.indexOf("</head>"));

describe("fonts stylesheet", () => {
  it("is not an @import in src/index.css", () => {
    expect(indexCss).not.toMatch(/@import\s+url\(\s*['"]?https:\/\/fonts\.googleapis\.com/);
    expect(indexCss).not.toContain("fonts.googleapis.com/css2");
  });

  it("is a head link in index.html, a verbatim copy of GOOGLE_FONTS_HREF", () => {
    expect(headOf(indexHtml)).toContain(`<link rel="stylesheet" href="${GOOGLE_FONTS_HREF}" />`);
  });

  it("keeps the SPA's two credential-strip scripts ahead of the fonts link", () => {
    const head = headOf(indexHtml);
    const link = head.indexOf(GOOGLE_FONTS_HREF);
    const scripts = [...head.matchAll(/<script>/g)].map((m) => m.index ?? -1);
    expect(scripts.length).toBeGreaterThanOrEqual(2);
    expect(scripts[0]).toBeLessThan(link);
    expect(scripts[1]).toBeLessThan(link);
  });

  it("is a head link in MarketingLayout.astro, from GOOGLE_FONTS_HREF", () => {
    expect(marketingLayout).toContain('import { GOOGLE_FONTS_HREF } from "@/lib/fonts";');
    expect(headOf(marketingLayout)).toContain('<link rel="stylesheet" href={GOOGLE_FONTS_HREF} />');
  });
});
