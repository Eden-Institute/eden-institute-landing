/**
 * How many herbs the Eden Apothecary holds, for customer-facing copy.
 *
 * Runtime-import-free on purpose (like src/lib/tiers.ts and
 * src/lib/apothecaryPrices.ts), so the Vite app, the Astro pages under web/
 * and plain vitest runs can all import it without constructing a Supabase
 * client.
 *
 * Verified against production 2026-09-15: public.herbs holds 300 rows
 * (H001-H300, every one status Approved). Every tier sees all of them; the
 * tiers differ only in how deep each monograph goes. When the catalog grows,
 * change this number and the copy follows everywhere.
 * src/test/herbCatalogCopy.test.ts fails if a page hardcodes a count again.
 */
export const HERB_CATALOG_SIZE = 300;
