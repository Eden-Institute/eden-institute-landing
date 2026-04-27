-- =============================================================================
-- Stage 6.3.6 / Phase B sub-task 6 — herbs dual-source citation JSONB
-- =============================================================================
-- Adds the structured dual-source citation surface to public.herbs that mirrors
-- the Phase B ContentEntry pattern (src/lib/contentEntry.ts).
--
-- Per Locked Decision §0.8 #43 (dual-source clinical citation), every clinical
-- claim — including every herb monograph — must cite BOTH:
--   (a) a public-domain primary-text source per Lock #38, AND
--   (b) an industry best-practice secondary cross-reference.
--
-- Per Locked Decision §0.8 #44 (classical-tradition observation IN, theological
-- attribution OUT), herb rows may also surface structured cross-tradition
-- observations (Western Eclectic / Physiomedical; TCM; Ayurveda; Unani; etc.)
-- with attribution-stripped framing.
--
-- The legacy free-text columns `primary_sources` and `secondary_sources` remain
-- in place for back-compat and human archival; the new JSONB columns are the
-- canonical structured shape for UI rendering, compliance scanning, and
-- cross-module citation drawer reuse.
--
-- Three additive columns:
--
--   - primary_text_citation       jsonb   -- PrimaryTextCitation shape:
--                                          --   { author, title, year, url,
--                                          --     excerpt?, locator? }
--   - secondary_citation          jsonb   -- SecondaryCitation shape:
--                                          --   { kind, title, author?, year?,
--                                          --     identifier, url, excerpt?,
--                                          --     locator? }
--   - traditional_observations    jsonb   -- TraditionalObservation[] shape:
--                                          --   [{ tradition, traditionLabel?,
--                                          --      pattern, observation,
--                                          --      citation, secondary? }, ...]
--
-- The TypeScript shapes for these three fields live in src/lib/contentEntry.ts
-- (PrimaryTextCitation, SecondaryCitation, TraditionalObservation interfaces).
-- The herb data layer and the Phase B content-module data layer share the
-- same citation drawer in src/components/apothecary/HerbCard.tsx.
--
-- Visibility model: all three new columns are Band 3 (Seed+ only) — same gate
-- as the existing primary_sources / secondary_sources. The view re-creation
-- below appends the new columns AT THE END of the SELECT list so Postgres
-- column-position invariance (42P16) does not block CREATE OR REPLACE VIEW.
--
-- Idempotent. Applied to production via Supabase SQL Editor.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Additive columns on public.herbs
-- ---------------------------------------------------------------------------
ALTER TABLE public.herbs
  ADD COLUMN IF NOT EXISTS primary_text_citation jsonb,
  ADD COLUMN IF NOT EXISTS secondary_citation jsonb,
  ADD COLUMN IF NOT EXISTS traditional_observations jsonb;

COMMENT ON COLUMN public.herbs.primary_text_citation IS
  'Structured public-domain primary-text citation per Lock #38 + #43. '
  'Shape: { author, title, year, url, excerpt?, locator? } — mirrors '
  'PrimaryTextCitation in src/lib/contentEntry.ts. Pre-1928 English '
  'translations only; primary texts in their original language qualify '
  'regardless of date when the text itself predates 1928.';

COMMENT ON COLUMN public.herbs.secondary_citation IS
  'Structured industry best-practice secondary citation per Lock #43. '
  'Shape: { kind, title, author?, year?, identifier, url, excerpt?, '
  'locator? } — mirrors SecondaryCitation in src/lib/contentEntry.ts. '
  'kind ∈ pubmed | who_monograph | escop | nih | usda | university_extension '
  '| ahg_standard | nimh_standard | ahpa_safety | industry_textbook.';

COMMENT ON COLUMN public.herbs.traditional_observations IS
  'Optional cross-tradition observations per Lock #44. Array of '
  '{ tradition, traditionLabel?, pattern, observation, citation, '
  'secondary? } — mirrors TraditionalObservation[] in '
  'src/lib/contentEntry.ts. Observation IN, theological attribution OUT.';

-- ---------------------------------------------------------------------------
-- 2. herbs_directory_v — append 3 new Band 3 columns at end of SELECT list
-- ---------------------------------------------------------------------------
-- Identical to 20260425000000_herbs_directory_v_complaint_names.sql except
-- the three new JSONB citation columns are added AFTER complaint_names. All
-- previous column positions are preserved — Postgres CREATE OR REPLACE VIEW
-- requires invariance on existing columns and tolerates appended new ones.

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

  -- Symptom-membership facet (Stage 6.3.5, Band 1 always-visible).
  COALESCE(
    (SELECT array_agg(cpl.complaint_name ORDER BY cpl.complaint_name)
       FROM public.herbs_complaints hc
       JOIN public.complaints cpl ON cpl.complaint_id = hc.complaint_id
      WHERE hc.herb_id = h.herb_id),
    ARRAY[]::text[]
  ) AS complaint_names,

  -- NEW (Phase B sub-task 6, appended): structured dual-source citations
  -- per Lock #43, plus optional cross-tradition observations per Lock #44.
  -- All three are Band 3 (Seed+ gate), same as the legacy free-text
  -- primary_sources / secondary_sources columns above.
  CASE WHEN public.current_user_at_least('seed')
       THEN h.primary_text_citation END AS primary_text_citation,
  CASE WHEN public.current_user_at_least('seed')
       THEN h.secondary_citation END AS secondary_citation,
  CASE WHEN public.current_user_at_least('seed')
       THEN h.traditional_observations END AS traditional_observations

FROM public.herbs h;

COMMENT ON VIEW public.herbs_directory_v IS
  'Stage 6.3.5/6.3.6 + Phase B sub-task 6 unified directory read surface — '
  '108 rows (post-archetypal-backfill) always; tier-conditional column '
  'population (visible-but-gated). '
  'BAND 1 identity + complaint_names always visible. '
  'BAND 2 (body) visible on free rows for anon/free, all rows for Seed+. '
  'BAND 3 (clinical) Seed+ only across all rows — includes legacy '
  'primary_sources/secondary_sources free-text columns AND new '
  'primary_text_citation/secondary_citation/traditional_observations JSONB '
  'columns per Locks #43 and #44.';

GRANT SELECT ON public.herbs_directory_v TO anon, authenticated;
