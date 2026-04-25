-- =============================================================================
-- Stage 6.3.6 — herbs_directory_v: visible-but-gated unified directory view
-- =============================================================================
-- Replaces the dual-query (herbs_public / herbs_clinical_v) read surface from
-- Stage 6.3 with a single view returning all 100 herb rows, with tier-conditional
-- column population.
--
-- Per Locked Decision §0.8 #17 (Manual v3.2): "Free/anon visitors see all 100
-- herb names plus directory cards. Seed-only herbs render in a 'locked' state
-- with 'Unlock with Seed' overlay (basic identity visible: name, latin, image,
-- possibly part-used; monograph body and clinical sections replaced with
-- upgrade prompt). Same on the detail page in Stage 6.4."
--
-- Visibility model (3-band):
--
--   1) ALWAYS visible (every caller, every row):
--        herb_id, common_name, latin_name, plant_family, part_used,
--        pronunciation, image_filename, tier_visibility, status, is_locked
--
--   2) BODY (visible on free rows for everyone; on every row for Seed+):
--        taste, temperature, moisture, energetics_summary, stewardship_note,
--        biblical_traditional_reference, cautions, contraindications_general,
--        pregnancy_safety, breastfeeding_safety, children_safety
--
--   3) CLINICAL (Seed+ only, regardless of row tier):
--        tissue_states_indicated, tissue_states_contraindicated,
--        system_affinity, chief_complaints, western_constitution_match,
--        ayurvedic_dosha_match, ayurvedic_dosha_aggravates,
--        tcm_pattern_match, tcm_contraindicated_patterns,
--        drug_interactions, preparation_methods, dosage_notes,
--        refer_threshold, primary_sources, secondary_sources, notes,
--        actions_rel, tissue_states_indicated_rel,
--        tissue_states_contraindicated_rel, systems_rel, complaints_rel,
--        tastes_rel, constitutions_rel, tcm_indicated_rel,
--        tcm_contraindicated_rel, doshas_match_rel, doshas_aggravates_rel,
--        preparations_rel
--
-- The view is SECURITY INVOKER (default in PG15+); the gate function
-- current_user_at_least() is itself SECURITY DEFINER and resolves auth.uid()
-- correctly. Junction subqueries are wrapped in CASE so anon/free callers
-- never trigger the joins.
--
-- This migration leaves herbs_public and herbs_clinical_v in place for
-- back-compat during rollout. They will be dropped in a follow-up migration
-- after the frontend is fully cut over to herbs_directory_v.
-- =============================================================================

CREATE OR REPLACE VIEW public.herbs_directory_v AS
SELECT
  -- ------------------------------------------------------------------------ --
  -- BAND 1: Identity (always visible)
  -- ------------------------------------------------------------------------ --
  h.herb_id,
  h.common_name,
  h.latin_name,
  h.plant_family,
  h.part_used,
  h.pronunciation,
  h.image_filename,
  h.tier_visibility,
  h.status,

  -- Lock flag: true when the row is gated for the caller.
  -- A row is gated when the caller is below Seed AND the row is not free.
  CASE
    WHEN public.current_user_at_least('seed') THEN false
    WHEN h.tier_visibility = 'free'::subscription_tier
      OR h.tier_visibility IS NULL THEN false
    ELSE true
  END AS is_locked,

  -- ------------------------------------------------------------------------ --
  -- BAND 2: Body (visible on free rows for anon/free; all rows for Seed+)
  -- ------------------------------------------------------------------------ --
  CASE WHEN public.current_user_at_least('seed')
         OR h.tier_visibility = 'free'::subscription_tier
         OR h.tier_visibility IS NULL
       THEN h.taste END AS taste,
  CASE WHEN public.current_user_at_least('seed')
         OR h.tier_visibility = 'free'::subscription_tier
         OR h.tier_visibility IS NULL
       THEN h.temperature END AS temperature,
  CASE WHEN public.current_user_at_least('seed')
         OR h.tier_visibility = 'free'::subscription_tier
         OR h.tier_visibility IS NULL
       THEN h.moisture END AS moisture,
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

  -- ------------------------------------------------------------------------ --
  -- BAND 3: Clinical (Seed+ only, all rows)
  -- ------------------------------------------------------------------------ --
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

  -- ------------------------------------------------------------------------ --
  -- BAND 3 (cont.): 12 jsonb _rel columns from junctions (Seed+ only)
  -- ------------------------------------------------------------------------ --
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
  ) END AS preparations_rel

FROM public.herbs h;

COMMENT ON VIEW public.herbs_directory_v IS
  'Stage 6.3.6 unified directory read surface — 100 rows always; '
  'tier-conditional column population (visible-but-gated). '
  'Anon/free see identity + body for free rows, identity-only for seed rows '
  '(is_locked=true). Seed+ see full content across all rows. '
  'Supersedes herbs_public + herbs_clinical_v dual-query pattern.';

GRANT SELECT ON public.herbs_directory_v TO anon, authenticated;
