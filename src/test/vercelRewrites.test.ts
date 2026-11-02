/**
 * vercel.json sends ONLY the SPA's own routes to the SPA shell.
 *
 * Until this test, one rewrite sent every path without a file extension to
 * /_spa/index.html, so a mistyped or retired URL answered HTTP 200 with the
 * homepage head and "index, follow". Now each SPA route has its own rewrite and
 * anything else is a real 404 (web/pages/404.astro, built to dist/404.html).
 *
 * The risk that trade brings is a NEW SPA route that nobody adds to vercel.json:
 * it would work in the dev server and on client-side navigation, and 404 on a
 * hard load or an emailed link. The first block makes that impossible to merge.
 *
 * The model of Vercel's matching lives in ./vercelRouting.ts (path-to-regexp 6,
 * case-sensitive and strict, the way @vercel/routing-utils compiles a source).
 * The filesystem here is the source tree: pages with a fixed path in web/pages
 * and files in public/. Pages built from data (web/pages/**\/[slug].astro) are
 * decided by the build, so for those the table only proves that no redirect or
 * rewrite claims the path.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import vercelJsonRaw from "../../vercel.json?raw";
import { ROUTES } from "@/lib/routes";
import { route, sourceMatches, sourceToRegExp, type VercelConfig } from "./vercelRouting";

const ROOT = join(__dirname, "..", "..");
const PAGES = join(ROOT, "web", "pages");
const PUBLIC = join(ROOT, "public");
const SPA_SHELL = "/_spa/index.html";

const config = JSON.parse(vercelJsonRaw) as VercelConfig;
const spaRewrites = (config.rewrites ?? []).filter((r) => r.destination === SPA_SHELL);

/**
 * Does `rel` (a "/"-separated path under `dir`) exist with exactly this
 * spelling? Vercel's filesystem is case-sensitive; Windows and macOS disks
 * usually are not, so existsSync alone would find "LEARN" for "learn".
 */
function exactly(dir: string, rel: string, kind: "file" | "dir"): boolean {
  let here = dir;
  for (const part of rel.split("/").filter(Boolean)) {
    if (!existsSync(here) || !statSync(here).isDirectory() || !readdirSync(here).includes(part)) return false;
    here = join(here, part);
  }
  return kind === "file" ? statSync(here).isFile() : statSync(here).isDirectory();
}

/**
 * The source file that a build turns into the file Vercel serves at `pathname`,
 * or null. Fixed-path pages and public/ files only. 404.astro builds to
 * dist/404.html, which Vercel serves for misses, not at /404.
 */
function sourceFileFor(pathname: string): string | null {
  if (pathname === SPA_SHELL) return "index.html";
  if (exactly(PUBLIC, pathname, "file")) return `public${pathname}`;
  const clean = pathname.replace(/\/$/, "");
  const base = clean === "" ? "index" : clean.slice(1);
  if (base === "404") return null;
  for (const candidate of [`${base}.astro`, `${base}/index.astro`, `${base}.ts`]) {
    if (exactly(PAGES, candidate, "file")) return `web/pages/${candidate}`;
  }
  return null;
}

/** The page built from data that could serve `pathname`, e.g. web/pages/herbs/[slug].astro. */
function dataPageFor(pathname: string): string | null {
  const parts = pathname.replace(/\/$/, "").split("/").filter(Boolean);
  if (parts.length === 0) return null;
  const parent = parts.slice(0, -1).join("/");
  if (parent && !exactly(PAGES, parent, "dir")) return null;
  const dynamic = readdirSync(join(PAGES, ...parts.slice(0, -1))).find((f) => /^\[[^\]]+\]\.astro$/.test(f));
  return dynamic ? `web/pages/${[...parts.slice(0, -1), dynamic].join("/")}` : null;
}

const resolve = (url: string, host?: string) => route(config, url, sourceFileFor, host);

// ── The routes registered in src/App.tsx ────────────────────────────────────

