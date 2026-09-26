/**
 * /homeschool/scope-and-sequence: every week, plant and unit of both years. Added
 * 2026-09-25 (founder decision: publish both 36-plant lists; week, plant, unit;
 * no lesson content).
 *
 * SOURCES, and they must stay in step:
 *  - Sprouts: the Sprouts TG Content Spine Google Sheet, "Content Map" tab (the
 *    fill-source the printed Teacher's Guide was built from), read 2026-09-25.
 *    Week order matches /homeschool/herbs; units 1-2 match /starter.
 *  - Seedlings: the WEEK AT A GLANCE page of each week in the final Seedlings
 *    Teacher's Guide interior (Lulu build, 245 pages), read 2026-09-25.
 * Deliberately NOT published: the body-system labels on the Seedlings week pages
 * (e.g. "Immune"), which read as health claims out of context, and any lesson text.
 */

export interface ScopeWeek {
  week: number;
  plant: string;
  latin: string;
  /** 1-based index into the band's units. */
  unit: number;
}

export const SPROUTS_UNITS: readonly string[] = ["In the Garden God Made", "When Your Body Talks", "The Way We're Made to Live", "Handed Down with Love", "Just the Way God Made You", "Now We Tend the Garden"];
export const SEEDLINGS_UNITS: readonly string[] = ["Fearfully and Wonderfully Made", "Learning to Listen", "Seeing the Whole Person", "Handing Down What's True", "Bearing God's Fingerprint", "Carrying It Forward"];

export const SPROUTS_WEEKS: readonly ScopeWeek[] = [
  { week: 1, plant: "Lavender", latin: "Lavandula angustifolia", unit: 1 },
  { week: 2, plant: "Chamomile", latin: "Matricaria chamomilla", unit: 1 },
  { week: 3, plant: "Lemon Balm", latin: "Melissa officinalis", unit: 1 },
  { week: 4, plant: "Peppermint", latin: "Mentha × piperita", unit: 1 },
  { week: 5, plant: "Calendula", latin: "Calendula officinalis", unit: 1 },
  { week: 6, plant: "Plantain", latin: "Plantago major", unit: 1 },
  { week: 7, plant: "Fennel", latin: "Foeniculum vulgare", unit: 2 },
  { week: 8, plant: "Slippery Elm", latin: "Ulmus rubra", unit: 2 },
  { week: 9, plant: "Marshmallow Root", latin: "Althaea officinalis", unit: 2 },
  { week: 10, plant: "Linden", latin: "Tilia spp.", unit: 2 },
  { week: 11, plant: "Catnip", latin: "Nepeta cataria", unit: 2 },
  { week: 12, plant: "Mullein", latin: "Verbascum thapsus", unit: 2 },
  { week: 13, plant: "Nettle", latin: "Urtica dioica", unit: 3 },
  { week: 14, plant: "Dandelion Root", latin: "Taraxacum officinale", unit: 3 },
  { week: 15, plant: "Rosemary", latin: "Salvia rosmarinus", unit: 3 },
  { week: 16, plant: "Thyme", latin: "Thymus vulgaris", unit: 3 },
  { week: 17, plant: "Oregano", latin: "Origanum vulgare", unit: 3 },
  { week: 18, plant: "Yarrow", latin: "Achillea millefolium", unit: 3 },
  { week: 19, plant: "Hyssop", latin: "Hyssopus officinalis", unit: 4 },
  { week: 20, plant: "Cinnamon (Ceylon)", latin: "Cinnamomum verum", unit: 4 },
  { week: 21, plant: "Angelica", latin: "Angelica archangelica", unit: 4 },
  { week: 22, plant: "Wood Betony", latin: "Betonica officinalis", unit: 4 },
  { week: 23, plant: "Hibiscus", latin: "Hibiscus sabdariffa", unit: 4 },
  { week: 24, plant: "Agrimony", latin: "Agrimonia eupatoria", unit: 4 },
  { week: 25, plant: "Burdock", latin: "Arctium lappa", unit: 5 },
  { week: 26, plant: "Raspberry Leaf", latin: "Rubus idaeus", unit: 5 },
  { week: 27, plant: "Hawthorn Berry", latin: "Crataegus spp.", unit: 5 },
  { week: 28, plant: "Oat Straw", latin: "Avena sativa", unit: 5 },
  { week: 29, plant: "Horsetail", latin: "Equisetum arvense", unit: 5 },
  { week: 30, plant: "Rose Petals", latin: "Rosa spp.", unit: 5 },
  { week: 31, plant: "Garlic", latin: "Allium sativum", unit: 6 },
  { week: 32, plant: "Turmeric", latin: "Curcuma longa", unit: 6 },
  { week: 33, plant: "White Pine Needle", latin: "Pinus strobus", unit: 6 },
  { week: 34, plant: "White Mulberry Leaf", latin: "Morus alba", unit: 6 },
  { week: 35, plant: "Rose Hips", latin: "Rosa canina", unit: 6 },
  { week: 36, plant: "Corn Silk", latin: "Zea mays", unit: 6 },
];

