-- ============================================================================
-- CRO Phase 2 (approved redesign plan §6): directory depth advertising.
--
-- "Lead every locked row with the match, not the lock" requires the client
-- to compute the Pattern match/avoid relationship for LOCKED rows too.
-- computeMatchRelationship (src/lib/edenPattern.ts) reads temperature,
-- moisture, and tissue_states_indicated; on locked rows all three were
-- NULL, so every axis classified Neutral and no badge could ever render.
--
-- This migration makes TWO deliberate, founder-approved relaxations of the
-- Band 2 gate — and nothing else:
--
--   1. temperature + moisture move to BAND 1 (always visible, all rows,
--      all callers). These are one-phrase energetic axis labels ("Warm",
--      "Dry"), the minimum data the match badge needs. tissue_states stays
--      Band 3, so free-tier badges compute from 2 axes (already the
--      documented degraded mode — edenPattern.ts classifies NULL tone as
--      Neutral).
--
--   2. NEW column energetics_teaser (appended at the END per CREATE OR
--      REPLACE VIEW column invariance, SQLSTATE 42P16): the FIRST CLAUSE
--      of energetics_summary (up to the first semicolon, capped at 140
--      chars), always visible. Gives locked cards a true teaser line
--      ("Cool and moist with bitter") without exposing the matching or
--      affinity clauses. The full energetics_summary stays Band 2.
--
-- Everything else (taste, safety fields, all Band 3 clinical columns, the
-- 12 _rel jsonb aggregates) keeps its existing gate, and is_locked is
-- unchanged. The view remains OWNER-privileged (NOT security_invoker) on
-- purpose — the CASE gates in this body are the tier boundary.
--
-- All previous column positions are preserved — Postgres CREATE OR REPLACE
-- VIEW requires invariance on existing columns and tolerates appended new
-- ones. Idempotent. Applied to production via Supabase SQL Editor.
-- ============================================================================

