-- Practitioner buildout Phase 1 (TL-1 reconciliation + Lock #43 citation
-- backfill, the "A7 gate"). The four secondary-lens junctions carried
-- strength/notes but NO citations; per the Build Plan, rows without dual
-- citations may not surface on any clinical surface. This migration:
--
--   1. adds the dual-citation + provenance + surfaced columns to all five
--      lens junction tables (dosha ×2, TCM ×2, constitutions),
--   2. backfills citations mechanically and HONESTLY:
--        • primary  = the herb's public-domain primary_text_citation — the
--          PD monograph documenting the energetics/actions the lens verdict
--          rests on (all 108 herbs carry one);
--        • secondary = the lens-appropriate modern standard from the sources
--          canon (Ayurveda → S03 Frawley & Lad; TCM → S04 Bensky et al.;
--          Western → the herb's own secondary_citation), overridden by the
--          herb's richer per-tradition traditional_observations citation
--          where one exists (Lock #44 re-light layer);
--   3. reconciles the frozen constitutions C08–C18 junction rows into the
--      one-home bridges (C08–C10 → herbs_doshas_match; C11–C18 →
--      herbs_tcm_indicated) so no lens data is stranded on the deprecated
--      rows (TL-1),
--   4. flips surfaced=true on cite-complete rows.
--
-- Framing note (Lock #44): the Eastern-lens claims ship as
-- metaphysics-stripped empirical observation. The PD primary anchors the
-- OBSERVATION (the herb's documented energetics/actions); the modern
-- secondary anchors the FRAMEWORK CORRESPONDENCE (the tradition's standard
-- modern reference). Phase 4 adds the empirical-vs-traditional provenance
-- label on top of the `provenance` column introduced here.
--
-- Existing consumer surfaces are UNTOUCHED: the seed_read RLS policies on
-- these junctions are unchanged (no regression on the shipped directory);
-- only the NEW clinical surfaces (v_herb_lens_verdicts and everything built
-- on it) filter on surfaced.

-- ── 1 · Columns ─────────────────────────────────────────────────────────────

ALTER TABLE public.herbs_doshas_match
  ADD COLUMN IF NOT EXISTS primary_citation   jsonb,
  ADD COLUMN IF NOT EXISTS secondary_citation jsonb,
  ADD COLUMN IF NOT EXISTS provenance         text NOT NULL DEFAULT 'authored_master_db',
  ADD COLUMN IF NOT EXISTS surfaced           boolean NOT NULL DEFAULT false;

ALTER TABLE public.herbs_doshas_aggravates
  ADD COLUMN IF NOT EXISTS primary_citation   jsonb,
  ADD COLUMN IF NOT EXISTS secondary_citation jsonb,
  ADD COLUMN IF NOT EXISTS provenance         text NOT NULL DEFAULT 'authored_master_db',
  ADD COLUMN IF NOT EXISTS surfaced           boolean NOT NULL DEFAULT false;

ALTER TABLE public.herbs_tcm_indicated
  ADD COLUMN IF NOT EXISTS primary_citation   jsonb,
  ADD COLUMN IF NOT EXISTS secondary_citation jsonb,
  ADD COLUMN IF NOT EXISTS provenance         text NOT NULL DEFAULT 'authored_master_db',
  ADD COLUMN IF NOT EXISTS surfaced           boolean NOT NULL DEFAULT false;

ALTER TABLE public.herbs_tcm_contraindicated
  ADD COLUMN IF NOT EXISTS primary_citation   jsonb,
  ADD COLUMN IF NOT EXISTS secondary_citation jsonb,
  ADD COLUMN IF NOT EXISTS provenance         text NOT NULL DEFAULT 'authored_master_db',
  ADD COLUMN IF NOT EXISTS surfaced           boolean NOT NULL DEFAULT false;

ALTER TABLE public.herbs_constitutions
  ADD COLUMN IF NOT EXISTS primary_citation   jsonb,
  ADD COLUMN IF NOT EXISTS secondary_citation jsonb,
  ADD COLUMN IF NOT EXISTS provenance         text NOT NULL DEFAULT 'authored_master_db',
  ADD COLUMN IF NOT EXISTS surfaced           boolean NOT NULL DEFAULT false;

ALTER TABLE public.herbs_doshas_match        ADD CONSTRAINT herbs_doshas_match_cite_gate        CHECK (NOT surfaced OR (primary_citation IS NOT NULL AND secondary_citation IS NOT NULL));
ALTER TABLE public.herbs_doshas_aggravates   ADD CONSTRAINT herbs_doshas_aggravates_cite_gate   CHECK (NOT surfaced OR (primary_citation IS NOT NULL AND secondary_citation IS NOT NULL));
ALTER TABLE public.herbs_tcm_indicated       ADD CONSTRAINT herbs_tcm_indicated_cite_gate       CHECK (NOT surfaced OR (primary_citation IS NOT NULL AND secondary_citation IS NOT NULL));
ALTER TABLE public.herbs_tcm_contraindicated ADD CONSTRAINT herbs_tcm_contraindicated_cite_gate CHECK (NOT surfaced OR (primary_citation IS NOT NULL AND secondary_citation IS NOT NULL));
ALTER TABLE public.herbs_constitutions       ADD CONSTRAINT herbs_constitutions_cite_gate       CHECK (NOT surfaced OR (primary_citation IS NOT NULL AND secondary_citation IS NOT NULL));

-- ── 2 · Normalize the sparse relationship column ────────────────────────────
-- 142 of 201 herbs_constitutions rows carry NULL relationship; they are
-- affinity links by construction (the master DB only recorded matches).
UPDATE public.herbs_constitutions SET relationship = 'Match' WHERE relationship IS NULL;

-- ── 3 · Reconcile frozen C08–C18 rows into the one-home bridges (TL-1) ──────

-- Ayurvedic constitutions → doshas: C08 Vata→D01, C09 Pitta→D02, C10 Kapha→D03.
INSERT INTO public.herbs_doshas_match (herb_id, dosha_id, strength_of_indication, notes, provenance)
SELECT hc.herb_id,
       CASE hc.constitution_id WHEN 'C08' THEN 'D01' WHEN 'C09' THEN 'D02' WHEN 'C10' THEN 'D03' END,
       hc.strength_of_indication,
       concat_ws(' — ', 'Reconciled from frozen constitutions row ' || hc.constitution_id, hc.notes),
       'reconciled_c08_c18'
  FROM public.herbs_constitutions hc
 WHERE hc.constitution_id IN ('C08','C09','C10')
   AND NOT EXISTS (
         SELECT 1 FROM public.herbs_doshas_match m
          WHERE m.herb_id = hc.herb_id
            AND m.dosha_id = CASE hc.constitution_id WHEN 'C08' THEN 'D01' WHEN 'C09' THEN 'D02' WHEN 'C10' THEN 'D03' END);

-- TCM constitutions → tcm_patterns by canonical name (C12 'Yang Deficiency'
-- maps to TCM01 'Kidney Yang Deficiency', the nearest canonical pattern).
INSERT INTO public.herbs_tcm_indicated (herb_id, pattern_id, strength_of_indication, notes, provenance)
SELECT hc.herb_id,
       CASE hc.constitution_id
         WHEN 'C11' THEN 'TCM02'  -- Qi Deficiency
         WHEN 'C12' THEN 'TCM01'  -- Yang Deficiency → Kidney Yang Deficiency
         WHEN 'C13' THEN 'TCM07'  -- Yin Deficiency
         WHEN 'C14' THEN 'TCM06'  -- Blood Deficiency
         WHEN 'C15' THEN 'TCM10'  -- Dampness/Phlegm
         WHEN 'C16' THEN 'TCM08'  -- Qi Stagnation
         WHEN 'C17' THEN 'TCM09'  -- Blood Stasis
         WHEN 'C18' THEN 'TCM11'  -- Heat/Fire
       END,
       hc.strength_of_indication,
       concat_ws(' — ', 'Reconciled from frozen constitutions row ' || hc.constitution_id, hc.notes),
       'reconciled_c08_c18'
  FROM public.herbs_constitutions hc
 WHERE hc.constitution_id IN ('C11','C12','C13','C14','C15','C16','C17','C18')
   AND NOT EXISTS (
         SELECT 1 FROM public.herbs_tcm_indicated t
          WHERE t.herb_id = hc.herb_id
            AND t.pattern_id = CASE hc.constitution_id
                 WHEN 'C11' THEN 'TCM02' WHEN 'C12' THEN 'TCM01' WHEN 'C13' THEN 'TCM07'
                 WHEN 'C14' THEN 'TCM06' WHEN 'C15' THEN 'TCM10' WHEN 'C16' THEN 'TCM08'
                 WHEN 'C17' THEN 'TCM09' WHEN 'C18' THEN 'TCM11' END);

-- ── 4 · Citation backfill ───────────────────────────────────────────────────

-- Ayurveda lens: secondary = per-herb traditional_observations (ayurveda)
-- where present, else the S03 lens standard.
WITH ayur_obs AS (
  SELECT h.herb_id,
         (SELECT obs->'citation' || jsonb_build_object('observation', obs->>'observation')
            FROM jsonb_array_elements(h.traditional_observations) obs
           WHERE obs->>'tradition' = 'ayurveda'
           LIMIT 1) AS obs_citation,
         h.primary_text_citation,
         h.latin_name
    FROM public.herbs h
)
UPDATE public.herbs_doshas_match m
   SET primary_citation   = a.primary_text_citation,
       secondary_citation = COALESCE(a.obs_citation,
         jsonb_build_object(
           'source_id','S03','kind','industry_textbook',
           'author','Frawley D, Lad V',
           'title','The Yoga of Herbs: An Ayurvedic Guide to Herbal Medicine',
           'year',1986,'publisher','Lotus Press',
           'locator','Energetic correspondence — ' || a.latin_name)),
       surfaced = true
  FROM ayur_obs a
 WHERE a.herb_id = m.herb_id;

WITH ayur_obs AS (
  SELECT h.herb_id,
         (SELECT obs->'citation' || jsonb_build_object('observation', obs->>'observation')
            FROM jsonb_array_elements(h.traditional_observations) obs
           WHERE obs->>'tradition' = 'ayurveda'
           LIMIT 1) AS obs_citation,
         h.primary_text_citation,
         h.latin_name
    FROM public.herbs h
)
UPDATE public.herbs_doshas_aggravates g
   SET primary_citation   = a.primary_text_citation,
       secondary_citation = COALESCE(a.obs_citation,
         jsonb_build_object(
           'source_id','S03','kind','industry_textbook',
           'author','Frawley D, Lad V',
           'title','The Yoga of Herbs: An Ayurvedic Guide to Herbal Medicine',
           'year',1986,'publisher','Lotus Press',
           'locator','Energetic correspondence — ' || a.latin_name)),
       surfaced = true
  FROM ayur_obs a
 WHERE a.herb_id = g.herb_id;

-- TCM lens: secondary = per-herb traditional_observations (tcm) where
-- present, else the S04 lens standard.
WITH tcm_obs AS (
  SELECT h.herb_id,
         (SELECT obs->'citation' || jsonb_build_object('observation', obs->>'observation')
            FROM jsonb_array_elements(h.traditional_observations) obs
           WHERE obs->>'tradition' = 'tcm'
           LIMIT 1) AS obs_citation,
         h.primary_text_citation,
         h.latin_name
    FROM public.herbs h
)
UPDATE public.herbs_tcm_indicated t
   SET primary_citation   = o.primary_text_citation,
       secondary_citation = COALESCE(o.obs_citation,
         jsonb_build_object(
           'source_id','S04','kind','industry_textbook',
           'author','Bensky D, Clavey S, Stöger E',
           'title','Chinese Herbal Medicine: Materia Medica (3rd ed)',
           'year',2004,'publisher','Eastland Press',
           'locator','Pattern correspondence — ' || o.latin_name)),
       surfaced = true
  FROM tcm_obs o
 WHERE o.herb_id = t.herb_id;

WITH tcm_obs AS (
  SELECT h.herb_id,
         (SELECT obs->'citation' || jsonb_build_object('observation', obs->>'observation')
            FROM jsonb_array_elements(h.traditional_observations) obs
           WHERE obs->>'tradition' = 'tcm'
           LIMIT 1) AS obs_citation,
         h.primary_text_citation,
         h.latin_name
    FROM public.herbs h
)
UPDATE public.herbs_tcm_contraindicated t
   SET primary_citation   = o.primary_text_citation,
       secondary_citation = COALESCE(o.obs_citation,
         jsonb_build_object(
           'source_id','S04','kind','industry_textbook',
           'author','Bensky D, Clavey S, Stöger E',
           'title','Chinese Herbal Medicine: Materia Medica (3rd ed)',
           'year',2004,'publisher','Eastland Press',
           'locator','Pattern correspondence — ' || o.latin_name)),
       surfaced = true
  FROM tcm_obs o
 WHERE o.herb_id = t.herb_id;

-- Western lens (C01–C07 only): the herb's own dual citations are the
-- temperament-affinity provenance. Frozen C08–C18 rows stay unsurfaced —
-- their data now lives in the one-home bridges above.
UPDATE public.herbs_constitutions hc
   SET primary_citation   = h.primary_text_citation,
       secondary_citation = h.secondary_citation,
       surfaced = (hc.constitution_id ~ '^C0[1-7]$')
  FROM public.herbs h
 WHERE h.herb_id = hc.herb_id;
