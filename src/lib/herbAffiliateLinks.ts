// Mountain Rose Herbs affiliate links for the /herbs/<slug> pages ("Where to buy" box).
//
// 2026-11-16: Camila asked to earn from the plant-page traffic through her existing Mountain Rose
// Herbs affiliate program (AspireIQ short links, get.aspr.app) and approved "Build it" on the SEO
// review page, placed below "Safety at a glance". Founder law 2026-10-26: every herb link is her
// affiliate link, never a plain store URL, with a one-line disclosure.
//
// HOW THIS WAS BUILT. Each herb (herbs table, 300 rows) was matched to a Mountain Rose dried-herb
// product by its common name, aliases in parentheses, or Latin binomial, against Mountain Rose's
// product sitemap (tinctures, oils, capsules, blends and garden seeds left out). Every product page
// was opened (HTTP 200), and every link below was followed to the right product with a real
// transaction_id. Herbs taught in Eden's Table reuse the per-herb codes in
// web/pages/homeschool/herbs.astro; the rest use her bulk code with a url= deep link, which credits
// the same way.
//
// SAFETY. No link for any herb whose cautions, general contraindications or refer threshold say it
// is toxic, a poison, fatal, for external use only, or for practitioner use only (21 herbs that
// Mountain Rose sells, listed in SAFETY_EXCLUDED_HERBS), and none for Lobelia (H171), whose only Mountain
// Rose match was garden seeds of a strong emetic plant, or Evening Primrose (H015), whose only match is a
// planting seed. Loosening either is Camila's call. Corn Silk and White
// Mulberry Leaf are sourced from Amazon in herbs.astro, so they get no Mountain Rose box here.
//
// Keyed by herb_id (H-code), never by slug, so a rename cannot drop or misplace a link. To change a
// product, follow the link, confirm the product and the transaction_id, then edit the row here.

export interface HerbAffiliateLink {
  /** Mountain Rose's own product name, as shown on its page. */
  product: string;
  /** Her affiliate link. Always get.aspr.app. */
  href: string;
}

