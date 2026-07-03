/**
 * herbLinks — slug helpers for the public herb monograph route
 * (/apothecary/:herbId, CRO Phase 1).
 *
 * herb_id in the DB is an H-code (H001..H108), not a slug. Monograph URLs
 * use a slug derived from common_name ("Marshmallow" → "marshmallow",
 * "Bacopa (Brahmi)" → "bacopa-brahmi") because those are the URLs people
 * share and read. Derived slugs are verified unique across all 108 rows
 * (live audit 2026-07-01) and contain no dot+extension sequences, so the
 * vercel.json SPA rewrite always serves them.
 *
 * The route accepts BOTH forms: findHerbByParam matches the H-code first
 * (exact, case-insensitive), then the slug. If a common_name is ever
 * renamed, old slug links degrade to the monograph not-found state (which
 * links back to the directory) rather than breaking the router.
 */

/**
 * Display aliases: authored content sometimes names a preparation of a
 * plant the DB carries under a different common_name (one monograph per
 * plant). The monograph header surfaces these so a reader who clicked
 * "Milky Oats" isn't confused to land on "Oat Straw" (both Avena sativa).
 * Keyed by the DB-derived slug.
 */
export const HERB_ALIASES: Record<string, string[]> = {
  "oat-straw": ["Milky Oats"],
};

export function herbSlug(commonName: string): string {
  return commonName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export interface HerbLinkable {
  herb_id: string | null;
  common_name: string | null;
}

/** Canonical monograph path segment for a directory row (slug preferred). */
export function herbParam(herb: HerbLinkable): string {
  if (herb.common_name) return herbSlug(herb.common_name);
  return herb.herb_id ?? "";
}

/**
 * Resolve a :herbId route param against the loaded directory. Accepts the
 * H-code or the common-name slug, case-insensitively. Returns undefined
 * for unknown params (including typo'd static paths the dynamic segment
 * swallows, e.g. /apothecary/pricng) — the page renders not-found.
 */
export function findHerbByParam<T extends HerbLinkable>(
  herbs: T[],
  param: string | undefined,
): T | undefined {
  if (!param) return undefined;
  const needle = param.toLowerCase();
  return herbs.find(
    (h) =>
      h.herb_id?.toLowerCase() === needle ||
      (h.common_name !== null && herbSlug(h.common_name) === needle),
  );
}
