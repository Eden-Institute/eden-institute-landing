/**
 * curriculumHerbs: which Eden Apothecary herb monographs are taught as a week
 * of Eden's Table, so the herb pages can point at the curriculum and the scope
 * and sequence page can point back at the herb pages.
 *
 * HOW THIS WAS BUILT (2026-09-26). Each of the 72 weeks in
 * web/lib/scopeAndSequence.ts was matched against the full herb roster
 * (herbs_directory_v joined to herbs.latin_name, 300 rows):
 *   1. "latin": the week's Latin binomial equals the monograph's latin_name
 *      (ignoring case, author abbreviations and x versus the multiplication sign).
 *   2. "common-name": no Latin match, but the week's plant name equals the
 *      monograph's common_name exactly.
 * Nothing was matched on genus alone or on a similar-looking name. Weeks with
 * no match are listed in UNMATCHED_CURRICULUM_WEEKS with the reason, and
 * src/test/curriculumHerbs.test.ts checks that every one of the 72 weeks is in
 * exactly one of the two lists.
 *
 * Keyed by herb_id (H-code), never by slug: the slug is derived from
 * common_name and changes if a herb is renamed, the H-code does not.
 * If the scope and sequence or the herb roster changes, redo the match by the
 * same two rules. Do not guess.
 */

export type CurriculumBand = "sprouts" | "seedlings";

export interface CurriculumHerbMatch {
  band: CurriculumBand;
  week: number;
  /** herbs.herb_id of the matched monograph. */
  herbId: string;
  /** Which rule made the match. */
  via: "latin" | "common-name";
}

export const CURRICULUM_BANDS: Record<CurriculumBand, { name: string; grades: string }> = {
  sprouts: { name: "Sprouts", grades: "grades K-2" },
  seedlings: { name: "Seedlings", grades: "grades 3-5" },
};

export const CURRICULUM_HERB_MATCHES: readonly CurriculumHerbMatch[] = [
  // Sprouts (K-2)
  { band: "sprouts", week: 1, herbId: "H031", via: "latin" }, // Lavender
  { band: "sprouts", week: 2, herbId: "H007", via: "latin" }, // Chamomile
  { band: "sprouts", week: 3, herbId: "H032", via: "latin" }, // Lemon Balm
  { band: "sprouts", week: 4, herbId: "H046", via: "latin" }, // Peppermint
  { band: "sprouts", week: 5, herbId: "H004", via: "latin" }, // Calendula
  { band: "sprouts", week: 6, herbId: "H047", via: "latin" }, // Plantain
  { band: "sprouts", week: 7, herbId: "H016", via: "latin" }, // Fennel
  { band: "sprouts", week: 8, herbId: "H057", via: "latin" }, // Slippery Elm
  { band: "sprouts", week: 9, herbId: "H036", via: "latin" }, // Marshmallow Root -> Marshmallow
  { band: "sprouts", week: 10, herbId: "H034", via: "common-name" }, // Linden (week: Tilia spp.; monograph: Tilia europaea)
  { band: "sprouts", week: 11, herbId: "H086", via: "latin" }, // Catnip
  { band: "sprouts", week: 12, herbId: "H041", via: "latin" }, // Mullein
  { band: "sprouts", week: 13, herbId: "H042", via: "latin" }, // Nettle
  { band: "sprouts", week: 14, herbId: "H011", via: "latin" }, // Dandelion Root -> Dandelion
  { band: "sprouts", week: 15, herbId: "H053", via: "common-name" }, // Rosemary (week: Salvia rosmarinus; monograph: Rosmarinus officinalis)
  { band: "sprouts", week: 16, herbId: "H059", via: "latin" }, // Thyme
  { band: "sprouts", week: 17, herbId: "H154", via: "latin" }, // Oregano -> Oregano (Wild Marjoram)
  { band: "sprouts", week: 18, herbId: "H069", via: "latin" }, // Yarrow
  { band: "sprouts", week: 19, herbId: "H122", via: "latin" }, // Hyssop
  { band: "sprouts", week: 20, herbId: "H009", via: "latin" }, // Cinnamon (Ceylon) -> Cinnamon
  { band: "sprouts", week: 21, herbId: "H074", via: "latin" }, // Angelica
  { band: "sprouts", week: 22, herbId: "H068", via: "latin" }, // Wood Betony (Betonica officinalis)
  { band: "sprouts", week: 23, herbId: "H102", via: "latin" }, // Hibiscus
  { band: "sprouts", week: 24, herbId: "H072", via: "latin" }, // Agrimony
  { band: "sprouts", week: 25, herbId: "H003", via: "latin" }, // Burdock
  { band: "sprouts", week: 26, herbId: "H048", via: "latin" }, // Raspberry Leaf
  { band: "sprouts", week: 28, herbId: "H043", via: "latin" }, // Oat Straw
  { band: "sprouts", week: 29, herbId: "H029", via: "latin" }, // Horsetail
  { band: "sprouts", week: 31, herbId: "H018", via: "latin" }, // Garlic
  { band: "sprouts", week: 32, herbId: "H060", via: "latin" }, // Turmeric
  { band: "sprouts", week: 34, herbId: "H264", via: "latin" }, // White Mulberry Leaf -> White Mulberry Leaf (Sang Ye)
  { band: "sprouts", week: 35, herbId: "H052", via: "latin" }, // Rose Hips -> Rose (Rosa canina, part used: hip, petal)
  { band: "sprouts", week: 36, herbId: "H089", via: "latin" }, // Corn Silk

  // Seedlings (3-5)
  { band: "seedlings", week: 1, herbId: "H013", via: "latin" }, // Elderberry -> Elder
  { band: "seedlings", week: 2, herbId: "H027", via: "latin" }, // Tulsi (Holy Basil) -> Holy Basil (Tulsi)
  { band: "seedlings", week: 3, herbId: "H019", via: "latin" }, // Ginger
  { band: "seedlings", week: 4, herbId: "H002", via: "latin" }, // Astragalus
  { band: "seedlings", week: 5, herbId: "H012", via: "latin" }, // Echinacea
  { band: "seedlings", week: 6, herbId: "H050", via: "latin" }, // Reishi
  { band: "seedlings", week: 7, herbId: "H023", via: "common-name" }, // Goldenrod (week: Solidago spp.; monograph: Solidago virgaurea)
  { band: "seedlings", week: 8, herbId: "H054", via: "latin" }, // Sage
  { band: "seedlings", week: 9, herbId: "H164", via: "latin" }, // Willow Bark -> White Willow
  { band: "seedlings", week: 10, herbId: "H037", via: "latin" }, // Meadowsweet
  { band: "seedlings", week: 11, herbId: "H093", via: "latin" }, // Elecampane
  { band: "seedlings", week: 12, herbId: "H083", via: "latin" }, // Boneset
  { band: "seedlings", week: 13, herbId: "H128", via: "latin" }, // Cardamom -> Cardamom (Ela)
  { band: "seedlings", week: 14, herbId: "H039", via: "latin" }, // Motherwort
  { band: "seedlings", week: 15, herbId: "H070", via: "latin" }, // Yellow Dock
  { band: "seedlings", week: 16, herbId: "H033", via: "latin" }, // Licorice
  { band: "seedlings", week: 17, herbId: "H063", via: "latin" }, // Valerian
  { band: "seedlings", week: 19, herbId: "H049", via: "latin" }, // Red Clover
  { band: "seedlings", week: 20, herbId: "H056", via: "latin" }, // Skullcap
  { band: "seedlings", week: 21, herbId: "H010", via: "latin" }, // Cleavers
  { band: "seedlings", week: 22, herbId: "H096", via: "latin" }, // Gentian
  { band: "seedlings", week: 24, herbId: "H058", via: "latin" }, // St. John's Wort
  { band: "seedlings", week: 25, herbId: "H045", via: "latin" }, // Passionflower
  { band: "seedlings", week: 26, herbId: "H001", via: "latin" }, // Ashwagandha
  { band: "seedlings", week: 27, herbId: "H082", via: "latin" }, // Blue Vervain
  { band: "seedlings", week: 28, herbId: "H055", via: "latin" }, // Schisandra
  { band: "seedlings", week: 29, herbId: "H005", via: "latin" }, // California Poppy
  { band: "seedlings", week: 30, herbId: "H014", via: "latin" }, // Eleuthero
  { band: "seedlings", week: 31, herbId: "H088", via: "latin" }, // Comfrey
  { band: "seedlings", week: 32, herbId: "H165", via: "latin" }, // Bilberry
  { band: "seedlings", week: 33, herbId: "H008", via: "latin" }, // Chickweed
  { band: "seedlings", week: 34, herbId: "H090", via: "latin" }, // Cramp Bark
  { band: "seedlings", week: 35, herbId: "H065", via: "latin" }, // Wild Cherry Bark -> Wild Cherry
  { band: "seedlings", week: 36, herbId: "H123", via: "latin" }, // Self-Heal -> Selfheal
];

