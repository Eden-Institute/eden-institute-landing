export const CONSTITUTION_MAP: Record<string, { slug: string; name: string }> = {
  "Hot / Dry / Tense": { slug: "burning-bowstring", name: "The Burning Bowstring" },
  "Hot / Dry / Relaxed": { slug: "open-flame", name: "The Open Flame" },
  "Hot / Damp / Tense": { slug: "pressure-cooker", name: "The Pressure Cooker" },
  "Hot / Damp / Relaxed": { slug: "overflowing-cup", name: "The Overflowing Cup" },
  "Cold / Dry / Tense": { slug: "drawn-bowstring", name: "The Drawn Bowstring" },
  "Cold / Dry / Relaxed": { slug: "spent-candle", name: "The Spent Candle" },
  "Cold / Damp / Tense": { slug: "frozen-knot", name: "The Frozen Knot" },
  "Cold / Damp / Relaxed": { slug: "still-water", name: "The Still Water" },
};

export function getSlugFromType(constitutionType: string): string {
  return CONSTITUTION_MAP[constitutionType]?.slug ?? "burning-bowstring";
}

export function getNameFromType(constitutionType: string): string {
  return CONSTITUTION_MAP[constitutionType]?.name ?? "Unknown";
}