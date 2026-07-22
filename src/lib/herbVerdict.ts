import {
  computeMatchRelationship,
  type EdenPatternName,
  type MatchRelationship,
} from "@/lib/edenPattern";

/**
 * herbVerdict — the single resolver every surface must use to decide what a
 * herb card says about a reader's body pattern.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 *
 * A reader with the Spent Candle pattern bought the deep-dive guide, which
 * recommends ginger ("the spark that begins to re-light the candle") and
 * nettle ("foundational"), then opened the Apothecary and found both flagged
 * with a red AVOID banner. Hawthorn and marshmallow — also recommended by the
 * guide — showed no badge at all.
 *
 * The cause was not bad herb data. It was that two different systems were
 * independently deciding the same clinical question:
 *
 *   1. The guides (supabase/functions/_shared/guide/guide-content-*.ts) are
 *      hand-authored prose reasoning from the CLINICALLY DECISIVE axis.
 *      Measured across all 8 patterns they are perfectly self-consistent:
 *      warming stimulants (ginger, cayenne) are recommended for all four COLD
 *      patterns and cautioned for all three HOT ones; moistening demulcents
 *      (marshmallow, licorice) are recommended for all four DRY patterns and
 *      cautioned for the DAMP ones.
 *
 *   2. The Apothecary card recomputed a verdict in the browser on every
 *      render via computeMatchRelationship(), which gives all three axes an
 *      EQUAL VOTE and takes a 2-of-3 majority.
 *
 * Those two models disagree structurally, not occasionally. Replaying the
 * live algorithm against the curriculum's 80 recommendations: it endorsed
 * only 54. It contradicted 26 — eleven of them with a red AVOID flag on a
 * herb the reader's own paid guide recommends.
 *
 * Worse, the curated correction layer already existed. The
 * herbs_eden_patterns bridge (built July 2026: 80 founder-canon pairings plus
 * a 42-row clinical review, each carrying dual citations per Lock #43) had
 * already recorded the right answers for nettle, hawthorn and marshmallow —
 * but no client code read it. It was correct data nobody asked.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE RULES THIS MODULE ENFORCES
 *
 * 1. CURATED DATA IS CANON. If a surfaced row exists in herbs_eden_patterns
 *    for this herb+pattern, its verdict wins outright. That table is where
 *    clinical judgment and citations live.
 *
 * 2. A COMPUTED VERDICT MAY NEVER SAY "AVOID". This is the safety rule and
 *    it is not negotiable. We measured the computed models against the
 *    curriculum: the current equal-vote rule agrees 67% of the time, and the
 *    best model we could build from the existing columns reaches 82%. An
 *    ~18-33% error rate is acceptable for *ranking* a directory. It is not
 *    acceptable for printing a red warning telling a reader to avoid a herb
 *    on a health product. Rejection requires evidence, so "avoid" requires a
 *    curated, cited row. A computed "avoid" is downgraded to "neutral" —
 *    the herb simply sorts low and says nothing.
 *
 * 3. CONDITIONAL IS A FIRST-CLASS VERDICT. Public-domain materia medica
 *    rarely says "never." It says "yes, but." The tradition's standard answer
 *    to a remedy that was right on its main action but carried an unwanted
 *    secondary quality was to ADD A CORRECTIVE, not to reject the remedy —
 *    Cook (Physio-Medical Dispensatory, 1869) calls this "the balancing of
 *    all intensely stimulating and local remedies, by associating with them
 *    some of the diffusive aromatics as adjuvants." Ginger for a cold-and-dry
 *    pattern is exactly this case: indicated for the cold, drying against the
 *    dryness, and therefore given in small dose with a demulcent. "Match" and
 *    "avoid" both misrepresent that; "conditional" states it.
 *
 * @see src/test/herbVerdict.test.ts for the invariants, including the
 *      never-compute-avoid safety rule.
 */

export type HerbVerdictRelationship =
  | "match"
  | "conditional"
  | "neutral"
  | "avoid";

export type VerdictSource = "curated" | "computed";

/**
 * A surfaced row from public.herbs_eden_patterns, already narrowed to the
 * active pattern. Null when the pairing has not been curated yet — which is
 * the common case: the bridge covers the curriculum's pairings, not all
 * 300 herbs x 8 patterns.
 */
export interface CuratedHerbPatternRow {
  relationship: string | null;
  /**
   * MUST be 'curated' for this row to be trusted.
   *
   * The bridge is NOT a curated-only table. As of 2026-07-21 it holds 2,292
   * surfaced rows with derivation='computed_energetics' — including 922
   * surfaced "avoid" verdicts — produced by a SQL mirror of the very
   * equal-vote algorithm this work exists to stop trusting (see
   * 20260709170000_herbs_eden_patterns_bridge.sql, which states it
   * "mirror[s] src/lib/edenPattern.ts exactly"). Only 108 rows are genuinely
   * curated.
   *
   * Those computed rows carry citations — that is how they satisfied the
   * surfacing constraint — so they LOOK authoritative. Trusting them would
   * surface 922 machine-generated red "avoid" flags with sources attached,
   * making the reported defect worse rather than better. Anything not
   * explicitly 'curated' is treated as no row at all.
   */
  derivation?: string | null;
  /** Axis-derivation note or the reviewer's one-line clinical reason. */
  rationale?: string | null;
  /** Reader-facing "how this helps your pattern" prose, ported from the guides. */
  benefit_note?: string | null;
  /** For conditional verdicts: the dose/form/pairing condition. */
  condition_note?: string | null;
  primary_citation?: unknown;
  secondary_citation?: unknown;
}

