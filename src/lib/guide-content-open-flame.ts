import type { FullGuideContent } from "./guide-types";

export const openFlameGuide: FullGuideContent = {
  slug: "open-flame",
  constitutionType: "Hot / Dry / Relaxed",
  nickname: "The Open Flame",
  tagline: "You burn bright and open — warm, expressive, and unguarded. But without containment, the flame consumes its own fuel.",

  chapterOne: {
    subtitle: "Understanding the Hot / Dry / Relaxed Constitutional Tendency",
    paragraphs: [
      "You are wired for warmth and openness. Your metabolism runs high, your body generates heat readily, and unlike the Burning Bowstring, your tissues tend toward relaxation rather than tension. You burn freely — an open flame without a hearth. This creates a pattern of heat dissipation, dryness from uncontained burning, and tissues that lack tone.",
      "Under normal conditions, this pattern manifests as warmth, charisma, creative energy, and a generous spirit. You tend to be expressive, spontaneous, and emotionally available. But without structure, the fire spreads too thin and the fuel runs out.",
    ],
    physicalTendencies: [
      "Heat with laxity — flushing, redness, but tissues feel loose rather than tight",
      "Dry skin, dry mucous membranes, and a tendency to dehydrate quickly",
      "Varicose veins, hemorrhoids, or prolapse tendencies — heat weakens vascular tone",
      "Easy bruising, slow wound healing, capillary fragility",
      "Digestive heat with laxity — loose stools, acid reflux, poor sphincter tone",
      "Poor recovery from exertion — the system burns out rather than tenses up",
      "Tendency toward excessive sweating, especially with minimal exertion",
      "Low blood pressure despite running warm — heat with vascular laxity",
    ],
    emotionalTendencies: [
      "Emotional openness that can become boundary-lessness",
      "Difficulty saying no, over-giving, and people-pleasing",
      "Scattered attention — enthusiastic starts without follow-through",
      "Emotional volatility without the tension to contain it — feelings spill out",
      "Fatigue from over-extension rather than from over-work",
      "A sense of being spread too thin, unfocused, and without center",
      "Warmth and generosity that others may exploit",
    ],
    whenImbalanced: "When the Open Flame pattern becomes excessive, you may experience chronic dehydration, tissue laxity leading to varicose veins or prolapse, burnout from over-giving, scattered energy that prevents meaningful accomplishment, and a loss of identity from constantly adapting to others. The flame needs a hearth — without containment, it dies.",
  },

  chapterTwo: {
    subtitle: "The Choleric-Relaxed Pattern in Classical Medicine",
    paragraphs: [
      "The Hot/Dry/Relaxed constitution combines the Choleric temperament's heat and dryness with the tissue state of relaxation — what the Physiomedical tradition called \"atony\" or deficient vital force in the tissues.",
      "While Hippocrates and Galen recognized the Choleric pattern broadly, the Eclectic and Physiomedical traditions added the critical distinction between conditions of tension and relaxation. William Cook, in his Physio-Medical Dispensatory (1869), described tissue relaxation as a state where the vital force fails to maintain proper tone — resulting in laxity, prolapse, and excessive secretion.",
      "For this variant, practitioners favored astringent herbs to restore tissue tone, alongside the cooling and moistening herbs common to all hot/dry patterns. The goal was to contain and direct the fire, not to extinguish it.",
    ],
  },

  chapterThree: {
    subtitle: "A Christian Understanding of Constitutional Medicine",
    paragraphs: [
      "The recognition that people differ in consistent, observable, and clinically significant ways is not borrowed from Eastern religion — it is confirmed by centuries of Western observation and is consistent with the biblical teaching that each person is \"fearfully and wonderfully made\" (Psalm 139:14).",
      "God did not create one human template stamped out in endless copies. He wove each person with particular tendencies, strengths, and vulnerabilities. Constitutional medicine honors this particularity rather than treating all bodies as interchangeable.",
      "We do not need to adopt the metaphysics of other systems to benefit from their observational wisdom. We reject the idea that your constitution is determined by planetary influence, karmic imprint, or the balance of primal elements with independent existence. Instead, we affirm that your constitutional pattern reflects the particular way God designed your body to function — with its own tendencies, its own needs, and its own path toward flourishing.",
    ],
    scriptureVerse: "\"Above all else, guard your heart, for everything you do flows from it\" (Proverbs 4:23). The Open Flame must learn containment — not suppression, but stewardship. A fire in a hearth warms the house. A fire without one burns it down.",
    closingParagraph: "The intelligence that regulates your body — the coherence that holds your systems together — is not an impersonal force. It is upheld by the One in whom \"all things hold together\" (Colossians 1:17). Herbal medicine, rightly understood, is partnership with this design.",
  },

  chapterFour: {
    subtitle: "10 Herbs for The Open Flame",
    intro: "The herbs that best support the Open Flame are those that cool excess heat, moisten dryness, and — critically — restore tissue tone. Astringents (herbs that tighten and tone lax, loose tissue) and tonics are essential for this type, alongside cooling demulcents (herbs that coat and soothe irritated tissue).",
    herbs: [
      {
        name: "Witch Hazel",
        latin: "Hamamelis virginiana",
        actions: [
          { term: "Astringent", translation: "tightens and tones lax tissue" },
          { term: "Anti-inflammatory", translation: "calms inflammation and reduces swelling" },
          { term: "Venotonic", translation: "strengthens blood vessel walls" },
          { term: "Vulnerary", translation: "promotes healing of damaged tissue" },
        ],
        constitutionalMatch: "Witch Hazel is the quintessential remedy for hot tissue laxity. It tones blood vessels, reduces inflammation, and restores integrity to tissues that have lost their structure. For the Open Flame with varicose veins, easy bruising, or hemorrhoids, it is foundational.",
        preparation: "Internal tincture of bark: 15–30 drops 3x daily. External: distilled witch hazel applied topically. Decoction of bark for sitz baths.",
        safety: "Internal use should use bark preparations, not commercial distilled witch hazel (which is for external use only).",
      },
      {
        name: "Yarrow",
        latin: "Achillea millefolium",
        actions: [
          { term: "Astringent", translation: "tightens and tones lax tissue" },
          { term: "Diaphoretic", translation: "promotes gentle sweating to release trapped heat" },
          { term: "Anti-inflammatory", translation: "calms inflammation and reduces swelling" },
          { term: "Hemostatic", translation: "slows or stops excess bleeding" },
          { term: "Bitter tonic", translation: "stimulates digestion through bitter taste receptors" },
        ],
        constitutionalMatch: "Yarrow is cooling, drying, and toning — a perfect match for the Open Flame. It tightens lax tissues, reduces excessive bleeding or sweating, and moves blood where it has stagnated.",
        preparation: "Hot infusion: 1–2 teaspoons dried herb per cup, steep covered 10–15 minutes. Tincture. External poultice for wounds.",
        safety: "Avoid during pregnancy. May cause sensitivity in those allergic to Asteraceae family plants.",
      },
      {
        name: "Marshmallow Root",
        latin: "Althaea officinalis",
        actions: [
          { term: "Demulcent", translation: "coats and soothes irritated tissue" },
          { term: "Emollient", translation: "softens and moistens dry membranes" },
          { term: "Cooling, moistening", translation: "" },
          { term: "Anti-inflammatory", translation: "calms inflammation and reduces swelling" },
        ],
        constitutionalMatch: "Marshmallow addresses the dryness axis directly. Its mucilage coats and soothes irritated, inflamed tissues while restoring moisture to a system that burns dry.",
        preparation: "Cold infusion: 1–2 tablespoons dried root in a quart of room-temperature water, steep 4–8 hours.",
        safety: "May slow absorption of medications. Separate by 1–2 hours.",
      },
      {
        name: "Red Raspberry Leaf",
        latin: "Rubus idaeus",
        actions: [
          { term: "Uterine tonic", translation: "" },
          { term: "Astringent", translation: "tightens and tones lax tissue" },
          { term: "Nutritive", translation: "rich in vitamins and minerals your body can absorb" },
          { term: "Mild anti-inflammatory", translation: "" },
        ],
        constitutionalMatch: "Red Raspberry Leaf is a gentle astringent tonic that restores tone to smooth muscle throughout the body — not just the uterus. For the Open Flame with generalized tissue laxity, it builds structure and containment over time.",
        preparation: "Standard infusion or long infusion: 1 oz dried leaf to 1 quart water. Can be drunk freely as a daily tea.",
        safety: "Very safe. One of the best long-term tonic herbs available.",
      },
      {
        name: "Rose",
        latin: "Rosa spp.",
        actions: [
          { term: "Cooling", translation: "" },
          { term: "Mildly astringent", translation: "tightens and tones lax tissue" },
          { term: "Nervine", translation: "" },
          { term: "Heart tonic", translation: "" },
          { term: "Anti-inflammatory", translation: "calms inflammation and reduces swelling" },
        ],
        constitutionalMatch: "Rose cools heat and gently astringes lax tissues. It is particularly indicated for the Open Flame who gives too freely and needs to restore emotional and physical boundaries. Rose teaches containment with grace.",
        preparation: "Infusion of dried rose petals, rose water in beverages, glycerite. Rose honey is traditional.",
        safety: "Ensure roses are organically grown and unsprayed.",
      },
      {
        name: "Calendula",
        latin: "Calendula officinalis",
        actions: [
          { term: "Lymphatic", translation: "moves fluid through the lymph system to clear waste" },
          { term: "Vulnerary", translation: "promotes healing of damaged tissue" },
          { term: "Anti-inflammatory", translation: "calms inflammation and reduces swelling" },
          { term: "Mild astringent", translation: "" },
          { term: "Antimicrobial", translation: "fights harmful bacteria, viruses, and fungi" },
        ],
        constitutionalMatch: "Calendula moves lymph, heals damaged tissue, and provides gentle astringency. For the Open Flame with slow-healing wounds, inflamed skin, or lymphatic sluggishness, calendula promotes repair and resolution.",
        preparation: "Infusion of dried flowers. Tincture. Oil infusion for external use.",
        safety: "Avoid if allergic to Asteraceae family plants.",
      },
      {
        name: "Hawthorn",
        latin: "Crataegus spp.",
        actions: [
          { term: "Cardiovascular tonic", translation: "nourishes and strengthens the heart over time" },
          { term: "Venotonic", translation: "strengthens blood vessel walls" },
          { term: "Hypotensive", translation: "gently helps lower blood pressure" },
          { term: "Antioxidant", translation: "protects your cells from damage" },
        ],
        constitutionalMatch: "Hawthorn strengthens blood vessel walls and restores vascular tone. For the Open Flame with capillary fragility, low blood pressure, or a heart that gives too much without replenishing, hawthorn is deeply restorative.",
        preparation: "Tincture of berries, leaves, and flowers combined. Decoction of berries. Safe for long-term daily use.",
        safety: "May potentiate cardiac medications — consult a practitioner if on heart medication.",
      },
      {
        name: "Lemon Balm",
        latin: "Melissa officinalis",
        actions: [
          { term: "Cooling nervine", translation: "" },
          { term: "Carminative", translation: "warms and settles the gut, relieves gas" },
          { term: "Mild sedative", translation: "" },
          { term: "Antiviral", translation: "" },
          { term: "Uplifting", translation: "" },
        ],
        constitutionalMatch: "Lemon Balm cools heat and gently centers scattered energy. For the Open Flame who burns in all directions at once, lemon balm brings focus without suppression.",
        preparation: "Fresh plant is strongest. Standard infusion: 1–2 teaspoons dried herb per cup, steep covered 10–15 minutes.",
        safety: "May theoretically affect thyroid function at very high doses; standard use is safe.",
      },
      {
        name: "Sage",
        latin: "Salvia officinalis",
        actions: [
          { term: "Astringent", translation: "tightens and tones lax tissue" },
          { term: "Antiseptic", translation: "" },
          { term: "Drying", translation: "" },
          { term: "Reduces excessive sweating", translation: "" },
          { term: "Carminative", translation: "warms and settles the gut, relieves gas" },
        ],
        constitutionalMatch: "Sage is specifically indicated for excessive sweating and secretion — common in the Open Flame. It dries and tones where tissues are too open and leaking. It also sharpens a scattered mind.",
        preparation: "Infusion: 1 teaspoon dried leaf per cup. For excessive sweating, drink cold sage tea.",
        safety: "Avoid large medicinal doses during pregnancy. Not for long-term use at high doses.",
      },
      {
        name: "Licorice Root",
        latin: "Glycyrrhiza glabra",
        actions: [
          { term: "Demulcent", translation: "coats and soothes irritated tissue" },
          { term: "Anti-inflammatory", translation: "calms inflammation and reduces swelling" },
          { term: "Adrenal restorative", translation: "rebuilds adrenal glands worn out by chronic stress" },
          { term: "Harmonizer", translation: "" },
        ],
        constitutionalMatch: "Licorice moistens dryness and supports depleted adrenal glands. For the Open Flame who has burned through reserves by over-giving, licorice helps restore what was lost.",
        preparation: "Decoction or as part of herbal formulas. Small amounts harmonize other herbs beautifully.",
        safety: "Not for long-term use at high doses. Avoid with hypertension or edema. DGL form safer for digestive use.",
      },
    ],
  },

  cautionHerbs: [
    { name: "Cayenne", latin: "Capsicum annuum", reason: "Intensely heating and drying. Worsens heat and may further relax vascular tone." },
    { name: "Ginger in excess", latin: "Zingiber officinale", reason: "Warming and diaphoretic. May increase sweating and heat loss." },
    { name: "Coffee", latin: "Coffea arabica", reason: "Heating, stimulating, and dehydrating. Worsens dryness and scattered energy." },
    { name: "Strong stimulant herbs (Ma Huang, Guarana)", latin: "", reason: "Push an already open system further open." },
    { name: "Excessive diaphoretics (Elderflower, Peppermint)", latin: "", reason: "May increase fluid loss." },
    { name: "Alcohol", latin: "", reason: "Hot and drying. Directly aggravates this pattern and weakens vascular tone." },
    { name: "Excess raw, cold foods", latin: "", reason: "While cooling, they may weaken digestive tone further." },
  ],

  chapterFive: {
    subtitle: "Guidance for Your Constitutional Pattern",
    dietary: "Favor cooling, moistening, and building foods — bone broth, well-cooked grains, healthy fats (olive oil, avocado, ghee), stewed fruits, and mineral-rich broths. Include astringent foods: pomegranate, green tea, blackberries. Eat regular meals — your open system needs consistent fuel and structure.",
    movement: "Choose practices that build structure and tone rather than dissipate energy. Moderate strength training, Pilates, walking, and structured movement are ideal. Avoid excessive cardio or hot yoga — these push the flame outward when you need to draw it inward.",
    restRhythm: "Structure is your medicine. Consistent meal times, sleep times, and work rhythms provide the containment your open flame needs. Build boundaries into your schedule — not because you want to, but because your body requires it.",
    spiritualPractice: "\"Let your yes be yes and your no be no\" (Matthew 5:37). Your tendency is to say yes to everything and everyone. Learning to say no is not selfishness — it is stewardship of the fire God gave you.",
  },

  coachingCTA: {
    title: "Need Help Applying This?",
    intro: "This guide gives you the map. A 1:1 consultation helps you navigate it.",
    body: "You now know your constitutional pattern, your herbal allies, and the lifestyle principles that support your body. But applying this to your specific life — your symptoms, your season, your family's needs — is where the real transformation happens.",
    bullets: [
      "Review your quiz results and identify any secondary patterns layered on top of your primary constitution",
      "Build a personalized herbal protocol — your specific herbs, your specific doses, matched to what you're experiencing right now",
      "Create a daily rhythm plan tailored to your constitutional needs — when to eat, move, rest, and supplement",
      "Address your top 3 health concerns through a constitutional lens, not a symptom-chasing one",
      "Walk you through preparation methods so you feel confident making teas, tinctures, or decoctions at home",
    ],
  },

  courseCTA: {
    title: "The Foundations Course",
    subtitle: "Your Next Step With The Eden Institute",
    body: "This guide has introduced you to your constitutional pattern through the lens of Western herbal tradition. But this is only the beginning.",
    bullets: [
      "Deeper Constitutional Mapping: How your pattern connects to classical Western traditions — translated into a Biblical framework without Eastern metaphysics.",
      "Body System Integration: How your constitutional pattern tends to manifest in each body system — digestive, respiratory, nervous, cardiovascular, endocrine, and more.",
      "Tissue State Assessment: Learn to read the six tissue states (heat, cold, damp, dry, tension, laxity) and how they layer onto your constitutional baseline.",
      "Herbal Actions & Materia Medica: A comprehensive herb library organized by constitutional affinity, with detailed monographs.",
      "Formulation Principles: Learn how to combine herbs effectively for your constitution — which herbs lead, which support, and how to balance a formula.",
      "Biblical Anchors: Scripture-grounded wisdom for every body system and every herbal decision.",
    ],
  },
};
