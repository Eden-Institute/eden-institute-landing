// Book details for the Product markup on /books and /back-to-eden (founder 2026-11-03).
//
// These are the same details the Merchant Center feed carries in its
// `product_detail` column since 2026-11-03 (Sheet "Eden Merchant Center Product
// Feed", tab Products, column O), so the page and the feed say the same thing.
// Genre is Camila's wording: "Homeschool Curriculum" for the printed sets,
// "Biblical Herbalism" for the Back to Eden books. Formats follow the print
// packages in supabase/functions/_shared/lulu-config.ts: Teacher's Guides and
// Student Notebooks are coil bound, Read-Aloud Storybooks and the Back to Eden
// paperback are perfect bound, the Study & Journal Edition and Study Guide are
// coil (spiral) bound. Change a value here and in the feed together.
//
// The two 9-week Starter Units (/starter, /starter/seedlings, added 2026-11-03)
// are digital, so they are not in the feed (digital left out on purpose,
// 2026-09-30); their format is the pages' own "PDF, instant download".

type Detail = [name: string, value: string];

const SET_FORMAT = "Coil-bound Teacher's Guide and Student Notebook, paperback Read-Aloud Storybook";
const BOTH_FORMAT = "Coil-bound Teacher's Guides and Student Notebooks, paperback Read-Aloud Storybooks";
const STARTER_FORMAT = "Instant digital download (PDF)";

export const PRODUCT_DETAILS: Record<string, Detail[]> = {
  sprouts_print_set: [["Genre", "Homeschool Curriculum"], ["Grade level", "K-2"], ["Format", SET_FORMAT], ["Language", "English"]],
  seedlings_print_set: [["Genre", "Homeschool Curriculum"], ["Grade level", "3-5"], ["Format", SET_FORMAT], ["Language", "English"]],
  both_bands_print_set: [["Genre", "Homeschool Curriculum"], ["Grade level", "K-5"], ["Format", BOTH_FORMAT], ["Language", "English"]],
  sprouts_starter_unit: [["Genre", "Homeschool Curriculum"], ["Grade level", "K-2"], ["Format", STARTER_FORMAT], ["Language", "English"]],
  seedlings_starter_unit: [["Genre", "Homeschool Curriculum"], ["Grade level", "3-5"], ["Format", STARTER_FORMAT], ["Language", "English"]],
  bte_paperback_print: [["Genre", "Biblical Herbalism"], ["Format", "Paperback"], ["Language", "English"], ["Author", "Camila Johnson"]],
  bte_study_journal_print: [["Genre", "Biblical Herbalism"], ["Format", "Spiral-bound"], ["Language", "English"], ["Author", "Camila Johnson"]],
  bte_study_guide_print: [["Genre", "Biblical Herbalism"], ["Format", "Spiral-bound"], ["Language", "English"], ["Author", "Camila Johnson"]],
};

/** schema.org `additionalProperty` for one product sku. */
export function productDetails(sku: string) {
  const details = PRODUCT_DETAILS[sku];
  if (!details) throw new Error(`No product details for ${sku}`);
  return {
    additionalProperty: details.map(([name, value]) => ({ "@type": "PropertyValue", name, value })),
  };
}

const detail = (sku: string, name: string) => PRODUCT_DETAILS[sku]?.find(([n]) => n === name)?.[1];

/**
 * The Book properties for one Back to Eden print edition, so its Product can
 * also be typed Book. `size` is the edition's own size line ("6 × 9 in ·
 * paperback · 186 pages"); the page count is read from it so the markup and
 * the page can never disagree. schema.org has no spiral or coil BookFormatType,
 * so only the paperback gets `bookFormat`; the spiral editions keep their
 * format in `additionalProperty`.
 */
export function bookEditionDetails(sku: string, size: string) {
  const pages = Number(/(\d+)\s*pages/.exec(size)?.[1]);
  if (!pages) throw new Error(`No page count in "${size}"`);
  const author = detail(sku, "Author");
  return {
    ...(author ? { author: { "@type": "Person", name: author } } : {}),
    genre: detail(sku, "Genre"),
    inLanguage: "en",
    numberOfPages: pages,
    ...(detail(sku, "Format") === "Paperback" ? { bookFormat: "https://schema.org/Paperback" } : {}),
  };
}
