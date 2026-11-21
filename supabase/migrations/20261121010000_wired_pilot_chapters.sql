-- 2026-11-20, Wired quiz W12 (Lane 2b): the pilot's advance chapters, from PRIVATE storage (Camila's tap
-- 2026-11-20 "Private Eden storage": expiring links like the Starter Unit, never public). Applied only on her tap.
-- DARK: nothing reaches a family until WIRED_PILOT_OPEN is "true".
--
-- 1. Bucket pilot-chapters: private (no public URL; no policies, so only the service role can read or write).
--    Holds chapter-1.pdf and, after her read, chapter-4.pdf. wired-pilot signs a 1-hour view link per tap.
-- 2. wired_pilot_progress.ch1_emailed_at / ch4_emailed_at: the chapter-ready email went (once per chapter).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pilot-chapters', 'pilot-chapters', false, 10485760, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

alter table public.wired_pilot_progress
  add column if not exists ch1_emailed_at timestamptz,
  add column if not exists ch4_emailed_at timestamptz;
