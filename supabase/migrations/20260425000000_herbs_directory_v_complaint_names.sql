-- =============================================================================
-- Stage 6.3.5 — herbs_directory_v: append complaint_names + profiles.constitution_type
-- =============================================================================
-- Adds two surfaces for the Symptom-Doorway Filter Rebuild:
--
--   1. A `complaint_names text[]` column APPENDED to `herbs_directory_v`. Per
--      Locked Decision §0.8 #26 the Free tier's single discovery axis is
--      Symptom; locked Seed-tier rows must remain filterable by symptom
--      (visible-but-gated rendering carries the lock, not the membership).
--      Anon and Free callers therefore need the herb→complaint membership
--      without the clinical depth that lives in Band 3. Complaint NAMES (not
--      strengths, not descriptions) are exposed for all callers; the
--      underlying public.complaints dimension table is already readable by
--      anon per the §21.3 RLS reconciliation, so this view widens no privacy
--      surface. The column is APPENDED at the end of the SELECT list (rather
--      than inserted into Band 1) so `CREATE OR REPLACE VIEW` does not run
--      afoul of Postgres's column-position invariance rule (42P16).
--
--   2. A `constitution_type text` column on `public.profiles`. Stage 7
--      (absorbed into Stage 6.3.5) writes the Pattern of Eden quiz result
--      here so the directory's Match/Avoid badges and personalization layer
--      can read the active user's pattern. Nullable; no default. The eight
--      canonical Pattern names are the only intended values; we do NOT lock
--      these into a CHECK constraint at this migration because the Free-quiz
--      redirect path on edeninstitute.health currently writes Western /
--      Ayurvedic / TCM constitution labels to quiz_completions, and the
--      Stage 6.3.5 trigger maps those onto Eden Pattern names with
--      fall-throughs. Locking the enum at the DB layer would make the
--      trigger brittle. Phase 2 may add a CHECK once the mapping is fully
--      defensive.
--
-- Both changes are idempotent and additive. The held branch's
-- 20260424183000_herbs_directory_v.sql migration remains the canonical
-- view source; this file CREATE OR REPLACE-s the view to add the column.
--
-- Applied to production noeqztssupewjidpvhar via SQL Editor on 2026-04-25;
-- this file commits the source so disaster-recovery rebuilds re-apply it
-- in order.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. profiles.constitution_type (additive column)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS constitution_type text;

COMMENT ON COLUMN public.profiles.constitution_type IS
  'Active Pattern of Eden constitution for this user, written by the quiz '
  'completion path. One of: The Burning Bowstring, The Open Flame, '
  'The Pressure Cooker, The Overflowing Cup, The Drawn Bowstring, '
  'The Spent Candle, The Frozen Knot, The Still Water — or NULL when the '
  'user has not yet completed the quiz. Free-tier quiz redirects through '
  'edeninstitute.health may write Western/Ayurvedic/TCM labels here; the '
  'frontend treats unknown labels as ''no active pattern'' (graceful fallback).';

-- ---------------------------------------------------------------------------
-- 2. herbs_directory_v — re-create with complaint_names appended at end
-- ---------------------------------------------------------------------------
-- Identical to 20260424183000_herbs_directory_v.sql except the new column
-- `complaint_names` is added AS THE FINAL ENTRY in the SELECT list, after
-- preparations_rel. All previous column positions (h.herb_id through
-- preparations_rel) are preserved unchanged.

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

  -- NEW (Stage 6.3.5, appended): Symptom-membership facet — always visible.
  -- Returns the array of complaint names this herb is indicated for. Locked
  -- rows still expose this so Free-tier symptom filters can match against
  -- them; the rendering layer keeps the lock on the card itself.
  COALESCE(
    (SELECT array_agg(cpl.complaint_name ORDER BY cpl.complaint_name)
       FROM public.herbs_complaints hc
       JOIN public.complaints cpl ON cpl.complaint_id = hc.complaint_id
      WHERE hc.herb_id = h.herb_id),
    ARRAY[]::text[]
  ) AS complaint_names

FROM public.herbs h;

COMMENT ON VIEW public.herbs_directory_v IS
  'Stage 6.3.5/6.3.6 unified directory read surface — 100 rows always; '
  'tier-conditional column population (visible-but-gated). '
  'BAND 1 identity (and the appended complaint_names facet) always visible. '
  'BAND 2 (body) visible on free rows for anon/free, all rows for Seed+. '
  'BAND 3 (clinical) Seed+ only across all rows. '
  'Anon/free see locked cards for Seed-tier rows (is_locked=true). '
  'Supersedes herbs_public + herbs_clinical_v dual-query pattern.';

GRANT SELECT ON public.herbs_directory_v TO anon, authenticated;
