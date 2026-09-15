// No ad or analytics tags on the pages whose URL carries a credential.
//
// /starter/downloads?t=<durable Starter download token>,
// /partner-sample?k=<partner key>, /unsubscribe?token=<unsubscribe token> and
// /preorder-response?token=<delay-notice answer token>
// keep the credential in the address bar, so
// every emailed, copied or bookmarked link keeps working. That is only safe if
// nothing on those pages can read location.href and send it on. This renders
// every Astro page through the real layout (Astro's container API, compiled by
// vitest.astro.config.ts) and pins both halves of the promise:
//   - the two private pages carry no Google Tag Manager, Google Analytics,
//     Pinterest or Meta code, and do carry the no-referrer policy
//   - every other page still carries all of its tags, unchanged
// The session id strip script stays the first script everywhere.

import { experimental_AstroContainer as AstroContainer } from "astro/container";
import reactRenderer from "@astrojs/react/server.js";
import { beforeAll, describe, expect, it } from "vitest";
import { CHECKOUT_SESSION_STRIP_JS } from "@/lib/checkoutSession";

type PageModule = { default: unknown };
type RenderableComponent = Parameters<AstroContainer["renderToString"]>[0];

const pageModules = import.meta.glob<PageModule>("../../web/pages/**/*.astro");
const pageSources = import.meta.glob<string>("../../web/pages/**/*.astro", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** The pages that must render without third-party tags, and nothing else. */
const PRIVATE_PAGES = [
  "starter/downloads.astro",
  "partner-sample.astro",
  "unsubscribe.astro",
  "preorder-response.astro",
];

/** These read the live herb database while they render (web/lib/herbsPublic.ts)
 *  or take their props from getStaticPaths (esa/[state].astro), so a unit test
 *  must not render them. Their source is checked instead. */
const NEEDS_BUILD_DATA = [
  "herbs/index.astro",
  "herbs/[slug].astro",
  "results/[slug].astro",
  "esa/[state].astro",
];

/** Anything that would load or configure a third-party tag. */
const TAG_MARKERS = [
  "googletagmanager.com",
  "GTM-PVRHXN8N",
  "G-5DVHEZPKL0",
  "gtag(",
  "ga-disable-",
  "pintrk",
  "s.pinimg.com",
  "ct.pinterest.com",
  "fbevents",
  "connect.facebook.net",
];

/** What a normal page must still carry. */
const REQUIRED_ON_NORMAL_PAGES = [
  "https://www.googletagmanager.com/gtm.js?id=",
  "GTM-PVRHXN8N",
  "https://www.googletagmanager.com/gtag/js?id=G-5DVHEZPKL0",
  "gtag('config', 'G-5DVHEZPKL0')",
  "window['ga-disable-G-5DVHEZPKL0'] = true",
  "https://s.pinimg.com/ct/core.js",
  "pintrk('load', '2613485320295')",
  "pintrk('page')",
  "https://www.googletagmanager.com/ns.html?id=GTM-PVRHXN8N",
  "https://ct.pinterest.com/v3/?event=init",
];

const NO_REFERRER = /<meta name="referrer" content="no-referrer"\s*\/?>/;

const rel = (key: string) => key.replace(/^.*\/web\/pages\//, "");
const norm = (s: string) =>
  s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");

function firstHeadScript(html: string): string | null {
  const head = html.split(/<\/head>/i)[0];
  const m = head.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i);
  return m ? m[1] : null;
}

/** The SiteAnalytics island and the props it was given. */
function siteAnalyticsProps(html: string): string | null {
  const island = html.match(/<astro-island\b[^>]*component-url="[^"]*SiteAnalytics[^"]*"[^>]*>/);
  if (!island) return null;
  const props = island[0].match(/\bprops="([^"]*)"/);
  return props ? props[1].replace(/&quot;/g, '"') : null;
}

const rendered = new Map<string, string>();

beforeAll(async () => {
  const container = await AstroContainer.create();
  container.addServerRenderer({ name: "@astrojs/react", renderer: reactRenderer });
  container.addClientRenderer({ name: "@astrojs/react", entrypoint: "@astrojs/react/client.js" });
  for (const [key, load] of Object.entries(pageModules)) {
    if (NEEDS_BUILD_DATA.includes(rel(key))) continue;
    const mod = await load();
    rendered.set(rel(key), await container.renderToString(mod.default as RenderableComponent));
  }
}, 60_000);

