// multi-framework-engine — Phase 2 compute engine (PD-5, PD-6, PD-10, TL-7).
//
// Pure function over (bank, responses, population): no I/O, no clock. The
// bank (public.quiz_banks.bank) carries the questions, option→dimension
// score vectors, population weights, red-flag overrides, framework
// coefficient matrices, and disagreement rules — so this engine is generic
// over bank versions and a quiz-version bump recomputes any historical
// completion from its stored raw_responses (Lock #37).
//
// Semantics:
//   • Dimension scores normalize to −1…+1 by each question's potential
//     contribution, so unanswered/skipped items shrink coverage rather than
//     biasing the score.
//   • Red flags force an axis to a pole with confidence 1 (an unambiguous
//     acute sign outranks the aggregate).
//   • Every axis can resolve to a pole OR an explicit balanced state
//     (|score| < balanced_band). A balanced axis yields NO forced Eden
//     primary (Lock #39: never default to a Pattern).
//   • Framework readings carry primary + secondary (within secondary_margin)
//     + the full spectrum (PD-6).
//   • Disagreements: a non-Eden primary whose expected axis signature
//     contradicts a confident Eden axis is flagged, never resolved (PD-10).

export type Population = "adult" | "child" | "pregnancy" | "elderly";

export interface AxisReading {
  score: number;
  confidence: number;
  balanced: boolean;
  forced: boolean;
}

export interface PatternScore {
  pattern_id: string;
  score: number;
  confidence: number;
}

export interface FrameworkReading {
  primary: PatternScore | null;
  secondary: PatternScore | null;
  spectrum: Record<string, number>;
  balanced: boolean;
}

export interface Disagreement {
  framework: string;
  pattern_id: string;
  axis: string;
  expected_sign: number;
  actual_score: number;
}

export interface EngineResult {
  axes: Record<string, AxisReading>;
  dimensions: Record<string, { score: number; coverage: number }>;
  frameworks: Record<string, FrameworkReading>;
  disagreements: Disagreement[];
  answered: number;
  applicable: number;
}

// deno-lint-ignore no-explicit-any
type Bank = any;

const round3 = (n: number) => Math.round(n * 1000) / 1000;

function populationWeight(question: Bank, population: Population): number {
  if (population === "child") {
    return question.kid_text ? 1 : 0; // items without a kid variant are skipped
  }
  if (population === "pregnancy") return question.pregnancy_weight ?? 1;
  if (population === "elderly") return question.elderly_weight ?? 1;
  return 1;
}

