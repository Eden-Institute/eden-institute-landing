-- Herb tier model: what each subscription tier can read in the Eden Apothecary.
-- Founder decision 2026-09-15. Written 2026-09-15, NOT YET APPLIED. Every statement is
-- idempotent, and the assertions at the bottom abort the whole transaction if a gate is wrong.
--
-- THE MODEL
--   Free (and anon): all 300 herbs, nothing locked. Identity, taste, temperature, moisture,
--     energetics, stewardship, biblical/traditional reference, and every safety field.
--   Seed adds: actions, tissue states, body systems, chief complaints, constitution and
--     pattern matches (Western, Ayurvedic, TCM, and their *_rel joins), preparations,
--     dosage notes, notes, traditional observations, tastes_rel.
--   Root adds: drug_interactions, refer_threshold, primary_sources, secondary_sources,
--     primary_text_citation, secondary_citation.
--   Practitioner: inherits everything (current_user_at_least is a >= comparison).
--
-- GATING TABLE for public.herbs_directory_v (column -> minimum tier)
--   free : herb_id, common_name, latin_name, plant_family, part_used, pronunciation,
--          image_filename, tier_visibility, status, is_locked, taste, temperature, moisture,
--          energetics_summary, energetics_teaser, stewardship_note,
--          biblical_traditional_reference, cautions, contraindications_general,
--          pregnancy_safety, breastfeeding_safety, children_safety, complaint_names
--   seed : tissue_states_indicated, tissue_states_contraindicated, system_affinity,
--          chief_complaints, western_constitution_match, ayurvedic_dosha_match,
--          ayurvedic_dosha_aggravates, tcm_pattern_match, tcm_contraindicated_patterns,
--          preparation_methods, dosage_notes, notes, traditional_observations, actions_rel,
--          tissue_states_indicated_rel, tissue_states_contraindicated_rel, systems_rel,
--          complaints_rel, tastes_rel, constitutions_rel, tcm_indicated_rel,
--          tcm_contraindicated_rel, doshas_match_rel, doshas_aggravates_rel, preparations_rel
--   root : drug_interactions, refer_threshold, primary_sources, secondary_sources,
--          primary_text_citation, secondary_citation
--
-- is_locked
--   Kept (dropping or retyping it would change the generated TS types) but now the constant
--   false for every caller: no herb is locked at any tier. herbs.tier_visibility no longer
--   gates any column in this view. It is still returned, because herbLinks.herbCanonicalUrl
--   and the Astro build use it to decide which herbs have a pre-rendered /herbs/:slug page
--   (herbs_public is unchanged and still lists only the 155 free-visibility herbs).
--   Deploy order is safe either way: the current front end renders a never-locked row as
--   its "free row" state, so applying this before the front end ships shows every herb with
--   identity, energetics and safety plus the Seed teaser.
--
-- WHAT THIS CHANGES (verified against production 2026-09-15)
--   1. herbs_directory_v: recreated with the gating above. Before: seed-tier herbs were
--      locked for free/anon (identity only), and every clinical, interaction, refer and
--      source column opened at Seed.
--   2. herbs_clinical_v: drug_interactions, refer_threshold, primary_sources and
--      secondary_sources now gate at Root inside the view. It has no client grant, so this is
--      defence in depth only. security_invoker=false, security_barrier=true kept.
--   3. citations and citations_herbs: SELECT policy was USING (true) for anon and
--      authenticated. Now authenticated with current_user_at_least('root') only.
--   4. herbs_directory_v and herbs_public: client write privileges revoked (see GRANTS).
--
-- LEFT ALONE, ON PURPOSE
--   * herbs_public's definition (free-visibility herbs only; exposes no Seed or Root column).
--     Only its grants change, see GRANTS below.
--   * sources (a 32-row bibliography of works, not per-herb citations): still public read.
--   * The Seed-gated link tables (herbs_eden_patterns, herbs_constitutions,
--     herbs_doshas_match/_aggravates, herbs_tcm_indicated/_contraindicated) carry
--     primary_citation / secondary_citation columns that a Seed caller can SELECT directly
--     through PostgREST, and v_herb_lens_verdicts (security_invoker) surfaces them. RLS is
--     row-level and cannot hide a column per tier, and a column REVOKE would break
--     useCuratedHerbVerdicts for every tier. No Seed-facing UI renders these citations
--     (herbVerdict.ts only tests whether one exists). Separate decision.
--
-- GRANTS: DELIBERATELY NARROWER THAN LIVE (flag for review)
--   Live, anon and authenticated hold ALL (arwdDxtm) on herbs_directory_v and herbs_public.
--   Both views are auto-updatable (information_schema.views.is_updatable = YES) and
--   owner-privileged, so a write through them runs as postgres against public.herbs and its
--   using(false) RLS policy does not apply. That is an INSERT/UPDATE/DELETE path onto the herb
--   table for anyone holding the publishable key (not exercised; read-only inspection only).
--   This migration would also make MORE directory columns plain (updatable) references, so it
--   re-grants SELECT only and revokes every write privilege from anon and authenticated on both
--   views. No client writes to either view. service_role keeps ALL; owner stays postgres; the
--   directory keeps no reloptions and herbs_public keeps security_invoker=false,
--   security_barrier=true (herbs_public is not recreated, only its grants change).

