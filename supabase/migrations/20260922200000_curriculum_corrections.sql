-- Curriculum corrections reported by families from /homeschool/updates.
--
-- The printed books point readers at edeninstitute.health/homeschool/updates twice
-- ("we keep a single page current with any corrections to this guide", and the
-- sourcing-links line on the affiliate page), so the page has to exist and the
-- report has to land somewhere durable. This table is that somewhere: source of
-- truth, with the email to hello@ as best-effort enrichment, the same shape as
-- partner_inquiries and feedback_submissions.
--
-- Deliberately NOT the app's feedback_submissions rail: its areas are Apothecary
-- surfaces (quiz, herb directory, formulary, patient notes) and its notification
-- is branded "Eden Apothecary Feedback". A typo on Week 12 Thursday is not an app bug.
--
-- Page structure behind `location`, measured from the real Lulu print files on
-- 2026-09-22, not assumed:
--   Teacher's Guide  240pp = 12 front + (36 weeks x 6: Week at a Glance, Mon-Fri) + 12 back
--   Student Notebook 224pp =  2 front + (36 weeks x 6: Mon-Fri, My Wonder Pages) +  6 back
--   Read-Aloud       112pp, straight page numbers, so it reports a page number instead.
create table if not exists public.curriculum_corrections (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  band           text not null check (band in ('sprouts', 'seedlings')),
  book           text not null check (book in ('tg', 'nb', 'ra')),
  -- null when the report is about front matter, back matter or a cover
  week           integer check (week is null or (week between 1 and 36)),
  location       text not null check (location in (
                   'wag', 'mon', 'tue', 'wed', 'thu', 'fri', 'wonder',
                   'page', 'front', 'back', 'cover', 'other')),
  -- Read-Aloud page number, or any page the reader can cite. 999 is a ceiling, not a spec.
  page_number    integer check (page_number is null or (page_number between 1 and 999)),
  description    text not null,
  reporter_name  text,
  reporter_email text,
  page_url       text,
  user_agent     text,
  -- 'published' is what puts a row on the corrections list; nothing is published automatically.
  status         text not null default 'new'
                 check (status in ('new', 'confirmed', 'published', 'not_an_error')),
  founder_note   text,
  published_at   timestamptz
);

alter table public.curriculum_corrections enable row level security;
-- Deliberately no policies: written only by submit-curriculum-correction with the
-- service role, and read with the service role. Anon and authenticated get nothing.

create index if not exists curriculum_corrections_triage_idx
  on public.curriculum_corrections (status, created_at desc);
create index if not exists curriculum_corrections_book_idx
  on public.curriculum_corrections (band, book, week);