export function computeMultiFramework(
  bank: Bank,
  responses: Record<string, number>,
  population: Population,
): EngineResult {
  const dims: string[] = bank.dimensions;
  const num: Record<string, number> = {};
  const denom: Record<string, number> = {};
  const potentialTotal: Record<string, number> = {};
  for (const d of dims) { num[d] = 0; denom[d] = 0; potentialTotal[d] = 0; }

  const forced: Record<string, number> = {};
  let answered = 0;
  let applicable = 0;

  for (const question of bank.questions) {
    const w = populationWeight(question, population);
    if (w === 0) continue;
    applicable++;

    // Per-dimension potential = the largest |score| any option could
    // contribute; forms the normalization denominator whether or not the
    // question was answered (unanswered → coverage loss, not score bias).
    const potentials: Record<string, number> = {};
    for (const option of question.options) {
      for (const [d, s] of Object.entries(option.scores ?? {})) {
        potentials[d] = Math.max(potentials[d] ?? 0, Math.abs(s as number));
      }
    }
    for (const [d, p] of Object.entries(potentials)) potentialTotal[d] += p * w;

    const chosen = responses[question.id];
    if (chosen === undefined || chosen === null) continue;
    const option = question.options[chosen];
    if (!option) continue;
    answered++;

    for (const [d, p] of Object.entries(potentials)) denom[d] += p * w;
    for (const [d, s] of Object.entries(option.scores ?? {})) {
      num[d] += (s as number) * w;
    }

    if (question.red_flag && chosen === question.red_flag.option) {
      for (const [axis, value] of Object.entries(question.red_flag.force)) {
        forced[axis] = value as number;
      }
    }
  }

  const dimensions: Record<string, { score: number; coverage: number }> = {};
  for (const d of dims) {
    const score = denom[d] > 0 ? num[d] / denom[d] : 0;
    const coverage = potentialTotal[d] > 0 ? denom[d] / potentialTotal[d] : 0;
    dimensions[d] = { score: round3(score), coverage: round3(coverage) };
  }

  const band: number = bank.balanced_band ?? 0.2;
  const margin: number = bank.secondary_margin ?? 0.15;

  const axes: Record<string, AxisReading> = {};
  for (const axis of bank.axis_dimensions as string[]) {
    const isForced = forced[axis] !== undefined;
    const score = isForced ? forced[axis] : dimensions[axis].score;
    const coverage = dimensions[axis].coverage;
    const balanced = !isForced && Math.abs(score) < band;
    const confidence = isForced
      ? 1
      : round3(Math.min(1, coverage * (balanced
          ? (1 - Math.abs(score) / band)          // how firmly inside the band
          : (0.4 + 0.6 * Math.min(1, Math.abs(score) / 0.6))))); // how far past it
    axes[axis] = { score: round3(score), confidence, balanced, forced: isForced };
  }

  const frameworks: Record<string, FrameworkReading> = {};

  // Eden: sign-alignment across the three axes → all 8 Patterns' spectrum.
  {
    const patterns: Record<string, Record<string, number>> = {
      EP01: { temperature: 1, moisture: -1, tone: 1 },
      EP02: { temperature: 1, moisture: -1, tone: -1 },
      EP03: { temperature: 1, moisture: 1, tone: 1 },
      EP04: { temperature: 1, moisture: 1, tone: -1 },
      EP05: { temperature: -1, moisture: -1, tone: 1 },
      EP06: { temperature: -1, moisture: -1, tone: -1 },
      EP07: { temperature: -1, moisture: 1, tone: 1 },
      EP08: { temperature: -1, moisture: 1, tone: -1 },
    };
    const spectrum: Record<string, number> = {};
    for (const [pid, signs] of Object.entries(patterns)) {
      let s = 0;
      for (const [axis, sign] of Object.entries(signs)) s += axes[axis].score * sign;
      spectrum[pid] = round3(s / 3);
    }
    const anyBalanced = Object.values(axes).some((a) => a.balanced);
    const ranked = Object.entries(spectrum).sort((a, b) => b[1] - a[1]);
    const meanConf = round3(Object.values(axes).reduce((s, a) => s + a.confidence, 0) / 3);
    frameworks.eden = {
      // Lock #39: a balanced/indeterminate axis yields NO primary Pattern.
      primary: anyBalanced ? null : { pattern_id: ranked[0][0], score: ranked[0][1], confidence: meanConf },
      secondary: !anyBalanced && ranked[0][1] - ranked[1][1] <= margin
        ? { pattern_id: ranked[1][0], score: ranked[1][1], confidence: meanConf }
        : null,
      spectrum,
      balanced: anyBalanced,
    };
  }

  // Linear frameworks: normalized coefficient dot-products.
  for (const [fw, spec] of Object.entries(bank.frameworks as Record<string, Bank>)) {
    if (spec.type !== "linear") continue;
    const spectrum: Record<string, number> = {};
    const confid: Record<string, number> = {};
    for (const [pid, coeffs] of Object.entries(spec.patterns as Record<string, Record<string, number>>)) {
      let s = 0, wsum = 0, c = 0;
      for (const [d, coeff] of Object.entries(coeffs)) {
        s += dimensions[d].score * coeff;
        c += dimensions[d].coverage * Math.abs(coeff);
        wsum += Math.abs(coeff);
      }
      spectrum[pid] = round3(wsum > 0 ? s / wsum : 0);
      confid[pid] = round3(wsum > 0 ? c / wsum : 0);
    }
    const ranked = Object.entries(spectrum).sort((a, b) => b[1] - a[1]);
    const threshold = fw === "tcm" ? (bank.tcm_threshold ?? 0.25) : 0.1;
    const top = ranked[0];
    const balanced = top[1] < threshold;
    frameworks[fw] = {
      primary: balanced ? null : { pattern_id: top[0], score: top[1], confidence: confid[top[0]] },
      secondary: !balanced && ranked.length > 1 && top[1] - ranked[1][1] <= margin && ranked[1][1] >= threshold
        ? { pattern_id: ranked[1][0], score: ranked[1][1], confidence: confid[ranked[1][0]] }
        : null,
      spectrum,
      balanced,
    };
  }

  // PD-10: cross-framework disagreement detection.
  const disagreements: Disagreement[] = [];
  const expected = bank.disagreement_rules?.expected_axes ?? {};
  for (const [fw, reading] of Object.entries(frameworks)) {
    if (fw === "eden" || !reading.primary) continue;
    const signs = expected[reading.primary.pattern_id] ?? {};
    for (const [axis, sign] of Object.entries(signs as Record<string, number>)) {
      const a = axes[axis];
      if (!a || a.balanced) continue;
      if (Math.sign(a.score) === -Math.sign(sign) && Math.abs(a.score) >= band && a.confidence >= 0.4) {
        disagreements.push({
          framework: fw,
          pattern_id: reading.primary.pattern_id,
          axis,
          expected_sign: sign as number,
          actual_score: a.score,
        });
      }
    }
  }

  return { axes, dimensions, frameworks, disagreements, answered, applicable };
}

// Layer-2 continuity: derive the legacy galenic_temperament enum from the
// temperature/moisture axes so the Lock #37 stack stays populated. The enum
// speaks "wet" where the axis speaks "damp".
export function deriveGalenicTemperament(
  axes: Record<string, AxisReading>,
): string {
  const t = axes.temperature, m = axes.moisture;
  const tPole = t.balanced ? null : (t.score > 0 ? "hot" : "cold");
  const mPole = m.balanced ? null : (m.score > 0 ? "wet" : "dry");
  if (!tPole && !mPole) return "eukrasia";
  if (tPole && !mPole) return `simple_dyskrasia_${tPole}`;
  if (!tPole && mPole) return `simple_dyskrasia_${mPole}`;
  return `compound_dyskrasia_${tPole}_${mPole}`;
}

// Layer-4 continuity: vital force from the vitality dimension.
export function deriveVitalForce(
  dimensions: Record<string, { score: number; coverage: number }>,
): string {
  const v = dimensions.vitality;
  if (!v || v.coverage < 0.3) return "balanced";
  if (v.score >= 0.25) return "sthenic";
  if (v.score <= -0.25) return "asthenic";
  return "balanced";
}
