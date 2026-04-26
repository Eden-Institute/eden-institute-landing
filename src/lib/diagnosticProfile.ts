/**
 * DiagnosticProfile — the forward-compatible four-layer profile contract.
 *
 * Per Locked Decision §0.8 #37 (proposed v3.8), the Apothecary diagnostic
 * stack is layered:
 *
 *   LAYER 1 — Eden Pattern (PRIMARY, all authed tiers)
 *             3-axis: Temperature × Moisture × Tone → 8 Patterns
 *             Source: Eden synthesis of Galenic + Physiomedicalist scaffolding
 *
 *   LAYER 2 — Galenic Temperament (Root only, secondary)
 *             9 temperaments: eukrasia + 4 simple dyskrasias + 4 compound
 *             Source: Galen, De Temperamentis (2nd c. AD)
 *
 *   LAYER 3 — Tissue State Profile by Organ System (Root only, tertiary)
 *             6 priority organ systems × Cook's 7 tissue states
 *             Source: Cook, Physio-Medical Dispensatory (1869);
 *                     Felter, Eclectic Materia Medica (1922)
 *
 *   LAYER 4 — Vital Force Reading (Root only, overlay)
 *             3 levels: sthenic, balanced, asthenic
 *             Source: Felter (sthenic/asthenic terminology); Cook (vital force)
 *
 * v1 (this file) ships LAYER 1 only — Layers 2-4 are typed but optional,
 * undefined for users who have only completed the 12-question marketing
 * quiz. When the deep diagnostic ships, the same DiagnosticProfile shape is
 * populated with all four layers — no consuming-component refactor needed.
 *
 * Per Locked Decision §0.8 #38, every diagnostic claim surfaced from this
 * profile must include a primary-text citation. The citation modules
 * (galenicTemperament.ts, tissueStateProfile.ts, vitalForce.ts) ship
 * alongside Layers 2-4 in their respective build phases.
 */

import type { EdenPatternName } from "./edenPattern";

/* -------------------- LAYER 2 — Galenic Temperament -------------------- */

export type GalenicTemperament =
  | "eukrasia"
  | "simple_dyskrasia_hot"
  | "simple_dyskrasia_cold"
  | "simple_dyskrasia_dry"
  | "simple_dyskrasia_wet"
  | "compound_dyskrasia_hot_dry" // classical "choleric"
  | "compound_dyskrasia_hot_wet" // classical "sanguine"
  | "compound_dyskrasia_cold_dry" // classical "melancholic"
  | "compound_dyskrasia_cold_wet"; // classical "phlegmatic"

/* -------------------- LAYER 3 — Tissue State Profile ------------------- */

export type TissueState =
  | "depression"
  | "torpor"
  | "atrophy"
  | "atony"
  | "excitation"
  | "irritation"
  | "constriction"
  | "mixed";

export type OrganSystem =
  | "nervous"
  | "digestive"
  | "cardiovascular"
  | "respiratory"
  | "musculoskeletal"
  | "integumentary";

export type TissueStateProfile = Partial<Record<OrganSystem, TissueState>>;

/* -------------------- LAYER 4 — Vital Force --------------------------- */

export type VitalForce = "sthenic" | "balanced" | "asthenic";

/* -------------------- Eden axes (Layer 1 underlying detail) ----------- */

export type TemperatureReading = "Hot" | "Cold" | "Neutral";
export type MoistureReading = "Dry" | "Damp" | "Neutral";
export type ToneReading = "Tense" | "Relaxed" | "Neutral";

export interface EdenAxisReadings {
  temperature: TemperatureReading;
  moisture: MoistureReading;
  tone: ToneReading;
}

/* -------------------- The unified profile contract -------------------- */

