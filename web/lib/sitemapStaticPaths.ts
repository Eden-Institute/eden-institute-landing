/**
 * Pre-rendered marketing pages listed in /sitemap.xml (web/pages/sitemap.xml.ts),
 * kept in step with web/pages/*.astro by hand. src/test/sitemapStaticPaths.test.ts
 * (npm test) fails when an indexable page is missing from this list or a listed
 * page no longer exists or has gone noindex.
 *
 * Dynamic routes (/esa/[state], /results/[slug], /herbs/[slug]) are not listed
 * here; the sitemap endpoint generates those from data.
 *
 * Excluded on purpose (all noindex):
 *   /partner-sample       - link-only, noindex (on purpose NOT Disallow-ed in
 *                           robots.txt, or crawlers could never read the noindex)
 *   /curriculum           - link-only, noindex
 *   /preorder             - page removed 2026-09-24, redirects to /books (vercel.json)
 *   /books/thank-you      - post-purchase confirmation
 *   /starter/downloads    - post-purchase delivery surface
 *   /starter/thank-you    - post-purchase confirmation
 *   /starter/seedlings/thank-you - post-purchase confirmation (Seedlings)
 */
export const STATIC_PATHS: readonly string[] = [
  "/",
  "/why-eden",
  "/constitutional-herbalism",
  "/courses",
  "/homeschool",
  "/homeschool/herbs",
  "/homeschool/updates",
  "/community",
  "/freebies",
  "/books",
  "/starter",
  "/starter/seedlings",
  "/contact",
  "/returns",
  "/terms",
  "/privacy",
  "/cookies",
  "/herbs",
  "/esa",
  "/tales-and-table-talk",
];
