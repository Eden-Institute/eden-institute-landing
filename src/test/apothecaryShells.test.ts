/**
 * scripts/build-apothecary-shells.mjs: the per-herb /apothecary/<slug> shell.
 *
 * The invariant: a hard load of any /apothecary page carries that page's own
 * title, description and canonical in the RAW HTML (a free herb names its
 * /herbs/<slug> twin; Search Console 2026-09-28 had 86 herbs indexed twice; a
 * gated herb and an app route name themselves, 2026-10-28), the body is the SPA
 * shell untouched, and every tag the script touched carries the shell's own value
 * as data-default so useDocumentMeta restores site defaults after navigation.
 */
import { describe, expect, it } from "vitest";
import {
  buildShell,
  checkHeads,
  escapeHtml,
  reservedApothecarySegments,
} from "../../scripts/build-apothecary-shells.mjs";
import { readHeadDefaults } from "@/lib/useDocumentMeta";

const SHELL = `<!doctype html>
<html lang="en">
  <head>
    <title>The Eden Institute: A Framework Our Culture Forgot</title>
    <meta name="robots" content="index, follow" />
    <meta name="description" content="Site default description." />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="The Eden Institute: A Framework Our Culture Forgot" />
    <meta property="og:description" content="Site default og description." />
    <meta property="og:image" content="https://edeninstitute.health/og-default-realpages.jpg" />
  </head>
  <body><div id="root"></div><script type="module" src="/_spa/assets/index.js"></script></body>
</html>
`;

const AGRIMONY = {
  path: "/apothecary/agrimony",
  title: "Agrimony (Agrimonia eupatoria): Traditional Uses & Safety | Eden Apothecary",
  description:
    "Agrimony (Agrimonia eupatoria): traditional uses, preparation and safety cautions, explained plainly. Part of Eden Apothecary's free herb library.",
  canonical: "https://edeninstitute.health/apothecary/agrimony",
};
const HYSSOP = {
  path: "/apothecary/hyssop",
  title: "Hyssop (Hyssopus officinalis): Traditional Uses & Safety | Eden Apothecary",
  description:
    "Hyssop (Hyssopus officinalis): traditional uses, preparation and safety cautions, explained plainly. Part of Eden Apothecary's free herb library.",
  canonical: "https://edeninstitute.health/herbs/hyssop",
};
const PRICING = {
  path: "/apothecary/pricing",
  title: "Pricing | Eden Apothecary",
  description: "Free access to the herb directory & the Pattern quiz.",
  canonical: "https://edeninstitute.health/apothecary/pricing",
};

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("build-apothecary-shells", () => {
  const out = buildShell(SHELL, AGRIMONY);
  const doc = parse(out);

  it("a gated herb names itself as canonical and og:url in the raw HTML", () => {
    expect(doc.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(AGRIMONY.canonical);
    expect(doc.querySelector('meta[property="og:url"]')?.getAttribute("content")).toBe(AGRIMONY.canonical);
  });

  it("a free herb names its /herbs twin", () => {
    const h = parse(buildShell(SHELL, HYSSOP));
    expect(h.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("https://edeninstitute.health/herbs/hyssop");
  });

  it("carries the herb's own title and description, escaped once and read back intact", () => {
    expect(doc.title).toBe(AGRIMONY.title);
    expect(out).toContain("Traditional Uses &amp; Safety");
    expect(out).toContain("Eden Apothecary&#39;s free herb library");
    expect(doc.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(AGRIMONY.description);
    expect(doc.querySelector('meta[property="og:title"]')?.getAttribute("content")).toBe(AGRIMONY.title);
    expect(doc.querySelector('meta[property="og:description"]')?.getAttribute("content")).toBe(AGRIMONY.description);
  });

  it("an app route gets its own head too", () => {
    const r = parse(buildShell(SHELL, PRICING));
    expect(r.title).toBe("Pricing | Eden Apothecary");
    expect(r.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(PRICING.description);
  });

  it("leaves the body and every other head tag byte-identical, the real-pages share image included", () => {
    const body = (s: string) => s.slice(s.indexOf("<body>"));
    expect(body(out)).toBe(body(SHELL));
    for (const tag of [
      '<meta name="robots" content="index, follow" />',
      '<meta property="og:type" content="website" />',
      '<meta property="og:image" content="https://edeninstitute.health/og-default-realpages.jpg" />',
    ]) {
      expect(out).toContain(tag);
    }
  });

  it("records the shell's own values so useDocumentMeta restores SITE defaults", () => {
    const defaults = readHeadDefaults(doc);
    expect(defaults.title).toBe("The Eden Institute: A Framework Our Culture Forgot");
    expect(defaults.description).toBe("Site default description.");
    expect(defaults.ogTitle).toBe("The Eden Institute: A Framework Our Culture Forgot");
    expect(defaults.ogDescription).toBe("Site default og description.");
    expect(defaults.canonical).toBe("");
    expect(defaults.ogUrl).toBe("");
    expect(defaults.robots).toBe("index, follow");
  });

  it("reads the plain shell's defaults unchanged when there is no data-default", () => {
    const defaults = readHeadDefaults(parse(SHELL));
    expect(defaults.title).toBe("The Eden Institute: A Framework Our Culture Forgot");
    expect(defaults.description).toBe("Site default description.");
    expect(defaults.canonical).toBe("");
  });

  it("refuses a shell that already ships a canonical, and a canonical off the site", () => {
    const withCanonical = SHELL.replace("</head>", '<link rel="canonical" href="https://x" /></head>');
    expect(() => buildShell(withCanonical, AGRIMONY)).toThrow(/canonical/);
    expect(() => buildShell(SHELL, { ...AGRIMONY, canonical: "https://evil.example/x" })).toThrow(/outside the site/);
  });

  it("escapes the characters that would break an attribute", () => {
    expect(escapeHtml(`a & b "c" <d> 'e'`)).toBe("a &amp; b &quot;c&quot; &lt;d&gt; &#39;e&#39;");
  });

  it("checks the manifest before writing anything", () => {
    const reserved = new Set(["start", "auth", "pricing"]);
    expect(() => checkHeads({ herbs: [AGRIMONY, HYSSOP], routes: [PRICING] }, reserved)).not.toThrow();
    expect(() => checkHeads({ herbs: [], routes: [PRICING] }, reserved)).toThrow(/no herbs/);
    expect(() => checkHeads({ herbs: [{ ...AGRIMONY, path: "/apothecary/start" }], routes: [PRICING] }, reserved)).toThrow(/collides/);
    expect(() => checkHeads({ herbs: [AGRIMONY, AGRIMONY], routes: [PRICING] }, reserved)).toThrow(/two heads/);
    expect(() => checkHeads({ herbs: [{ ...AGRIMONY, description: "x".repeat(160) }], routes: [PRICING] }, reserved)).toThrow(/160 characters/);
    expect(() => checkHeads({ herbs: [{ ...AGRIMONY, path: "/apothecary/../x" }], routes: [PRICING] }, reserved)).toThrow(/bad path/);
  });

  it("knows the app's own /apothecary routes, so no herb slug can shadow one", () => {
    const reserved = reservedApothecarySegments(`
      APOTHECARY_START: "/apothecary/start",
      APOTHECARY_SIGNUP: "/apothecary/auth/signup",
      APOTHECARY_QUIZ: "/apothecary/quiz",`);
    expect([...reserved].sort()).toEqual(["auth", "quiz", "start"]);
  });
});
