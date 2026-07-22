-- Fix the energetics classifiers so they read the LEADING CLAUSE of the
-- temperature/moisture prose instead of substring-matching the whole value.
--
-- THE BUG. eden_classify_temperature tested '%hot%' and '%warm%' against the
-- entire field before it ever considered '%cold%' or '%cool%'. But these
-- columns hold descriptive prose in which the first clause carries the verdict
-- and the remainder EXPLAINS it, and explaining routinely names the opposite
-- pole, either to say what the herb is not or to record a tradition that
-- classes it the other way. So the better a herb was documented, the more
-- likely it was misclassified.
--
-- Barberry (H188) is the worst case, inverted on both axes:
--   temperature "Cold. A classic cold, clearing bitter; ... used it to cool
--                and drain a hot, congested, bilious liver."   -> read 'hot'
--   moisture    "Dry. The bitter, astringent bark drains and dries damp,
--                boggy, congested tissue rather than moistening it."
--                                                              -> read 'damp'
-- Stored Cold/Dry, matched as Hot/Damp, so it was recommended to exactly the
-- constitutions it should have been held back from.
--
-- Verified against production 2026-07-21: 11 temperature and 9 moisture
-- readings were inverted, every one of them in the same direction, because
-- hot/damp are tested first. Four herbs (Barberry, Cranberry, Sandalwood,
-- Guduchi) were inverted on BOTH axes.
--
-- NO STORED VALUE IS WRONG and none is changed here. The explanatory prose is
-- among the most valuable content in the herbs table: it is where the
-- cross-tradition disagreements are recorded. The code has to be able to read
-- a record that explains itself.
--
-- Mirrors src/lib/edenPattern.ts (leadingClause / classifyTemperature /
-- classifyMoisture). Regression tests: src/test/edenPatternClassifier.test.ts.
--
-- eden_classify_tone is deliberately NOT changed. It reads
-- tissue_states_indicated, which is a LIST of states rather than a
-- verdict-then-explanation, so whole-value set membership is correct there.
--
-- Idempotent.

begin;

-- ── The leading clause: everything before the first . ( ; or : ────────────
-- Every one of the 300 rows opens with its verdict, so this is the answer in
-- all of them. Values with no delimiter are returned whole, which preserves
-- the existing reading of forms like 'Neutral to slightly warm'.
CREATE OR REPLACE FUNCTION public.eden_leading_clause(value text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(substring(value from '^[^.(;:]*'))
$$;

COMMENT ON FUNCTION public.eden_leading_clause(text) IS
  'First clause of an energetics prose value, lowercased. The verdict lives here; the remainder explains it and routinely names the opposite pole.';

CREATE OR REPLACE FUNCTION public.eden_classify_temperature(value text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN value IS NULL THEN NULL
    WHEN public.eden_leading_clause(value) LIKE '%hot%'
      OR public.eden_leading_clause(value) LIKE '%warm%' THEN 'hot'
    WHEN public.eden_leading_clause(value) LIKE '%cold%'
      OR public.eden_leading_clause(value) LIKE '%cool%' THEN 'cold'
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.eden_classify_moisture(value text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN value IS NULL THEN NULL
    WHEN public.eden_leading_clause(value) LIKE '%moist%'
      OR public.eden_leading_clause(value) LIKE '%damp%'
      OR public.eden_leading_clause(value) LIKE '%mucil%'
      OR public.eden_leading_clause(value) LIKE '%demulcent%' THEN 'damp'
    WHEN public.eden_leading_clause(value) LIKE '%dry%' THEN 'dry'
    ELSE NULL
  END
$$;

-- ── Recompute the computed_energetics verdicts ────────────────────────────
-- Scoped to derivation = 'computed_energetics'. Curated rows are founder canon
-- and are never touched. surfaced and the citation columns are left alone, so
-- the Lock #43 dual-citation CHECK cannot be disturbed by this.
WITH herb_axes AS (
  SELECT h.herb_id,
         public.eden_classify_temperature(h.temperature)      AS t,
         public.eden_classify_moisture(h.moisture)            AS m,
         public.eden_classify_tone(h.tissue_states_indicated) AS tn
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
         ) AS rationale
    FROM herb_axes ha
   CROSS JOIN public.eden_patterns ep
)
UPDATE public.herbs_eden_patterns hep
   SET relationship = CASE WHEN s.rebal >= 2 THEN 'match'
                           WHEN s.aggr  >= 2 THEN 'avoid'
                           ELSE 'neutral' END,
       rebalancing_axes = s.rebal,
       aggravating_axes = s.aggr,
       rationale        = s.rationale
  FROM scored s
 WHERE hep.herb_id    = s.herb_id
   AND hep.pattern_id = s.pattern_id
   AND hep.derivation = 'computed_energetics';

commit;
