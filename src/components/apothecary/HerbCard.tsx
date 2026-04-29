import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Pill,
  Lock,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { type HerbRow } from "@/hooks/useApothecaryHerbs";
import {
  type EdenPatternName,
  computeMatchRelationship,
  type MatchRelationshipDetail,
} from "@/lib/edenPattern";
import {
  type PrimaryTextCitation,
  type SecondaryCitation,
  type TraditionalObservation,
} from "@/lib/contentEntry";
import { ROUTES } from "@/lib/routes";

interface HerbCardProps {
  herb: HerbRow;
  /**
   * Active user's Eden Pattern, when known. When set, the card surfaces a
   * Match (green) or Avoid (amber) badge for unlocked rows, computed from
   * `temperature × moisture × tissue_states_indicated`. Locked rows are
   * skipped — the lock affordance owns that visual slot.
   *
   * §8.1.2 (Manual v4.0): the same compute also drives a stewardship-
   * language "matches because…" reason list rendered under the chip row,
   * so the reader sees terrain reasoning, not just a color.
   */
  activePattern?: EdenPatternName | null;
}

const chipClass =
  "inline-block px-2.5 py-0.5 rounded-full text-xs font-body tracking-wide";
const sectionLabel =
  "font-accent text-[11px] tracking-[0.25em] uppercase mb-1.5";

/**
 * Split a comma / slash delimited text field into trimmed tokens.
 * Used for rendering Seed+ text fields that carry list-style payloads
 * (e.g., "Deficiency, Atrophy, Dryness, Exhaustion").
 */