begin;

-- 1. herbs_directory_v -------------------------------------------------------------------
-- Same 54 columns, names, order and types as the live view (CREATE OR REPLACE VIEW refuses
-- to run otherwise). Owner-privileged (no security_invoker), exactly as live.
create or replace view public.herbs_directory_v as
select
  h.herb_id,
  h.common_name,
  h.latin_name,
  h.plant_family,
  h.part_used,
  h.pronunciation,
  h.image_filename,
  h.tier_visibility,
  h.status,
  false AS is_locked,
  h.taste,
  h.temperature,
  h.moisture,
  h.energetics_summary,
  h.stewardship_note,
  h.biblical_traditional_reference,
  h.cautions,
  h.contraindications_general,
  h.pregnancy_safety,
  h.breastfeeding_safety,
  h.children_safety,
  CASE WHEN public.current_user_at_least('seed'::text) THEN h.tissue_states_indicated ELSE NULL::text END AS tissue_states_indicated,
  CASE WHEN public.current_user_at_least('seed'::text) THEN h.tissue_states_contraindicated ELSE NULL::text END AS tissue_states_contraindicated,
  CASE WHEN public.current_user_at_least('seed'::text) THEN h.system_affinity ELSE NULL::text END AS system_affinity,
  CASE WHEN public.current_user_at_least('seed'::text) THEN h.chief_complaints ELSE NULL::text END AS chief_complaints,
  CASE WHEN public.current_user_at_least('seed'::text) THEN h.western_constitution_match ELSE NULL::text END AS western_constitution_match,
  CASE WHEN public.current_user_at_least('seed'::text) THEN h.ayurvedic_dosha_match ELSE NULL::text END AS ayurvedic_dosha_match,
  CASE WHEN public.current_user_at_least('seed'::text) THEN h.ayurvedic_dosha_aggravates ELSE NULL::text END AS ayurvedic_dosha_aggravates,
  CASE WHEN public.current_user_at_least('seed'::text) THEN h.tcm_pattern_match ELSE NULL::text END AS tcm_pattern_match,
  CASE WHEN public.current_user_at_least('seed'::text) THEN h.tcm_contraindicated_patterns ELSE NULL::text END AS tcm_contraindicated_patterns,
  CASE WHEN public.current_user_at_least('root'::text) THEN h.drug_interactions ELSE NULL::text END AS drug_interactions,
  CASE WHEN public.current_user_at_least('seed'::text) THEN h.preparation_methods ELSE NULL::text END AS preparation_methods,
  CASE WHEN public.current_user_at_least('seed'::text) THEN h.dosage_notes ELSE NULL::text END AS dosage_notes,
  CASE WHEN public.current_user_at_least('root'::text) THEN h.refer_threshold ELSE NULL::text END AS refer_threshold,
  CASE WHEN public.current_user_at_least('root'::text) THEN h.primary_sources ELSE NULL::text END AS primary_sources,
  CASE WHEN public.current_user_at_least('root'::text) THEN h.secondary_sources ELSE NULL::text END AS secondary_sources,
  CASE WHEN public.current_user_at_least('seed'::text) THEN h.notes ELSE NULL::text END AS notes,
  CASE WHEN public.current_user_at_least('seed'::text) THEN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('action_id', a.action_id, 'action_name', a.action_name, 'strength', ha.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_actions ha JOIN public.actions a ON a.action_id = ha.action_id
     WHERE ha.herb_id = h.herb_id
  ) ELSE NULL::jsonb END AS actions_rel,
  CASE WHEN public.current_user_at_least('seed'::text) THEN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('state_id', ts.state_id, 'state_name', ts.state_name, 'strength', hts.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_tissue_states_indicated hts JOIN public.tissue_states ts ON ts.state_id = hts.state_id
     WHERE hts.herb_id = h.herb_id
  ) ELSE NULL::jsonb END AS tissue_states_indicated_rel,
  CASE WHEN public.current_user_at_least('seed'::text) THEN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('state_id', ts.state_id, 'state_name', ts.state_name, 'strength', htsc.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_tissue_states_contraindicated htsc JOIN public.tissue_states ts ON ts.state_id = htsc.state_id
     WHERE htsc.herb_id = h.herb_id
  ) ELSE NULL::jsonb END AS tissue_states_contraindicated_rel,
  CASE WHEN public.current_user_at_least('seed'::text) THEN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('system_id', bs.system_id, 'system_name', bs.system_name, 'strength', hs.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_systems hs JOIN public.body_systems bs ON bs.system_id = hs.system_id
     WHERE hs.herb_id = h.herb_id
  ) ELSE NULL::jsonb END AS systems_rel,
  CASE WHEN public.current_user_at_least('seed'::text) THEN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('complaint_id', cpl.complaint_id, 'complaint_name', cpl.complaint_name, 'strength', hc.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_complaints hc JOIN public.complaints cpl ON cpl.complaint_id = hc.complaint_id
     WHERE hc.herb_id = h.herb_id
  ) ELSE NULL::jsonb END AS complaints_rel,
  CASE WHEN public.current_user_at_least('seed'::text) THEN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('taste_id', t.taste_id, 'taste_name', t.taste_name)), '[]'::jsonb)
      FROM public.herbs_tastes ht JOIN public.tastes t ON t.taste_id = ht.taste_id
     WHERE ht.herb_id = h.herb_id
  ) ELSE NULL::jsonb END AS tastes_rel,
  CASE WHEN public.current_user_at_least('seed'::text) THEN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('constitution_id', c.constitution_id, 'name', c.name, 'relationship', hc2.relationship, 'strength', hc2.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_constitutions hc2 JOIN public.constitutions c ON c.constitution_id = hc2.constitution_id
     WHERE hc2.herb_id = h.herb_id
  ) ELSE NULL::jsonb END AS constitutions_rel,
  CASE WHEN public.current_user_at_least('seed'::text) THEN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('pattern_id', p.pattern_id, 'pattern_name', p.pattern_name, 'strength', htci.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_tcm_indicated htci JOIN public.tcm_patterns p ON p.pattern_id = htci.pattern_id
     WHERE htci.herb_id = h.herb_id
  ) ELSE NULL::jsonb END AS tcm_indicated_rel,
  CASE WHEN public.current_user_at_least('seed'::text) THEN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('pattern_id', p.pattern_id, 'pattern_name', p.pattern_name, 'strength', htcc.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_tcm_contraindicated htcc JOIN public.tcm_patterns p ON p.pattern_id = htcc.pattern_id
     WHERE htcc.herb_id = h.herb_id
  ) ELSE NULL::jsonb END AS tcm_contraindicated_rel,
  CASE WHEN public.current_user_at_least('seed'::text) THEN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('dosha_id', d.dosha_id, 'dosha_name', d.dosha_name, 'strength', hdm.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_doshas_match hdm JOIN public.doshas d ON d.dosha_id = hdm.dosha_id
     WHERE hdm.herb_id = h.herb_id
  ) ELSE NULL::jsonb END AS doshas_match_rel,
  CASE WHEN public.current_user_at_least('seed'::text) THEN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('dosha_id', d.dosha_id, 'dosha_name', d.dosha_name, 'strength', hda.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_doshas_aggravates hda JOIN public.doshas d ON d.dosha_id = hda.dosha_id
     WHERE hda.herb_id = h.herb_id
  ) ELSE NULL::jsonb END AS doshas_aggravates_rel,
  CASE WHEN public.current_user_at_least('seed'::text) THEN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('prep_id', pr.prep_id, 'preparation_name', pr.preparation_name, 'strength', hp.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_preparations hp JOIN public.preparations pr ON pr.prep_id = hp.prep_id
     WHERE hp.herb_id = h.herb_id
  ) ELSE NULL::jsonb END AS preparations_rel,
  COALESCE((
    SELECT array_agg(cpl.complaint_name ORDER BY cpl.complaint_name)
      FROM public.herbs_complaints hc JOIN public.complaints cpl ON cpl.complaint_id = hc.complaint_id
     WHERE hc.herb_id = h.herb_id
  ), ARRAY[]::text[]) AS complaint_names,
  CASE WHEN public.current_user_at_least('root'::text) THEN h.primary_text_citation ELSE NULL::jsonb END AS primary_text_citation,
  CASE WHEN public.current_user_at_least('root'::text) THEN h.secondary_citation ELSE NULL::jsonb END AS secondary_citation,
  CASE WHEN public.current_user_at_least('seed'::text) THEN h.traditional_observations ELSE NULL::jsonb END AS traditional_observations,
  CASE WHEN h.energetics_summary IS NULL THEN NULL::text
       ELSE "left"(split_part(h.energetics_summary, ';'::text, 1), 140)
  END AS energetics_teaser