const appSource = readFileSync(join(ROOT, "src", "App.tsx"), "utf8");

/** Evaluate one <Route path={...}> expression against the real ROUTES table. */
function evalRoutePath(expr: string): string {
  const child = expr.match(/^childPath\((.+)\)$/);
  if (child) return evalRoutePath(child[1].trim()); // the browser asks for the full path
  const m = expr.match(/^ROUTES\.([A-Z_]+)(?:\("([^"]*)"\))?$/);
  if (!m) throw new Error(`App.tsx route path this test cannot read: {${expr}}. Teach evalRoutePath the new form.`);
  const value = (ROUTES as Record<string, unknown>)[m[1]];
  if (m[2] !== undefined) {
    if (typeof value !== "function") throw new Error(`ROUTES.${m[1]} is not a function`);
    return (value as (s: string) => string)(m[2]);
  }
  if (typeof value !== "string") throw new Error(`ROUTES.${m[1]} is not a string`);
  return value;
}

const appRoutes = [...appSource.matchAll(/<Route\s[^>]*?path=\{([^}]*)\}/g)].map((m) => evalRoutePath(m[1].trim()));

/** A path a browser could ask for under this route: each :param filled with a realistic slug. */
const concrete = (routePath: string) => routePath.replace(/:[A-Za-z]+/g, "sample-slug-1");

/** Served by an Astro page, not the SPA, even though App.tsx registers it (HomeRedirect). */
const SERVED_BY_ASTRO: Record<string, string> = { "/": "web/pages/index.astro" };

describe("every App.tsx route has a vercel.json rewrite", () => {
  it("reads the route table (a check that reads nothing must not pass)", () => {
    expect(appRoutes.length).toBeGreaterThanOrEqual(20);
    expect(appRoutes).toContain("/apothecary/:herbId");
    expect(appRoutes).toContain("/guide/:constitutionSlug");
    expect(spaRewrites.length).toBeGreaterThanOrEqual(3);
  });

  it("the nested Apothecary index route is the /apothecary path itself", () => {
    // <Route index> has no path prop; it renders at its parent, ROUTES.APOTHECARY.
    expect(appSource).toMatch(/<Route path=\{ROUTES\.APOTHECARY\} element=\{<ApothecaryLayout \/>\}>/);
    expect(appSource.match(/<Route index /g)).toHaveLength(1);
    expect(appRoutes).toContain(ROUTES.APOTHECARY);
  });

  for (const routePath of [...new Set(appRoutes)]) {
    it(`${routePath} reaches the SPA shell on a hard load; its trailing-slash form redirects there`, () => {
      if (routePath in SERVED_BY_ASTRO) {
        expect(exactly(ROOT, SERVED_BY_ASTRO[routePath], "file")).toBe(true);
        expect(resolve(routePath)).toEqual({ kind: "file", file: SERVED_BY_ASTRO[routePath] });
        return;
      }
      const url = concrete(routePath);
      // A pre-rendered file is fine too (Vercel serves it first), but no App
      // route has a fixed-path Astro page today; if one appears, say so here.
      expect(resolve(url), `${url}: add a rewrite to ${SPA_SHELL} in vercel.json`).toMatchObject({
        kind: "rewrite",
        destination: SPA_SHELL,
      });
      // One address per page (vercel.json "trailingSlash": false).
      expect(resolve(`${url}/`)).toMatchObject({ kind: "redirect", status: 308, location: url });
    });
  }

  it("every SPA rewrite serves at least one App.tsx route (no leftover catch-all)", () => {
    const samples = appRoutes.flatMap((p) => [concrete(p), `${concrete(p)}/`]);
    for (const r of spaRewrites) {
      expect(samples.some((s) => sourceMatches(r.source, s)), r.source).toBe(true);
    }
  });

  it("only sends the SPA shell or an /api function as a rewrite destination", () => {
    for (const r of config.rewrites ?? []) {
      expect(r.destination === SPA_SHELL || r.destination.startsWith("/api/"), r.source).toBe(true);
    }
  });
});

