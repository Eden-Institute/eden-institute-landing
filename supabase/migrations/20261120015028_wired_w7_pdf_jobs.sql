-- Fearfully & Wonderfully Wired, W7: wired-pdf claims one job at a time; claimed_at lets a run
-- pick up a job a crashed run left in 'building' (after 15 minutes).
alter table public.wired_pdf_jobs add column if not exists claimed_at timestamptz;
