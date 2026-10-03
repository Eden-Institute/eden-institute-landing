/**
 * scripts/build-apothecary-shells.mjs: the per-herb /apothecary/<slug> shell.
 *
 * The invariant: a hard load of /apothecary/<slug> for a free herb names
 * /herbs/<slug> as canonical in the RAW HTML (Search Console 2026-09-28 had 86
 * herbs indexed twice), the body is the SPA shell untouched, and every tag
 * the script touched carries the shell's own value as data-default so
 * useDocumentMeta restores site defaults, not the herb's, after navigation.
 */
import { describe, expect, it } from "vitest";
import {
  buildShell,
  readHerbPageHead,
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
    <meta property="og:image" content="https://edeninstitute.health/og-default-printset.jpg" />
  </head>
  <body><div id="root"></div><script type="module" src="/_spa/assets/index.js"></script></body>
</html>
`;

const HERB_PAGE = `<html><head><title>Hibiscus (Hibiscus sabdariffa): Safety and Energetics | The Eden Institute</title>
<meta name="description" content="Cool, moist &amp; sour: costs $5 &quot;fresh&quot;.">
<link rel="canonical" href="https://edeninstitute.health/herbs/hibiscus"></head><body></body></html>`;

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("build-apothecary-shells", () => {
  const head = readHerbPageHead(HERB_PAGE, "hibiscus");
  const out = buildShell(SHELL, { slug: "hibiscus", ...head });
  const doc = parse(out);

  it("reads the herb name and description from the /herbs page", () => {
    expect(head.name).toBe("Hibiscus (Hibiscus sabdariffa)");
    expect(head.description).toBe("Cool, moist &amp; sour: costs $5 &quot;fresh&quot;.");
  });

  it("names /herbs/<slug> as canonical and og:url in the raw HTML", () => {
    expect(doc.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      "https://edeninstitute.health/herbs/hibiscus",
    );
    expect(doc.querySelector('meta[property="og:url"]')?.getAttribute("content")).toBe(
      "https://edeninstitute.health/herbs/hibiscus",
    );
  });

  it("gives the herb's title and description, with $ and entities intact", () => {
    expect(doc.title).toBe("Hibiscus (Hibiscus sabdariffa) · Monograph | Eden Apothecary");
    expect(doc.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(
      'Cool, moist & sour: costs $5 "fresh".',
    );
    expect(doc.querySelector('meta[property="og:title"]')?.getAttribute("content")).toBe(doc.title);
  });

  it("leaves the body and every other head tag byte-identical", () => {
    const body = (s: string) => s.slice(s.indexOf("<body>"));
    expect(body(out)).toBe(body(SHELL));
    for (const tag of [
      '<meta name="robots" content="index, follow" />',
      '<meta property="og:type" content="website" />',
      '<meta property="og:image" content="https://edeninstitute.health/og-default-printset.jpg" />',
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

  it("refuses a shell that already ships a canonical", () => {
    const withCanonical = SHELL.replace("</head>", '<link rel="canonical" href="https://x" /></head>');
    expect(() => buildShell(withCanonical, { slug: "hibiscus", ...head })).toThrow(/canonical/);
  });

  it("refuses a /herbs page whose title format changed", () => {
    expect(() => readHerbPageHead(HERB_PAGE.replace("Safety and Energetics", "Energetics"), "hibiscus")).toThrow(/does not end/);
  });

  it("knows the app's own /apothecary routes, so no herb slug can shadow one", () => {
    const reserved = reservedApothecarySegments(`
      APOTHECARY_START: "/apothecary/start",
      APOTHECARY_SIGNUP: "/apothecary/auth/signup",
      APOTHECARY_QUIZ: "/apothecary/quiz",`);
    expect([...reserved].sort()).toEqual(["auth", "quiz", "start"]);
  });
});