// ── What a request gets: must-serve and must-404 examples ───────────────────

/** SPA routes, as people and emails actually reach them. */
const SPA = [
  "/assessment",
  "/quiz",
  "/founder",
  "/practitioner",
  "/homeschool/welcome",
  "/homeschool/welcome?session_id=cs_test_123&lookup_key=sprouts_complete",
  "/guide/success",
  "/guide/frozen-knot",
  "/guide/frozen-knot?access=abc123",
  // dist/results/<slug>/index.html wins over this rewrite for the 8 Patterns;
  // the rewrite catches the rest, where Results renders its noindex not-found.
  "/results/frozen-knot",
  "/results/not-a-pattern",
  "/apothecary",
  "/apothecary/start",
  "/apothecary/pricing",
  "/apothecary/auth/signup",
  "/apothecary/auth/signin",
  "/apothecary/auth/reset",
  "/apothecary/auth/update-password",
  "/apothecary/welcome-tour",
  "/apothecary/welcome",
  "/apothecary/account",
  "/apothecary/profiles",
  "/apothecary/favorites",
  "/apothecary/quiz",
  // Gated herbs have no /herbs page and no pre-built shell: the rewrite serves them.
  "/apothecary/agrimony",
  "/apothecary/oat-straw",
  "/apothecary/horsetail",
  "/apothecary/H036",
  // Free herbs get dist/apothecary/<slug>/index.html, which wins over the rewrite.
  "/apothecary/chamomile",
  // Unknown herb: still the SPA (the :herbId route), which renders a noindex not-found.
  "/apothecary/not-a-real-herb-xyz",
];

const REDIRECTS: [string, number, string][] = [
  ["/Homeschool", 308, "/homeschool"],
  ["/app", 308, "/apothecary"],
  ["/app/pricing", 308, "/apothecary/pricing"],
  ["/q/lavender", 307, "/?utm_source=stillroom&utm_medium=qr&utm_campaign=makers-wall&utm_content=lavender"],
  ["/s/lavender", 307, "/?utm_source=stillroom&utm_medium=label-url&utm_campaign=makers-wall&utm_content=lavender"],
  ["/preorder", 307, "/books"],
  ["/sprouts-founders.html", 307, "/books"],
  ["/go/deep-dive/frozen-knot", 307, "https://noeqztssupewjidpvhar.supabase.co/functions/v1/guide-checkout?slug=frozen-knot"],
  ["/preorder-response?token=abc", 307, "https://noeqztssupewjidpvhar.supabase.co/functions/v1/preorder-response?token=abc"],
  ["/partner-sample/KEY123", 307, "/partner-sample?k=KEY123"],
  ["/partner-sample/KEY123/extra", 307, "/partner-sample?k=KEY123"],
  ["/Partner-Sample", 307, "/partner-sample"],
  ["/starter/downloads/extra", 307, "/starter/downloads"],
  ["/Starter/Downloads", 307, "/starter/downloads"],
  ["/back-to-eden/download/extra", 307, "/back-to-eden/download"],
  ["/Back-To-Eden/Download", 307, "/back-to-eden/download"],
];

/**
 * Retired adult-course pages (PR #630): they redirect to the book page. Status
 * is not pinned here because the move from temporary to permanent ships in its
 * own PR; where they land is what matters.
 */
const RETIRED: [string, string][] = [
  ["/courses", "/back-to-eden"],
  ["/tier-2-waitlist", "/back-to-eden"],
];

/**
 * One address per page: vercel.json "trailingSlash": false answers every
 * /path/ with a 308 to /path before any other rule, keeping the query.
 */
