export interface ConstitutionProfile {
  nickname: string;
  tagline: string;
  description: string[];
  herbs: { name: string; note: string }[];
  amazonUrl: string;
}

export const constitutionProfiles: Record<string, ConstitutionProfile> = {
  "Hot / Dry / Tense": {
    nickname: "The Burning Bowstring",
    tagline: "You run hot, burn dry, and hold everything tight.",
    description: [
      "You are wired for intensity. Your metabolism runs high, your mind moves quickly, and your body generates heat readily. But you also carry significant tension — muscular, nervous, and emotional. Your system is like a bowstring drawn too tight and set on fire: powerful, precise, but at constant risk of snapping. You tend to be driven, goal-oriented, and capable of extraordinary effort — but you rarely know when to stop.",
      "Your body needs cooling, moistening, and relaxing support — not more stimulation. The herbs that serve you best are those that soften the edges, replenish lost fluids, and calm the fire without extinguishing your vitality.",
    ],
    herbs: [
      { name: "Chamomile", note: "Cools heat and calms digestive tension." },
      { name: "California Poppy", note: "Relaxes nervous tension without sedation." },
      { name: "Marshmallow Root", note: "Soothes and moistens dry, irritated tissue." },
      { name: "Lemon Balm", note: "Cools nervous heat and lifts anxious tension." },
      { name: "Passionflower", note: "Quiets an overactive mind and releases muscular holding." },
      { name: "Skullcap", note: "Deeply calms the nervous system without suppressing function." },
      { name: "Hawthorn Berry", note: "Cools cardiovascular heat and supports heart under stress." },
      { name: "Licorice Root", note: "Moistens dry tissue and soothes inflamed mucous membranes." },
      { name: "Plantain Leaf", note: "Cools and heals irritated, dry tissue throughout the body." },
      { name: "Slippery Elm", note: "Coats and protects dry, inflamed digestive lining." },
    ],
    amazonUrl: "https://www.amazon.com/hz/wishlist/ls/3SVZB0BRV2IE3?ref_=wl_share",
  },
  "Hot / Dry / Relaxed": {
    nickname: "The Open Flame",
    tagline: "You burn bright and open — warm, expressive, and unguarded.",
    description: [
      "You are wired for warmth and openness. Your metabolism runs high, your body generates heat readily, and your tissues tend toward relaxation. You burn freely — an open flame without a hearth. This creates a pattern of heat dissipation and tissues that lack tone. You tend to be expressive, spontaneous, and emotionally available. But without structure, the fire spreads too thin.",
      "Your healing journey is about containment without restriction — learning to direct your warmth purposefully rather than letting it radiate without boundary.",
    ],
    herbs: [
      { name: "Witch Hazel", note: "Tones lax blood vessels and reduces inflammation." },
      { name: "Yarrow", note: "Tightens loose tissue and cools heat." },
      { name: "Red Raspberry Leaf", note: "Gently restores muscle tone throughout the body." },
      { name: "White Oak Bark", note: "Powerful astringent that firms lax, weeping tissue." },
      { name: "Hibiscus", note: "Cools heat and gently tones blood vessels." },
      { name: "Rose Petals", note: "Mild astringent that cools and lifts the spirit." },
      { name: "Lemon Balm", note: "Cools nervous heat and supports digestion." },
      { name: "Elderflower", note: "Opens pores to release trapped heat safely." },
      { name: "Plantain Leaf", note: "Cools and tightens irritated, relaxed tissue." },
      { name: "Chamomile", note: "Gentle cooling anti-inflammatory for overheated systems." },
    ],
    amazonUrl: "https://www.amazon.com/hz/wishlist/ls/1ELQEQ7OEN6V6?ref_=wl_share",
  },
  "Hot / Damp / Tense": {
    nickname: "The Pressure Cooker",
    tagline: "You run hot, hold fluid, and clench tight. Pressure builds with no release valve.",
    description: [
      "You carry heat and moisture in your system, but you also carry significant tension. Your body generates warmth, retains fluid, and holds everything tight. Heat trapped under tension, inflammation that cannot resolve, and a system that builds pressure until it erupts. You tend to be intense, focused, and powerful.",
      "Your work is to create outlets — not through force, but through gentle, consistent release. Movement, bitter herbs, and nervines that don't add more heat are your allies.",
    ],
    herbs: [
      { name: "Dandelion", note: "Supports liver and kidney drainage to release pressure." },
      { name: "Linden", note: "Relaxes tension AND lowers blood pressure AND opens pores." },
      { name: "Calendula", note: "Moves lymph and heals inflamed tissue." },
    ],
    amazonUrl: "https://www.amazon.com/hz/wishlist/ls/QR7IKCJ9S89E?ref_=wl_share",
  },
  "Hot / Damp / Relaxed": {
    nickname: "The Overflowing Cup",
    tagline: "You run warm, hold fluid, and everything spills over.",
    description: [
      "You carry both heat and moisture, and your tissues tend toward relaxation. Warm abundance that cannot be contained: excess fluid, lax tissues, and a system that leaks rather than holds. You tend to be expressive, nurturing, and emotionally available. But without tone and structure, the abundance becomes excess.",
      "Your path involves drying, cooling, and toning simultaneously. Astringent herbs that tighten lax tissues, bitter herbs that clear damp heat, and gentle stimulants that improve sluggish elimination will help you find your edges again.",
    ],
    herbs: [
      { name: "Calendula", note: "Moves sluggish lymph and promotes tissue healing." },
      { name: "Sage", note: "Dries and tones where tissues are too open." },
      { name: "Oregon Grape Root", note: "Cools damp heat and supports liver function." },
    ],
    amazonUrl: "https://www.amazon.com/hz/wishlist/ls/23IQ93Z31QB8Z?ref_=wl_share",
  },
  "Cold / Dry / Tense": {
    nickname: "The Drawn Bowstring",
    tagline: "You run cold, dry, and tight — depleted but unable to rest.",
    description: [
      "You run cold, your tissues are dry, and yet you cannot relax. A system under tension with insufficient resources to sustain it. The string is taut, but the bow is brittle. You tend toward thoughtfulness and analytical ability, but the tension axis adds anxiety and hypervigilance that prevents the rest your depleted system needs.",
      "Your healing lies in warmth, moisture, and gentle release. You need herbs that kindle your internal fire, soften dried-out tissues, and slowly coax your nervous system out of its guarded posture.",
    ],
    herbs: [
      { name: "Ashwagandha", note: "Deeply restorative — calms anxiety while building strength." },
      { name: "Valerian", note: "Releases the tension your body cannot let go of on its own." },
      { name: "Milky Oats", note: "Slowly rebuilds an exhausted nervous system." },
    ],
    amazonUrl: "https://www.amazon.com/hz/wishlist/ls/2TK1B0LX1VFPS?ref_=wl_share",
  },
  "Cold / Dry / Relaxed": {
    nickname: "The Spent Candle",
    tagline: "You have burned to the wick — cold, dry, and too exhausted to hold yourself together.",
    description: [
      "Your system has run out of fuel. Unlike the Drawn Bowstring, you have passed beyond tension into collapse. Your tissues are cold, dry, and lax. Your energy is spent. Your reserves are gone. Under normal conditions, your gifts — thoughtfulness, sensitivity, creativity — are genuine strengths. But in the depleted state, they are buried under exhaustion.",
      "Your path is the most gentle of all — slow, steady rebuilding. Warming, moistening, and toning herbs taken consistently over time will gradually restore what was lost.",
    ],
    herbs: [
      { name: "Ashwagandha", note: "Rebuilds depleted reserves without overstimulating." },
      { name: "Nettle", note: "Mineral-rich nourishment that rebuilds from the ground up." },
      { name: "Astragalus", note: "Builds deep immune strength and protective energy over time." },
    ],
    amazonUrl: "https://www.amazon.com/hz/wishlist/ls/2Q5D53CU2ZW1L?ref_=wl_share",
  },
  "Cold / Damp / Tense": {
    nickname: "The Frozen Knot",
    tagline: "You run cold, hold water, and lock everything down.",
    description: [
      "Your system has become cold, waterlogged, and tense simultaneously. This creates a body that is both stagnant and clenched, unable to move and unable to release. Your underlying strengths include resilience, loyalty, and emotional depth. But the tension transforms endurance into rigidity.",
      "Your healing requires gentle warming, drying herbs, and antispasmodics to release the tension so the warming herbs can actually penetrate.",
    ],
    herbs: [
      { name: "Ginger", note: "Warms the core and moves stagnant fluids." },
      { name: "Valerian", note: "Releases the tension so warming herbs can penetrate." },
      { name: "Prickly Ash", note: "Powerfully moves blood and lymph to break through stagnation." },
    ],
    amazonUrl: "https://www.amazon.com/hz/wishlist/ls/7NTDELHCTNMO?ref_=wl_share",
  },
  "Cold / Damp / Relaxed": {
    nickname: "The Still Water",
    tagline: "You run deep and slow — calm, patient, and unmoved.",
    description: [
      "Your metabolism conserves energy, your body retains moisture, and your tissues are relaxed. A body designed for steady, sustained function, not quick bursts. Under normal conditions, this is remarkable resilience: calm under pressure, reliable, and deeply rooted. But when the Still Water becomes too still, calm becomes stagnation.",
      "Your path is activation — gentle, sustained activation, not aggressive stimulation. Warming, drying, and toning herbs will help you metabolize what's accumulated and build the internal fire needed to move stagnant energy.",
    ],
    herbs: [
      { name: "Ginger", note: "Warms and stimulates sluggish digestion and circulation." },
      { name: "Rosemary", note: "Clears mental fog and lifts depressed spirits." },
      { name: "Astragalus", note: "Builds deep energy reserves and immune function." },
    ],
    amazonUrl: "https://www.amazon.com/hz/wishlist/ls/2OV04T0L7C1FA?ref_=wl_share",
  },
};

export function getNickname(constitutionType: string): string {
  return constitutionProfiles[constitutionType]?.nickname ?? constitutionType;
}

export function computeResult(answers: Record<number, string>): string {
  const axes = {
    temperature: { first: "Hot", second: "Cold", questions: [1, 2, 3, 4] },
    fluid: { first: "Damp", second: "Dry", questions: [5, 6, 7, 8] },
    tone: { first: "Tense", second: "Relaxed", questions: [9, 10, 11, 12] },
  };
  const results: string[] = [];
  for (const axis of Object.values(axes)) {
    let firstCount = 0;
    let secondCount = 0;
    for (const qId of axis.questions) {
      const score = answers[qId];
      if (score === axis.first) firstCount++;
      if (score === axis.second) secondCount++;
    }
    results.push(firstCount >= secondCount ? axis.first : axis.second);
  }
  return results.join(" / ");
}
