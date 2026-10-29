// build-apothecary-shells: give every /apothecary page its own head in the HTML itself.
//
// WHY. The app at /apothecary/* is served from the one SPA shell
// (dist/_spa/index.html), whose raw <head> carries the site's default title, the
// publisher description and no canonical. useDocumentMeta sets the real head, but
// only after JavaScript runs, so anything that reads the raw HTML (Facebook and
// Pinterest link previews, and any crawler that does not render) saw "The Eden
// Institute: A Framework Our Culture Forgot" on every herb. Search Console,
// 2026-09-28, also had 86 herbs indexed TWICE, /herbs/<slug> and /apothecary/<slug>.
//
// WHAT. After both builds, for every entry in dist/apothecary-heads.json (built by
// web/pages/apothecary-heads.json.ts from the same helpers the pages use), write
// dist/<path>/index.html: a byte-for-byte copy of the SPA shell except for its
// head tags (title, description, og:title, og:description, plus a canonical and
// og:url). That covers:
//   - every herb in the directory (2026-10-28; until then only the free ones):
//     the monograph title and description templates (src/lib/monographMeta.ts),
//     canonical = the /herbs/<slug> twin for a free herb, itself for a gated one
//   - the public app routes: /apothecary, /apothecary/pricing, /apothecary/start
// The share image is the shell's own og:image, the real-pages card
// (og-default-realpages.jpg), never an AI image.
//
// Vercel serves a real file before the SPA rewrite, so a hard load gets this file,
// and the SPA boots from it exactly as it does from /_spa/index.html. Nothing in
// <body> changes and no herb content is frozen into the file: the app still renders
// the page live from the DB, which is the objection web/lib/herbsPublic.ts raises
// against a static page at this path.
//
// Every tag this script changes or adds carries data-default="<shell value>" so
// useDocumentMeta restores the SITE defaults, not this page's, when the reader
// navigates on to a route that sets no meta of its own.
//
// Run by `npm run build` after astro build and vite build. Fails the build on any
// surprise rather than shipping a half-patched head. Deletes the manifest when done,
// so it is never served.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const SITE = "https://edeninstitute.health";
export const MANIFEST = "apothecary-heads.json";
/** The monograph description template stays under 160 characters (src/lib/monographMeta.ts). */
export const MAX_DESCRIPTION = 159;

function one(html, re, what) {
  const all = [...html.matchAll(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"))];
  if (all.length !== 1) throw new Error(`${what}: expected exactly 1 match, found ${all.length}`);
  return all[0];
}

/** Text for an HTML attribute or <title>: the five characters that matter, escaped. */
export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Replace the content="" of one meta tag, recording the old value as data-default. */
function swapMetaContent(html, attr, key, content, what) {
  const re = new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`);
  const m = one(html, re, what);
  return html.replace(m[0], () => `<meta ${attr}="${key}" content="${content}" data-default="${m[1]}"`);
}

/** The SPA shell with this page's head. Values are raw text; they are escaped here. */
export function buildShell(shell, { title, description, canonical }) {
  if (/<link rel="canonical"/.test(shell) || /<meta property="og:url"/.test(shell)) {
    throw new Error("SPA shell already ships a canonical or og:url; this script assumes it does not");
  }
  if (!canonical.startsWith(`${SITE}/`)) throw new Error(`canonical outside the site: ${canonical}`);
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const c = escapeHtml(canonical);
  let html = shell;
  const tm = one(html, /<title>([^<]*)<\/title>/, "shell <title>");
  html = html.replace(tm[0], () => `<title data-default="${tm[1]}">${t}</title>`);
  html = swapMetaContent(html, "name", "description", d, "shell description");
  html = swapMetaContent(html, "property", "og:title", t, "shell og:title");
  html = swapMetaContent(html, "property", "og:description", d, "shell og:description");
  one(html, /<\/head>/, "shell </head>");
  html = html.replace(
    "</head>",
    () =>
      `  <link rel="canonical" href="${c}" data-default="" />\n` +
      `    <meta property="og:url" content="${c}" data-default="" />\n  </head>`,
  );
  return html;
}

/** First path segments the SPA routes under /apothecary (src/lib/routes.ts). A herb slug must never take one. */
export function reservedApothecarySegments(routesSource) {
  return new Set([...routesSource.matchAll(/"\/apothecary\/([a-z0-9-]+)/g)].map((m) => m[1]));
}

/** Throws on anything a head must not ship with. */
export function checkHeads({ herbs, routes }, reserved) {
  if (!Array.isArray(herbs) || herbs.length === 0) throw new Error(`${MANIFEST}: no herbs; run astro build first`);
  if (!Array.isArray(routes) || routes.length === 0) throw new Error(`${MANIFEST}: no app routes`);
  const seen = new Set();
  for (const h of [...herbs, ...routes]) {
    if (!/^\/apothecary(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?$/.test(h.path)) throw new Error(`bad path: ${h.path}`);
    if (seen.has(h.path)) throw new Error(`two heads for ${h.path}`);
    seen.add(h.path);
    if (!h.title?.trim() || !h.description?.trim()) throw new Error(`${h.path}: empty title or description`);
  }
  for (const h of herbs) {
    const slug = h.path.slice("/apothecary/".length);
    if (reserved.has(slug)) throw new Error(`herb slug "${slug}" collides with an /apothecary app route`);
    if (h.description.length > MAX_DESCRIPTION) {
      throw new Error(`${h.path}: description is ${h.description.length} characters (max ${MAX_DESCRIPTION})`);
    }
  }
}

export function run(root) {
  const dist = join(root, "dist");
  const manifestPath = join(dist, MANIFEST);
  if (!existsSync(manifestPath)) throw new Error(`dist/${MANIFEST} is missing; run astro build first`);
  const heads = JSON.parse(readFileSync(manifestPath, "utf8"));
  const shell = readFileSync(join(dist, "_spa", "index.html"), "utf8");
  const reserved = reservedApothecarySegments(readFileSync(join(root, "src", "lib", "routes.ts"), "utf8"));
  checkHeads(heads, reserved);
  for (const h of [...heads.herbs, ...heads.routes]) {
    const out = join(dist, ...h.path.split("/").filter(Boolean), "index.html");
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, buildShell(shell, h));
  }
  rmSync(manifestPath);
  return { herbs: heads.herbs.length, routes: heads.routes.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const n = run(root);
  console.log(`build-apothecary-shells: wrote ${n.herbs} herb heads and ${n.routes} app route heads under /apothecary`);
}
