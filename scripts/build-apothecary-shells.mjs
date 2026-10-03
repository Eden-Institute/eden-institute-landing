// build-apothecary-shells: give every free herb's /apothecary/:slug a head that
// names its /herbs/:slug page, in the HTML itself.
//
// WHY. The app monograph at /apothecary/:slug is served from the one SPA shell
// (dist/_spa/index.html), whose raw <head> carries the homepage title and no
// canonical. useDocumentMeta names /herbs/:slug as canonical, but only after
// JavaScript runs. Search Console, 2026-09-28: Google had indexed 86 herbs
// TWICE, /herbs/<slug> and /apothecary/<slug>, each as its own canonical, so
// every one of those herbs split its ranking across two URLs.
//
// WHAT. After both builds, for each pre-rendered dist/herbs/<slug>/index.html,
// write dist/apothecary/<slug>/index.html: a byte-for-byte copy of the SPA
// shell except for six head tags (title, description, og:title,
// og:description, plus a canonical and og:url pointing at /herbs/<slug>).
// Vercel serves a real file before the SPA rewrite, so a hard load of
// /apothecary/<slug> gets this file, and the SPA boots from it exactly as it
// does from /_spa/index.html. Nothing in <body> changes and no herb content is
// frozen into the file: the app still renders the monograph live from the DB,
// which is the objection web/lib/herbsPublic.ts raises against a static page
// at this path.
//
// Every tag this script changes or adds carries data-default="<shell value>"
// so useDocumentMeta restores the SITE defaults, not this herb's, when the
// reader navigates on to a route that sets no meta of its own.
//
// Gated herbs have no /herbs page, so they get no file and keep the plain shell
// (their canonical stays the app URL, set by useDocumentMeta).
//
// Run by `npm run build` after astro build and vite build. Fails the build on
// any surprise rather than shipping a half-patched head.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const SITE = "https://edeninstitute.health";
export const HERB_PAGE_TITLE_SUFFIX = ": Safety and Energetics | The Eden Institute";
// Same suffix HerbMonograph.tsx passes to useDocumentMeta, so the raw title and
// the rendered title agree.
export const APP_TITLE_SUFFIX = " · Monograph | Eden Apothecary";

function one(html, re, what) {
  const all = [...html.matchAll(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"))];
  if (all.length !== 1) throw new Error(`${what}: expected exactly 1 match, found ${all.length}`);
  return all[0];
}

/** Read the title and description the pre-rendered /herbs/<slug> page ships. */
export function readHerbPageHead(html, slug) {
  const title = one(html, /<title>([^<]*)<\/title>/, `/herbs/${slug} <title>`)[1];
  if (!title.endsWith(HERB_PAGE_TITLE_SUFFIX)) {
    throw new Error(`/herbs/${slug} <title> does not end with "${HERB_PAGE_TITLE_SUFFIX}": ${title}`);
  }
  const description = one(html, /<meta name="description" content="([^"]*)"/, `/herbs/${slug} description`)[1];
  return { name: title.slice(0, -HERB_PAGE_TITLE_SUFFIX.length), description };
}

/** Replace the content="" of one meta tag, recording the old value as data-default. */
function swapMetaContent(html, attr, key, content, what) {
  const re = new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`);
  const m = one(html, re, what);
  return html.replace(m[0], () => `<meta ${attr}="${key}" content="${content}" data-default="${m[1]}"`);
}

/**
 * The SPA shell with this herb's head. Values come in already HTML-escaped
 * (read out of the built /herbs page), so they are inserted as they are.
 */
export function buildShell(shell, { slug, name, description }) {
  if (/<link rel="canonical"/.test(shell) || /<meta property="og:url"/.test(shell)) {
    throw new Error("SPA shell already ships a canonical or og:url; this script assumes it does not");
  }
  const canonical = `${SITE}/herbs/${slug}`;
  const title = `${name}${APP_TITLE_SUFFIX}`;
  let html = shell;
  const t = one(html, /<title>([^<]*)<\/title>/, "shell <title>");
  html = html.replace(t[0], () => `<title data-default="${t[1]}">${title}</title>`);
  html = swapMetaContent(html, "name", "description", description, "shell description");
  html = swapMetaContent(html, "property", "og:title", title, "shell og:title");
  html = swapMetaContent(html, "property", "og:description", description, "shell og:description");
  one(html, /<\/head>/, "shell </head>");
  html = html.replace(
    "</head>",
    () =>
      `  <link rel="canonical" href="${canonical}" data-default="" />\n` +
      `    <meta property="og:url" content="${canonical}" data-default="" />\n  </head>`,
  );
  return html;
}

/** First path segments the SPA routes under /apothecary (src/lib/routes.ts). A herb slug must never take one. */
export function reservedApothecarySegments(routesSource) {
  return new Set([...routesSource.matchAll(/"\/apothecary\/([a-z0-9-]+)/g)].map((m) => m[1]));
}

export function run(root) {
  const dist = join(root, "dist");
  const shell = readFileSync(join(dist, "_spa", "index.html"), "utf8");
  const reserved = reservedApothecarySegments(readFileSync(join(root, "src", "lib", "routes.ts"), "utf8"));
  const herbsDir = join(dist, "herbs");
  const slugs = readdirSync(herbsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(herbsDir, d.name, "index.html")))
    .map((d) => d.name);
  if (slugs.length === 0) throw new Error("no pre-rendered /herbs pages found; run astro build first");
  for (const slug of slugs) {
    if (reserved.has(slug)) throw new Error(`herb slug "${slug}" collides with an /apothecary app route`);
    const head = readHerbPageHead(readFileSync(join(herbsDir, slug, "index.html"), "utf8"), slug);
    const out = join(dist, "apothecary", slug, "index.html");
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, buildShell(shell, { slug, ...head }));
  }
  return slugs.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const n = run(root);
  console.log(`build-apothecary-shells: wrote ${n} /apothecary/<slug> shells pointing at /herbs/<slug>`);
}
