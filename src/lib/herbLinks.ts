/**
 * herbLinks — slug helpers for the public herb monograph route
 * (/apothecary/:herbId, CRO Phase 1).
 *
 * herb_id in the DB is an H-code (H001..H300), not a slug. Monograph URLs
 * use a slug derived from common_name ("Marshmallow" → "marshmallow",
 * "Bacopa (Brahmi)" → "bacopa-brahmi") because those are the URLs people
 * share and read. Derived slugs are verified unique across all 300 rows
 * (live audits 2026-07-01 at 108 rows and 2026-09-14 at 300 rows) and contain no dot+extension sequences, so the
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

function herbSlug(commonName: string): string {
  return commonName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export interface HerbLinkable {
  herb_id: string | null;
  common_name: string | null;
  tier_visibility?: string | null;
}

/** Canonical monograph path segment for a directory row (slug preferred). */
export function herbParam(herb: HerbLinkable): string {
  if (herb.common_name) return herbSlug(herb.common_name);
  return herb.herb_id ?? "";
}

/** Absolute canonical URL for an herb. Free-tier rows have a pre-rendered
 *  /herbs/:slug page (PR #454), which is the SEO surface; gated rows exist
 *  only in the app, so they canonicalize to /apothecary/:param. Keyed on
 *  tier_visibility (the herbs_public predicate), never is_locked, which the
 *  view sets false for every row when the caller is Seed+. */
export function herbCanonicalUrl(herb: HerbLinkable): string {
  const hasStaticPage =
    !!herb.common_name &&
    (herb.tier_visibility === "free" || herb.tier_visibility == null);
  return hasStaticPage
    ? `https://edeninstitute.health/herbs/${herbParam(herb)}`
    : `https://edeninstitute.health/apothecary/${herbParam(herb)}`;
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

/** Every slug herbSlug can produce, and every H-code, has this shape. */
const PARAM_SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * A PostgREST `or` filter that returns every herbs_directory_v row
 * findHerbByParam could match for this param, so the one-herb page can read
 * one or two rows instead of the whole view. findHerbByParam still makes the
 * final choice over what comes back.
 *
 *  - herb_id ilike the param, no wildcards: the case-insensitive H-code match.
 *  - common_name ilike the slug's words joined by wildcards, anchored at the
 *    start: "bacopa-brahmi" -> bacopa*brahmi* matches "Bacopa (Brahmi)". Every
 *    common_name starts with a letter or digit (all 299, checked 2026-10-03),
 *    so its slug starts with the same word. At most two rows match any real
 *    slug today.
 *
 * Returns null when the param cannot be any herb's slug or H-code (anything
 * outside [a-z0-9-]). That also keeps raw URL text out of the filter string.
 */
export function herbParamOrFilter(param: string | undefined): string | null {
  if (!param) return null;
  const needle = param.toLowerCase();
  if (!PARAM_SHAPE.test(needle)) return null;
  return `herb_id.ilike.${needle},common_name.ilike.${needle.split("-").join("*")}*`;
}

/**
 * The herb's name as it leads a page <title>: the common name, then the
 * botanical binomial in parentheses, e.g. "Marshmallow (Althaea officinalis)".
 * Both come straight from the herb's own row; nothing is invented.
 *
 *  - A common_name that already carries a second name in parentheses
 *    ("Aged Tangerine Peel (Chen Pi)") is used as it is. Appending the Latin
 *    as well produced a double parenthesis.
 *  - latin_name is cut to the binomial, dropping author abbreviations and
 *    synonym notes ("Camellia sinensis (L.) Kuntze (syn. ...)" becomes
 *    "Camellia sinensis"). The full name still shows on the page.
 *  - The Latin is left off when it only repeats the common name ("Aloe Vera").
 */
export function herbTitleName(herb: {
  common_name: string | null;
  latin_name?: string | null;
}): string {
  const common = (herb.common_name ?? "").trim();
  if (!common) return "";
  if (common.includes("(")) return common;
  const latin = herbBinomial(herb.latin_name);
  if (!latin || latin.toLowerCase() === common.toLowerCase()) return common;
  return `${common} (${latin})`;
}

/** "Genus species" (or "Genus x species") from a latin_name, or the text
 *  before any parenthesis when it does not read as a binomial. */
export function herbBinomial(latin: string | null | undefined): string {
  const raw = (latin ?? "").trim();
  if (!raw) return "";
  const m = raw.match(/^([A-Z][a-z]+(?:-[a-z]+)?)\s+(?:([x×])\s+)?([a-z][a-z-]*)/);
  if (m) return m[2] ? `${m[1]} ${m[2]} ${m[3]}` : `${m[1]} ${m[3]}`;
  return raw.split("(")[0].trim();
}
