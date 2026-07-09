-- Practitioner buildout Phase 1 (PD-2, PD-10, PD-11): the unified four-lens
-- verdict surface and the queryable cross-lens conflict set.
--
--   • v_herb_lens_verdicts — one row per surfaced (herb × framework ×
--     pattern) verdict across all four one-home bridges. security_invoker,
--     so client reads inherit the junctions' seed_read tier gates; the
--     Practitioner EF reads it service-role.
--   • v_herb_conflict_pairs — the PD-11 data set: (herb, lens-A pattern
--     matched, lens-B pattern avoided) pairs. A client whose readings land
--     on both sides of a pair sees the conflict flag, and the Avoid side
--     wins the badge.
--   • profile_herb_lens_verdicts(profile) — given a person profile's
--     standing readings (adjusted preferred over computed per PD-8), the
--     per-herb all-lens verdict, conflict flag, and Avoid-wins badge that
--     the pocket materia medica renders (PD-11).

CREATE OR REPLACE VIEW public.v_herb_lens_verdicts
WITH (security_invoker = on) AS
  SELECT herb_id, 'eden'::text AS framework, pattern_id, relationship AS verdict,
         rationale AS note, primary_citation, secondary_citation
    FROM public.herbs_eden_patterns
   WHERE surfaced AND relationship IN ('match','avoid')
  UNION ALL
  SELECT herb_id, 'western', constitution_id, 'match',
         notes, primary_citation, secondary_citation
    FROM public.herbs_constitutions
   WHERE surfaced AND constitution_id ~ '^C0[1-7]$'
  UNION ALL
  SELECT herb_id, 'ayurveda', dosha_id, 'match',
         notes, primary_citation, secondary_citation
    FROM public.herbs_doshas_match
   WHERE surfaced
  UNION ALL
  SELECT herb_id, 'ayurveda', dosha_id, 'avoid',
         notes, primary_citation, secondary_citation
    FROM public.herbs_doshas_aggravates
   WHERE surfaced
  UNION ALL
  SELECT herb_id, 'tcm', pattern_id, 'match',
         notes, primary_citation, secondary_citation
    FROM public.herbs_tcm_indicated
   WHERE surfaced
  UNION ALL
  SELECT herb_id, 'tcm', pattern_id, 'avoid',
         notes, primary_citation, secondary_citation
    FROM public.herbs_tcm_contraindicated
   WHERE surfaced;

COMMENT ON VIEW public.v_herb_lens_verdicts IS
  'All surfaced (dual-cited) herb verdicts across the four lens bridges (TL-1 one home each). Verdict ∈ match|avoid; a lens with no row for a herb/pattern is neutral by definition. security_invoker: tier RLS on the junctions applies to client reads.';

CREATE OR REPLACE VIEW public.v_herb_conflict_pairs
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
  'PD-11 cross-lens conflict set: pairs where one lens matches a herb for pattern A while another lens avoids it for pattern B. For a client whose readings include both patterns, the herb card flags the disagreement and the Avoid verdict wins the top badge.';

-- Per-profile pocket verdicts: adjusted readings preferred over computed
-- (PD-8), Avoid wins the badge on conflict (PD-11).
CREATE OR REPLACE FUNCTION public.profile_herb_lens_verdicts(p_profile_id uuid)
RETURNS TABLE (
  herb_id      text,
  verdicts     jsonb,
  badge        text,
  has_conflict boolean
)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  WITH readings AS (
    SELECT DISTINCT ON (framework) framework, pattern_id
      FROM public.person_profile_constitutions
     WHERE person_profile_id = p_profile_id
       AND role = 'primary'
     ORDER BY framework, (reading_kind = 'adjusted') DESC, updated_at DESC
  ),
  hits AS (
    SELECT v.herb_id, v.framework, v.pattern_id, v.verdict
      FROM public.v_herb_lens_verdicts v
      JOIN readings r
        ON r.framework = v.framework
       AND r.pattern_id = v.pattern_id
  )
  SELECT h.herb_id,
         jsonb_object_agg(h.framework,
           jsonb_build_object('verdict', h.verdict, 'pattern_id', h.pattern_id)) AS verdicts,
         CASE WHEN bool_or(h.verdict = 'avoid') THEN 'avoid'
              WHEN bool_or(h.verdict = 'match') THEN 'match'
              ELSE 'neutral' END                                                 AS badge,
         bool_or(h.verdict = 'avoid') AND bool_or(h.verdict = 'match')           AS has_conflict
    FROM hits h
   GROUP BY h.herb_id
$$;

COMMENT ON FUNCTION public.profile_herb_lens_verdicts(uuid) IS
  'Pocket-materia-medica verdict engine: for a person profile''s standing primary readings (adjusted over computed per PD-8), returns each herb''s per-lens verdicts, the PD-11 Avoid-wins badge, and the cross-lens conflict flag. SECURITY INVOKER: called service-role from the practitioner EF; client callers are bound by the underlying RLS.';
