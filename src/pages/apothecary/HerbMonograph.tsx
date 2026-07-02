import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, AlertTriangle, Lock, ShieldAlert, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HerbFavoriteHeart } from "@/components/apothecary/HerbFavoriteHeart";
import { PageSkeleton } from "@/components/apothecary/PageSkeleton";
import { useHerbsDirectory } from "@/hooks/useHerbsDirectory";
import { useEdenPattern } from "@/hooks/useEdenPattern";
import { useViewedHerbs } from "@/hooks/useViewedHerbs";
import { computeMatchRelationship } from "@/lib/edenPattern";
import { findHerbByParam, herbParam, HERB_ALIASES } from "@/lib/herbLinks";
import { ROUTES } from "@/lib/routes";
import { useDocumentMeta } from "@/lib/useDocumentMeta";

/**
 * HerbMonograph — the public per-herb page at /apothecary/:herbId
 * (CRO Phase 1). Accepts the common-name slug ("marshmallow", canonical)
 * or the H-code herb_id ("H036").
 *
 * PUBLIC on purpose (v3.4 amendment to Lock §0.8 #21, founder-approved
 * CRO redesign plan §2/§4): monographs are the destination for the
 * Results-page matched-herb links, so anonymous quiz-takers must be able
 * to read them. The DB view herbs_directory_v enforces the real tier
 * gate — anon/free callers receive NULL for gated bands, so this page
 * renders exactly the depth the caller is entitled to and advertises
 * the rest:
 *   • Free-visibility herbs → identity + energetics + safety render;
 *     the clinical study renders as a locked preview (Seed CTA).
 *   • Seed-visibility herbs (is_locked) → identity only + one full-depth
 *     advertisement panel.
 *   • Seed+ callers → everything.
 *
 * The dynamic :herbId segment swallows any typo'd single-segment path
 * under /apothecary (static siblings like /apothecary/pricing always
 * outrank it, but /apothecary/pricng lands here) — the not-found state
 * below is the safety net for those.
 */
