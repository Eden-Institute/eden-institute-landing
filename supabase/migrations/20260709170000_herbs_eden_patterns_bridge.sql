-- Practitioner buildout Phase 1 (PD-4): the Eden lens herb bridge.
-- herbs_eden_patterns materializes, in data, the SAME relationship algorithm
-- the shipped directory computes client-side (src/lib/edenPattern.ts
-- computeMatchRelationship): a herb MATCHES a Pattern when ≥2 of its three
-- energetic axes stand OPPOSITE the Pattern's axes (terrain restoration is
-- rebalancing, not reinforcement); it AGGRAVATES (avoid) when ≥2 axes are the
-- SAME; otherwise neutral. The three SQL classifiers below mirror the
-- TypeScript classifiers keyword-for-keyword so the two layers can never
-- disagree.
--
-- Hybrid production per PD-4: computed here (all 108 herbs × 8 Patterns,
-- 864 rows), then CURATED before surfacing — rows are inserted with
-- surfaced = false and only flip on after the curation pass. Lock #43 gate:
-- a CHECK constraint makes it impossible to surface a row without both
-- citation halves. Citations are the herb's own energetics provenance
-- (primary_text_citation / secondary_citation — present on all 108 herbs):
-- the match/avoid claim is a deterministic derivation from the herb's
-- documented energetics, so the energetics provenance IS the claim's
-- provenance, with the derivation itself recorded in `rationale`.

-- ── Classifiers (mirror src/lib/edenPattern.ts exactly) ─────────────────────