from public.herbs h;

alter view public.herbs_directory_v owner to postgres;
revoke all on table public.herbs_directory_v from public, anon, authenticated;
grant select on table public.herbs_directory_v to anon, authenticated;
grant all on table public.herbs_directory_v to service_role;

-- 1b. herbs_public: definition untouched, write privileges closed (see GRANTS above) -------
revoke all on table public.herbs_public from public, anon, authenticated;
grant select on table public.herbs_public to anon, authenticated;
grant all on table public.herbs_public to service_role;

-- 2. herbs_clinical_v (defence in depth) -------------------------------------------------
-- No client grant (20260915100000_audit_hardening revokes it), but it still returned the
-- Root columns to any Seed caller. Root columns now gate at Root inside the view.
create or replace view public.herbs_clinical_v
with (security_invoker = false, security_barrier = true) as
select
  h.herb_id,
  h.common_name,
  h.latin_name,
  h.plant_family,
  h.part_used,
  h.taste,
  h.temperature,
  h.moisture,
  h.tissue_states_indicated,
  h.tissue_states_contraindicated,
  h.system_affinity,
  h.chief_complaints,
  h.western_constitution_match,
  h.ayurvedic_dosha_match,
  h.ayurvedic_dosha_aggravates,
  h.tcm_pattern_match,
  h.tcm_contraindicated_patterns,
  h.cautions,
  h.contraindications_general,
  h.pregnancy_safety,
  h.breastfeeding_safety,
  h.children_safety,
  CASE WHEN public.current_user_at_least('root'::text) THEN h.drug_interactions ELSE NULL::text END AS drug_interactions,
  h.preparation_methods,
  h.dosage_notes,
  CASE WHEN public.current_user_at_least('root'::text) THEN h.primary_sources ELSE NULL::text END AS primary_sources,
  CASE WHEN public.current_user_at_least('root'::text) THEN h.secondary_sources ELSE NULL::text END AS secondary_sources,
  h.tier_visibility,
  h.notes,
  h.biblical_traditional_reference,
  h.stewardship_note,
  h.energetics_summary,
  CASE WHEN public.current_user_at_least('root'::text) THEN h.refer_threshold ELSE NULL::text END AS refer_threshold,
  h.pronunciation,
  h.image_filename,
  h.status,
  (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('action_id', a.action_id, 'action_name', a.action_name, 'strength', ha.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_actions ha JOIN public.actions a ON a.action_id = ha.action_id
     WHERE ha.herb_id = h.herb_id
  ) AS actions,
  (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('state_id', ts.state_id, 'state_name', ts.state_name, 'strength', hts.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_tissue_states_indicated hts JOIN public.tissue_states ts ON ts.state_id = hts.state_id
     WHERE hts.herb_id = h.herb_id
  ) AS tissue_states_indicated_rel,
  (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('state_id', ts.state_id, 'state_name', ts.state_name, 'strength', htsc.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_tissue_states_contraindicated htsc JOIN public.tissue_states ts ON ts.state_id = htsc.state_id
     WHERE htsc.herb_id = h.herb_id
  ) AS tissue_states_contraindicated_rel,
  (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('system_id', bs.system_id, 'system_name', bs.system_name, 'strength', hs.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_systems hs JOIN public.body_systems bs ON bs.system_id = hs.system_id
     WHERE hs.herb_id = h.herb_id
  ) AS systems_rel,
  (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('complaint_id', cpl.complaint_id, 'complaint_name', cpl.complaint_name, 'strength', hc.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_complaints hc JOIN public.complaints cpl ON cpl.complaint_id = hc.complaint_id
     WHERE hc.herb_id = h.herb_id
  ) AS complaints_rel,
  (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('taste_id', t.taste_id, 'taste_name', t.taste_name)), '[]'::jsonb)
      FROM public.herbs_tastes ht JOIN public.tastes t ON t.taste_id = ht.taste_id
     WHERE ht.herb_id = h.herb_id
  ) AS tastes_rel,
  (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('constitution_id', c.constitution_id, 'name', c.name, 'relationship', hc2.relationship, 'strength', hc2.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_constitutions hc2 JOIN public.constitutions c ON c.constitution_id = hc2.constitution_id
     WHERE hc2.herb_id = h.herb_id
  ) AS constitutions_rel,
  (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('pattern_id', p.pattern_id, 'pattern_name', p.pattern_name, 'strength', htci.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_tcm_indicated htci JOIN public.tcm_patterns p ON p.pattern_id = htci.pattern_id
     WHERE htci.herb_id = h.herb_id
  ) AS tcm_indicated_rel,
  (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('pattern_id', p.pattern_id, 'pattern_name', p.pattern_name, 'strength', htcc.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_tcm_contraindicated htcc JOIN public.tcm_patterns p ON p.pattern_id = htcc.pattern_id
     WHERE htcc.herb_id = h.herb_id
  ) AS tcm_contraindicated_rel,
  (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('dosha_id', d.dosha_id, 'dosha_name', d.dosha_name, 'strength', hdm.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_doshas_match hdm JOIN public.doshas d ON d.dosha_id = hdm.dosha_id
     WHERE hdm.herb_id = h.herb_id
  ) AS doshas_match_rel,
  (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('dosha_id', d.dosha_id, 'dosha_name', d.dosha_name, 'strength', hda.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_doshas_aggravates hda JOIN public.doshas d ON d.dosha_id = hda.dosha_id
     WHERE hda.herb_id = h.herb_id
  ) AS doshas_aggravates_rel,
  (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('prep_id', pr.prep_id, 'preparation_name', pr.preparation_name, 'strength', hp.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_preparations hp JOIN public.preparations pr ON pr.prep_id = hp.prep_id
     WHERE hp.herb_id = h.herb_id
  ) AS preparations_rel
from public.herbs h
where public.current_user_at_least('seed'::text);

alter view public.herbs_clinical_v owner to postgres;
revoke all on table public.herbs_clinical_v from public, anon, authenticated;

-- 3. citations + citations_herbs: Root ---------------------------------------------------
-- Both were readable by anon (policy USING true). They are per-herb source quotes, which the
-- tier ladder sells as Root. No client code reads either table (verified 2026-09-15: no
-- reference in src/, web/ or supabase/functions/); service_role bypasses RLS.
drop policy if exists citations_public_read on public.citations;
drop policy if exists citations_root_read on public.citations;
create policy citations_root_read on public.citations
  for select to authenticated
  using (public.current_user_at_least('root'::text));

drop policy if exists citations_herbs_public_read on public.citations_herbs;
drop policy if exists citations_herbs_root_read on public.citations_herbs;
create policy citations_herbs_root_read on public.citations_herbs
  for select to authenticated
  using (public.current_user_at_least('root'::text));

-- 4. Verification: abort the transaction if any gate is not what this file says ----------
do $$
declare
  dir_def  text;
  clin_def text;
  bad      text[] := '{}';
  col      text;
  priv     text;
  vw       text;
  n        int;
begin
  -- Pin search_path for this transaction so pg_get_viewdef prints function and column names
  -- unqualified, which is the form the checks below match.
  perform set_config('search_path', 'public, pg_catalog', true);
  dir_def  := pg_get_viewdef('public.herbs_directory_v'::regclass, true);
  clin_def := pg_get_viewdef('public.herbs_clinical_v'::regclass, true);

  -- Root columns gate at Root. pg_get_viewdef prints e.g.
  --   WHEN current_user_at_least('root'::text) THEN drug_interactions
  foreach col in array array['drug_interactions', 'refer_threshold', 'primary_sources', 'secondary_sources', 'primary_text_citation', 'secondary_citation'] loop
    if position(format('current_user_at_least(''root''::text) THEN %s', col) in dir_def) = 0 then
      bad := bad || ('herbs_directory_v.' || col || ' not gated at root');
    end if;
  end loop;
  foreach col in array array['drug_interactions', 'refer_threshold', 'primary_sources', 'secondary_sources'] loop
    if position(format('current_user_at_least(''root''::text) THEN %s', col) in clin_def) = 0 then
      bad := bad || ('herbs_clinical_v.' || col || ' not gated at root');
    end if;
  end loop;
  if dir_def ~ 'current_user_at_least\(''seed''::text\) THEN (drug_interactions|refer_threshold|primary_sources|secondary_sources|primary_text_citation|secondary_citation)\M' then
    bad := bad || 'a root column is still gated at seed in herbs_directory_v'::text;
  end if;

  -- Seed text/json columns gate at Seed.
  foreach col in array array['tissue_states_indicated', 'tissue_states_contraindicated', 'system_affinity', 'chief_complaints', 'western_constitution_match', 'ayurvedic_dosha_match', 'ayurvedic_dosha_aggravates', 'tcm_pattern_match', 'tcm_contraindicated_patterns', 'preparation_methods', 'dosage_notes', 'notes', 'traditional_observations'] loop
    if position(format('current_user_at_least(''seed''::text) THEN %s', col) in dir_def) = 0 then
      bad := bad || ('herbs_directory_v.' || col || ' not gated at seed');
    end if;
  end loop;
  -- Seed *_rel columns: exactly one seed CASE per rel column, 12 in total.
  select count(*) into n
    from regexp_matches(dir_def, 'current_user_at_least\(''seed''::text\) THEN \(', 'g');
  if n <> 12 then
    bad := bad || ('herbs_directory_v has ' || n || ' seed-gated subqueries, expected 12');
  end if;

  -- Free columns are no longer wrapped in any CASE, and nothing is locked.
  foreach col in array array['taste', 'temperature', 'moisture', 'energetics_summary', 'stewardship_note', 'biblical_traditional_reference', 'cautions', 'contraindications_general', 'pregnancy_safety', 'breastfeeding_safety', 'children_safety'] loop
    if dir_def ~ ('THEN ' || col || '\M') then
      bad := bad || ('herbs_directory_v.' || col || ' is still gated');
    end if;
  end loop;
  if position('false AS is_locked' in dir_def) = 0 then
    bad := bad || 'herbs_directory_v.is_locked is not constant false'::text;
  end if;
  if dir_def ~ 'tier_visibility = ' then
    bad := bad || 'herbs_directory_v still gates on tier_visibility'::text;
  end if;

  -- Shape unchanged: the generated TS types depend on it.
  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'herbs_directory_v';
  if n <> 54 then bad := bad || ('herbs_directory_v has ' || n || ' columns, expected 54'); end if;
  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'herbs_clinical_v';
  if n <> 48 then bad := bad || ('herbs_clinical_v has ' || n || ' columns, expected 48'); end if;

  -- Access: the app can read the directory and herbs_public, but write neither.
  foreach vw in array array['public.herbs_directory_v', 'public.herbs_public'] loop
    if not has_table_privilege('anon', vw, 'SELECT') or not has_table_privilege('authenticated', vw, 'SELECT') then
      bad := bad || (vw || ' lost its anon/authenticated SELECT grant');
    end if;
    foreach priv in array array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] loop
      if has_table_privilege('anon', vw, priv) or has_table_privilege('authenticated', vw, priv) then
        bad := bad || (vw || ' still grants ' || priv || ' to a client role');
      end if;
    end loop;
  end loop;
  if has_table_privilege('anon', 'public.herbs_clinical_v', 'SELECT')
     or has_table_privilege('authenticated', 'public.herbs_clinical_v', 'SELECT') then
    bad := bad || 'herbs_clinical_v is client-readable'::text;
  end if;
  if not exists (select 1 from pg_class where oid = 'public.herbs_clinical_v'::regclass
                  and coalesce(reloptions, '{}') @> array['security_barrier=true']) then
    bad := bad || 'herbs_clinical_v lost security_barrier'::text;
  end if;
  if exists (select 1 from pg_class where oid = 'public.herbs_directory_v'::regclass
              and coalesce(reloptions, '{}') && array['security_invoker=true', 'security_invoker=on']) then
    bad := bad || 'herbs_directory_v became security_invoker (would empty the directory)'::text;
  end if;

  -- Citations: no SELECT policy on either table may admit a caller below Root.
  if exists (select 1 from pg_policies
              where schemaname = 'public' and tablename in ('citations', 'citations_herbs')
                and cmd in ('SELECT', 'ALL')
                and (qual is null or qual !~ 'current_user_at_least\(''(root|practitioner)''')) then
    bad := bad || 'citations/citations_herbs still readable below root'::text;
  end if;

  if array_length(bad, 1) is not null then
    raise exception 'herb_tier_model: checks failed: %', array_to_string(bad, '; ');
  end if;
end $$;

commit;
