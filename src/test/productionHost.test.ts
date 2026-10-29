// Third-party tags run only on edeninstitute.health (2026-10-02). The inline
// head copies of the hostname pattern must match src/lib/productionHost.ts.
import { afterEach, describe, expect, it } from "vitest";
import indexHtml from "../../index.html?raw";
import layout from "../../web/layouts/MarketingLayout.astro?raw";
import { PRODUCTION_HOST_PATTERN, TEST_SESSION_GUARD_JS, isProductionHost, isTestSession, thirdPartyTagsAllowed } from "@/lib/productionHost";

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

describe("test sessions (2026-10-28)", () => {
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("both heads run the same guard right after setting __edenTagsLive", () => {
    expect(indexHtml).toContain(TEST_SESSION_GUARD_JS);
    expect(indexHtml.indexOf(TEST_SESSION_GUARD_JS)).toBeGreaterThan(indexHtml.indexOf("window.__edenTagsLive ="));
    expect(indexHtml.indexOf(TEST_SESSION_GUARD_JS)).toBeLessThan(indexHtml.indexOf("googletagmanager.com/gtm.js"));
    expect(layout).toContain("<script is:inline set:html={TEST_SESSION_GUARD_JS}></script>");
    expect(layout.indexOf("set:html={TEST_SESSION_GUARD_JS}")).toBeLessThan(layout.indexOf("googletagmanager.com/gtm.js"));
  });

  it("the inline guard turns the live tags off for a test session", () => {
    const run = (search: string, before?: () => void) => {
      sessionStorage.clear();
      localStorage.clear();
      window.history.replaceState(null, "", `/books${search}`);
      before?.();
      const w = window as unknown as { __edenTagsLive?: boolean };
      w.__edenTagsLive = true;
      new Function(TEST_SESSION_GUARD_JS)();
      return w.__edenTagsLive;
    };
    expect(run("")).toBe(true);
    expect(run("?utm_source=e2e_check&utm_medium=test&utm_content=attr")).toBe(false);
    expect(run("?utm_source=claude_e2e")).toBe(false);
    expect(run("?utm_source=facebook&utm_medium=test")).toBe(false);
    expect(run("?utm_source=facebook&utm_medium=group_post")).toBe(true);
    expect(run("", () => localStorage.setItem("eden_e2e_token", "x"))).toBe(false);
    // Remembered for the tab: the return from Stripe carries no tags.
    expect(run("", () => sessionStorage.setItem("eden-test-session", "1"))).toBe(false);
  });

  it("isTestSession follows the same rule for bundled code, and remembers the tab", () => {
    expect(isTestSession()).toBe(false);
    window.history.replaceState(null, "", "/books?utm_source=e2e_check&utm_medium=test");
    expect(isTestSession()).toBe(true);
    window.history.replaceState(null, "", "/books/thank-you");
    expect(isTestSession()).toBe(true);
    sessionStorage.clear();
    localStorage.setItem("eden_e2e_token", "x");
    expect(isTestSession()).toBe(true);
  });

  it("no third-party tags off the live site or in a test session", () => {
    // jsdom serves localhost, so never allowed here.
    expect(thirdPartyTagsAllowed()).toBe(false);
  });
});

describe("GA page_view on the app (2026-10-28)", () => {
  it("index.html turns GA's own page_view off; the Astro layout keeps it", () => {
    expect(indexHtml).toContain("gtag('config', 'G-5DVHEZPKL0', { send_page_view: false });");
    expect(layout).toContain("gtag('config', 'G-5DVHEZPKL0');");
  });
});