CREATE OR REPLACE FUNCTION public.eden_classify_temperature(value text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN value IS NULL THEN NULL
    WHEN lower(value) LIKE '%hot%'  OR lower(value) LIKE '%warm%' THEN 'hot'
    WHEN lower(value) LIKE '%cold%' OR lower(value) LIKE '%cool%' THEN 'cold'
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.eden_classify_moisture(value text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN value IS NULL THEN NULL
    WHEN lower(value) LIKE '%moist%' OR lower(value) LIKE '%damp%'
      OR lower(value) LIKE '%mucil%' OR lower(value) LIKE '%demulcent%' THEN 'damp'
    WHEN lower(value) LIKE '%dry%' THEN 'dry'
    ELSE NULL
  END
$$;

-- Returns the herb's INTRINSIC ACTION axis (opposite of the tissue states it
-- resolves), same convention as classifyTone in edenPattern.ts: indicated for
-- tense states → relaxant → 'relaxed'; indicated for lax states → tonic →
-- 'tense'; both or neither → NULL (neutral).
CREATE OR REPLACE FUNCTION public.eden_classify_tone(value text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN value IS NULL THEN NULL
    WHEN tense_hit AND NOT relaxed_hit THEN 'relaxed'
    WHEN relaxed_hit AND NOT tense_hit THEN 'tense'
    ELSE NULL
  END
  FROM (SELECT
          lower(value) ~ '(tension|constriction|stagnation|excitation)'                AS tense_hit,
          lower(value) ~ '(laxity|atony|atrophy|deficiency|torpor|exhaustion)'         AS relaxed_hit
       ) hits
$$;

-- ── The bridge table ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.herbs_eden_patterns (
  link_id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  herb_id           text NOT NULL REFERENCES public.herbs(herb_id),
  pattern_id        text NOT NULL REFERENCES public.eden_patterns(pattern_id),
  relationship      text NOT NULL CHECK (relationship IN ('match','avoid','neutral')),
  rebalancing_axes  smallint NOT NULL DEFAULT 0,
  aggravating_axes  smallint NOT NULL DEFAULT 0,
  rationale         text,
  derivation        text NOT NULL DEFAULT 'computed_energetics'
                    CHECK (derivation IN ('computed_energetics','curated')),
  primary_citation  jsonb,
  secondary_citation jsonb,
  surfaced          boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (herb_id, pattern_id),
  -- Lock #43 gate: no row surfaces without both citation halves.
  CHECK (NOT surfaced OR (primary_citation IS NOT NULL AND secondary_citation IS NOT NULL))
);

COMMENT ON TABLE public.herbs_eden_patterns IS
  'Eden lens herb bridge (PD-4, TL-1): one verdict per herb × Pattern, computed from herb energetics by the same algorithm as computeMatchRelationship (src/lib/edenPattern.ts), then curated. surfaced=false rows are invisible to clients (Lock #43: uncited/uncurated claims do not surface). Citations = the herb''s energetics provenance; rationale records the axis derivation.';

ALTER TABLE public.herbs_eden_patterns ENABLE ROW LEVEL SECURITY;

-- Same tier gate as the sibling lens junctions, plus the surfaced gate.
CREATE POLICY herbs_eden_patterns_seed_read
  ON public.herbs_eden_patterns FOR SELECT
  TO authenticated
  USING (current_user_at_least('seed'::text) AND surfaced);

-- ── Compute the 864 verdicts ────────────────────────────────────────────────

WITH herb_axes AS (
  SELECT h.herb_id,
         public.eden_classify_temperature(h.temperature)      AS t,
         public.eden_classify_moisture(h.moisture)            AS m,
         public.eden_classify_tone(h.tissue_states_indicated) AS tn,
         h.primary_text_citation,
         h.secondary_citation
    FROM public.herbs h
),
scored AS (
  SELECT ha.herb_id,
         ep.pattern_id,
         (CASE WHEN ha.t  IS NOT NULL AND ha.t  <> ep.temperature THEN 1 ELSE 0 END
        + CASE WHEN ha.m  IS NOT NULL AND ha.m  <> ep.moisture    THEN 1 ELSE 0 END
        + CASE WHEN ha.tn IS NOT NULL AND ha.tn <> ep.tone        THEN 1 ELSE 0 END) AS rebal,
         (CASE WHEN ha.t  = ep.temperature THEN 1 ELSE 0 END
        + CASE WHEN ha.m  = ep.moisture    THEN 1 ELSE 0 END
        + CASE WHEN ha.tn = ep.tone        THEN 1 ELSE 0 END)                        AS aggr,
         concat_ws('; ',
           CASE WHEN ha.t IS NULL THEN 'temperature: neutral'
                WHEN ha.t <> ep.temperature THEN format('temperature: herb %s rebalances the pattern''s %s', ha.t, ep.temperature)
                ELSE format('temperature: herb %s reinforces the pattern''s %s', ha.t, ep.temperature) END,
           CASE WHEN ha.m IS NULL THEN 'moisture: neutral'
                WHEN ha.m <> ep.moisture THEN format('moisture: herb %s rebalances the pattern''s %s', ha.m, ep.moisture)
                ELSE format('moisture: herb %s reinforces the pattern''s %s', ha.m, ep.moisture) END,
           CASE WHEN ha.tn IS NULL THEN 'tone: neutral'
                WHEN ha.tn <> ep.tone THEN format('tone: herb action (%s-ward) rebalances the pattern''s %s', ha.tn, ep.tone)
                ELSE format('tone: herb action (%s-ward) reinforces the pattern''s %s', ha.tn, ep.tone) END
         ) AS rationale,
         ha.primary_text_citation,
         ha.secondary_citation
    FROM herb_axes ha
   CROSS JOIN public.eden_patterns ep
)
INSERT INTO public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, rebalancing_axes, aggravating_axes,
   rationale, derivation, primary_citation, secondary_citation, surfaced)
SELECT herb_id,
       pattern_id,
       CASE WHEN rebal >= 2 THEN 'match'
            WHEN aggr  >= 2 THEN 'avoid'
            ELSE 'neutral' END,
       rebal,
       aggr,
       rationale,
       'computed_energetics',
       primary_text_citation,
       secondary_citation,
       false            -- curation pass flips surfaced on (PD-4 hybrid discipline)
  FROM scored
ON CONFLICT (herb_id, pattern_id) DO NOTHING;
