// Pattern-slug → curated Amazon wishlist URL.
// Sourced from constitutionProfiles (single source of truth for the wishlist links).
import { constitutionProfiles } from "@/lib/constitution-data";
import { CONSTITUTION_MAP } from "@/lib/constitution-utils";

export const AMAZON_KIT_URLS: Record<string, string> = Object.fromEntries(
  Object.entries(CONSTITUTION_MAP).map(([type, { slug }]) => [
    slug,
    constitutionProfiles[type]?.amazonUrl ?? "",
  ])
);

export function getAmazonKitUrl(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return AMAZON_KIT_URLS[slug] || null;
}
