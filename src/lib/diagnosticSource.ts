/**
 * src/lib/diagnosticSource.ts
 *
 * Provenance mapping for the DiagnosticProfile.source field. Per Locked
 * Decision §0.8 #38, every diagnostic claim surfaces a citation pointer; the
 * `source` field is the per-row provenance pointer to the writing pipeline.
 *
 * Hardcoding `source: "marketing_quiz_12q"` regardless of provenance (the
 * v3.15 audit Major #4 finding) is a Lock #38 violation — a value written
 * by the in-app diagnostic must NOT report as the marketing quiz, and a
 * value written by the upcoming 40-q deep diagnostic must NOT report as
 * the 12-q quiz.
 *
 * The mapping below is the single place that translates a
 * `diagnostic_completions.quiz_version` (or absence-of-row, i.e. legacy
 * bridge) into the wire-stable `DiagnosticSource` enum value plus a
 * UI-displayable citation label.
 *
 * Quiz version namespace per Lock #40 strict separation:
 *   - "v1"            → flows from quiz_completions (marketing) — anonymous funnel
 *   - "v1-diagnostic" → flows from diagnostic_completions       — in-app 12-q
 *   - "v2-deep"       → flows from diagnostic_completions       — Root 40-q
 *   - undefined       → no diagnostic_completions row; Layer 1 read came from
 *                       profiles.constitution_type bridge fallback (legacy
 *                       pre-trigger account, see v3.14 durable architectural
 *                       finding)
 */

import type { DiagnosticSource } from "./diagnosticProfile";

/**
 * Extended source vocabulary. The wire-stable type DiagnosticSource (in
 * diagnosticProfile.ts) currently lists `"marketing_quiz_12q" |
 * "deep_diagnostic_40q"`. The v3.16 hardening pass introduces:
 *   - "in_app_diagnostic_12q"       — written by the EF with quizVersion=v1-diagnostic
 *   - "marketing_quiz_12q_legacy_bridge" — legacy bridge fallback with no
 *      diagnostic_completions row backing the value
 *
 * These two are present in this module's mapper; the DiagnosticSource type
 * itself is widened in diagnosticProfile.ts to include them.
 */

export interface ProvenanceLabel {
  /** Wire-stable value for DiagnosticProfile.source. */
  source: DiagnosticSource;
  /** UI-displayable citation label. */
  citationLabel: string;
}

/**
 * Map a quiz_version (or undefined for the legacy bridge case) to its
 * provenance label.
 *
 * @param quizVersion Value of diagnostic_completions.quiz_version on the
 *   row that established this Layer 1 value, OR undefined when there is no
 *   diagnostic_completions row (legacy bridge: Layer 1 came from
 *   profiles.constitution_type).
 */
export function provenanceForQuizVersion(
  quizVersion: string | null | undefined,
): ProvenanceLabel {
  if (quizVersion === "v2-deep") {
    return {
      source: "deep_diagnostic_40q",
      citationLabel: "Root 40-question deep diagnostic",
    };
  }
  if (quizVersion === "v1-diagnostic") {
    return {
      source: "in_app_diagnostic_12q",
      citationLabel: "In-app 12-question Pattern of Eden quiz",
    };
  }
  if (quizVersion === "v1") {
    return {
      source: "marketing_quiz_12q",
      citationLabel: "12-question marketing quiz",
    };
  }
  // No quiz_version known: legacy bridge fallback (Layer 1 read from
  // profiles.constitution_type for a pre-trigger account; see Manual v3.14
  // Phase 8 durable architectural finding).
  return {
    source: "marketing_quiz_12q_legacy_bridge",
    citationLabel:
      "12-question marketing quiz (recorded before in-app diagnostic was wired)",
  };
}

/**
 * Convenience: map a row from diagnostic_completions (or null when no row
 * applies and the legacy bridge is in effect) to a provenance label.
 */
export function provenanceForCompletionRow(
  row: { quiz_version?: string | null } | null | undefined,
): ProvenanceLabel {
  if (!row) return provenanceForQuizVersion(undefined);
  return provenanceForQuizVersion(row.quiz_version);
}