export const HERB_MRH_LINKS: Record<string, HerbAffiliateLink> = {
  H001: { product: "Ashwagandha Root", href: "https://get.aspr.app/SH1pnn" },
  H002: { product: "Astragalus Root", href: "https://get.aspr.app/SH1pnR" },
  H003: { product: "Burdock Root", href: "https://get.aspr.app/SH1pAX" },
  H004: { product: "Calendula", href: "https://get.aspr.app/SH1pAD" },
  H005: { product: "California Poppy", href: "https://get.aspr.app/SH1pnq" },
  H006: { product: "Cayenne Powder", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fcayenne-powder%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H007: { product: "Chamomile Flowers", href: "https://get.aspr.app/SH1pA8" },
  H008: { product: "Chickweed", href: "https://get.aspr.app/SH1pnu" },
  H009: { product: "Sweet Cinnamon Chips", href: "https://get.aspr.app/SH1pAS" },
  H010: { product: "Cleavers", href: "https://get.aspr.app/SH1pni" },
  H011: { product: "Dandelion Root", href: "https://get.aspr.app/SH1pAM" },
  H012: { product: "Echinacea purpurea Root", href: "https://get.aspr.app/SH1pnS?url=https%3A%2F%2Fmountainroseherbs.com%2Fechinacea-purpurea-root%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H013: { product: "Elderberries", href: "https://get.aspr.app/SH1pnO?url=https%3A%2F%2Fmountainroseherbs.com%2Felder-berries%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H014: { product: "Eleuthero Root", href: "https://get.aspr.app/SH1pnr" },
  H016: { product: "Fennel Seed", href: "https://get.aspr.app/SH1pAF" },
  H017: { product: "Feverfew", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Ffeverfew%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H018: { product: "Organic Garlic Granules", href: "https://get.aspr.app/SH1pAd" },
  H019: { product: "Ginger Root", href: "https://get.aspr.app/SH1pnQ" },
  H020: { product: "Ginkgo Leaf", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fginkgo-leaf%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H021: { product: "Ginseng Root Whole, American", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Famerican-ginseng-root%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H022: { product: "Asian Ginseng Root Powder", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fasian-ginseng-root-powder%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H023: { product: "Goldenrod Herb", href: "https://get.aspr.app/SH1pnU" },
  H024: { product: "Goldenseal Root", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fgoldenseal-root%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H025: { product: "Gotu Kola", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fgotu-kola%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H026: { product: "Hawthorn Flower & Hawthorn Leaf", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fhawthorn-leaf-and-flower%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H027: { product: "Krishna Holy Basil Tulsi", href: "https://get.aspr.app/SH1pnP?url=https%3A%2F%2Fmountainroseherbs.com%2Fkrishna-holy-basil%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H028: { product: "Hops", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fhops-flowers%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H029: { product: "Horsetail", href: "https://get.aspr.app/SH1pAb" },
  H030: { product: "Kava Root", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fkava-kava-root%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H031: { product: "English Lavender Flowers", href: "https://get.aspr.app/SH1pA7" },
  H032: { product: "Lemon Balm", href: "https://get.aspr.app/SH1pA9" },
  H033: { product: "Licorice Root", href: "https://get.aspr.app/SH1pnd" },
  H034: { product: "Linden", href: "https://get.aspr.app/SH1pAI" },
  H036: { product: "Marshmallow Root", href: "https://get.aspr.app/SH1pAH" },
  H037: { product: "Meadowsweet Flower", href: "https://get.aspr.app/SH1pnX?url=https%3A%2F%2Fmountainroseherbs.com%2Fmeadowsweet-flowers%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H038: { product: "Milk Thistle Seed", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fmilk-thistle-seed%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H039: { product: "Motherwort", href: "https://get.aspr.app/SH1pnb" },
  H040: { product: "Mugwort Herb", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fmugwort-herb%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H041: { product: "Mullein Leaf", href: "https://get.aspr.app/SH1pAK" },
  H042: { product: "Nettle Leaf", href: "https://get.aspr.app/SH1pAL" },
  H043: { product: "Oatstraw", href: "https://get.aspr.app/SH1pAa" },
  H044: { product: "Oregon Grape Root", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Foregon-grape-root%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H045: { product: "Passion Flower", href: "https://get.aspr.app/SH1pnm?url=https%3A%2F%2Fmountainroseherbs.com%2Fpassion-flower%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H046: { product: "Peppermint Leaf", href: "https://get.aspr.app/SH1pAC" },
  H047: { product: "Plantain Leaf", href: "https://get.aspr.app/SH1pAE" },
  H048: { product: "Raspberry Leaf", href: "https://get.aspr.app/SH1pAY" },
  H049: { product: "Red Clover Blossoms", href: "https://get.aspr.app/SH1png?url=https%3A%2F%2Fmountainroseherbs.com%2Fred-clover-blossoms%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H050: { product: "Reishi Mushroom", href: "https://get.aspr.app/SH1pnT" },
  H051: { product: "Rhodiola Root", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Frhodiola-root%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H052: { product: "Rosehips", href: "https://get.aspr.app/SH1pAf" },
  H053: { product: "Rosemary Leaf", href: "https://get.aspr.app/SH1pAN" },
  H054: { product: "Sage Leaf", href: "https://get.aspr.app/SH1pnV?url=https%3A%2F%2Fmountainroseherbs.com%2Fsage-leaf%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H055: { product: "Chinese Schisandra Berries", href: "https://get.aspr.app/SH1pnp" },
  H056: { product: "Skullcap Herb", href: "https://get.aspr.app/SH1pnh?url=https%3A%2F%2Fmountainroseherbs.com%2Fskullcap-herb%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H057: { product: "Slippery Elm Bark", href: "https://get.aspr.app/SH1pAG" },
  H058: { product: "St. John's Wort", href: "https://get.aspr.app/SH1pnl" },
  H059: { product: "Thyme", href: "https://get.aspr.app/SH1pAO" },
  H060: { product: "Organic Turmeric Root", href: "https://get.aspr.app/SH1pAe" },
  H061: { product: "Usnea", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fusnea%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H062: { product: "Uva Ursi", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fuva-ursi%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H063: { product: "Valerian Root", href: "https://get.aspr.app/SH1pne" },
  H064: { product: "Vitex Berry", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fvitex-berry%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H065: { product: "Wild Cherry Bark", href: "https://get.aspr.app/SH1pnw" },
  H066: { product: "Wild Yam Root", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fwild-yam-root%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H067: { product: "Witch Hazel Leaf", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fwitch-hazel-leaf%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H068: { product: "Wood Betony", href: "https://get.aspr.app/SH1pAU" },
  H069: { product: "Yarrow", href: "https://get.aspr.app/SH1pAQ" },
  H070: { product: "Yellow Dock Root", href: "https://get.aspr.app/SH1pnc" },
  H071: { product: "Yerba Santa", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fyerba-santa%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H072: { product: "Agrimony", href: "https://get.aspr.app/SH1pAW" },
  H073: { product: "Aloe Vera Leaf", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Faloe-vera-leaf%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H074: { product: "Angelica Root", href: "https://get.aspr.app/SH1pAT" },
  H075: { product: "Anise Hyssop", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fanise-hyssop%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H077: { product: "Wood Betony", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fwood-betony%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H078: { product: "Black Cohosh Root", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fblack-cohosh-root%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H080: { product: "Blessed Thistle", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fblessed-thistle%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H081: { product: "Blue Cohosh Root", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fblue-cohosh-root%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H082: { product: "Blue Vervain", href: "https://get.aspr.app/SH1pno" },
  H083: { product: "Boneset", href: "https://get.aspr.app/SH1pnZ" },
  H085: { product: "Bugleweed", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fbugleweed%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H086: { product: "Catnip", href: "https://get.aspr.app/SH1pAJ" },
  H087: { product: "Coltsfoot", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fcoltsfoot%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H088: { product: "Comfrey Leaf", href: "https://get.aspr.app/SH1pns?url=https%3A%2F%2Fmountainroseherbs.com%2Fcomfrey-leaf%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H090: { product: "Cramp Bark", href: "https://get.aspr.app/SH1pnv" },
  H092: { product: "Dong Quai", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fdong-quai%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H093: { product: "Elecampane", href: "https://get.aspr.app/SH1pnY" },
  H095: { product: "Fenugreek Seeds", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Ffenugreek-seeds%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H096: { product: "Gentian", href: "https://get.aspr.app/SH1pnj" },
  H097: { product: "Gravel Root Organic", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fgravel-root%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H099: { product: "Gymnema", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fgymnema%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H100: { product: "Brahmi", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fbrahmi%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H101: { product: "White Oak Bark Organic", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fwhite-oak-bark%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H102: { product: "Hibiscus Flowers Cut", href: "https://get.aspr.app/SH1pAV" },
  H103: { product: "Shatavari", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fshatavari%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H104: { product: "Rehmannia Root", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Frehmannia-root%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H105: { product: "Prickly Ash Bark", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fprickly-ash-bark%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H107: { product: "Black Pepper", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fblack-pepper%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H108: { product: "Bayberry Root Bark", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fbayberry-root-bark%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H109: { product: "Myrrh Resin", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fmyrrh-resin%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H111: { product: "Coriander Seeds", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fcoriander-seed%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H112: { product: "Black Seed", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fblack-seed%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H113: { product: "Flax Seed", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fflax-seed%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H119: { product: "Wild Lettuce", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fwild-lettuce%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H120: { product: "Spikenard Root", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fspikenard-root%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H121: { product: "Cumin Seeds", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fcumin-seed%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H122: { product: "Hyssop", href: "https://get.aspr.app/SH1pAR" },
  H124: { product: "Clove Powder", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fclove-powder%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H125: { product: "Amla", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Famla%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H127: { product: "Senna Leaf", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fsenna-leaf%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H128: { product: "Cardamom Pods", href: "https://get.aspr.app/SH1pna?url=https%3A%2F%2Fmountainroseherbs.com%2Fcardamom-pods%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H129: { product: "Cascara Sagrada", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fcascara-sagrada%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H130: { product: "Andrographis Powder", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fandrographis-powder%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H132: { product: "Sarsaparilla", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fsarsaparilla%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H133: { product: "Saw Palmetto Berries", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fsaw-palmetto-berries%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H139: { product: "Kudzu Root", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fkudzu-root%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H140: { product: "Red Sage (Dan Shen)", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fred-sage%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H143: { product: "Buchu Leaf", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fbuchu-leaf%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H146: { product: "Dill Seeds", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fdill-seed%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H148: { product: "Arjuna Powder", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Farjuna-powder%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H149: { product: "Caraway Seeds", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fcaraway-seeds%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H150: { product: "Centaury", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fcentaury%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H152: { product: "Figwort", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Ffigwort%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H154: { product: "Oregano", href: "https://get.aspr.app/SH1pAP" },
  H156: { product: "Spearmint Leaf", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fspearmint-leaf%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H158: { product: "Long Pepper", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Flong-pepper%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H159: { product: "Psyllium Seeds", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fpsyllium-seeds%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H161: { product: "Horse Chestnuts", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fhorse-chestnut%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H162: { product: "Moringa Leaf", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fmoringa-leaf%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H164: { product: "White Willow Bark", href: "https://get.aspr.app/SH1pnW" },
  H165: { product: "Bilberry", href: "https://get.aspr.app/SH1pnt" },
  H166: { product: "Black Haw", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fblack-haw%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H167: { product: "Bloodroot", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fbloodroot%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H169: { product: "Chrysanthemum Flowers", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fchrysanthemum-flowers-whole%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H172: { product: "Pleurisy Root", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fpleurisy-root%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H173: { product: "White Peony Root", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fwhite-peony-root%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H179: { product: "Guduchi Powder", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fguduchi-powder%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H188: { product: "Barberry Root", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fbarberry-root%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H190: { product: "Cranberry Powder", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fcranberry-powder%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H194: { product: "Anise Seed", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fanise-seed%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H202: { product: "Cranesbill Root", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fcranesbill-root%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H207: { product: "Olive Leaf", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Folive-leaf%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H209: { product: "Pipsissewa", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fpipsissewa%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H215: { product: "Codonopsis", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fcodonopsis-root%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H216: { product: "Fringe Tree Bark", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Ffringe-tree-bark%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H217: { product: "Horseradish Powder", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fhorseradish-powder%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H221: { product: "Stone Root", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fstone-root%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H225: { product: "Damiana Leaf", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fdamiana-leaf%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H227: { product: "Epimedium", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fepimedium%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H229: { product: "Lovage Root", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Flovage-root%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H234: { product: "Summer Savory", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fsummer-savory%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H239: { product: "Artichoke Leaf", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fartichoke-leaf%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H245: { product: "Blue Flag Root", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fblue-flag-root%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H247: { product: "Celery Seed", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fcelery-seed%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H252: { product: "Hydrangea Root", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fhydrangea-root%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H256: { product: "Silk Tree Bark", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fsilk-tree-bark%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H260: { product: "Safflower", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fsafflower%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H265: { product: "Grains of Paradise", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fgrains-of-paradise%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H285: { product: "Chaga Mushroom", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fchaga-mushroom%3Ftransaction_id%3D%7Btransaction_id%7D" },
  H294: { product: "Shiitake Mushroom", href: "https://get.aspr.app/SH1p9w?url=https%3A%2F%2Fmountainroseherbs.com%2Fshiitake-mushroom%3Ftransaction_id%3D%7Btransaction_id%7D" },
};

/** Herbs Mountain Rose sells that get no link (safety wording above). */
export const SAFETY_EXCLUDED_HERBS: readonly string[] = ["H076", "H079", "H110", "H115", "H117", "H131", "H134", "H136", "H155", "H174", "H201", "H205", "H208", "H241", "H242", "H243", "H249", "H259", "H286", "H290", "H291"];

export function mrhLinkForHerb(herbId: string): HerbAffiliateLink | null {
  return HERB_MRH_LINKS[herbId] ?? null;
}