const TRAILING: [string, string][] = [
  ["/homeschool/", "/homeschool"],
  ["/learn/is-herbalism-biblical/", "/learn/is-herbalism-biblical"],
  ["/assessment/", "/assessment"],
  ["/apothecary/", "/apothecary"],
  ["/apothecary/auth/update-password/", "/apothecary/auth/update-password"],
  ["/homeschool/welcome/?session_id=cs_test_123", "/homeschool/welcome?session_id=cs_test_123"],
  ["/courses/", "/courses"],
];

/** Other domains pointed at this project: [host, path, status, location]. */
const HOST_REDIRECTS: [string, string, number, string][] = [
  ["talesandtabletalk.com", "/", 301, "https://ultimateradioshow.com/tales-and-table-talk/"],
  ["talesandtabletalk.com", "/episode-1", 301, "https://ultimateradioshow.com/tales-and-table-talk/"],
  ["www.talesandtabletalk.com", "/", 301, "https://ultimateradioshow.com/tales-and-table-talk/"],
  // The retired LearnWorlds school (DNS removed 10/14): every path to the book page.
  ["learn.edeninstitute.health", "/", 301, "https://edeninstitute.health/back-to-eden"],
  ["learn.edeninstitute.health", "/about", 301, "https://edeninstitute.health/back-to-eden"],
];

/** Served by a file whose path is fixed in the source tree. */
const FILES: [string, string][] = [
  ["/", "web/pages/index.astro"],
  ["/homeschool", "web/pages/homeschool.astro"],
  ["/homeschool/scope-and-sequence", "web/pages/homeschool/scope-and-sequence.astro"],
  ["/why-eden", "web/pages/why-eden.astro"],
  ["/learn", "web/pages/learn/index.astro"],
  ["/herbs", "web/pages/herbs/index.astro"],
  ["/esa", "web/pages/esa/index.astro"],
  ["/books", "web/pages/books.astro"],
  ["/books/thank-you", "web/pages/books/thank-you.astro"],
  ["/starter", "web/pages/starter.astro"],
  ["/starter/seedlings", "web/pages/starter/seedlings.astro"],
  ["/starter/downloads", "web/pages/starter/downloads.astro"],
  ["/starter/thank-you", "web/pages/starter/thank-you.astro"],
  ["/back-to-eden/download", "web/pages/back-to-eden/download.astro"],
  ["/partner-sample", "web/pages/partner-sample.astro"],
  ["/preorder-response?state=yes", "web/pages/preorder-response.astro"],
  ["/unsubscribe?token=abc", "web/pages/unsubscribe.astro"],
  ["/curriculum", "web/pages/curriculum.astro"],
  ["/sitemap.xml", "web/pages/sitemap.xml.ts"],
  ["/robots.txt", "public/robots.txt"],
  ["/llms.txt", "public/llms.txt"],
  ["/favicon.ico", "public/favicon.ico"],
  ["/og-default-printset.jpg", "public/og-default-printset.jpg"],
  ["/_spa/index.html", "index.html"],
];

/** Built from data by a [slug].astro page: a file when the data has the slug, a 404 when not. The build decides. */
const DATA_PAGES = [
  "/herbs/chamomile",
  "/herbs/not-a-real-herb-xyz",
  "/learn/is-herbalism-biblical",
  "/learn/this-page-does-not-exist-xyz",
  "/esa/arizona",
  "/homeschool/kindergarten",
  "/homeschool/seedlings",
];

/** Nothing serves these: HTTP 404. */
const NOT_FOUND = [
  "/this-does-not-exist-xyz",
  "/LEARN/is-herbalism-biblical",
  "/Assessment",
  "/APOTHECARY",
  "/starter/sprouts",
  "/guide",
  "/results",
  "/assessment/extra",
  "/homeschool/welcome/extra",
  "/founders",
  "/apothecary/chamomile/extra",
  "/apothecary/auth/unknown",
  "/apothecary/not-a-real-herb.png",
  "/guide/frozen-knot.pdf",
  "/wp-login.php",
  "/index.php",
  "/404",
];