export default function HerbMonograph() {
  const { herbId: param } = useParams<{ herbId: string }>();
  const { data: herbs, isLoading, isError, isSubscriber } = useHerbsDirectory();
  const { data: activePattern } = useEdenPattern();
  const { viewedOrder, recordView } = useViewedHerbs();

  const herb = findHerbByParam(herbs, param);
  const name = herb?.common_name ?? "";
  const isLocked = herb?.is_locked === true;
  const hasClinical = !!herb && !isLocked && herb.tissue_states_indicated !== null;

  // CRO Phase 3 retention: record the view once the herb resolves. Hook
  // rules require this ABOVE the early returns; the guard inside skips
  // loading/error/not-found states. recordView is idempotent, so
  // StrictMode double-invokes and remounts are harmless.
  const resolvedHerbId = herb?.herb_id ?? null;
  useEffect(() => {
    if (resolvedHerbId) recordView(resolvedHerbId);
    // recordView is stable-enough (reads localStorage fresh each call);
    // keying on the id alone prevents effect churn per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedHerbId]);

  // Recently-viewed strip (excluding the page's own herb) — the public
  // page's reason-to-keep-going. Resolved against the loaded directory so
  // stale ids from removed herbs drop out naturally.
  const recentlyViewed = viewedOrder
    .filter((id) => id !== resolvedHerbId)
    .map((id) => herbs.find((h) => h.herb_id === id))
    .filter((h): h is NonNullable<typeof h> => !!h)
    .slice(0, 4);

  // Match badge — client-computed like HerbCard. Since the CRO Phase 2
  // view migration, temperature/moisture are visible on every row, so
  // locked monographs carry the badge too (two-axis degraded mode —
  // tissue_states stays Seed-gated). Rows without axis data classify
  // Neutral and the badge hides without a special case.
  const match =
    herb && activePattern
      ? computeMatchRelationship(
          {
            temperature: herb.temperature,
            moisture: herb.moisture,
            tissue_states_indicated: herb.tissue_states_indicated,
          },
          activePattern,
        )
      : null;
  const patternShort = activePattern
    ? activePattern.replace(/^The\s+/i, "")
    : null;

  // Unresolved params (typos the :herbId segment swallows) canonicalize to
  // the directory URL, never echo the junk param back as a self-referential
  // canonical/og:url on an HTTP-200 soft-404.
  useDocumentMeta({
    title: herb
      ? `${name} Monograph | Eden Apothecary`
      : "Herb Monograph | Eden Apothecary",
    description: herb
      ? herb.energetics_summary
        ? herb.energetics_summary.slice(0, 155)
        : `${name} in the Eden Apothecary: identity, energetics, safety, and the clinical study, organized by body pattern.`
      : "Herb monographs organized by body pattern in the Eden Apothecary.",
    canonical: herb
      ? `https://edeninstitute.health/apothecary/${herbParam(herb)}`
      : "https://edeninstitute.health/apothecary",
  });

  if (isLoading) return <PageSkeleton />;

  // Directory fetch failed (network blip / 5xx after retries): say so and
  // offer a retry — never assert "not found" for an herb that may exist.
  // Mirrors ApothecaryHome's error handling of the same hook.
  if (isError) {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center">
        <h1
          className="font-serif text-3xl font-bold mb-4"
          style={{ color: "hsl(var(--eden-bark))" }}
        >
          We couldn't load this herb
        </h1>
        <p className="font-body text-base text-muted-foreground mb-8">
          Something went wrong fetching the directory. Please try again.
        </p>
        <Button variant="eden" size="lg" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </div>
    );
  }

  if (!herb) {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center">
        <h1
          className="font-serif text-3xl font-bold mb-4"
          style={{ color: "hsl(var(--eden-bark))" }}
        >
          Herb not found
        </h1>
        <p className="font-body text-base text-muted-foreground mb-8">
          We couldn't find a monograph at this address. Browse the full
          directory, or take the 2-minute quiz to see the herbs matched to
          your body pattern.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="eden" size="lg" asChild>
            <Link to={ROUTES.APOTHECARY}>Browse all herbs</Link>
          </Button>
          <Button variant="eden-outline" size="lg" asChild>
            <Link to={ROUTES.ASSESSMENT}>Take the quiz</Link>
          </Button>
        </div>
      </div>
    );
  }

  const complaintNames = (herb.complaint_names ?? []).filter(Boolean);

  return (
    <div>
      {/* ── Identity header (Band 1 — always present) ── */}
      <section
        className="py-10 md:py-14 px-6"
        style={{ backgroundColor: "hsl(var(--eden-cream))" }}
      >
        <div className="max-w-3xl mx-auto relative">
          {/* Heart sits absolute top-right of this relative container.
              Locked rows get no heart — the lock owns that slot, matching
              HerbCard. */}
          {!isLocked && (
            <HerbFavoriteHeart herbId={herb.herb_id ?? ""} herbName={name} />
          )}
          {/* min-h + negative margin keeps the 44px tap target without
              shifting the visual layout (project mobile spec). */}
          <Link
            to={ROUTES.APOTHECARY}
            className="inline-flex items-center gap-1 font-body text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 min-h-[44px] -my-3 py-3 pr-3"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            All herbs
          </Link>
          <p
            className="font-accent text-xs tracking-[0.3em] uppercase mb-3"
            style={{ color: "hsl(var(--eden-gold))" }}
          >
            Herb monograph
          </p>
          <h1
            className="font-serif text-4xl md:text-5xl font-bold leading-tight mb-2"
            style={{ color: "hsl(var(--eden-bark))" }}
          >
            {name}
          </h1>
          {(herb.latin_name || herb.pronunciation) && (
            <p className="font-body text-lg text-muted-foreground mb-1">
              {herb.latin_name && <span className="italic">{herb.latin_name}</span>}
              {herb.latin_name && herb.pronunciation && " · "}
              {herb.pronunciation}
            </p>
          )}
          {(HERB_ALIASES[herbParam(herb)] ?? []).length > 0 && (
            <p className="font-body text-sm text-muted-foreground mb-4">
              Also known as {HERB_ALIASES[herbParam(herb)].join(", ")}
            </p>
          )}
          <div className="flex flex-wrap gap-2 mb-2">
            {herb.part_used && <IdentityChip label="Part used" value={herb.part_used} />}
            {herb.plant_family && <IdentityChip label="Family" value={herb.plant_family} />}
            {isLocked && (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-body text-xs"
                style={{
                  backgroundColor: "hsl(var(--eden-gold) / 0.12)",
                  color: "hsl(var(--eden-gold))",
                }}
              >
                <Lock className="w-3 h-3" aria-hidden="true" />
                Full study opens with Seed
              </span>
            )}
          </div>
          {match && match.relationship !== "neutral" && patternShort && (
            <div className="mt-4" aria-label={`Relationship to your ${patternShort} pattern`}>
              {match.relationship === "match" ? (
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-body text-sm"
                  style={{
                    backgroundColor: "hsl(var(--eden-gold) / 0.15)",
                    color: "hsl(var(--eden-gold))",
                  }}
                >
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                  Matches your {patternShort}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-body text-sm bg-destructive/10 text-destructive">
                  <ShieldAlert className="w-4 h-4" aria-hidden="true" />
                  May aggravate your {patternShort}
                </span>
              )}
              {match.reasons.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {match.reasons.map((reason) => (
                    <li
                      key={reason}
                      className="font-body text-sm italic"
                      style={{
                        color:
                          match.relationship === "match"
                            ? "hsl(var(--eden-gold))"
                            : "hsl(var(--destructive))",
                      }}
                    >
                      {reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">
        {complaintNames.length > 0 && (
          <section aria-label="Traditionally reached for">
            <SectionHeading>Traditionally reached for</SectionHeading>
            <div className="flex flex-wrap gap-2">
              {complaintNames.map((c) => (
                <span
                  key={c}
                  className="px-3 py-1 rounded-full font-body text-sm border"
                  style={{
                    borderColor: "hsl(var(--border))",
                    color: "hsl(var(--eden-bark))",
                  }}
                >
                  {c}
                </span>
              ))}
            </div>
          </section>
        )}

        {isLocked ? (
          /* ── Seed-visibility herb, anon/free caller: identity is the
                preview, the monograph body is the advertisement. ── */
          <section
            className="p-6 md:p-8 border-2 rounded"
            style={{
              borderColor: "hsl(var(--eden-gold) / 0.4)",
              backgroundColor: "hsl(var(--eden-cream) / 0.5)",
            }}
          >
            <p
              className="font-accent text-xs tracking-[0.3em] uppercase mb-2"
              style={{ color: "hsl(var(--eden-gold))" }}
            >
              There's more to know about {name}
            </p>
            <h2
              className="font-serif text-2xl font-bold mb-3"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              Seed opens this monograph in full.
            </h2>
            {/* Always-visible energetics teaser (CRO Phase 2) — the depth
                is visibly present, one step from unlocking. */}
            {(herb.temperature || herb.moisture || herb.energetics_teaser) && (
              <p
                className="font-body text-base italic mb-3"
                style={{ color: "hsl(var(--eden-bark))" }}
              >
                {herb.energetics_teaser ??
                  [herb.temperature, herb.moisture].filter(Boolean).join(" and ")}
                .
              </p>
            )}
            <p className="font-body text-base text-muted-foreground leading-relaxed mb-4">
              The complete study of {name} is written and waiting: how it
              acts in the body, who it suits, and how to use it safely.
            </p>
            {/* Bullets stay inside the SEED promise of the tier ladder
                (drug interactions / refer thresholds are sold as Root on
                Start + apothecaryTiers — don't advertise them here). */}
            <ul className="font-body text-sm text-muted-foreground space-y-1.5 mb-6 list-disc pl-5">
              <li>Taste, temperature, moisture, and the energetics summary</li>
              <li>Cautions, contraindications, and pregnancy, nursing, and children's safety</li>
              <li>Actions and tissue states, indicated and contraindicated</li>
              <li>Body systems, chief complaints, and constitutional matches</li>
              <li>Preparation methods and dosage notes</li>
            </ul>
            <Button
              variant="eden"
              size="lg"
              className="w-full sm:w-auto"
              asChild
              data-cta="monograph-unlock-seed"
            >
              <Link to={`${ROUTES.APOTHECARY_PRICING}#tier-seed`}>
                Unlock with Seed, $7.99/mo
              </Link>
            </Button>
          </section>
        ) : (
          <>
            {/* ── At a glance (Band 2) ── */}
            {(herb.taste || herb.temperature || herb.moisture || herb.energetics_summary) && (
              <section aria-label="Energetics at a glance">
                <SectionHeading>At a glance</SectionHeading>
                <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  {herb.taste && <GlanceItem label="Taste" value={herb.taste} />}
                  {herb.temperature && <GlanceItem label="Temperature" value={herb.temperature} />}
                  {herb.moisture && <GlanceItem label="Moisture" value={herb.moisture} />}
                </dl>
                {herb.energetics_summary && (
                  <p
                    className="font-body text-base leading-relaxed"
                    style={{ color: "hsl(var(--eden-bark))" }}
                  >
                    {herb.energetics_summary}
                  </p>
                )}
              </section>
            )}

            {/* ── Biblical & traditional (Band 2) ── */}
            {(herb.biblical_traditional_reference || herb.stewardship_note) && (
              <section aria-label="Biblical and traditional context">
                <SectionHeading>Biblical &amp; traditional</SectionHeading>
                {herb.biblical_traditional_reference && (
                  <p
                    className="font-body text-base leading-relaxed mb-3"
                    style={{ color: "hsl(var(--eden-bark))" }}
                  >
                    {herb.biblical_traditional_reference}
                  </p>
                )}
                {herb.stewardship_note && (
                  <p className="font-body text-sm italic text-muted-foreground leading-relaxed">
                    {herb.stewardship_note}
                  </p>
                )}
              </section>
            )}

            {/* ── Safety (Band 2 core + Band 3 overlays) ── */}
            <section aria-label="Safety">
              <SectionHeading>Safety</SectionHeading>
              {(herb.cautions || herb.contraindications_general) && (
                <div className="flex gap-3 mb-4">
                  <AlertTriangle
                    className="w-5 h-5 shrink-0 mt-0.5 text-destructive"
                    aria-hidden="true"
                  />
                  <div className="space-y-2">
                    {herb.cautions && (
                      <p
                        className="font-body text-base leading-relaxed"
                        style={{ color: "hsl(var(--eden-bark))" }}
                      >
                        {herb.cautions}
                      </p>
                    )}
                    {herb.contraindications_general && (
                      <p className="font-body text-sm text-muted-foreground leading-relaxed">
                        {herb.contraindications_general}
                      </p>
                    )}
                  </div>
                </div>
              )}
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {herb.pregnancy_safety && (
                  <GlanceItem label="Pregnancy" value={herb.pregnancy_safety} />
                )}
                {herb.breastfeeding_safety && (
                  <GlanceItem label="Breastfeeding" value={herb.breastfeeding_safety} />
                )}
                {herb.children_safety && (
                  <GlanceItem label="Children" value={herb.children_safety} />
                )}
              </dl>
            </section>

            {hasClinical ? (
              /* ── The clinical study (Band 3 — Seed+) ── */
              <section aria-label="Clinical study" className="space-y-8">
                <div>
                  <SectionHeading>Tissue states</SectionHeading>
                  {herb.tissue_states_indicated && (
                    <ChipRow
                      label="Indicated for"
                      values={splitList(herb.tissue_states_indicated)}
                      tone="gold"
                    />
                  )}
                  {herb.tissue_states_contraindicated && (
                    <ChipRow
                      label="Contraindicated in"
                      values={splitList(herb.tissue_states_contraindicated)}
                      tone="destructive"
                    />
                  )}
                </div>

                {(herb.system_affinity || herb.chief_complaints) && (
                  <div>
                    <SectionHeading>Systems &amp; chief complaints</SectionHeading>
                    {herb.system_affinity && (
                      <ProseItem label="System affinity" value={herb.system_affinity} />
                    )}
                    {herb.chief_complaints && (
                      <ProseItem label="Chief complaints" value={herb.chief_complaints} />
                    )}
                  </div>
                )}

                {(herb.western_constitution_match ||
                  herb.ayurvedic_dosha_match ||
                  herb.tcm_pattern_match) && (
                  <div>
                    <SectionHeading>Constitutional overlays</SectionHeading>
                    {herb.western_constitution_match && (
                      <ProseItem label="Western" value={herb.western_constitution_match} />
                    )}
                    {herb.ayurvedic_dosha_match && (
                      <ProseItem label="Ayurvedic (matches)" value={herb.ayurvedic_dosha_match} />
                    )}
                    {herb.ayurvedic_dosha_aggravates && (
                      <ProseItem
                        label="Ayurvedic (aggravates)"
                        value={herb.ayurvedic_dosha_aggravates}
                      />
                    )}
                    {herb.tcm_pattern_match && (
                      <ProseItem label="TCM (indicated)" value={herb.tcm_pattern_match} />
                    )}
                    {herb.tcm_contraindicated_patterns && (
                      <ProseItem
                        label="TCM (contraindicated)"
                        value={herb.tcm_contraindicated_patterns}
                      />
                    )}
                  </div>
                )}

                {(herb.preparation_methods || herb.dosage_notes) && (
                  <div>
                    <SectionHeading>Preparation &amp; dosage</SectionHeading>
                    {herb.preparation_methods && (
                      <ProseItem label="Preparations" value={herb.preparation_methods} />
                    )}
                    {herb.dosage_notes && (
                      <ProseItem label="Dosage" value={herb.dosage_notes} />
                    )}
                  </div>
                )}

                {herb.drug_interactions && (
                  <div>
                    <SectionHeading>Drug interactions</SectionHeading>
                    <div className="flex gap-3">
                      <AlertTriangle
                        className="w-5 h-5 shrink-0 mt-0.5 text-destructive"
                        aria-hidden="true"
                      />
                      <p
                        className="font-body text-base leading-relaxed"
                        style={{ color: "hsl(var(--eden-bark))" }}
                      >
                        {herb.drug_interactions}
                      </p>
                    </div>
                  </div>
                )}

                {herb.refer_threshold && (
                  <div>
                    <SectionHeading>When to refer</SectionHeading>
                    <p className="font-body text-base leading-relaxed text-muted-foreground">
                      {herb.refer_threshold}
                    </p>
                  </div>
                )}
              </section>
            ) : (
              /* ── Free-visibility herb, anon/free caller: the clinical
                    study renders as a preview that names exactly what
                    Seed opens for THIS herb. ── */
              <section
                className="p-6 md:p-8 border-2 rounded"
                style={{
                  borderColor: "hsl(var(--eden-gold))",
                  backgroundColor: "hsl(var(--eden-forest))",
                }}
                aria-label="Clinical study, opens with Seed"
              >
                {/* Eyebrow renders in parchment here: 12px gold on forest
                    fails WCAG AA contrast (~4.4:1); gold eyebrows are for
                    cream/white backgrounds only. Bullets stay inside the
                    SEED promise of the tier ladder (drug interactions /
                    refer thresholds are sold as Root). */}
                <p
                  className="font-accent text-xs tracking-[0.3em] uppercase mb-2"
                  style={{ color: "hsl(var(--eden-parchment) / 0.9)" }}
                >
                  The clinical study
                </p>
                <h2
                  className="font-serif text-2xl font-bold mb-3"
                  style={{ color: "hsl(var(--eden-parchment))" }}
                >
                  Seed opens the full clinical study of {name}.
                </h2>
                <ul
                  className="font-body text-sm space-y-1.5 mb-6 list-disc pl-5"
                  style={{ color: "hsl(var(--eden-parchment) / 0.85)" }}
                >
                  <li>Actions and tissue states, indicated and contraindicated</li>
                  <li>Body systems and chief complaints</li>
                  <li>Constitutional overlays: Pattern of Eden, Western, Ayurvedic, TCM</li>
                  <li>Preparation methods and dosage notes</li>
                </ul>
                <Button
                  variant="eden"
                  size="lg"
                  className="w-full sm:w-auto whitespace-normal h-auto py-3"
                  asChild
                  data-cta="monograph-clinical-seed"
                >
                  <Link to={`${ROUTES.APOTHECARY_PRICING}#tier-seed`}>
                    Unlock the full study with Seed, $7.99/mo
                  </Link>
                </Button>
              </section>
            )}
          </>
        )}

        {/* ── No Pattern yet: the quiz is the personalization hook. ── */}
        {!activePattern && (
          <section
            className="p-6 border rounded text-center"
            style={{
              borderColor: "hsl(var(--border))",
              backgroundColor: "hsl(var(--eden-cream) / 0.5)",
            }}
            aria-label="Take the Pattern quiz"
          >
            <h2
              className="font-serif text-xl font-semibold mb-2"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              Does {name} fit your body pattern?
            </h2>
            <p className="font-body text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Take the free 2-minute Pattern of Eden quiz and every herb in
              the directory is read against your own constitution.
            </p>
            <Button variant="eden" size="lg" asChild data-cta="monograph-quiz">
              <Link to={ROUTES.ASSESSMENT}>Take the 2-minute quiz</Link>
            </Button>
          </section>
        )}

        {/* Recently viewed (CRO Phase 3): keep the reading thread going.
            Device-local, works for anon too — this is the public page's
            retention hook. */}
        {recentlyViewed.length > 0 && (
          <section aria-label="Recently viewed herbs">
            {/* Darker gold than the --eden-gold token: 12px text on the
                light background needs ≥4.5:1 (the token lands at ~2.3:1). */}
            <p
              className="font-accent text-[11px] tracking-[0.25em] uppercase mb-2"
              style={{ color: "hsl(40, 60%, 34%)" }}
            >
              Recently viewed
            </p>
            <div className="flex flex-wrap gap-2">
              {recentlyViewed.map((h) => (
                <Link
                  key={h.herb_id}
                  to={ROUTES.APOTHECARY_HERB(herbParam(h))}
                  data-cta="monograph-recently-viewed"
                  className="inline-flex items-center min-h-[44px] px-3 py-1 rounded-full font-body text-sm border bg-background transition-colors hover:border-[hsl(var(--eden-gold))]"
                  style={{
                    borderColor: "hsl(var(--border))",
                    color: "hsl(var(--eden-bark))",
                  }}
                >
                  {h.common_name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Subscribers with a Pattern get a quiet directory return path
            instead of a sales block. */}
        {isSubscriber && (
          <p className="text-center">
            <Link
              to={ROUTES.APOTHECARY}
              className="inline-flex items-center min-h-[44px] px-3 font-body text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
            >
              Back to the full directory
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Small presentational helpers (page-local) ── */

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-serif text-xl font-semibold mb-3"
      style={{ color: "hsl(var(--eden-bark))" }}
    >
      {children}
    </h2>
  );
}

function IdentityChip({ label, value }: { label: string; value: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-body text-xs border bg-background"
      style={{ borderColor: "hsl(var(--border))" }}
    >
      <span className="text-muted-foreground">{label}:</span>
      <span style={{ color: "hsl(var(--eden-bark))" }}>{value}</span>
    </span>
  );
}

function GlanceItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt
        className="font-accent text-[11px] tracking-[0.2em] uppercase mb-1"
        style={{ color: "hsl(var(--eden-gold))" }}
      >
        {label}
      </dt>
      <dd
        className="font-body text-sm leading-relaxed"
        style={{ color: "hsl(var(--eden-bark))" }}
      >
        {value}
      </dd>
    </div>
  );
}

function ProseItem({ label, value }: { label: string; value: string }) {
  return (
    <p className="font-body text-base leading-relaxed mb-2">
      <span
        className="font-accent text-[11px] tracking-[0.2em] uppercase mr-2"
        style={{ color: "hsl(var(--eden-gold))" }}
      >
        {label}
      </span>
      <span style={{ color: "hsl(var(--eden-bark))" }}>{value}</span>
    </p>
  );
}

function ChipRow({
  label,
  values,
  tone,
}: {
  label: string;
  values: string[];
  tone: "gold" | "destructive";
}) {
  if (values.length === 0) return null;
  return (
    <div className="mb-3">
      <p
        className="font-accent text-[11px] tracking-[0.2em] uppercase mb-1.5"
        style={{ color: "hsl(var(--eden-gold))" }}
      >
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {values.map((v) => (
          <span
            key={v}
            className={
              tone === "destructive"
                ? "px-3 py-1 rounded-full font-body text-sm bg-destructive/10 text-destructive"
                : "px-3 py-1 rounded-full font-body text-sm"
            }
            style={
              tone === "gold"
                ? {
                    backgroundColor: "hsl(var(--eden-gold) / 0.12)",
                    color: "hsl(var(--eden-bark))",
                  }
                : undefined
            }
          >
            {v}
          </span>
        ))}
      </div>
    </div>
  );
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
