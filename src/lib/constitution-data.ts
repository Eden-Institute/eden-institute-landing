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
      { name: "Burdock Root", note: "Clears damp heat through the liver and skin." },
      { name: "Motherwort", note: "Releases tension from the heart and calms palpitations." },
      { name: "Skullcap", note: "Calms nervous tension without adding heat or moisture." },
      { name: "Cleavers", note: "Drains congested lymph and cools inflamed tissue." },
      { name: "Nettle Leaf", note: "Mineral-rich diuretic that clears damp without depleting." },
      { name: "Chamomile", note: "Eases digestive tension and cools mild inflammation." },
      { name: "Yarrow", note: "Opens peripheral circulation to release trapped heat." },
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
      { name: "Red Raspberry Leaf", note: "Tones lax tissue while cooling excess heat." },
      { name: "Dandelion Root", note: "Drains damp heat through the liver and kidneys." },
      { name: "Cleavers", note: "Moves stagnant lymph and clears boggy tissue." },
      { name: "Plantain Leaf", note: "Cools and tightens weeping, inflamed tissue." },
      { name: "Yarrow", note: "Dries excess moisture and tones blood vessels." },
      { name: "White Oak Bark", note: "Powerful astringent for lax, overflowing tissue." },
      { name: "Thyme", note: "Dries dampness and warms digestion gently." },
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
      { name: "Marshmallow Root", note: "Moistens dry, depleted tissue throughout the body." },
      { name: "Cinnamon", note: "Gently warms cold digestion and improves circulation." },
      { name: "Licorice Root", note: "Restores adrenal reserves and moistens dry mucous membranes." },
      { name: "Chamomile", note: "Warms digestion gently while calming nervous tension." },
      { name: "Lemon Balm", note: "Lifts anxious spirits without adding stimulation." },
      { name: "Hawthorn Berry", note: "Nourishes the heart and steadies anxious palpitations." },
      { name: "Schisandra", note: "Adaptogen that astringes leaking vitality and calms the mind." },
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
      { name: "Marshmallow Root", note: "Deeply moistens parched, exhausted tissue." },
      { name: "Licorice Root", note: "Supports adrenals and restores moisture to dry systems." },
      { name: "Milky Oats", note: "Gently rebuilds a burned-out nervous system over time." },
      { name: "Shatavari", note: "Nourishing tonic that rebuilds reproductive and digestive vitality." },
      { name: "Cinnamon", note: "Warms cold digestion and improves nutrient absorption." },
      { name: "Rehmannia", note: "Deep yin tonic that restores depleted blood and fluids." },
      { name: "Red Raspberry Leaf", note: "Tones lax tissue and provides gentle mineral nourishment." },
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
      { name: "Cramp Bark", note: "Releases deep muscular spasm and visceral tension." },
      { name: "Rosemary", note: "Warms and stimulates sluggish circulation and mental fog." },
      { name: "Angelica Root", note: "Warming aromatic that moves cold, stuck blood." },
      { name: "Cinnamon", note: "Deeply warming and drying for cold, damp stagnation." },
      { name: "Thyme", note: "Dries damp congestion and warms respiratory tissue." },
      { name: "Juniper Berry", note: "Warming diuretic that clears cold, waterlogged tissue." },
      { name: "Black Pepper", note: "Penetrating warmth that breaks through deep stagnation." },
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
      { name: "Cinnamon", note: "Kindles digestive fire and dries excess dampness." },
      { name: "Sage", note: "Dries damp tissue and sharpens sluggish cognition." },
      { name: "Prickly Ash", note: "Stimulates circulation and breaks through deep stagnation." },
      { name: "Juniper Berry", note: "Warming diuretic that drains waterlogged tissue." },
      { name: "Thyme", note: "Dries respiratory dampness and warms digestion." },
      { name: "Elecampane", note: "Warms and dries cold, damp lungs and sluggish digestion." },
      { name: "Bayberry", note: "Powerful warming astringent that tones lax, boggy tissue." },
    ],
    amazonUrl: "https://www.amazon.com/hz/wishlist/ls/2OV04T0L7C1FA?ref_=wl_share",
  },
};

export function getNickname(constitutionType: string): string {
  return constitutionProfiles[constitutionType]?.nickname ?? constitutionType;
}

/**
 * Compute the 3-axis result label from quiz answers.
 *
 * Per Locked Decision §0.8 #39, inconclusive results never default to a
 * Pattern. Each axis resolves to the dominant direction ONLY when the count
 * strictly exceeds the opposite count. Ties (including all-neutral answers)
 * resolve to "Neutral" on that axis. Any "Neutral" in the result string
 * means the user should be routed to the inconclusive UI, not the email
 * gate or the Pattern result.
 *
 * Use `isInconclusiveResult(result)` to test for inconclusivity rather than
 * substring-matching on the caller side.
 */
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
    if (firstCount > secondCount) results.push(axis.first);
    else if (secondCount > firstCount) results.push(axis.second);
    else results.push("Neutral");
  }
  return results.join(" / ");
}

/**
 * Identify the axes that came back Neutral, for surfacing in the
 * inconclusive UI ("Your responses didn't show a clear pattern on the
 * temperature axis"). Returns the human-readable axis names, in the same
 * order as the result string.
 */
