-- Add the Read-Aloud storybook to the paid Starter Unit (founder decision 2026-08-26).
--
-- The Starter Unit shipped with two files, the Teacher's Guide and the Student
-- Notebook. It now carries three: the six-week Read-Aloud storybook is included as
-- well. It is the SAME file the founding partners receive, holding the stories that
-- cover weeks 1 to 6 rather than the full 36-week book (confirmed with Camila, not
-- inferred from the filename).
--
-- The three printed card sets remain print-exclusive and the copy on /starter still
-- says so, which stays true: a storybook is read aloud from a screen perfectly well,
-- and a field card is not.
--
-- NULLABLE and no backfill, deliberately. A delivery created before this migration
-- has no stamped Read-Aloud, and starter-fulfillment now stamps each of the three
-- files INDEPENDENTLY when its path is null. So the existing order self-heals on its
-- next fulfilment pass rather than needing a data migration: re-queue it by setting
-- status back to 'pending' and the drain picks it up.
alter table public.starter_deliveries
  add column if not exists ra_object_path text;

comment on column public.starter_deliveries.ra_object_path is
  'Storage path of the buyer''s stamped Read-Aloud storybook. Null until stamped; '
  'stamped independently of the other two files so pre-existing deliveries self-heal.';