function splitTokens(value: string | null | undefined): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(/[,/]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * Phase B sub-task 6 — narrowing helpers for the structured dual-source
 * citation JSONB columns added in 20260426234500_herbs_dual_citation_jsonb.sql.
 *
 * The view exposes these as `Json | null`; at runtime the shape is the one
 * authored by the data-backfill migration (mirrors the TS types exported from
 * `@/lib/contentEntry`). The narrowing below is defensive — if a row has
 * malformed JSONB, the helper returns null and the UI falls back to the
 * legacy free-text `primary_sources` / `secondary_sources` prose render.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function asPrimaryTextCitation(value: unknown): PrimaryTextCitation | null {
  if (!isPlainObject(value)) return null;
  const { author, title, year, url } = value;
  if (
    typeof author !== "string" ||
    typeof title !== "string" ||
    typeof year !== "number" ||
    typeof url !== "string"
  ) {
    return null;
  }
  return value as unknown as PrimaryTextCitation;
}

function asSecondaryCitation(value: unknown): SecondaryCitation | null {
  if (!isPlainObject(value)) return null;
  const { kind, title, identifier, url } = value;
  if (
    typeof kind !== "string" ||
    typeof title !== "string" ||
    typeof identifier !== "string" ||
    typeof url !== "string"
  ) {
    return null;
  }
  return value as unknown as SecondaryCitation;
}

function asTraditionalObservations(
  value: unknown,
): TraditionalObservation[] | null {
  if (!Array.isArray(value)) return null;
  const observations: TraditionalObservation[] = [];
  for (const item of value) {
    if (!isPlainObject(item)) continue;
    const { tradition, pattern, observation, citation } = item;
    if (
      typeof tradition !== "string" ||
      typeof pattern !== "string" ||
      typeof observation !== "string" ||
      asPrimaryTextCitation(citation) === null
    ) {
      continue;
    }
    observations.push(item as unknown as TraditionalObservation);
  }
  return observations.length > 0 ? observations : null;
}

/**
 * Human-readable label for the SecondaryCitation.kind enum. Used in the
 * citation drawer to surface provenance (WHO / ESCOP / PubMed / etc.).
 */
const SECONDARY_KIND_LABELS: Record<SecondaryCitation["kind"], string> = {
  pubmed: "PubMed / PMC",
  who_monograph: "WHO Monograph",
  escop: "ESCOP Monograph",
  nih: "NIH / NCCIH",
  usda: "USDA / FDA",
  university_extension: "University Extension",
  ahg_standard: "AHG Standard",
  nimh_standard: "NIMH Standard",
  ahpa_safety: "AHPA Botanical Safety",
  industry_textbook: "Industry Textbook",
};

/**
 * Human-readable label for the ClassicalTradition slug union. Used in the
 * traditional-observations strip badges per Lock #44.
 */
const TRADITION_LABELS: Record<TraditionalObservation["tradition"], string> = {
  western_eclectic: "Western Eclectic",
  western_physiomedical: "Western Physiomedical",
  tcm: "TCM",
  ayurveda: "Ayurveda",
  unani: "Unani",
  tibetan: "Tibetan",
  other: "Other Tradition",
};

/**
 * Stage 6.3.6 visible-but-gated card.
 *
 * Three render states, derived entirely from the row shape (no out-of-band
 * tier check):
 *
 * 1. LOCKED (`herb.is_locked === true`) — anon/free caller on a Seed-tier row.
 *    Renders identity (name, latin, pronunciation) + a clear lock affordance
 *    + an "Unlock with Seed" CTA. No body chips, no clinical sections, no
 *    expand toggle. Per Locked Decision §0.8 #17.
 *
 * 2. BODY-ONLY (`!is_locked` AND clinical fields NULL) — anon/free caller on
 *    a free-tier row. Existing herbs_public-style render: identity, body
 *    chips (temperature, moisture, part used, plant family, taste), energetics
 *    summary, and on expand: stewardship, biblical reference, cautions,
 *    special populations. The footer "Clinical overlay unlocks with Seed"
 *    teaser remains for this state.
 *
 * 3. CLINICAL (`!is_locked` AND clinical populated) — Seed+ caller, any row.
 *    Full monograph: tissue states, organ system affinity, chief complaints,
 *    constitutional matches, drug interactions, preparation & dosage, refer
 *    threshold, plus identity + body. Footer teaser suppressed.
 */
export function HerbCard({ herb, activePattern = null }: HerbCardProps) {
  const [expanded, setExpanded] = useState(false);

  const isLocked = herb.is_locked === true;
  // The clinical band is present whenever any Seed+ column is non-null.
  // tissue_states_indicated is the canonical discriminator (matches the
  // Stage 6.3 isClinicalRow logic).
  const hasClinical =
    !isLocked && herb.tissue_states_indicated !== null;
  const hasSafetyFlag =
    !isLocked &&
    Boolean(herb.cautions || herb.contraindications_general);

  // Pattern of Eden relationship — computed only for unlocked rows when an
  // active pattern is set. For locked rows the lock affordance owns the
  // header visual slot, so the badge is suppressed (visible-but-gated stays
  // primary). Neutral relationships also suppress the badge to avoid noise.
  // §8.1.2: the full detail (including stewardship-language reasons) is
  // captured here so the card can render WHY a herb matches/avoids beneath
  // the chip row.
  const matchDetail: MatchRelationshipDetail | null =
    !isLocked && activePattern
      ? computeMatchRelationship(
          {
            temperature: herb.temperature ?? null,
            moisture: herb.moisture ?? null,
            tissue_states_indicated: herb.tissue_states_indicated ?? null,
          },
          activePattern
        )
      : null;
  const matchRelationship = matchDetail?.relationship ?? null;
  const matchReasons = matchDetail?.reasons ?? [];

  // -------------------------------------------------------------------------
  // STATE 1: LOCKED — identity + lock affordance + CTA
  // -------------------------------------------------------------------------
  if (isLocked) {
    return (
      <article
        className="rounded-lg border p-5 bg-background flex flex-col h-full"
        style={{
          borderColor: "hsl(var(--eden-gold) / 0.4)",
          backgroundColor: "hsl(var(--eden-cream) / 0.4)",
        }}
        aria-label={`${herb.common_name ?? "Herb"} — locked, requires Seed`}
      >
        <header>
          <div className="flex items-start justify-between gap-2">
            <h3
              className="font-serif text-xl font-semibold leading-tight"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              {herb.common_name ?? "Unnamed herb"}
            </h3>
            <Lock
              className="w-4 h-4 mt-1 shrink-0"
              style={{ color: "hsl(var(--eden-gold))" }}
              aria-hidden="true"
            />
          </div>
          {herb.latin_name && (
            <p className="font-body italic text-sm text-muted-foreground mt-0.5">
              {herb.latin_name}
            </p>
          )}
          {herb.pronunciation && (
            <p className="font-accent text-[11px] tracking-[0.2em] uppercase text-muted-foreground mt-1">
              {herb.pronunciation}
            </p>
          )}
        </header>

        {/* identity-only chip row: part used + plant family if present */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {herb.part_used && (
            <span
              className={chipClass}
              style={{
                backgroundColor: "hsl(var(--eden-cream))",
                color: "hsl(var(--eden-bark))",
              }}
            >
              {herb.part_used}
            </span>
          )}
          {herb.plant_family && (
            <span
              className={chipClass}
              style={{
                backgroundColor: "hsl(var(--eden-cream) / 0.6)",
                color: "hsl(var(--eden-bark))",
              }}
            >
              {herb.plant_family}
            </span>
          )}
        </div>

        <div
          className="mt-5 flex-1 flex flex-col items-start justify-end gap-3 pt-4 border-t"
          style={{ borderColor: "hsl(var(--eden-gold) / 0.25)" }}
        >
          <p
            className="font-accent text-[11px] tracking-[0.25em] uppercase"
            style={{ color: "hsl(var(--eden-gold))" }}
          >
            There's more to know about this herb
          </p>
          <p className="font-body text-sm leading-relaxed text-muted-foreground">
            Seed opens the full study — how it acts in the body, who it suits,
            how to prepare it, and how to use it safely. All 100 herbs, one
            subscription.
          </p>
          <Button variant="eden" size="sm" asChild>
            <Link to={ROUTES.APOTHECARY_PRICING}>Unlock with Seed</Link>
          </Button>
        </div>
      </article>
    );
  }

  // -------------------------------------------------------------------------
  // STATE 2 & 3: UNLOCKED — body always; clinical sections only when populated
  // -------------------------------------------------------------------------
  return (
    <article
      className="rounded-lg border p-5 bg-background flex flex-col h-full"
      style={{ borderColor: "hsl(var(--border))" }}
    >
      {/*
        §8.1.3 (Manual v4.0) — Pattern-specific aggravation banner.
        Promotes the chip-row Avoid badge into a top-of-card warning when
        the herb's energetics oppose the user's resolved Eden Pattern. The
        chip-row badge stays as the at-a-glance indicator; this banner is
        the "you stopped to read this card, here's why" treatment. Reasons
        live HERE for the avoid case (suppressed from the under-chip-row
        list below) so the warning isn't duplicated.
      */}
      {matchRelationship === "avoid" &&
        activePattern &&
        matchReasons.length > 0 && (
          <aside
            role="note"
            aria-label={`May aggravate your ${activePattern} pattern`}
            className="-mx-5 -mt-5 mb-4 px-5 py-3 rounded-t-lg flex items-start gap-2.5 border-b"
            style={{
              backgroundColor: "hsl(var(--destructive) / 0.08)",
              borderColor: "hsl(var(--destructive) / 0.25)",
            }}
          >
            <ShieldAlert
              className="w-4 h-4 mt-0.5 shrink-0"
              style={{ color: "hsl(var(--destructive))" }}
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              <p
                className="font-accent text-[10px] tracking-[0.25em] uppercase mb-1"
                style={{ color: "hsl(var(--destructive))" }}
              >
                May aggravate your {activePattern}
              </p>
              <ul className="font-body text-xs leading-relaxed space-y-0.5">
                {matchReasons.map((reason) => (
                  <li
                    key={reason}
                    style={{ color: "hsl(var(--destructive))" }}
                  >
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        )}

      <header>
        <h3
          className="font-serif text-xl font-semibold leading-tight"
          style={{ color: "hsl(var(--eden-bark))" }}
        >
          {herb.common_name ?? "Unnamed herb"}
        </h3>
        {herb.latin_name && (
          <p className="font-body italic text-sm text-muted-foreground mt-0.5">
            {herb.latin_name}
          </p>
        )}
        {herb.pronunciation && (
          <p className="font-accent text-[11px] tracking-[0.2em] uppercase text-muted-foreground mt-1">
            {herb.pronunciation}
          </p>
        )}
      </header>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {/* Pattern of Eden Match badge — leads the chip row when active. */}
        {matchRelationship === "match" && (
          <span
            className={`${chipClass} flex items-center gap-1`}
            style={{
              backgroundColor: "hsl(var(--eden-gold) / 0.15)",
              color: "hsl(var(--eden-gold))",
              borderColor: "hsl(var(--eden-gold))",
            }}
            title="Rebalances your Pattern"
          >
            <Sparkles className="w-3 h-3" />
            Match
          </span>
        )}
        {matchRelationship === "avoid" && (
          <span
            className={`${chipClass} flex items-center gap-1`}
            style={{
              backgroundColor: "hsl(var(--destructive) / 0.1)",
              color: "hsl(var(--destructive))",
            }}
            title="May aggravate your Pattern"
          >
            <ShieldAlert className="w-3 h-3" />
            Avoid
          </span>
        )}
        {herb.temperature && (
          <span
            className={chipClass}
            style={{
              backgroundColor: "hsl(var(--eden-cream))",
              color: "hsl(var(--eden-bark))",
            }}
          >
            {herb.temperature}
          </span>
        )}
        {herb.moisture && (
          <span
            className={chipClass}
            style={{
              backgroundColor: "hsl(var(--eden-cream))",
              color: "hsl(var(--eden-bark))",
            }}
          >
            {herb.moisture}
          </span>
        )}
        {herb.part_used && (
          <span
            className={chipClass}
            style={{
              backgroundColor: "hsl(var(--eden-cream))",
              color: "hsl(var(--eden-bark))",
            }}
          >
            {herb.part_used}
          </span>
        )}
        {herb.plant_family && (
          <span
            className={chipClass}
            style={{
              backgroundColor: "hsl(var(--eden-cream) / 0.6)",
              color: "hsl(var(--eden-bark))",
            }}
          >
            {herb.plant_family}
          </span>
        )}
        {hasSafetyFlag && (
          <span
            className={`${chipClass} flex items-center gap-1`}
            style={{
              backgroundColor: "hsl(var(--destructive) / 0.1)",
              color: "hsl(var(--destructive))",
            }}
            title="Cautions apply"
          >
            <AlertTriangle className="w-3 h-3" />
            Cautions
          </span>
        )}
      </div>

      {/*
        §8.1.2 + §8.1.3 — stewardship-language reasons under the chip row.
        For MATCH: surfaces WHY this herb suits the user's Pattern in
        terrain-first prose, beneath the Match badge. For AVOID: reasons
        live in the §8.1.3 top-of-card aggravation banner above and are
        suppressed here to avoid duplication. For NEUTRAL: nothing to say.
      */}
      {matchReasons.length > 0 && matchRelationship === "match" && (
        <ul
          className="mt-3 space-y-0.5"
          aria-label="Why this herb matches your Pattern"
        >
          {matchReasons.map((reason) => (
            <li
              key={reason}
              className="font-body text-xs italic leading-relaxed flex items-start gap-1.5"
              style={{ color: "hsl(var(--eden-gold))" }}
            >
              <span aria-hidden="true" className="mt-[3px] shrink-0">
                ·
              </span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      )}

      {herb.taste && (
        <p className="font-body text-xs text-muted-foreground mt-3">
          <span className="font-accent uppercase tracking-[0.2em] text-[10px] mr-1">
            Taste
          </span>
          {herb.taste}
        </p>
      )}

      {herb.energetics_summary && (
        <p
          className={`font-body text-sm mt-3 leading-relaxed ${
            expanded ? "" : "line-clamp-3"
          }`}
        >
          {herb.energetics_summary}
        </p>
      )}

      {expanded && (
        <div
          className="mt-4 space-y-5 border-t pt-4"
          style={{ borderColor: "hsl(var(--border))" }}
        >
          {/* ---------- Clinical-tier sections (Seed+ only) ---------- */}
          {hasClinical && (
            <>
              {(herb.tissue_states_indicated ||
                herb.tissue_states_contraindicated) && (
                <section>
                  <h4
                    className={sectionLabel}
                    style={{ color: "hsl(var(--eden-gold))" }}
                  >
                    Tissue states
                  </h4>
                  {herb.tissue_states_indicated && (
                    <div className="mb-2">
                      <p className="font-body text-[11px] uppercase tracking-[0.15em] text-muted-foreground mb-1">
                        Indicated
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {splitTokens(herb.tissue_states_indicated).map((t) => (
                          <span
                            key={`tsi-${t}`}
                            className={chipClass}
                            style={{
                              backgroundColor: "hsl(var(--eden-cream) / 0.8)",
                              color: "hsl(var(--eden-bark))",
                            }}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {herb.tissue_states_contraindicated && (
                    <div>
                      <p className="font-body text-[11px] uppercase tracking-[0.15em] text-muted-foreground mb-1">
                        Contraindicated
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {splitTokens(herb.tissue_states_contraindicated).map(
                          (t) => (
                            <span
                              key={`tsc-${t}`}
                              className={chipClass}
                              style={{
                                backgroundColor:
                                  "hsl(var(--destructive) / 0.08)",
                                color: "hsl(var(--destructive))",
                              }}
                            >
                              {t}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </section>
              )}

              {herb.system_affinity && (
                <section>
                  <h4
                    className={sectionLabel}
                    style={{ color: "hsl(var(--eden-gold))" }}
                  >
                    Organ system affinity
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {splitTokens(herb.system_affinity).map((s) => (
                      <span
                        key={`sys-${s}`}
                        className={chipClass}
                        style={{
                          backgroundColor: "hsl(var(--eden-cream) / 0.8)",
                          color: "hsl(var(--eden-bark))",
                        }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {herb.chief_complaints && (
                <section>
                  <h4
                    className={sectionLabel}
                    style={{ color: "hsl(var(--eden-gold))" }}
                  >
                    Chief complaints
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {splitTokens(herb.chief_complaints).map((c) => (
                      <span
                        key={`cc-${c}`}
                        className={chipClass}
                        style={{
                          backgroundColor: "hsl(var(--eden-cream) / 0.8)",
                          color: "hsl(var(--eden-bark))",
                        }}
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {(herb.western_constitution_match ||
                herb.ayurvedic_dosha_match ||
                herb.ayurvedic_dosha_aggravates ||
                herb.tcm_pattern_match ||
                herb.tcm_contraindicated_patterns) && (
                <section>
                  <h4
                    className={sectionLabel}
                    style={{ color: "hsl(var(--eden-gold))" }}
                  >
                    Constitutional match
                  </h4>
                  {/*
                    Cross-tradition observational labels per Lock #44 (Manual
                    §0.8). Western, Ayurvedic, and TCM systems each
                    independently observed the same human body and named
                    what they saw. We honor each tradition's pattern-
                    observation while explicitly NOT carrying forward its
                    spiritual attribution of vital force (qi-as-cosmic,
                    prana-as-Brahman, the Tao as ground of being). Per Lock
                    #14 worldview anchor, the source of vital force is named
                    plainly as the Holy Spirit; the dosha and pattern labels
                    here describe what the body is doing, not where life
                    comes from.
                  */}
                  <dl className="font-body text-sm leading-relaxed space-y-1">
                    {herb.western_constitution_match && (
                      <div>
                        <dt className="inline font-medium">Western: </dt>
                        <dd className="inline">
                          {herb.western_constitution_match}
                        </dd>
                      </div>
                    )}
                    {herb.ayurvedic_dosha_match && (
                      <div>
                        <dt className="inline font-medium">
                          Ayurvedic (matches):{" "}
                        </dt>
                        <dd className="inline">
                          {herb.ayurvedic_dosha_match}
                        </dd>
                      </div>
                    )}
                    {herb.ayurvedic_dosha_aggravates && (
                      <div>
                        <dt className="inline font-medium">
                          Ayurvedic (aggravates):{" "}
                        </dt>
                        <dd className="inline">
                          {herb.ayurvedic_dosha_aggravates}
                        </dd>
                      </div>
                    )}
                    {herb.tcm_pattern_match && (
                      <div>
                        <dt className="inline font-medium">
                          TCM (matches):{" "}
                        </dt>
                        <dd className="inline">
                          {herb.tcm_pattern_match}
                        </dd>
                      </div>
                    )}
                    {herb.tcm_contraindicated_patterns && (
                      <div>
                        <dt className="inline font-medium">
                          TCM (contraindicated):{" "}
                        </dt>
                        <dd className="inline">
                          {herb.tcm_contraindicated_patterns}
                        </dd>
                      </div>
                    )}
                  </dl>
                  <p
                    className="font-body text-xs italic mt-2 text-muted-foreground"
                    aria-label="Cross-tradition observational scope"
                  >
                    Pattern-observation only. The source of vital force is
                    named on the WhyEden page — these labels describe
                    what the body is doing, not where life comes from.
                  </p>
                </section>
              )}

              {herb.drug_interactions && (
                <section>
                  <h4
                    className={`${sectionLabel} flex items-center gap-1.5`}
                    style={{ color: "hsl(var(--destructive))" }}
                  >
                    <AlertTriangle className="w-3 h-3" />
                    Drug interactions
                  </h4>
                  <p className="font-body text-sm leading-relaxed">
                    {herb.drug_interactions}
                  </p>
                </section>
              )}

              {(herb.preparation_methods || herb.dosage_notes) && (
                <section>
                  <h4
                    className={`${sectionLabel} flex items-center gap-1.5`}
                    style={{ color: "hsl(var(--eden-gold))" }}
                  >
                    <Pill className="w-3 h-3" />
                    Preparation & dosage
                  </h4>
                  {herb.preparation_methods && (
                    <p className="font-body text-sm leading-relaxed">
                      <span className="font-medium">Methods: </span>
                      {herb.preparation_methods}
                    </p>
                  )}
                  {herb.dosage_notes && (
                    <p className="font-body text-sm leading-relaxed mt-1.5 text-muted-foreground">
                      <span className="font-medium">Dosage: </span>
                      {herb.dosage_notes}
                    </p>
                  )}
                </section>
              )}

              {herb.refer_threshold && (
                <section>
                  <h4
                    className={sectionLabel}
                    style={{ color: "hsl(var(--eden-gold))" }}
                  >
                    Refer threshold
                  </h4>
                  <p className="font-body text-sm leading-relaxed italic">
                    {herb.refer_threshold}
                  </p>
                </section>
              )}
            </>
          )}

          {/* ---------- Shared sections (free + clinical) ---------- */}
          {herb.stewardship_note && (
            <section>
              <h4
                className={sectionLabel}
                style={{ color: "hsl(var(--eden-gold))" }}
              >
                Stewardship
              </h4>
              <p className="font-body text-sm leading-relaxed">
                {herb.stewardship_note}
              </p>
            </section>
          )}

          {herb.biblical_traditional_reference && (
            <section>
              <h4
                className={sectionLabel}
                style={{ color: "hsl(var(--eden-gold))" }}
              >
                Tradition
              </h4>
              <p className="font-body text-sm leading-relaxed italic">
                {herb.biblical_traditional_reference}
              </p>
            </section>
          )}

          {(herb.cautions || herb.contraindications_general) && (
            <section>
              <h4
                className={`${sectionLabel} flex items-center gap-1.5`}
                style={{ color: "hsl(var(--destructive))" }}
              >
                <AlertTriangle className="w-3 h-3" />
                Cautions
              </h4>
              {herb.cautions && (
                <p className="font-body text-sm leading-relaxed">
                  {herb.cautions}
                </p>
              )}
              {herb.contraindications_general && (
                <p className="font-body text-sm leading-relaxed mt-1.5 text-muted-foreground">
                  <span className="font-medium">
                    General contraindications:{" "}
                  </span>
                  {herb.contraindications_general}
                </p>
              )}
            </section>
          )}

          {(herb.pregnancy_safety ||
            herb.breastfeeding_safety ||
            herb.children_safety) && (
            <section>
              <h4
                className={sectionLabel}
                style={{ color: "hsl(var(--eden-gold))" }}
              >
                Special populations
              </h4>
              <dl className="font-body text-sm leading-relaxed space-y-1">
                {herb.pregnancy_safety && (
                  <div>
                    <dt className="inline font-medium">Pregnancy: </dt>
                    <dd className="inline">{herb.pregnancy_safety}</dd>
                  </div>
                )}
                {herb.breastfeeding_safety && (
                  <div>
                    <dt className="inline font-medium">Breastfeeding: </dt>
                    <dd className="inline">{herb.breastfeeding_safety}</dd>
                  </div>
                )}
                {herb.children_safety && (
                  <div>
                    <dt className="inline font-medium">Children: </dt>
                    <dd className="inline">{herb.children_safety}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          {hasClinical && herb.notes && (
            <section>
              <h4
                className={sectionLabel}
                style={{ color: "hsl(var(--eden-gold))" }}
              >
                Notes
              </h4>
              <p className="font-body text-sm leading-relaxed">
                {herb.notes}
              </p>
            </section>
          )}

          {hasClinical &&
            (() => {
              // Phase B sub-task 6 — prefer the structured dual-source citations
              // populated by 20260426234600_herbs_archetypal_dual_citation_backfill.sql
              // and follow-on data migrations, per Locks #38 + #43. Fall back to the
              // legacy free-text prose render when the structured fields are NULL
              // (rows not yet through the audit).
              const primary = asPrimaryTextCitation(herb.primary_text_citation);
              const secondary = asSecondaryCitation(herb.secondary_citation);
              const traditional = asTraditionalObservations(
                herb.traditional_observations,
              );
              const hasStructured = primary || secondary || traditional;
              const hasLegacy = herb.primary_sources || herb.secondary_sources;
              if (!hasStructured && !hasLegacy) return null;

              return (
                <section>
                  <h4
                    className={sectionLabel}
                    style={{ color: "hsl(var(--eden-gold))" }}
                  >
                    Sources
                  </h4>

                  {primary ? (
                    <div className="font-body text-xs leading-relaxed text-muted-foreground">
                      <span className="font-medium">Primary: </span>
                      <a
                        href={primary.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline decoration-dotted underline-offset-2 hover:opacity-80"
                      >
                        {primary.author}, <em>{primary.title}</em>{" "}
                        ({primary.year})
                      </a>
                      {primary.locator && (
                        <span className="opacity-80"> — {primary.locator}</span>
                      )}
                    </div>
                  ) : (
                    herb.primary_sources && (
                      <p className="font-body text-xs leading-relaxed text-muted-foreground">
                        <span className="font-medium">Primary: </span>
                        {herb.primary_sources}
                      </p>
                    )
                  )}

                  {secondary ? (
                    <div className="font-body text-xs leading-relaxed text-muted-foreground mt-1">
                      <span className="font-medium">Secondary: </span>
                      <a
                        href={secondary.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline decoration-dotted underline-offset-2 hover:opacity-80"
                      >
                        {secondary.author
                          ? `${secondary.author}, `
                          : ""}
                        <em>{secondary.title}</em>
                        {secondary.year ? ` (${secondary.year})` : ""}
                      </a>
                      <span className="opacity-80">
                        {" "}
                        — {SECONDARY_KIND_LABELS[secondary.kind] ?? secondary.kind}
                        {secondary.identifier && ` · ${secondary.identifier}`}
                      </span>
                    </div>
                  ) : (
                    herb.secondary_sources && (
                      <p className="font-body text-xs leading-relaxed text-muted-foreground mt-1">
                        <span className="font-medium">Secondary: </span>
                        {herb.secondary_sources}
                      </p>
                    )
                  )}

                  {traditional && (
                    <div className="mt-3 space-y-2">
                      {traditional.map((obs, i) => (
                        <div
                          key={`${obs.tradition}-${i}`}
                          className="border-l-2 pl-3 py-1"
                          style={{ borderColor: "hsl(var(--eden-bark) / 0.4)" }}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={chipClass}
                              style={{
                                background: "hsl(var(--eden-bark) / 0.1)",
                                color: "hsl(var(--eden-bark))",
                              }}
                            >
                              {obs.traditionLabel ??
                                TRADITION_LABELS[obs.tradition] ??
                                obs.tradition}
                            </span>
                            <span className="font-body text-xs font-medium">
                              {obs.pattern}
                            </span>
                          </div>
                          <p className="font-body text-xs leading-relaxed text-muted-foreground">
                            {obs.observation}
                          </p>
                          <a
                            href={obs.citation.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-body text-[10px] tracking-wide uppercase underline decoration-dotted underline-offset-2 text-muted-foreground hover:opacity-80 mt-1 inline-block"
                          >
                            {obs.citation.author}, {obs.citation.title} ({
                              obs.citation.year
                            })
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })()}

          {/* Footer teaser only on the body-only state (free-tier row, anon/free caller). */}
          {!hasClinical && (
            <p className="font-body text-xs text-muted-foreground italic pt-1">
              The full study — how this herb acts in the body, who it suits,
              how to prepare and use it safely — opens with Seed.
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="mt-4 flex items-center gap-1 font-accent uppercase tracking-[0.2em] text-[11px] hover:opacity-70 self-start"
        style={{ color: "hsl(var(--eden-bark))" }}
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse monograph" : "Read full monograph"}
      >
        {expanded ? (
          <>
            <ChevronUp className="w-3 h-3" />
            Collapse
          </>
        ) : (
          <>
            <ChevronDown className="w-3 h-3" />
            Read monograph
          </>
        )}
      </button>
    </article>
  );
}
