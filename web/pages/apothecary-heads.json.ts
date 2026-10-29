/**
 * /apothecary-heads.json - build input only, deleted from dist/ by
 * scripts/build-apothecary-shells.mjs once it has written the heads.
 *
 * The head every /apothecary page should carry in its raw HTML (2026-10-28,
 * analytics and search developer prompt, task 13): one entry per herb in the
 * directory, free and gated alike, plus the public app routes. Built here, in
 * TypeScript, from the same helpers the pages use (src/lib/monographMeta.ts,
 * src/lib/herbLinks.ts, src/lib/apothecaryRouteMeta.ts), so the build script
 * never re-implements a title rule and the raw head can never disagree with the
 * one the app sets once it runs.
 *
 *   canonical  a free herb names its pre-rendered /herbs/<slug> twin; a gated
 *              herb names itself (herbCanonicalUrl, the app page's own rule)
 */
import type { APIRoute } from "astro";
import { getHerbRoster } from "../lib/herbsPublic";
import { herbCanonicalUrl, herbParam } from "@/lib/herbLinks";
import { monographDescription, monographTitle } from "@/lib/monographMeta";
import { APOTHECARY_PUBLIC_ROUTES } from "@/lib/apothecaryRouteMeta";

export interface ApothecaryHead {
  /** Path under the site root, no trailing slash: "/apothecary/agrimony". */
  path: string;
  title: string;
  description: string;
  canonical: string;
}

export const GET: APIRoute = async () => {
  const roster = await getHerbRoster();
  const herbs: ApothecaryHead[] = roster.map((h) => ({
    path: `/apothecary/${herbParam(h)}`,
    title: monographTitle(h),
    description: monographDescription(h),
    canonical: herbCanonicalUrl(h),
  }));
  const routes: ApothecaryHead[] = APOTHECARY_PUBLIC_ROUTES.map(({ path, title, description, canonical }) => ({
    path,
    title,
    description,
    canonical,
  }));
  return new Response(JSON.stringify({ herbs, routes }), {
    headers: { "Content-Type": "application/json" },
  });
};
