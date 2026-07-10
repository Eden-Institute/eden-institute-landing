-- Practitioner buildout Phase 3 (PD-1, PD-9, PD-11, PD-12, TL-3, TL-4):
-- the Practitioner clinical layer + the pocket-materia-medica query engine.
--
-- Architecture:
--   • TL-3: clinical records live in a SEPARATE schema (`clinical`), FK-linked
--     to public.person_profiles (the roster IS person_profiles — its cap
--     trigger already enforces Practitioner Solo=500; Group/Enterprise raise
--     the cap at the tier layer). Lower-tier profiles coexist untouched.
--   • TL-4 / HIPAA posture: the clinical schema is NOT exposed through
--     PostgREST. All access flows through public SECURITY DEFINER RPCs that
--     only the service role may execute — i.e. only the practitioner-clinical
--     Edge Function (which does JWT → tier → ownership checks) can reach
--     clinical data. No client-direct reads or writes exist at all.
--   • PD-9: refer-out evaluation is structural — the pocket query RPC takes
--     the encounter and REFUSES to return herbs while un-acknowledged
--     refer-out triggers stand.
--   • PD-11/PD-12: the pocket query returns per-lens verdicts with the
--     Avoid-wins badge and applies population safety (pediatric/geriatric
--     from the profile, pregnancy/breastfeeding from the encounter,
--     drug-interaction matching against the profile's medication list).
--     Absolute contraindications exclude; the rest surface as flagged
--     cautions with clinical guidance.

CREATE SCHEMA IF NOT EXISTS clinical;

-- ── Encounters (HIPAA-aware clinical notes) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS clinical.encounters (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_user_id      uuid NOT NULL,
  person_profile_id         uuid NOT NULL REFERENCES public.person_profiles(id) ON DELETE CASCADE,
  encounter_date            timestamptz NOT NULL DEFAULT now(),
  chief_complaint_id        text REFERENCES public.complaints(complaint_id),
  chief_complaint_text      text,
  pregnant                  boolean NOT NULL DEFAULT false,
  breastfeeding             boolean NOT NULL DEFAULT false,
  refer_out_trigger_ids     text[] NOT NULL DEFAULT '{}',
  refer_out_acknowledged_at timestamptz,
  refer_out_acknowledged_note text,
  soap                      jsonb,   -- {s, o, a, p}
  status                    text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE clinical.encounters IS
  'Practitioner encounters (TL-3). HIPAA-aware: unreachable from PostgREST (schema not exposed); service-role RPCs only, behind the practitioner-clinical EF''s JWT + tier + ownership checks. refer_out_trigger_ids + acknowledgment implement the PD-9 block.';

CREATE INDEX IF NOT EXISTS encounters_profile_idx ON clinical.encounters (person_profile_id, encounter_date DESC);
CREATE INDEX IF NOT EXISTS encounters_practitioner_idx ON clinical.encounters (practitioner_user_id, encounter_date DESC);

-- ── Formularies ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clinical.formularies (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_user_id uuid NOT NULL,
  person_profile_id    uuid REFERENCES public.person_profiles(id) ON DELETE SET NULL,
  name                 text NOT NULL,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clinical.formulary_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formulary_id   uuid NOT NULL REFERENCES clinical.formularies(id) ON DELETE CASCADE,
  herb_id        text NOT NULL REFERENCES public.herbs(herb_id),
  preparation_id text REFERENCES public.preparations(prep_id),
  parts          numeric NOT NULL DEFAULT 1,
  unit           text NOT NULL DEFAULT 'part',
  note           text,
  sort_order     integer NOT NULL DEFAULT 100
);

CREATE INDEX IF NOT EXISTS formularies_practitioner_idx ON clinical.formularies (practitioner_user_id, updated_at DESC);

-- Lock the schema down: no anon/authenticated access at any layer.
REVOKE ALL ON ALL TABLES IN SCHEMA clinical FROM anon, authenticated;
REVOKE USAGE ON SCHEMA clinical FROM anon, authenticated;

-- ── Pocket materia medica (PD-2, PD-9, PD-11, PD-12) ───────────────────────

CREATE OR REPLACE FUNCTION public.pocket_materia_medica(
  p_person_profile_id uuid,
  p_encounter_id      uuid,
  p_framework         text DEFAULT NULL,   -- lens dropdown; NULL = all standing readings
  p_pattern_id        text DEFAULT NULL    -- explicit pattern under the lens; NULL = client's reading
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'clinical', 'pg_temp'
AS $$
DECLARE
  v_enc          clinical.encounters%ROWTYPE;
  v_profile      public.person_profiles%ROWTYPE;
  v_age          numeric;
  v_herbs        jsonb;
BEGIN
  SELECT * INTO v_enc FROM clinical.encounters WHERE id = p_encounter_id;
  IF NOT FOUND OR v_enc.person_profile_id <> p_person_profile_id THEN
    RETURN jsonb_build_object('error', 'encounter_not_found');
  END IF;

  -- PD-9: refer-out BLOCKS. No herb list leaves this function while
  -- un-acknowledged triggers stand on the encounter.
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
    -- The client's standing primary reading per lens (adjusted wins, PD-8),
    -- unless the practitioner pinned an explicit lens+pattern.
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
  SELECT jsonb_agg(to_jsonb(s) ORDER BY
           (s.badge = 'match') DESC, s.complaint_matched DESC, s.common_name)
    INTO v_herbs
    FROM scored s
   WHERE NOT s.excluded                       -- absolute contraindication: excluded (PD-12)
     AND (s.badge = 'match')                  -- terrain match list…
     AND (v_enc.chief_complaint_id IS NULL OR s.complaint_matched);  -- …for the chief complaint

  RETURN jsonb_build_object(
    'blocked', false,
    'herbs', COALESCE(v_herbs, '[]'::jsonb),
    'avoid_list', (SELECT jsonb_agg(to_jsonb(s) ORDER BY s.common_name)
                     FROM scored s
                    WHERE (s.badge = 'avoid' OR s.excluded OR s.has_conflict)
                      AND (v_enc.chief_complaint_id IS NULL OR s.complaint_matched)),
    'lens', (SELECT jsonb_agg(to_jsonb(l)) FROM lens l),
    'population', jsonb_build_object(
      'age', v_age, 'kind', v_profile.profile_kind,
      'pregnant', v_enc.pregnant, 'breastfeeding', v_enc.breastfeeding)
  );
END;
$$;

COMMENT ON FUNCTION public.pocket_materia_medica(uuid, uuid, text, text) IS
  'The Phase 3 one-screen clinical query (PD-2/9/11/12): active client + encounter → refer-out gate → lens-filtered, complaint-matched, safety-filtered, dual-cited herb list with Avoid-wins badges and conflict flags. SECURITY DEFINER, service-role-execute only — callable exclusively through the practitioner-clinical EF.';

-- ── Clinical CRUD RPCs (service-role only; the EF is the sole caller) ──────

CREATE OR REPLACE FUNCTION public.clinical_encounter_upsert(
  p_id uuid, p_practitioner uuid, p_person_profile_id uuid,
  p_chief_complaint_id text, p_chief_complaint_text text,
  p_pregnant boolean, p_breastfeeding boolean,
  p_trigger_ids text[], p_soap jsonb, p_status text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'clinical', 'pg_temp'
AS $$
DECLARE v_row clinical.encounters%ROWTYPE;
BEGIN
  IF p_id IS NULL THEN
    INSERT INTO clinical.encounters
      (practitioner_user_id, person_profile_id, chief_complaint_id, chief_complaint_text,
       pregnant, breastfeeding, refer_out_trigger_ids, soap, status)
    VALUES (p_practitioner, p_person_profile_id, p_chief_complaint_id, p_chief_complaint_text,
       COALESCE(p_pregnant, false), COALESCE(p_breastfeeding, false),
       COALESCE(p_trigger_ids, '{}'), p_soap, COALESCE(p_status, 'open'))
    RETURNING * INTO v_row;
  ELSE
    UPDATE clinical.encounters SET
      chief_complaint_id = COALESCE(p_chief_complaint_id, chief_complaint_id),
      chief_complaint_text = COALESCE(p_chief_complaint_text, chief_complaint_text),
      pregnant = COALESCE(p_pregnant, pregnant),
      breastfeeding = COALESCE(p_breastfeeding, breastfeeding),
      refer_out_trigger_ids = COALESCE(p_trigger_ids, refer_out_trigger_ids),
      -- editing the trigger list re-arms the PD-9 gate
      refer_out_acknowledged_at = CASE WHEN p_trigger_ids IS NOT NULL THEN NULL ELSE refer_out_acknowledged_at END,
      soap = COALESCE(p_soap, soap),
      status = COALESCE(p_status, status),
      updated_at = now()
    WHERE id = p_id AND practitioner_user_id = p_practitioner
    RETURNING * INTO v_row;
    IF NOT FOUND THEN RETURN jsonb_build_object('error', 'encounter_not_found'); END IF;
  END IF;
  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.clinical_encounter_ack_refer_out(
  p_id uuid, p_practitioner uuid, p_note text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'clinical', 'pg_temp'
AS $$
DECLARE v_row clinical.encounters%ROWTYPE;
BEGIN
  UPDATE clinical.encounters
     SET refer_out_acknowledged_at = now(),
         refer_out_acknowledged_note = p_note,
         updated_at = now()
   WHERE id = p_id AND practitioner_user_id = p_practitioner
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'encounter_not_found'); END IF;
  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.clinical_encounters_for_profile(
  p_person_profile_id uuid, p_practitioner uuid
) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public', 'clinical', 'pg_temp'
AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.encounter_date DESC), '[]'::jsonb)
    FROM clinical.encounters e
   WHERE e.person_profile_id = p_person_profile_id
     AND e.practitioner_user_id = p_practitioner;
$$;

CREATE OR REPLACE FUNCTION public.clinical_formulary_save(
  p_id uuid, p_practitioner uuid, p_person_profile_id uuid,
  p_name text, p_notes text, p_items jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'clinical', 'pg_temp'
AS $$
DECLARE v_id uuid;
BEGIN
  IF p_id IS NULL THEN
    INSERT INTO clinical.formularies (practitioner_user_id, person_profile_id, name, notes)
    VALUES (p_practitioner, p_person_profile_id, p_name, p_notes)
    RETURNING id INTO v_id;
  ELSE
    UPDATE clinical.formularies
       SET name = COALESCE(p_name, name), notes = COALESCE(p_notes, notes), updated_at = now()
     WHERE id = p_id AND practitioner_user_id = p_practitioner
    RETURNING id INTO v_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('error', 'formulary_not_found'); END IF;
    DELETE FROM clinical.formulary_items WHERE formulary_id = v_id;
  END IF;
  INSERT INTO clinical.formulary_items (formulary_id, herb_id, preparation_id, parts, unit, note, sort_order)
  SELECT v_id, i->>'herb_id', i->>'preparation_id',
         COALESCE((i->>'parts')::numeric, 1), COALESCE(i->>'unit', 'part'),
         i->>'note', COALESCE((i->>'sort_order')::integer, 100)
    FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) i;
  RETURN jsonb_build_object('id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.clinical_formularies_list(
  p_practitioner uuid, p_person_profile_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public', 'clinical', 'pg_temp'
AS $$
  SELECT COALESCE(jsonb_agg(f ORDER BY f->>'updated_at' DESC), '[]'::jsonb) FROM (
    SELECT to_jsonb(fo) || jsonb_build_object('items',
             COALESCE((SELECT jsonb_agg(to_jsonb(it) || jsonb_build_object('common_name', h.common_name)
                        ORDER BY it.sort_order)
                FROM clinical.formulary_items it
                JOIN public.herbs h ON h.herb_id = it.herb_id
               WHERE it.formulary_id = fo.id), '[]'::jsonb)) AS f
      FROM clinical.formularies fo
     WHERE fo.practitioner_user_id = p_practitioner
       AND (p_person_profile_id IS NULL OR fo.person_profile_id = p_person_profile_id)
  ) x;
$$;

-- Exportable case file (PD-1): client + standing readings + axis history +
-- encounters + formularies, one JSON document.
CREATE OR REPLACE FUNCTION public.clinical_case_file(
  p_person_profile_id uuid, p_practitioner uuid
) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public', 'clinical', 'pg_temp'
AS $$
  SELECT jsonb_build_object(
    'client', (SELECT to_jsonb(pp) FROM public.person_profiles pp
                WHERE pp.id = p_person_profile_id AND pp.user_id = p_practitioner),
    'readings', (SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.framework, c.role, c.reading_kind), '[]'::jsonb)
                   FROM public.person_profile_constitutions c
                  WHERE c.person_profile_id = p_person_profile_id),
    'completions', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                      'id', d.id, 'quiz_version', d.quiz_version, 'completed_at', d.completed_at,
                      'temperature_score', d.temperature_score, 'moisture_score', d.moisture_score,
                      'tone_score', d.tone_score, 'framework_readings', d.framework_readings)
                      ORDER BY d.completed_at DESC), '[]'::jsonb)
                   FROM public.diagnostic_completions d
                  WHERE d.person_profile_id = p_person_profile_id),
    'encounters', public.clinical_encounters_for_profile(p_person_profile_id, p_practitioner),
    'formularies', public.clinical_formularies_list(p_practitioner, p_person_profile_id),
    'exported_at', now()
  );
$$;

-- Service-role-only execution for the entire clinical RPC surface (TL-4).
REVOKE EXECUTE ON FUNCTION public.pocket_materia_medica(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.clinical_encounter_upsert(uuid, uuid, uuid, text, text, boolean, boolean, text[], jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.clinical_encounter_ack_refer_out(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.clinical_encounters_for_profile(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.clinical_formulary_save(uuid, uuid, uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.clinical_formularies_list(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.clinical_case_file(uuid, uuid) FROM PUBLIC, anon, authenticated;
