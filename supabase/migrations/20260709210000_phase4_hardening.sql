-- Practitioner buildout Phase 4: hardening & convergence.
--
--   1. Lock #44 provenance labeling — every surfaced lens verdict now carries
--      an explicit epistemic label at the worldview boundary:
--        • eden / western verdicts derive from PD-documented energetics →
--          'empirical_observational'
--        • ayurveda / tcm verdicts are the tradition's correspondence,
--          shipped metaphysics-stripped → 'traditional_observation'
--      (v_herb_lens_verdicts columns are appended at the END per the
--      CREATE OR REPLACE VIEW invariance rule.)
--   2. Disagreement analytics (PD-10) — an aggregate view over the stored
--      framework_readings so lens-conflict frequency is measurable and the
--      confidence model can be tuned on real completions.
--   3. Query performance — covering index for the pocket verdict join.
--
-- Balanced/indeterminate + contradictory-answer handling live in the engine
-- (TL-7: per-axis balanced states, Lock #39 no forced Pattern; low-coverage
-- axes read as low confidence) and surface through axis_confidence — the
-- retake/clinician-review UX reads those fields directly.

DROP VIEW IF EXISTS public.v_herb_conflict_pairs;
DROP VIEW IF EXISTS public.v_herb_lens_verdicts;

CREATE VIEW public.v_herb_lens_verdicts
WITH (security_invoker = on) AS
  SELECT herb_id, 'eden'::text AS framework, pattern_id, relationship AS verdict,
         rationale AS note, primary_citation, secondary_citation,
         derivation AS provenance, 'empirical_observational'::text AS lock44_label
    FROM public.herbs_eden_patterns
   WHERE surfaced AND relationship IN ('match','avoid')
  UNION ALL
  SELECT herb_id, 'western', constitution_id, 'match',
         notes, primary_citation, secondary_citation,
         provenance, 'empirical_observational'
    FROM public.herbs_constitutions
   WHERE surfaced AND constitution_id ~ '^C0[1-7]$'
  UNION ALL
  SELECT herb_id, 'ayurveda', dosha_id, 'match',
         notes, primary_citation, secondary_citation,
         provenance, 'traditional_observation'
    FROM public.herbs_doshas_match
   WHERE surfaced
  UNION ALL
  SELECT herb_id, 'ayurveda', dosha_id, 'avoid',
         notes, primary_citation, secondary_citation,
         provenance, 'traditional_observation'
    FROM public.herbs_doshas_aggravates
   WHERE surfaced
  UNION ALL
  SELECT herb_id, 'tcm', pattern_id, 'match',
         notes, primary_citation, secondary_citation,
         provenance, 'traditional_observation'
    FROM public.herbs_tcm_indicated
   WHERE surfaced
  UNION ALL
  SELECT herb_id, 'tcm', pattern_id, 'avoid',
         notes, primary_citation, secondary_citation,
         provenance, 'traditional_observation'
    FROM public.herbs_tcm_contraindicated
   WHERE surfaced;

COMMENT ON VIEW public.v_herb_lens_verdicts IS
  'All surfaced (dual-cited) herb verdicts across the four lens bridges (TL-1). lock44_label marks the worldview boundary per Lock #44: empirical_observational (derived from PD-documented energetics) vs traditional_observation (tradition correspondence, metaphysics-stripped). security_invoker: tier RLS applies to client reads.';

CREATE VIEW public.v_herb_conflict_pairs
WITH (security_invoker = on) AS
  SELECT a.herb_id,
         a.framework  AS match_framework,
         a.pattern_id AS match_pattern,
         b.framework  AS avoid_framework,
         b.pattern_id AS avoid_pattern
    FROM public.v_herb_lens_verdicts a
    JOIN public.v_herb_lens_verdicts b
      ON b.herb_id = a.herb_id
     AND a.verdict = 'match'
     AND b.verdict = 'avoid'
     AND b.framework <> a.framework;

COMMENT ON VIEW public.v_herb_conflict_pairs IS
  'PD-11 cross-lens conflict set (rebuilt with the Lock #44-labeled verdict view).';

-- PD-10 analytics: disagreement frequency across stored completions.
CREATE OR REPLACE VIEW public.v_disagreement_analytics
WITH (security_invoker = off) AS
  SELECT d.quiz_version,
         dis->>'framework'   AS framework,
         dis->>'pattern_id'  AS pattern_id,
         dis->>'axis'        AS axis,
         count(*)            AS occurrences,
         min(d.completed_at) AS first_seen,
         max(d.completed_at) AS last_seen
    FROM public.diagnostic_completions d,
         LATERAL jsonb_array_elements(d.framework_readings->'disagreements') dis
   WHERE d.framework_readings ? 'disagreements'
   GROUP BY 1, 2, 3, 4;

COMMENT ON VIEW public.v_disagreement_analytics IS
  'PD-10 tuning surface: which framework/pattern/axis combinations disagree with the Eden axes, how often, across which quiz versions. OWNER-privileged (service/founder analytics only — completions are clinical data).';

REVOKE ALL ON public.v_disagreement_analytics FROM anon, authenticated;

-- Pocket-query hot path: verdict lookup by (framework, pattern) per lens table.
CREATE INDEX IF NOT EXISTS herbs_eden_patterns_pattern_idx
  ON public.herbs_eden_patterns (pattern_id, relationship) WHERE surfaced;
CREATE INDEX IF NOT EXISTS herbs_doshas_match_dosha_idx
  ON public.herbs_doshas_match (dosha_id) WHERE surfaced;
CREATE INDEX IF NOT EXISTS herbs_doshas_aggravates_dosha_idx
  ON public.herbs_doshas_aggravates (dosha_id) WHERE surfaced;
CREATE INDEX IF NOT EXISTS herbs_tcm_indicated_pattern_idx
  ON public.herbs_tcm_indicated (pattern_id) WHERE surfaced;
CREATE INDEX IF NOT EXISTS herbs_tcm_contraindicated_pattern_idx
  ON public.herbs_tcm_contraindicated (pattern_id) WHERE surfaced;
