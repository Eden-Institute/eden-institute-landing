/**
 * The Pattern of Eden — canonical Apothecary constitutional framework.
 *
 * Per Locked Decision §0.8 #15 (Manual v3.2+) the eight Patterns are mapped to
 * a 3-axis terrain model: Temperature × Moisture × Tone. The pattern names are
 * brand-distinct (no other herbalism app uses these archetypes); biblically
 * anchored at Hebrews 8:5 / Exodus 25:9 ("make everything according to the
 * pattern shown to you"); and computable at query time from existing herb
 * energetics columns (temperature, moisture, tissue_states_indicated) — no
 * junction table is required.
 *
 * This module is the single source of truth for:
 *   • the eight Pattern names + their 3-axis composition
 *   • free-text → axis classifiers tolerant of the herb DB's descriptive prose
 *   • `computeMatchRelationship(herb, pattern)` — returns 'match' | 'avoid' | 'neutral'
 *
 * The relationship semantics:
 *   • A herb MATCHES a Pattern when its energetics are *opposite* to the
 *     Pattern's axes — Hot patterns match cooling herbs, Dry patterns match
 *     moistening herbs, Tense patterns match relaxant herbs (terrain
 *     restoration is rebalancing, not reinforcement).
 *   • A herb AGGRAVATES a Pattern when its energetics *match* the Pattern's
 *     axes — a Hot herb aggravates a Hot pattern. Avoid badge.
 *   • Score is 0–3 across the three axes; ≥2 axes opposite = match,
 *     ≥2 axes same = avoid, otherwise neutral.
 *
 * This is intentionally a fuzzy classifier. The herb DB's temperature and
 * moisture columns are descriptive prose ("Cool to neutral", "Drying
 * (diuretic)", "Warm (warming diaphoretic, paradoxically calming)") rather
 * than enum values. We classify by substring rather than exact match, and
 * any value that doesn't clearly fall on an axis returns 'neutral' for that
 * axis (counted as 0 in the score).
 *
 * Tone is derived from `tissue_states_indicated` (a comma-separated text
 * field at the herb level): tension/constriction/stagnation states indicate
 * the herb relaxes tense tissue, laxity/atrophy/deficiency states indicate
 * the herb tonifies relaxed tissue.
 *
 * The 8 archetypes also live in resend-waitlist's constitutionProfiles
 * (intro/anchor/herbs by Pattern name); future work may unify the two
 * sources behind a shared content module, but the relationship-computing
 * logic lives here.
 */

export const EDEN_PATTERNS = [
  "The Burning Bowstring",
  "The Open Flame",
  "The Pressure Cooker",
  "The Overflowing Cup",
  "The Drawn Bowstring",
  "The Spent Candle",
  "The Frozen Knot",
  "The Still Water",
] as const;

export type EdenPatternName = (typeof EDEN_PATTERNS)[number];

export type TemperatureAxis = "Hot" | "Cold" | "Neutral";
export type MoistureAxis = "Dry" | "Damp" | "Neutral";
export type ToneAxis = "Tense" | "Relaxed" | "Neutral";

export interface EdenPatternProfile {
  name: EdenPatternName;
  temperature: "Hot" | "Cold";
  moisture: "Dry" | "Damp";
  tone: "Tense" | "Relaxed";
  /** One- or two-line plain-meaning summary for result and personalization surfaces. */
  summary: string;
  /** Biblical anchor verse; surfaced on the result page and the welcome tour. */
  anchorVerse: string;
}