/** Weeks deliberately left unlinked, with the reason. */
export const UNMATCHED_CURRICULUM_WEEKS: readonly { band: CurriculumBand; week: number; reason: string }[] = [
  { band: "sprouts", week: 27, reason: "Hawthorn Berry (Crataegus spp.): genus only; the monograph is Hawthorn (Crataegus monogyna), a different name" },
  { band: "sprouts", week: 30, reason: "Rose Petals (Rosa spp.): genus only; the one Rose monograph (Rosa canina) is already matched by Latin name to week 35, Rose Hips" },
  { band: "sprouts", week: 33, reason: "White Pine Needle (Pinus strobus): no pine monograph in the roster" },
  { band: "seedlings", week: 18, reason: "Lemon Verbena (Aloysia citriodora): no monograph in the roster" },
  { band: "seedlings", week: 23, reason: "Sweet Violet (Viola odorata): no monograph in the roster" },
];

/** The curriculum weeks that teach this herb, Sprouts first, in week order. */
export function curriculumWeeksForHerb(herbId: string | null | undefined): CurriculumHerbMatch[] {
  if (!herbId) return [];
  return CURRICULUM_HERB_MATCHES.filter((m) => m.herbId === herbId).sort(
    (a, b) => (a.band === b.band ? a.week - b.week : a.band === "sprouts" ? -1 : 1),
  );
}

/** The matched herb_id for one curriculum week, or null when unmatched. */
export function herbIdForCurriculumWeek(band: CurriculumBand, week: number): string | null {
  return CURRICULUM_HERB_MATCHES.find((m) => m.band === band && m.week === week)?.herbId ?? null;
}

/** Where a herb page's curriculum line links: the band's section of the scope
 *  and sequence page. */
export function scopeAndSequenceHref(band: CurriculumBand): string {
  return `/homeschool/scope-and-sequence#${band}`;
}
