-- Curriculum finder (2026-11-19): "what moms say" per curriculum (Camila asked for pros and cons
-- "based on what most moms say on unbiased reviews"). Researched from independent reviews (Cathy Duffy,
-- Well-Trained Mind forums, Homeschool Reviews, independent blogs; never publisher testimonials),
-- 2-3 cited sources each; mom_note flags thin, old or free-copy evidence.
alter table public.wired_curricula
  add column if not exists mom_pros    text[] not null default '{}',
  add column if not exists mom_cons    text[] not null default '{}',
  add column if not exists mom_sources jsonb  not null default '[]'::jsonb,
  add column if not exists mom_note    text,
  add column if not exists mom_checked date;