export const PATTERN_PROFILES: Record<EdenPatternName, EdenPatternProfile> = {
  "The Burning Bowstring": {
    name: "The Burning Bowstring",
    temperature: "Hot",
    moisture: "Dry",
    tone: "Tense",
    summary:
      "Heat held under tension — drawn taut, parched, running hot. The body is over-strung and over-fired at once.",
    anchorVerse: "Hebrews 8:5",
  },
  "The Open Flame": {
    name: "The Open Flame",
    temperature: "Hot",
    moisture: "Dry",
    tone: "Relaxed",
    summary:
      "Heat without holding — fire spreading through dry tissue with little structural restraint to bound it.",
    anchorVerse: "Hebrews 8:5",
  },
  "The Pressure Cooker": {
    name: "The Pressure Cooker",
    temperature: "Hot",
    moisture: "Damp",
    tone: "Tense",
    summary:
      "Heat trapped under pressure — fluids stagnant, tissues congested and contracted, steam with no release valve.",
    anchorVerse: "Hebrews 8:5",
  },
  "The Overflowing Cup": {
    name: "The Overflowing Cup",
    temperature: "Hot",
    moisture: "Damp",
    tone: "Relaxed",
    summary:
      "Heat in fluid excess — tissues warm, soft, and brimming over their proper bounds.",
    anchorVerse: "Hebrews 8:5",
  },
  "The Drawn Bowstring": {
    name: "The Drawn Bowstring",
    temperature: "Cold",
    moisture: "Dry",
    tone: "Tense",
    summary:
      "Cold under tension — the body braced and constricted, fluids withheld, energy reserved rather than circulating.",
    anchorVerse: "Hebrews 8:5",
  },
  "The Spent Candle": {
    name: "The Spent Candle",
    temperature: "Cold",
    moisture: "Dry",
    tone: "Relaxed",
    summary:
      "Cold without holding — the wick burning low, tissues thin and spent, vital warmth and fluid both wanting.",
    anchorVerse: "Hebrews 8:5",
  },
  "The Frozen Knot": {
    name: "The Frozen Knot",
    temperature: "Cold",
    moisture: "Damp",
    tone: "Tense",
    summary:
      "Cold and damp held tight — the body chilled, congested, and braced; circulation slowed by both stagnation and contraction.",
    anchorVerse: "Hebrews 8:5",
  },
  "The Still Water": {
    name: "The Still Water",
    temperature: "Cold",
    moisture: "Damp",
    tone: "Relaxed",
    summary:
      "Cold and damp without movement — the body settled and pooled, fluids ample but unmoving, warmth and tone alike subdued.",
    anchorVerse: "Hebrews 8:5",
  },
};

/**
 * AXIS_LABEL_TO_PATTERN — derived inverse of PATTERN_PROFILES.
 *
 * Maps the 3-axis label shape ("Hot / Dry / Tense") to the canonical
 * EdenPatternName ("The Burning Bowstring"). The production marketing quiz
 * (src/pages/Assessment.tsx) writes the axis-label shape into
 * profiles.constitution_type via the resend-waitlist + record-quiz-completion
 * Edge Functions; resolveEdenPattern consults this table to resolve those
 * back to a Pattern name for personalization.
 *
 * Single source of truth: derived from PATTERN_PROFILES at module load. Any
 * Pattern added to PATTERN_PROFILES is auto-included here. No second list to
 * maintain.
 */
export const AXIS_LABEL_TO_PATTERN: Readonly<Record<string, EdenPatternName>> =
  Object.freeze(
    Object.fromEntries(
      Object.values(PATTERN_PROFILES).map((p) => [
        `${p.temperature} / ${p.moisture} / ${p.tone}`,
        p.name,
      ]),
    ),
  );


/**
 * Classify a herb's `temperature` field (descriptive prose) onto the
 * Hot/Cold/Neutral axis. Returns "Neutral" when the value is genuinely
 * neutral or genuinely unparseable.
 */
export function classifyTemperature(value: string | null | undefined): TemperatureAxis {
  if (!value) return "Neutral";
  const lower = value.toLowerCase();
  if (lower.includes("hot") || lower.includes("warm")) return "Hot";
  if (lower.includes("cold") || lower.includes("cool")) return "Cold";
  return "Neutral";
}

/**
 * Classify a herb's `moisture` field onto the Dry/Damp/Neutral axis.
 * Mucilaginous and demulcent values land on Damp.
 */
export function classifyMoisture(value: string | null | undefined): MoistureAxis {
  if (!value) return "Neutral";
  const lower = value.toLowerCase();
  if (
    lower.includes("moist") ||
    lower.includes("damp") ||
    lower.includes("mucil") ||
    lower.includes("demulcent")
  ) {
    return "Damp";
  }
  if (lower.includes("dry")) return "Dry";
  return "Neutral";
}

/**
 * Classify a herb's `tissue_states_indicated` (comma-separated names) onto
 * the Tense/Relaxed/Neutral axis. A herb whose indications include
 * tension/constriction/stagnation states resolves Tense patterns
 * (relaxant); a herb whose indications include laxity/atrophy/deficiency
 * states resolves Relaxed patterns (tonifying).
 */
