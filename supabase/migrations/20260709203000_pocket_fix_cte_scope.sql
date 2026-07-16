-- Phase 3 fix: pocket_materia_medica referenced the `scored` CTE from a
-- second statement (the RETURN expression), where it no longer exists —
-- surfaced by the Lock #73 verification pass (SQLSTATE 42P01). Both the
-- match list and the avoid/flagged list now aggregate in the single CTE
-- statement via FILTER clauses. Behavior otherwise identical.

CREATE OR REPLACE FUNCTION public.pocket_materia_medica(
  p_person_profile_id uuid,
  p_encounter_id      uuid,
  p_framework         text DEFAULT NULL,
  p_pattern_id        text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'clinical', 'pg_temp'
AS $$
DECLARE
  v_enc     clinical.encounters%ROWTYPE;
  v_profile public.person_profiles%ROWTYPE;
  v_age     numeric;
  v_herbs   jsonb;
  v_avoid   jsonb;
  v_lens    jsonb;
BEGIN
  SELECT * INTO v_enc FROM clinical.encounters WHERE id = p_encounter_id;
  IF NOT FOUND OR v_enc.person_profile_id <> p_person_profile_id THEN
    RETURN jsonb_build_object('error', 'encounter_not_found');
  END IF;

  -- PD-9: refer-out BLOCKS.
  IF array_length(v_enc.refer_out_trigger_ids, 1) > 0
     AND v_enc.refer_out_acknowledged_at IS NULL THEN
    RETURN jsonb_build_object(
      'blocked', true,
      'reason', 'refer_out_unacknowledged',
      'triggers', (SELECT jsonb_agg(jsonb_build_object(
                     'trigger_id', t.trigger_id,
                     'description', t.trigger_description,
                     'severity', t.severity,
                     'action', t.action))
                     FROM public.refer_out_triggers t
                    WHERE t.trigger_id = ANY (v_enc.refer_out_trigger_ids)));
  END IF;

  SELECT * INTO v_profile FROM public.person_profiles WHERE id = p_person_profile_id;
  v_age := CASE WHEN v_profile.date_of_birth IS NULL THEN NULL
                ELSE extract(year FROM age(v_profile.date_of_birth)) END;

  WITH readings AS (
    SELECT DISTINCT ON (framework) framework, pattern_id
      FROM public.person_profile_constitutions
     WHERE person_profile_id = p_person_profile_id AND role = 'primary'
       AND (p_framework IS NULL OR framework = p_framework)
     ORDER BY framework, (reading_kind = 'adjusted') DESC, updated_at DESC
  ),
  lens AS (
    SELECT * FROM readings
    UNION
    SELECT p_framework, p_pattern_id
     WHERE p_framework IS NOT NULL AND p_pattern_id IS NOT NULL
  ),
  verdicts AS (
    SELECT v.herb_id, v.framework, v.pattern_id, v.verdict, v.note,
           v.primary_citation, v.secondary_citation
      FROM public.v_herb_lens_verdicts v
      JOIN lens l ON l.framework = v.framework AND l.pattern_id = v.pattern_id
  ),
  complaint_herbs AS (
    SELECT hc.herb_id
      FROM public.herbs_complaints hc
     WHERE v_enc.chief_complaint_id IS NOT NULL
       AND hc.complaint_id = v_enc.chief_complaint_id
  ),
  cautions AS (
    SELECT c.herb_id,
           jsonb_agg(jsonb_build_object(
             'kind', c.type, 'entity', c.interacting_entity,
             'severity', c.severity, 'guidance', c.clinical_guidance,
             'source', c.source_citation) ORDER BY c.severity DESC) AS items,
           bool_or(c.severity = 'absolute') AS excluded
      FROM public.contraindications c
     WHERE (c.type = 'pregnancy'      AND v_enc.pregnant)
        OR (c.type = 'breastfeeding'  AND v_enc.breastfeeding)
        OR (c.type = 'pediatric'      AND (v_profile.profile_kind = 'child' OR v_age < 12))
        OR (c.type = 'geriatric'      AND v_age >= 65)
        OR (c.type = 'drug_interaction'
            AND v_profile.medications IS NOT NULL
            AND v_profile.medications ILIKE '%' || c.interacting_entity || '%')
     GROUP BY c.herb_id
  ),
  scored AS (
    SELECT h.herb_id,
           h.common_name,
           h.latin_name,
           (h.herb_id IN (SELECT herb_id FROM complaint_herbs)) AS complaint_matched,
           COALESCE(jsonb_object_agg(v.framework,
             jsonb_build_object('verdict', v.verdict, 'pattern_id', v.pattern_id,
                                'note', v.note,
                                'primary_citation', v.primary_citation,
                                'secondary_citation', v.secondary_citation))
             FILTER (WHERE v.framework IS NOT NULL), '{}'::jsonb) AS lens_verdicts,
           CASE WHEN bool_or(v.verdict = 'avoid') THEN 'avoid'          -- PD-11: Avoid wins
                WHEN bool_or(v.verdict = 'match') THEN 'match'
                ELSE 'neutral' END AS badge,
           COALESCE(bool_or(v.verdict = 'avoid') AND bool_or(v.verdict = 'match'), false) AS has_conflict,
           ct.items AS caution_items,
           COALESCE(ct.excluded, false) AS excluded
      FROM public.herbs h
      LEFT JOIN verdicts v ON v.herb_id = h.herb_id
      LEFT JOIN cautions ct ON ct.herb_id = h.herb_id
     GROUP BY h.herb_id, h.common_name, h.latin_name, ct.items, ct.excluded
  )
  SELECT
    jsonb_agg(to_jsonb(s) ORDER BY s.complaint_matched DESC, s.common_name)
      FILTER (WHERE NOT s.excluded AND s.badge = 'match'
                AND (v_enc.chief_complaint_id IS NULL OR s.complaint_matched)),
    jsonb_agg(to_jsonb(s) ORDER BY s.complaint_matched DESC, s.common_name)
      FILTER (WHERE (s.badge = 'avoid' OR s.excluded OR s.has_conflict)
                AND (v_enc.chief_complaint_id IS NULL OR s.complaint_matched))
    INTO v_herbs, v_avoid
    FROM scored s;

  SELECT jsonb_agg(jsonb_build_object('framework', framework, 'pattern_id', pattern_id))
    INTO v_lens
    FROM (
      SELECT DISTINCT ON (framework) framework, pattern_id
        FROM public.person_profile_constitutions
       WHERE person_profile_id = p_person_profile_id AND role = 'primary'
         AND (p_framework IS NULL OR framework = p_framework)
       ORDER BY framework, (reading_kind = 'adjusted') DESC, updated_at DESC
    ) r;

  RETURN jsonb_build_object(
    'blocked', false,
    'herbs', COALESCE(v_herbs, '[]'::jsonb),
    'avoid_list', COALESCE(v_avoid, '[]'::jsonb),
    'lens', COALESCE(v_lens, '[]'::jsonb),
    'population', jsonb_build_object(
      'age', v_age, 'kind', v_profile.profile_kind,
      'pregnant', v_enc.pregnant, 'breastfeeding', v_enc.breastfeeding)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pocket_materia_medica(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
