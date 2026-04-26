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
  type MatchRelationship,
} from "@/lib/edenPattern";

interface HerbCardProps {
  herb: HerbRow;
  /**
   * Active user's Eden Pattern, when known. When set, the card surfaces a
   * Match (green) or Avoid (amber) badge for unlocked rows, computed from
   * `temperature × moisture × tissue_states_indicated`. Locked rows are
   * skipped — the lock affordance owns that visual slot.
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
  const matchRelationship: MatchRelationship | null =
    !isLocked && activePattern
      ? computeMatchRelationship(
          {
            temperature: herb.temperature ?? null,
            moisture: herb.moisture ?? null,
            tissue_states_indicated: herb.tissue_states_indicated ?? null,
          },
          activePattern
        ).relationship
      : null;

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
            <Link to="/apothecary/pricing">Unlock with Seed</Link>
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
            (herb.primary_sources || herb.secondary_sources) && (
              <section>
                <h4
                  className={sectionLabel}
                  style={{ color: "hsl(var(--eden-gold))" }}
                >
                  Sources
                </h4>
                {herb.primary_sources && (
                  <p className="font-body text-xs leading-relaxed text-muted-foreground">
                    <span className="font-medium">Primary: </span>
                    {herb.primary_sources}
                  </p>
                )}
                {herb.secondary_sources && (
                  <p className="font-body text-xs leading-relaxed text-muted-foreground mt-1">
                    <span className="font-medium">Secondary: </span>
                    {herb.secondary_sources}
                  </p>
                )}
              </section>
            )}

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