export function classifyTone(tissueStatesIndicated: string | null | undefined): ToneAxis {
  if (!tissueStatesIndicated) return "Neutral";
  const lower = tissueStatesIndicated.toLowerCase();
  const tenseTokens = ["tension", "constriction", "stagnation", "excitation"];
  const relaxedTokens = ["laxity", "atrophy", "deficiency", "torpor", "exhaustion"];
  const tenseHit = tenseTokens.some((t) => lower.includes(t));
  const relaxedHit = relaxedTokens.some((t) => lower.includes(t));
  if (tenseHit && !relaxedHit) return "Tense";
  if (relaxedHit && !tenseHit) return "Relaxed";
  return "Neutral";
}

export type MatchRelationship = "match" | "avoid" | "neutral";

export interface MatchRelationshipDetail {
  relationship: MatchRelationship;
  /** How many of the 3 axes the herb stands opposite to the Pattern (rebalancing). */
  rebalancingAxes: number;
  /** How many of the 3 axes the herb stands the same as the Pattern (aggravating). */
  aggravatingAxes: number;
}

/**
 * Compute the herb's relationship to a Pattern of Eden profile.
 *
 * The herb input may be any object that surfaces the three axes via
 * `temperature`, `moisture`, and `tissue_states_indicated`. Free/anon
 * callers receive NULL for tissue_states_indicated (Band 3 is Seed+
 * gated), in which case Tone resolves to Neutral and the result depends
 * on Temperature + Moisture alone — still meaningful enough to surface
 * the badge.
 *
 * Decision rule: count rebalancing axes (herb opposite to pattern) and
 * aggravating axes (herb same as pattern). ≥2 rebalancing → match.
 * ≥2 aggravating → avoid. Otherwise neutral. Neutral axes count toward
 * neither bucket.
 */
export function computeMatchRelationship(
  herb: {
    temperature: string | null | undefined;
    moisture: string | null | undefined;
    tissue_states_indicated: string | null | undefined;
  },
  patternName: EdenPatternName,
): MatchRelationshipDetail {
  const profile = PATTERN_PROFILES[patternName];
  const t = classifyTemperature(herb.temperature);
  const m = classifyMoisture(herb.moisture);
  const tone = classifyTone(herb.tissue_states_indicated);

  let rebalancing = 0;
  let aggravating = 0;

  // Temperature axis
  if (t !== "Neutral") {
    if (t !== profile.temperature) rebalancing++;
    else aggravating++;
  }
  // Moisture axis
  if (m !== "Neutral") {
    if (m !== profile.moisture) rebalancing++;
    else aggravating++;
  }
  // Tone axis
  if (tone !== "Neutral") {
    if (tone !== profile.tone) rebalancing++;
    else aggravating++;
  }

  let relationship: MatchRelationship = "neutral";
  if (rebalancing >= 2 && rebalancing > aggravating) relationship = "match";
  else if (aggravating >= 2 && aggravating > rebalancing) relationship = "avoid";

  return { relationship, rebalancingAxes: rebalancing, aggravatingAxes: aggravating };
}

/**
 * Resolve a free-text constitution string (which may come from the
 * existing on-site quiz that writes Western/Ayurvedic/TCM labels into
 * profiles.constitution_type) to an Eden Pattern, with fall-throughs.
 * Returns null when no clean mapping is possible — the badge UI then
 * renders "Take the quiz to see your Pattern" rather than a wrong badge.
 */
export function resolveEdenPattern(value: string | null | undefined): EdenPatternName | null {
  if (!value) return null;

  // Fast path: exact match against canonical Pattern names.
  for (const name of EDEN_PATTERNS) {
    if (name === value) return name;
  }

  // Axis-label match — what the production marketing quiz writes into
  // profiles.constitution_type via record-quiz-completion. Exact key match
  // first, then a normalized fallback for whitespace / case variations.
  const axisHit = AXIS_LABEL_TO_PATTERN[value];
  if (axisHit) return axisHit;
  const normAxis = value.replace(/\s+/g, " ").trim().toLowerCase();
  for (const [label, name] of Object.entries(AXIS_LABEL_TO_PATTERN)) {
    if (label.toLowerCase() === normAxis) return name;
  }

  // Loose Pattern-name match — strip leading "the" and lowercase.
  const norm = value.replace(/^the\s+/i, "").toLowerCase().trim();
  for (const name of EDEN_PATTERNS) {
    if (name.replace(/^the\s+/i, "").toLowerCase() === norm) return name;
  }

  // Future: Western/Ayurvedic/TCM mapping table. For now, return null and
  // let the UI surface the take-the-quiz affordance — better than a
  // wrong-but-confident badge.
  return null;
}