export function inconclusiveAxes(result: string): Array<"temperature" | "fluid" | "tone"> {
  const parts = result.split(" / ");
  const axisNames: Array<"temperature" | "fluid" | "tone"> = [
    "temperature",
    "fluid",
    "tone",
  ];
  const out: Array<"temperature" | "fluid" | "tone"> = [];
  parts.forEach((p, i) => {
    if (p === "Neutral" && axisNames[i]) out.push(axisNames[i]);
  });
  return out;
}

/**
 * True when any axis is Neutral. The Assessment phase machine routes to
 * "inconclusive" when this returns true; never silently defaults to a
 * Pattern.
 */
export function isInconclusiveResult(result: string): boolean {
  return result.split(" / ").includes("Neutral");
}

// ============================================================================
// v3.31 additions — axis-counts API for Option A+B quiz fix
// ============================================================================
//
// The targeted-follow-up flow needs a count-based scoring API rather than the
// id-range-based computeResult above. Existing computeResult / inconclusiveAxes
// / isInconclusiveResult preserved unchanged for backward compat with anything
// already calling them on the Edge Function side or in tests.

export type Axis = "temperature" | "fluid" | "tone";

/**
 * Per-axis answer counts. Used by both the original 12-question scoring path
 * (via buildAxisCounts) and the targeted follow-up path (combine original +
 * follow-up answers, then call buildAxisCounts again with the combined set).
 */
export interface AxisCounts {
  temperature: { hot: number; cold: number; neutral: number; total: number };
  fluid: { damp: number; dry: number; neutral: number; total: number };
  tone: { tense: number; relaxed: number; neutral: number; total: number };
}

/**
 * Minimal question shape for axis classification. The full Question /
 * FollowupQuestion types in Assessment.tsx + quiz-followup.ts both extend
 * this implicitly via their `id` + `axis` fields.
 */
export interface QuestionAxisDef {
  id: number;
  axis: Axis;
}

/**
 * Build per-axis answer counts from a Record<questionId, scoreValue> and a
 * questions definition list. Counts each answer toward its axis's first /
 * second / neutral bucket. Robust to: missing answers (just doesn't count),
 * unknown score values (counted as neutral), questions not in the list
 * (ignored). Used by Assessment.tsx for both the initial pass and the
 * targeted-follow-up combined recompute.
 */
export function buildAxisCounts(
  answers: Record<number, string>,
  questions: ReadonlyArray<QuestionAxisDef>,
): AxisCounts {
  const counts: AxisCounts = {
    temperature: { hot: 0, cold: 0, neutral: 0, total: 0 },
    fluid: { damp: 0, dry: 0, neutral: 0, total: 0 },
    tone: { tense: 0, relaxed: 0, neutral: 0, total: 0 },
  };
  for (const q of questions) {
    const score = answers[q.id];
    if (score === undefined) continue;
    counts[q.axis].total++;
    if (q.axis === "temperature") {
      if (score === "Hot") counts.temperature.hot++;
      else if (score === "Cold") counts.temperature.cold++;
      else counts.temperature.neutral++;
    } else if (q.axis === "fluid") {
      if (score === "Damp") counts.fluid.damp++;
      else if (score === "Dry") counts.fluid.dry++;
      else counts.fluid.neutral++;
    } else {
      if (score === "Tense") counts.tone.tense++;
      else if (score === "Relaxed") counts.tone.relaxed++;
      else counts.tone.neutral++;
    }
  }
  return counts;
}

/**
 * Resolve per-axis counts to the same `"Hot / Damp / Tense"`-shaped result
 * string that computeResult emits. Lock #39 semantics preserved: ties
 * (including all-neutral) resolve to "Neutral" on that axis; any "Neutral"
 * in the result makes the entire result inconclusive (use
 * isInconclusiveResult to test).
 */
export function computeResultFromCounts(counts: AxisCounts): string {
  const t =
    counts.temperature.hot > counts.temperature.cold
      ? "Hot"
      : counts.temperature.cold > counts.temperature.hot
        ? "Cold"
        : "Neutral";
  const f =
    counts.fluid.damp > counts.fluid.dry
      ? "Damp"
      : counts.fluid.dry > counts.fluid.damp
        ? "Dry"
        : "Neutral";
  const tone =
    counts.tone.tense > counts.tone.relaxed
      ? "Tense"
      : counts.tone.relaxed > counts.tone.tense
        ? "Relaxed"
        : "Neutral";
  return `${t} / ${f} / ${tone}`;
}

/**
 * Identify the axes that resolved to Neutral from per-axis counts. Used to
 * decide which follow-up questions to surface in the targeted-follow-up
 * phase (smart targeting per Option B — only inconclusive axes get
 * follow-up, not a blanket extension of the quiz).
 */
export function getNeutralAxesFromCounts(counts: AxisCounts): Axis[] {
  const out: Axis[] = [];
  if (counts.temperature.hot === counts.temperature.cold) out.push("temperature");
  if (counts.fluid.damp === counts.fluid.dry) out.push("fluid");
  if (counts.tone.tense === counts.tone.relaxed) out.push("tone");
  return out;
}
