-- Practitioner buildout Phase 0 (TL-1): one home per framework lens.
-- constitutions C08–C10 (Ayurvedic) and C11–C18 (TCM) triple-encode
-- frameworks that already have authoritative homes (doshas, tcm_patterns).
-- Per the Decisions Ledger they are FROZEN, not deleted: existing
-- herbs_constitutions rows keep their FK targets (Phase 1 reconciles the
-- junction data into the one-home bridges), but the rows are flagged
-- deprecated and excluded from the Western read-view every new surface uses.
-- After this migration the four lens homes are:
--   Eden      → eden_patterns
--   Western   → constitutions C01–C07 (via western_temperaments_v)
--   Ayurveda  → doshas
--   TCM       → tcm_patterns

ALTER TABLE public.constitutions
  ADD COLUMN IF NOT EXISTS deprecated boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.constitutions.deprecated IS
  'TL-1 one-home-per-lens freeze (2026-07-09): true for C08–C18 (Ayurvedic/TCM duplication — doshas and tcm_patterns are the authoritative homes). Frozen rows stay for FK integrity of legacy herbs_constitutions data; no new surface may read them.';

UPDATE public.constitutions
   SET deprecated = true
 WHERE system IN ('Ayurvedic', 'TCM');

-- Western lens read-view: the non-deprecated Western temperaments only.
CREATE OR REPLACE VIEW public.western_temperaments_v
WITH (security_invoker = on) AS
  SELECT constitution_id, name, description
    FROM public.constitutions
   WHERE system = 'Western'
     AND deprecated = false;

COMMENT ON VIEW public.western_temperaments_v IS
  'The Western humoral/temperament lens home (TL-1): constitutions C01–C07. New surfaces read this view, never the base table, so the frozen C08–C18 rows cannot leak into a lens picker.';