export const SEEDLINGS_WEEKS: readonly ScopeWeek[] = [
  { week: 1, plant: "Elderberry", latin: "Sambucus nigra", unit: 1 },
  { week: 2, plant: "Tulsi (Holy Basil)", latin: "Ocimum tenuiflorum", unit: 1 },
  { week: 3, plant: "Ginger", latin: "Zingiber officinale", unit: 1 },
  { week: 4, plant: "Astragalus", latin: "Astragalus membranaceus", unit: 1 },
  { week: 5, plant: "Echinacea", latin: "Echinacea purpurea", unit: 1 },
  { week: 6, plant: "Reishi", latin: "Ganoderma lucidum", unit: 1 },
  { week: 7, plant: "Goldenrod", latin: "Solidago spp.", unit: 2 },
  { week: 8, plant: "Sage", latin: "Salvia officinalis", unit: 2 },
  { week: 9, plant: "Willow Bark", latin: "Salix alba", unit: 2 },
  { week: 10, plant: "Meadowsweet", latin: "Filipendula ulmaria", unit: 2 },
  { week: 11, plant: "Elecampane", latin: "Inula helenium", unit: 2 },
  { week: 12, plant: "Boneset", latin: "Eupatorium perfoliatum", unit: 2 },
  { week: 13, plant: "Cardamom", latin: "Elettaria cardamomum", unit: 3 },
  { week: 14, plant: "Motherwort", latin: "Leonurus cardiaca", unit: 3 },
  { week: 15, plant: "Yellow Dock", latin: "Rumex crispus", unit: 3 },
  { week: 16, plant: "Licorice", latin: "Glycyrrhiza glabra", unit: 3 },
  { week: 17, plant: "Valerian", latin: "Valeriana officinalis", unit: 3 },
  { week: 18, plant: "Lemon Verbena", latin: "Aloysia citriodora", unit: 3 },
  { week: 19, plant: "Red Clover", latin: "Trifolium pratense", unit: 4 },
  { week: 20, plant: "Skullcap", latin: "Scutellaria lateriflora", unit: 4 },
  { week: 21, plant: "Cleavers", latin: "Galium aparine", unit: 4 },
  { week: 22, plant: "Gentian", latin: "Gentiana lutea", unit: 4 },
  { week: 23, plant: "Sweet Violet", latin: "Viola odorata", unit: 4 },
  { week: 24, plant: "St. John's Wort", latin: "Hypericum perforatum", unit: 4 },
  { week: 25, plant: "Passionflower", latin: "Passiflora incarnata", unit: 5 },
  { week: 26, plant: "Ashwagandha", latin: "Withania somnifera", unit: 5 },
  { week: 27, plant: "Blue Vervain", latin: "Verbena hastata", unit: 5 },
  { week: 28, plant: "Schisandra", latin: "Schisandra chinensis", unit: 5 },
  { week: 29, plant: "California Poppy", latin: "Eschscholzia californica", unit: 5 },
  { week: 30, plant: "Eleuthero", latin: "Eleutherococcus senticosus", unit: 5 },
  { week: 31, plant: "Comfrey", latin: "Symphytum officinale", unit: 6 },
  { week: 32, plant: "Bilberry", latin: "Vaccinium myrtillus", unit: 6 },
  { week: 33, plant: "Chickweed", latin: "Stellaria media", unit: 6 },
  { week: 34, plant: "Cramp Bark", latin: "Viburnum opulus", unit: 6 },
  { week: 35, plant: "Wild Cherry Bark", latin: "Prunus serotina", unit: 6 },
  { week: 36, plant: "Self-Heal", latin: "Prunella vulgaris", unit: 6 },
];