/**
 * Provenance of the Layer 1 value in this profile.
 *
 * Per Lock #38 (citation integrity), the source must honestly identify the
 * pipeline that produced the value. Per Lock #40 strict separation, the
 * marketing-quiz namespace (12-q anonymous funnel via quiz_completions) is
 * never conflated with the in-app diagnostic namespace (auth'd via
 * diagnostic_completions through record-diagnostic-completion).
 *
 *   • marketing_quiz_12q                  — anonymous /quiz, email-keyed.
 *   • marketing_quiz_12q_legacy_bridge   — legacy bridge fallback: the user
 *     read came from profiles.constitution_type because their account
 *     pre-dates the v3.10 sync trigger and they have not retaken the quiz
 *     in-app yet. See Manual v3.14 Phase 8 durable architectural finding.
 *   • in_app_diagnostic_12q              — auth'd user took the 12-q
 *     diagnostic from inside the apothecary (per-profile picker context).
 *   • deep_diagnostic_40q                 — Root-tier 40-question deep
 *     diagnostic. Sets has_full_diagnostic_depth.
 *
 * Mapper: src/lib/diagnosticSource.ts (provenanceForQuizVersion).
 */
export type DiagnosticSource =
  | "marketing_quiz_12q"
  | "marketing_quiz_12q_legacy_bridge"
  | "in_app_diagnostic_12q"
  | "deep_diagnostic_40q";

export interface DiagnosticProfile {
  /**
   * LAYER 1 — Eden Pattern. Always present after any quiz completion.
   * Null in this field is impossible by construction — if there is no
   * resolved Pattern, the consumer should receive `null` for the entire
   * profile from the hook, not a profile with null Pattern.
   */
  edenPattern: EdenPatternName;

  /** LAYER 1 detail — underlying axis readings. */
  edenAxes: EdenAxisReadings;

  /** LAYER 2 — Root deep diagnostic only. Undefined for 12-q-only users. */
  galenicTemperament?: GalenicTemperament;

  /** LAYER 3 — Root deep diagnostic only. Undefined for 12-q-only users. */
  tissueStateProfile?: TissueStateProfile;

  /** LAYER 4 — Root deep diagnostic only. Undefined for 12-q-only users. */
  vitalForce?: VitalForce;

  /** Which quiz produced this profile. */
  source: DiagnosticSource;

  /** ISO timestamp of the most recent contributing quiz completion. */
  completedAt?: string;
}

/**
 * True when the profile was produced by the Root-tier deep diagnostic and
 * therefore has all four layers populated. Used by UI components to decide
 * whether to render Layer 2-4 cards or the upgrade-to-Root affordance.
 */
export function hasFullDiagnosticDepth(profile: DiagnosticProfile): boolean {
  return (
    profile.source === "deep_diagnostic_40q" &&
    profile.galenicTemperament !== undefined &&
    profile.tissueStateProfile !== undefined &&
    profile.vitalForce !== undefined
  );
}

/**
 * Convert a raw constitution_type string (the axis-label shape that the
 * 12-q marketing quiz writes into profiles.constitution_type) into the
 * EdenAxisReadings detail. Used by useDiagnosticProfile when no deep-quiz
 * data exists yet.
 *
 * Returns null when the raw value cannot be parsed. Caller should fall
 * through to the take-the-quiz affordance.
 */
export function parseAxisReadingsFromRaw(
  raw: string | null | undefined,
): EdenAxisReadings | null {
  if (!raw) return null;
  const parts = raw.split(" / ").map((p) => p.trim());
  if (parts.length !== 3) return null;
  const [tempPart, moistPart, tonePart] = parts;

  const temperature: TemperatureReading | null =
    tempPart === "Hot" || tempPart === "Cold" || tempPart === "Neutral"
      ? tempPart
      : null;
  const moisture: MoistureReading | null =
    moistPart === "Dry" || moistPart === "Damp" || moistPart === "Neutral"
      ? moistPart
      : null;
  const tone: ToneReading | null =
    tonePart === "Tense" || tonePart === "Relaxed" || tonePart === "Neutral"
      ? tonePart
      : null;

  if (!temperature || !moisture || !tone) return null;
  return { temperature, moisture, tone };
}
