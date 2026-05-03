-- v4.3.3 — Canonicalize herbs.status drift.
--
-- Audit found 99 rows with status='Approved' (TitleCase) and 9 rows with
-- status='active' (lowercase). Same meaning, two values. The herbs_directory_v
-- view evidently accepts both shapes (production renders Rehmannia alongside
-- Approved-status herbs), but two-value status is brittle:
--   • Any future query that filters on a single literal value silently drops
--     rows from the other bucket
--   • RLS policies that filter on status will need to enumerate both values
--   • SQL audits comparing herb counts will return inconsistent numbers
--
-- Canonicalize the 9 'active' rows to 'Approved'. Idempotent: re-running
-- this migration matches nothing and passes through.
--
-- Affected herbs (per pre-migration audit, 2026-05-02):
--   Bayberry          (Myrica cerifera)
--   Black Pepper      (Piper nigrum)
--   Cramp Bark        (Viburnum opulus)
--   Hibiscus          (Hibiscus sabdariffa)
--   Juniper Berry     (Juniperus communis)
--   Prickly Ash       (Zanthoxylum americanum)
--   Rehmannia         (Rehmannia glutinosa)
--   Shatavari         (Asparagus racemosus)
--   White Oak Bark    (Quercus alba)

BEGIN;

UPDATE public.herbs
SET status = 'Approved',
    last_updated = now()
WHERE status = 'active';

-- Schema_migrations register-INSERT (per Lock #15 + migration tracking memory).
INSERT INTO public.schema_migrations (version, statements, name)
VALUES (
  '20260502160000',
  ARRAY['-- canonicalize herbs.status: active → Approved'],
  'v4_3_3_canonicalize_herb_status'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