describe("vercel.json routing, example table", () => {
  for (const url of SPA) {
    it(`${url} -> SPA shell`, () => {
      expect(resolve(url)).toMatchObject({ kind: "rewrite", destination: SPA_SHELL });
    });
  }

  for (const [url, status, location] of REDIRECTS) {
    it(`${url} -> ${status} ${location}`, () => {
      expect(resolve(url)).toMatchObject({ kind: "redirect", status, location });
    });
  }

  for (const [url, location] of TRAILING) {
    it(`${url} -> 308 ${location}`, () => {
      expect(resolve(url)).toMatchObject({ kind: "redirect", status: 308, location });
    });
  }

  it("the site root keeps its slash", () => {
    expect(resolve("/")).toEqual({ kind: "file", file: "web/pages/index.astro" });
  });

  for (const [url, location] of RETIRED) {
    it(`${url} -> redirect to ${location}`, () => {
      expect(resolve(url)).toMatchObject({ kind: "redirect", location });
    });
  }

  for (const [host, url, status, location] of HOST_REDIRECTS) {
    it(`${host}${url} -> ${status} ${location}`, () => {
      expect(resolve(url, host)).toMatchObject({ kind: "redirect", status, location });
    });
  }

  it("/go/course -> the /api/go/course function", () => {
    expect(resolve("/go/course")).toMatchObject({ kind: "rewrite", destination: "/api/go/course" });
  });

  for (const [url, file] of FILES) {
    it(`${url} -> ${file}`, () => {
      expect(resolve(url)).toEqual({ kind: "file", file });
    });
  }

  for (const url of DATA_PAGES) {
    it(`${url} -> no redirect or rewrite; a data-built page or 404`, () => {
      expect(resolve(url)).toEqual({ kind: "404" });
      expect(dataPageFor(url), url).not.toBeNull();
    });
  }

  for (const url of NOT_FOUND) {
    it(`${url} -> 404`, () => {
      expect(resolve(url)).toEqual({ kind: "404" });
      expect(dataPageFor(url), url).toBeNull();
    });
  }

  it("the 404 page exists and stays out of the index", () => {
    const source = readFileSync(join(PAGES, "404.astro"), "utf8");
    expect(source).toMatch(/<MarketingLayout[\s\S]*?noindex=\{true\}[\s\S]*?>/);
    expect(source).not.toMatch(/canonical=/);
  });
});

describe("the path-to-regexp model", () => {
  it("compiles the way @vercel/routing-utils does: case-sensitive, strict, custom patterns as written", () => {
    expect(sourceToRegExp("/Homeschool").re.source).toBe("^\\/Homeschool$");
    expect(sourceToRegExp("/app/:path*").re.source).toBe("^\\/app(?:\\/((?:[^\\/]+?)(?:\\/(?:[^\\/]+?))*))?$");
    expect(sourceToRegExp("/q/:slug([a-z0-9-]+)").re.source).toBe("^\\/q(?:\\/([a-z0-9-]+))$");
    expect(sourceMatches("/Homeschool", "/homeschool")).toBe(false);
    expect(sourceMatches("/preorder", "/preorder/")).toBe(false);
    expect(sourceMatches("/app/:path*", "/app")).toBe(true);
    expect(sourceMatches("/app/:path*", "/app/a/b")).toBe(true);
  });

  it("rejects what path-to-regexp rejects", () => {
    expect(() => sourceToRegExp("/(a(b))")).toThrow(/Capturing groups/);
    expect(() => sourceToRegExp("/(?:a)")).toThrow(/cannot start with/);
    expect(() => sourceToRegExp("/a/?")).toThrow(/Unexpected MODIFIER/);
  });

  it("every source in vercel.json compiles", () => {
    for (const r of [...(config.redirects ?? []), ...(config.rewrites ?? [])]) {
      expect(() => sourceToRegExp(r.source), r.source).not.toThrow();
    }
  });
});