export interface ResolvedHerbVerdict {
  relationship: HerbVerdictRelationship;
  source: VerdictSource;
  /** Stewardship lines explaining the verdict. May be empty. */
  reasons: string[];
  /** Present only for conditional verdicts. */
  conditionNote: string | null;
  /** Reader-facing benefit prose, when curated. */
  benefitNote: string | null;
  /** True when the row carries at least one citation (Lock #43 surfacing). */
  hasCitations: boolean;
  /** Single numeric for stable directory ordering, descending. */
  sortKey: number;
}

/** Sort bands. Curated verdicts outrank computed ones at equal relationship. */
const SORT_BAND = {
  curatedMatch: 4000,
  computedMatch: 3000,
  conditional: 2000,
  neutral: 1000,
  avoid: 0,
} as const;

function isCuratedRelationship(
  value: string | null | undefined,
): value is HerbVerdictRelationship {
  return (
    value === "match" ||
    value === "conditional" ||
    value === "neutral" ||
    value === "avoid"
  );
}

function hasCitation(row: CuratedHerbPatternRow): boolean {
  const filled = (v: unknown) =>
    v !== null && v !== undefined && (typeof v !== "object" || Object.keys(v as object).length > 0);
  return filled(row.primary_citation) || filled(row.secondary_citation);
}

/**
 * Resolve what a herb card should say.
 *
 * @param herb   the raw axis columns off herbs_directory_v
 * @param patternName the reader's resolved Eden pattern
 * @param curated  the surfaced herbs_eden_patterns row for this pairing, or
 *                 null/undefined when the pairing is not yet curated
 * @param subject  possessive woven into the reasons ("your", or a patient's
 *                 name possessive on practitioner surfaces)
 */
export function resolveHerbVerdict(
  herb: {
    temperature: string | null | undefined;
    moisture: string | null | undefined;
    tissue_states_indicated: string | null | undefined;
  },
  patternName: EdenPatternName,
  curated?: CuratedHerbPatternRow | null,
  subject: string = "your",
): ResolvedHerbVerdict {
  // ── Path 1: curated data is canon ──────────────────────────────────────
  // Gate on derivation, not merely on the row existing. A row with
  // derivation='computed_energetics' is the equal-vote algorithm's own output
  // written to the database — trusting it here would launder a computed
  // verdict into a cited one. See CuratedHerbPatternRow.derivation.
  if (
    curated &&
    curated.derivation === "curated" &&
    isCuratedRelationship(curated.relationship)
  ) {
    const relationship = curated.relationship;
    const reasons: string[] = [];
    // ONLY benefit_note is reader-facing. `rationale` is internal authoring
    // prose — 43 curated matches carry pipe-delimited classifier notes there
    // ("… (constitution-data.ts canon) | temperature: …"), 22 open with
    // "Curation review:", and some argue AGAINST the match. Falling back to
    // it printed that debug text verbatim under "Why this herb suits your
    // Pattern". A missing "why" renders as silence, never as internal notes.
    if (curated.benefit_note) reasons.push(curated.benefit_note);

    const sortKey =
      relationship === "match"
        ? SORT_BAND.curatedMatch
        : relationship === "conditional"
          ? SORT_BAND.conditional
          : relationship === "avoid"
            ? SORT_BAND.avoid
            : SORT_BAND.neutral;

    return {
      relationship,
      source: "curated",
      reasons,
      conditionNote: curated.condition_note ?? null,
      benefitNote: curated.benefit_note ?? null,
      hasCitations: hasCitation(curated),
      sortKey,
    };
  }

  // ── Path 2: fall back to the computed energetics ───────────────────────
  const computed = computeMatchRelationship(herb, patternName, subject);

  // THE SAFETY RULE. A computed model is right ~67-82% of the time against
  // the curriculum — good enough to rank a directory, nowhere near good
  // enough to tell a reader on a health product to avoid something. Only a
  // curated, cited row may render a red flag; everything else falls silent.
  const relationship: HerbVerdictRelationship =
    computed.relationship === "avoid"
      ? "neutral"
      : (computed.relationship as MatchRelationship as HerbVerdictRelationship);

  const downgraded = computed.relationship === "avoid";

  return {
    relationship,
    source: "computed",
    // Suppress the reasons on a downgraded avoid too: those strings argue the
    // herb aggravates the pattern, which is precisely the claim we have just
    // decided we cannot support without citations.
    reasons: downgraded ? [] : computed.reasons,
    conditionNote: null,
    benefitNote: null,
    hasCitations: false,
    sortKey:
      relationship === "match"
        ? SORT_BAND.computedMatch
        : // Downgraded avoids sort below genuine neutrals: we cannot say why,
          // but the energetics still suggest it is a poor fit, so it should
          // not surface above herbs we are neutral on.
          relationship === "neutral" && downgraded
          ? SORT_BAND.neutral - 500
          : SORT_BAND.neutral,
  };
}
