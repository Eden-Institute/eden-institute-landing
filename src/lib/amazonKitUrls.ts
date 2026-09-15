// Pattern-slug → curated Amazon wishlist URL.
// Sourced from constitutionProfiles (single source of truth for the wishlist links).
import { constitutionProfiles } from "@/lib/constitution-data";
import { CONSTITUTION_MAP, patternNameToSlug } from "@/lib/constitution-utils";

// Re-exported so existing importers of this module keep compiling.
export { patternNameToSlug };

const AMAZON_KIT_URLS: Record<string, string> = Object.fromEntries(
  Object.entries(CONSTITUTION_MAP).map(([type, { slug }]) => [
    slug,
    constitutionProfiles[type]?.amazonUrl ?? "",
  ])
);

// Accepts either a Pattern display name ("The Burning Bowstring") or an
// already-normalized slug ("burning-bowstring") and resolves to the wishlist
// URL. Callers pass whichever they have (the tier CTA has the display name, the
// homepage has the slug), so normalize both to the slug the map is keyed by.
export function getAmazonKitUrl(patternOrSlug: string | null | undefined): string | null {
  if (!patternOrSlug) return null;
  return AMAZON_KIT_URLS[patternNameToSlug(patternOrSlug)] || null;
}