CREATE OR REPLACE VIEW public.herbs_directory_v AS
SELECT
  -- BAND 1: Identity (always visible)
  h.herb_id,
  h.common_name,
  h.latin_name,
  h.plant_family,
  h.part_used,
  h.pronunciation,
  h.image_filename,
  h.tier_visibility,
  h.status,
  CASE
    WHEN public.current_user_at_least('seed') THEN false
    WHEN h.tier_visibility = 'free'::subscription_tier
      OR h.tier_visibility IS NULL THEN false
    ELSE true
  END AS is_locked,

  -- BAND 2: Body (visible on free rows for anon/free; all rows for Seed+)
  CASE WHEN public.current_user_at_least('seed')
         OR h.tier_visibility = 'free'::subscription_tier
         OR h.tier_visibility IS NULL
       THEN h.taste END AS taste,
  -- CRO Phase 2: temperature + moisture promoted to Band 1 (always visible)
  -- so locked rows can carry the Pattern match badge. See header.
  h.temperature,
  h.moisture,
  CASE WHEN public.current_user_at_least('seed')
         OR h.tier_visibility = 'free'::subscription_tier
         OR h.tier_visibility IS NULL
       THEN h.energetics_summary END AS energetics_summary,
  CASE WHEN public.current_user_at_least('seed')
         OR h.tier_visibility = 'free'::subscription_tier
         OR h.tier_visibility IS NULL
       THEN h.stewardship_note END AS stewardship_note,
  CASE WHEN public.current_user_at_least('seed')
         OR h.tier_visibility = 'free'::subscription_tier
         OR h.tier_visibility IS NULL
       THEN h.biblical_traditional_reference END AS biblical_traditional_reference,
  CASE WHEN public.current_user_at_least('seed')
         OR h.tier_visibility = 'free'::subscription_tier
         OR h.tier_visibility IS NULL
       THEN h.cautions END AS cautions,
  CASE WHEN public.current_user_at_least('seed')
         OR h.tier_visibility = 'free'::subscription_tier
         OR h.tier_visibility IS NULL
       THEN h.contraindications_general END AS contraindications_general,
  CASE WHEN public.current_user_at_least('seed')
         OR h.tier_visibility = 'free'::subscription_tier
         OR h.tier_visibility IS NULL
       THEN h.pregnancy_safety END AS pregnancy_safety,
  CASE WHEN public.current_user_at_least('seed')
         OR h.tier_visibility = 'free'::subscription_tier
         OR h.tier_visibility IS NULL
       THEN h.breastfeeding_safety END AS breastfeeding_safety,
  CASE WHEN public.current_user_at_least('seed')
         OR h.tier_visibility = 'free'::subscription_tier
         OR h.tier_visibility IS NULL
       THEN h.children_safety END AS children_safety,

  -- BAND 3: Clinical (Seed+ only, all rows)
  CASE WHEN public.current_user_at_least('seed')
       THEN h.tissue_states_indicated END AS tissue_states_indicated,
  CASE WHEN public.current_user_at_least('seed')
       THEN h.tissue_states_contraindicated END AS tissue_states_contraindicated,
  CASE WHEN public.current_user_at_least('seed')
       THEN h.system_affinity END AS system_affinity,
  CASE WHEN public.current_user_at_least('seed')
       THEN h.chief_complaints END AS chief_complaints,
  CASE WHEN public.current_user_at_least('seed')
       THEN h.western_constitution_match END AS western_constitution_match,
  CASE WHEN public.current_user_at_least('seed')
       THEN h.ayurvedic_dosha_match END AS ayurvedic_dosha_match,
  CASE WHEN public.current_user_at_least('seed')
       THEN h.ayurvedic_dosha_aggravates END AS ayurvedic_dosha_aggravates,
  CASE WHEN public.current_user_at_least('seed')
       THEN h.tcm_pattern_match END AS tcm_pattern_match,
  CASE WHEN public.current_user_at_least('seed')
       THEN h.tcm_contraindicated_patterns END AS tcm_contraindicated_patterns,
  CASE WHEN public.current_user_at_least('seed')
       THEN h.drug_interactions END AS drug_interactions,
  CASE WHEN public.current_user_at_least('seed')
       THEN h.preparation_methods END AS preparation_methods,
  CASE WHEN public.current_user_at_least('seed')
       THEN h.dosage_notes END AS dosage_notes,
  CASE WHEN public.current_user_at_least('seed')
       THEN h.refer_threshold END AS refer_threshold,
  CASE WHEN public.current_user_at_least('seed')
       THEN h.primary_sources END AS primary_sources,
  CASE WHEN public.current_user_at_least('seed')
       THEN h.secondary_sources END AS secondary_sources,
  CASE WHEN public.current_user_at_least('seed')
       THEN h.notes END AS notes,

  -- BAND 3 (cont.): 12 jsonb _rel columns from junctions (Seed+ only)
  CASE WHEN public.current_user_at_least('seed') THEN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'action_id', a.action_id,
      'action_name', a.action_name,
      'strength', ha.strength_of_indication
    )), '[]'::jsonb)
    FROM public.herbs_actions ha
    JOIN public.actions a ON a.action_id = ha.action_id
    WHERE ha.herb_id = h.herb_id
  ) END AS actions_rel,
  CASE WHEN public.current_user_at_least('seed') THEN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'state_id', ts.state_id,
      'state_name', ts.state_name,
      'strength', hts.strength_of_indication
    )), '[]'::jsonb)
    FROM public.herbs_tissue_states_indicated hts
    JOIN public.tissue_states ts ON ts.state_id = hts.state_id
    WHERE hts.herb_id = h.herb_id
  ) END AS tissue_states_indicated_rel,
  CASE WHEN public.current_user_at_least('seed') THEN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'state_id', ts.state_id,
      'state_name', ts.state_name,
      'strength', htsc.strength_of_indication
    )), '[]'::jsonb)
    FROM public.herbs_tissue_states_contraindicated htsc
    JOIN public.tissue_states ts ON ts.state_id = htsc.state_id
    WHERE htsc.herb_id = h.herb_id
  ) END AS tissue_states_contraindicated_rel,
  CASE WHEN public.current_user_at_least('seed') THEN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'system_id', bs.system_id,
      'system_name', bs.system_name,
      'strength', hs.strength_of_indication
    )), '[]'::jsonb)
    FROM public.herbs_systems hs
    JOIN public.body_systems bs ON bs.system_id = hs.system_id
    WHERE hs.herb_id = h.herb_id
  ) END AS systems_rel,
  CASE WHEN public.current_user_at_least('seed') THEN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'complaint_id', cpl.complaint_id,
      'complaint_name', cpl.complaint_name,
      'strength', hc.strength_of_indication
    )), '[]'::jsonb)
    FROM public.herbs_complaints hc
    JOIN public.complaints cpl ON cpl.complaint_id = hc.complaint_id
    WHERE hc.herb_id = h.herb_id
  ) END AS complaints_rel,
  CASE WHEN public.current_user_at_least('seed') THEN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'taste_id', t.taste_id,
      'taste_name', t.taste_name
    )), '[]'::jsonb)
    FROM public.herbs_tastes ht
    JOIN public.tastes t ON t.taste_id = ht.taste_id
    WHERE ht.herb_id = h.herb_id
  ) END AS tastes_rel,
  CASE WHEN public.current_user_at_least('seed') THEN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'constitution_id', c.constitution_id,
      'name', c.name,
      'relationship', hc2.relationship,
      'strength', hc2.strength_of_indication
    )), '[]'::jsonb)
    FROM public.herbs_constitutions hc2
    JOIN public.constitutions c ON c.constitution_id = hc2.constitution_id
    WHERE hc2.herb_id = h.herb_id
  ) END AS constitutions_rel,
  CASE WHEN public.current_user_at_least('seed') THEN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'pattern_id', p.pattern_id,
      'pattern_name', p.pattern_name,
      'strength', htci.strength_of_indication
    )), '[]'::jsonb)
    FROM public.herbs_tcm_indicated htci
    JOIN public.tcm_patterns p ON p.pattern_id = htci.pattern_id
    WHERE htci.herb_id = h.herb_id
  ) END AS tcm_indicated_rel,
  CASE WHEN public.current_user_at_least('seed') THEN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'pattern_id', p.pattern_id,
      'pattern_name', p.pattern_name,
      'strength', htcc.strength_of_indication
    )), '[]'::jsonb)
    FROM public.herbs_tcm_contraindicated htcc
    JOIN public.tcm_patterns p ON p.pattern_id = htcc.pattern_id
    WHERE htcc.herb_id = h.herb_id
  ) END AS tcm_contraindicated_rel,
  CASE WHEN public.current_user_at_least('seed') THEN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'dosha_id', d.dosha_id,
      'dosha_name', d.dosha_name,
      'strength', hdm.strength_of_indication
    )), '[]'::jsonb)
    FROM public.herbs_doshas_match hdm
    JOIN public.doshas d ON d.dosha_id = hdm.dosha_id
    WHERE hdm.herb_id = h.herb_id
  ) END AS doshas_match_rel,
  CASE WHEN public.current_user_at_least('seed') THEN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'dosha_id', d.dosha_id,
      'dosha_name', d.dosha_name,
      'strength', hda.strength_of_indication
    )), '[]'::jsonb)
    FROM public.herbs_doshas_aggravates hda
    JOIN public.doshas d ON d.dosha_id = hda.dosha_id
    WHERE hda.herb_id = h.herb_id
  ) END AS doshas_aggravates_rel,
  CASE WHEN public.current_user_at_least('seed') THEN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'prep_id', pr.prep_id,
      'preparation_name', pr.preparation_name,
      'strength', hp.strength_of_indication
    )), '[]'::jsonb)
    FROM public.herbs_preparations hp
    JOIN public.preparations pr ON pr.prep_id = hp.prep_id
    WHERE hp.herb_id = h.herb_id
  ) END AS preparations_rel,

  -- Symptom-membership facet (Stage 6.3.5, Band 1 always-visible).
  COALESCE(
    (SELECT array_agg(cpl.complaint_name ORDER BY cpl.complaint_name)
       FROM public.herbs_complaints hc
       JOIN public.complaints cpl ON cpl.complaint_id = hc.complaint_id
      WHERE hc.herb_id = h.herb_id),
    ARRAY[]::text[]
  ) AS complaint_names,

  -- Structured dual-source citations per Lock #43 + cross-tradition
  -- observations per Lock #44 (Band 3, unchanged from 20260426234500).
  CASE WHEN public.current_user_at_least('seed')
       THEN h.primary_text_citation END AS primary_text_citation,
  CASE WHEN public.current_user_at_least('seed')
       THEN h.secondary_citation END AS secondary_citation,
  CASE WHEN public.current_user_at_least('seed')
       THEN h.traditional_observations END AS traditional_observations,

  -- NEW (CRO Phase 2, appended): always-visible teaser — the first clause
  -- of energetics_summary ("Cool and moist with bitter"), never the
  -- matching/affinity clauses. split_part + left are IMMUTABLE.
  CASE
    WHEN h.energetics_summary IS NULL THEN NULL::text
    ELSE left(split_part(h.energetics_summary, ';', 1), 140)
  END AS energetics_teaser

FROM public.herbs h;

COMMENT ON VIEW public.herbs_directory_v IS
  'Stage 6.3.5/6.3.6 + Phase B sub-task 6 + CRO Phase 2 unified directory '
  'read surface — 108 rows always; tier-conditional column population '
  '(visible-but-gated). '
  'BAND 1 identity + complaint_names + temperature/moisture (CRO Phase 2: '
  'promoted so locked rows carry Pattern match badges) + energetics_teaser '
  '(first clause of energetics_summary) always visible. '
  'BAND 2 (body) visible on free rows for anon/free, all rows for Seed+. '
  'BAND 3 (clinical) Seed+ only across all rows — includes legacy '
  'primary_sources/secondary_sources free-text columns AND '
  'primary_text_citation/secondary_citation/traditional_observations JSONB '
  'columns per Locks #43 and #44.';

COMMENT ON COLUMN public.herbs_directory_v.energetics_teaser IS
  'CRO Phase 2: always-visible first clause of energetics_summary (up to '
  'the first semicolon, max 140 chars) so locked directory cards can show '
  'a true teaser line. The full energetics_summary remains Band 2 gated.';

GRANT SELECT ON public.herbs_directory_v TO anon, authenticated;
