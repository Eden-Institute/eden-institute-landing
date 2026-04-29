/**
 * §8.1.4 PR 4 — shared Amazon affiliate kit URLs keyed by Pattern slug.
 *
 * Single source of truth for the Pattern × Amazon-wishlist mapping. Mirrors
 * the AMAZON_URLS constant inside
 * `supabase/functions/_shared/nurture-email-templates.ts` (Email 5 starter
 * kit) so the EF and the on-app CTA pair render the same eight links. When
 * an URL changes, update both files in lockstep — they are deliberately
 * not deduplicated because the EF runs in Deno (no `@/lib/...` import path)
 * and bundling would add complexity for one constant table.
 *
 * Conventions:
 *   • Keys are Pattern slugs (kebab-case, no leading "the-").
 *   • Helper `patternNameToSlug` slugifies an EdenPatternName to the key
 *     shape used here.
 *   • Helper `getAmazonKitUrl` returns null when no mapping exists; callers
 *     suppress the Amazon card rather than ship a broken or generic link.
 *
 * Why this lives at /lib (not /constants): the slugifier is a pure
 * function; co-locating it with its lookup table keeps the API one import
 * for consumers.
 */

import type { EdenPatternName } from "@/lib/edenPattern";

/**
 * Pattern-slug → Amazon Idea List URL.
 *
 * MUST stay in sync with `AMAZON_URLS` in
 * `supabase/functions/_shared/nurture-email-templates.ts`.
 */
export const AMAZON_KIT_URLS: Readonly<Record<string, string>> = Object.freeze({
  "burning-bowstring":
    "https://www.amazon.com/hz/wishlist/ls/3SVZB0BRV2IE3?ref_=wl_share",
  "open-flame":
    "https://www.amazon.com/hz/wishlist/ls/1ELQEQ7OEN6V6?ref_=wl_share",
  "pressure-cooker":
    "https://www.amazon.com/hz/wishlist/ls/QR7IKCJ9S89E?ref_=wl_share",
  "overflowing-cup":
    "https://www.amazon.com/hz/wishlist/ls/23IQ93Z31QB8Z?ref_=wl_share",
  "drawn-bowstring":
    "https://www.amazon.com/hz/wishlist/ls/2TK1B0LX1VFPS?ref_=wl_share",
  "spent-candle":
    "https://www.amazon.com/hz/wishlist/ls/2Q5D53CU2ZW1L?ref_=wl_share",
  "frozen-knot":
    "https://www.amazon.com/hz/wishlist/ls/7NTDELHCTNMO?ref_=wl_share",
  "still-water":
    "https://www.amazon.com/hz/wishlist/ls/2OV04T0L7C1FA?ref_=wl_share",
});

/**
 * Convert a canonical EdenPatternName to its kebab-case slug used as the
 * key in AMAZON_KIT_URLS (and in /results/[slug] routes, and in the EF
 * email templates' constitutionSlug parameter).
 *
 * "The Pressure Cooker" → "pressure-cooker"
 */
export function patternNameToSlug(name: EdenPatternName): string {
  return name
    .replace(/^The\s+/i, "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .trim();
}

/**
 * Resolve an Amazon kit URL for a Pattern. Returns null when no Pattern
 * is set or when the Pattern has no mapping (defensive — should never
 * happen for the canonical 8). Callers should suppress the Amazon card
 * when null rather than ship a broken or generic link.
 */
export function getAmazonKitUrl(
  patternName: EdenPatternName | null,
): string | null {
  if (!patternName) return null;
  const slug = patternNameToSlug(patternName);
  return AMAZON_KIT_URLS[slug] ?? null;
}