describe("private pages load no third-party tags", () => {
  it("found the pages this test is about", () => {
    const all = Object.keys(pageModules).map(rel);
    for (const p of [...PRIVATE_PAGES, ...NEEDS_BUILD_DATA]) expect(all).toContain(p);
    // Guard against the glob silently matching nothing useful.
    expect(rendered.size).toBeGreaterThanOrEqual(15);
  });

  for (const page of PRIVATE_PAGES) {
    describe(page, () => {
      it("sets noThirdPartyTags on the layout", () => {
        const source = pageSources[`../../web/pages/${page}`];
        expect(source).toMatch(/<MarketingLayout[\s\S]*?noThirdPartyTags=\{true\}[\s\S]*?>/);
      });

      it("renders no Google Tag Manager, Google Analytics, Pinterest or Meta code", () => {
        const html = rendered.get(page) as string;
        expect(html).toContain("</head>");
        for (const marker of TAG_MARKERS) expect(html, marker).not.toContain(marker);
      });

      it("sets the no-referrer policy before any script or stylesheet", () => {
        const html = rendered.get(page) as string;
        const meta = html.search(NO_REFERRER);
        expect(meta).toBeGreaterThan(-1);
        const firstFetchOrScript = html.search(/<script\b|<link\b/i);
        expect(meta).toBeLessThan(firstFetchOrScript);
      });

      it("keeps the session id strip script as the first script", () => {
        const html = rendered.get(page) as string;
        expect(norm(firstHeadScript(html) ?? "")).toBe(norm(CHECKOUT_SESSION_STRIP_JS));
      });

      it("tells SiteAnalytics not to load the Meta Pixel or show the banner", () => {
        const props = siteAnalyticsProps(rendered.get(page) as string);
        expect(props).not.toBeNull();
        expect(props).toContain('"thirdPartyTags":[0,false]');
      });

      it("stays noindex", () => {
        expect(rendered.get(page)).toContain('<meta name="robots" content="noindex, nofollow">');
      });
    });
  }

  it("the starter downloads page still mounts its island and the partner page its script", () => {
    expect(rendered.get("starter/downloads.astro")).toMatch(/component-url="[^"]*StarterDownloads/);
    expect(rendered.get("partner-sample.astro")).toContain('new URLSearchParams(window.location.search).get("k")');
  });
});

describe("every other page keeps its tags", () => {
  it("renders every tag, the strip script first, and no no-referrer policy", () => {
    const others = [...rendered.keys()].filter((p) => !PRIVATE_PAGES.includes(p));
    expect(others.length).toBeGreaterThanOrEqual(13);
    for (const page of others) {
      const html = rendered.get(page) as string;
      for (const marker of REQUIRED_ON_NORMAL_PAGES) expect(html, `${page}: ${marker}`).toContain(marker);
      expect(norm(firstHeadScript(html) ?? ""), page).toBe(norm(CHECKOUT_SESSION_STRIP_JS));
      expect(html, page).not.toMatch(NO_REFERRER);
      const props = siteAnalyticsProps(html);
      expect(props, page).not.toBeNull();
      expect(props, page).toContain('"thirdPartyTags":[0,true]');
    }
  });

  it("the thank-you pages, which carry a session id, are not private pages", () => {
    for (const page of ["starter/thank-you.astro", "books/thank-you.astro"]) {
      expect(rendered.get(page), page).toContain("https://s.pinimg.com/ct/core.js");
    }
  });

  it("the pages that need build data use the layout without the private prop", () => {
    for (const page of NEEDS_BUILD_DATA) {
      const source = pageSources[`../../web/pages/${page}`];
      expect(source, page).toContain("<MarketingLayout");
      expect(source, page).not.toContain("noThirdPartyTags");
    }
  });

  it("no page other than the private pages mentions the prop", () => {
    const using = Object.entries(pageSources)
      .filter(([, src]) => src.includes("noThirdPartyTags"))
      .map(([key]) => rel(key))
      .sort();
    expect(using).toEqual([...PRIVATE_PAGES].sort());
  });
});
