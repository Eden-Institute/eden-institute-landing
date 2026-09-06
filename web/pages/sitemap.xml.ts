/**
 * /sitemap.xml - generated at build from the pages that actually render.
 *
 * WHY THIS REPLACED public/sitemap.xml
 *
 * The hand-maintained file listed 22 URLs. Fetched from the live site on
 * 2026-09-05, THIRTEEN of them returned the same 4,693-byte SPA shell with the
 * site-wide default <title> and no page content: /assessment, /apothecary,
 * /apothecary/start, /apothecary/pricing, /tier-2-waitlist, /terms and the
 * eight /results/* pages. Meanwhile the four pre-rendered pages that carry
 * revenue - /starter, /freebies, /preorder, /homeschool/herbs - were not
 * listed at all, and neither was a single herb monograph.
 *
 * Handing a crawler a dozen near-identical empty pages is not a neutral act;
 * it is a duplicate-content signal against the whole domain. This endpoint
 * lists only URLs that serve real, pre-rendered HTML, and it grows itself: a
 * new herb row appears here on the next build with nothing to remember.
 *
 * The /results/* pages ARE listed now, because this branch pre-renders them.
 *
 * Still deliberately absent, because they remain client-rendered shells:
 * /assessment, /apothecary/*, /tier-2-waitlist, /terms, /privacy, /cookies.
 * Excluding them advertises nothing false; it does not deindex anything.
 * Pre-rendering /assessment is the obvious next one to fix - it is the quiz
 * entry point and the highest-intent page on the site.
 *
 * No <lastmod>: the old file claimed 2026-04-30 for every URL, four months
 * stale. Stamping the build date instead would make it change on every deploy
 * whether or not the content did. An omitted lastmod is honest; a wrong one
 * teaches a crawler to ignore the field.
 */
import type { APIRoute } from "astro";
import { herbParam } from "@/lib/herbLinks";
import { CONSTITUTION_MAP } from "@/lib/constitution-utils";
import { constitutionProfiles } from "@/lib/constitution-data";
import { getPublicHerbs } from "../lib/herbsPublic";

const ORIGIN = "https://edeninstitute.health";

/**
 * Pre-rendered marketing pages, kept in step with web/pages/*.astro by hand.
 *
 * Excluded on purpose:
 *   /partner-sample       - link-only, noindex, and Disallow-ed in robots.txt
 *   /starter/downloads    - post-purchase delivery surface
 *   /starter/thank-you    - post-purchase confirmation
 */
const STATIC_PATHS = [
  "/",
  "/why-eden",
  "/constitutional-herbalism",
  "/courses",
  "/homeschool",
  "/homeschool/herbs",
  "/community",
  "/freebies",
  "/preorder",
  "/starter",
  "/contact",
  "/returns",
  "/herbs",
];

export const GET: APIRoute = async () => {
  const herbs = await getPublicHerbs();

  const patternPaths = Object.entries(CONSTITUTION_MAP)
    .filter(([type]) => !!constitutionProfiles[type])
    .map(([, { slug }]) => `/results/${slug}`);

  const herbPaths = herbs.map((herb) => `/herbs/${herbParam(herb)}`);

  const urls = [...STATIC_PATHS, ...patternPaths, ...herbPaths];

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((path) => `  <url><loc>${ORIGIN}${path}</loc></url>`),
    "</urlset>",
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
