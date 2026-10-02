// Third-party tags run only on edeninstitute.health (2026-10-02). The inline
// head copies of the hostname pattern must match src/lib/productionHost.ts.
import { describe, expect, it } from "vitest";
import indexHtml from "../../index.html?raw";
import layout from "../../web/layouts/MarketingLayout.astro?raw";
import { PRODUCTION_HOST_PATTERN, isProductionHost } from "@/lib/productionHost";

describe("isProductionHost", () => {
  it("is true only for the live site", () => {
    expect(isProductionHost("edeninstitute.health")).toBe(true);
    expect(isProductionHost("www.edeninstitute.health")).toBe(true);
    for (const h of ["localhost", "127.0.0.1", "eden-institute-landing-git-x.vercel.app", "edeninstitute.health.evil.com", "notedeninstitute.health", ""]) {
      expect(isProductionHost(h), h).toBe(false);
    }
  });
});

describe("inline head copies", () => {
  for (const [name, src] of [["index.html", indexHtml], ["MarketingLayout.astro", layout]] as const) {
    it(`${name} sets __edenTagsLive with the shared pattern and gates every tag`, () => {
      expect(src).toContain(`window.__edenTagsLive = ${PRODUCTION_HOST_PATTERN}.test(window.location.hostname);`);
      expect(src).toContain("if (window.__edenTagsLive) (function(w,d,s,l,i)");
      expect(src).toMatch(/if \(window\.__edenTagsLive\) \{\s*\(function\(\)\{var t=document\.createElement\('script'\)/);
      // No static gtag.js tag that would load on previews.
      expect(src).not.toContain('<script async src="https://www.googletagmanager.com/gtag/js');
    });
  }
  it("gates the Pinterest tag", () => {
    expect(layout).toMatch(/if \(window\.__edenTagsLive\) \{\s*!function\(e\)\{if\(!window\.pintrk\)/);
  });
});
