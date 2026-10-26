-- Starter Unit: Eden's own record of a buyer first reaching their files (2026-10-26).
--
-- WHY. The delivery email says the Starter Unit is not refundable once the files
-- have been downloaded. Until now the only sign that a buyer had opened their
-- downloads was Resend's click tracking on the email link, and that tracking is
-- being turned off for delivery mail (punch #25: privacy-first inboxes such as
-- Proton block tracked links). These two columns are first-party instead. Both
-- are written by starter-download and both are SET ONCE: the first value stays,
-- and later visits never move it.
--
--   first_opened_at      the first time /starter/downloads (the ?t= link in the
--                        delivery email) served this buyer their file links. The
--                        thank-you page, which every buyer sees seconds after
--                        paying, does not set it.
--   first_downloaded_at  the first time the buyer tapped a file, on the downloads
--                        page or the thank-you page. The file buttons go through
--                        starter-download's ?f= redirect so the tap is seen.
--
-- Rows from before this migration stay NULL. Nothing recorded either event then,
-- so NULL on an older row means "not recorded", not "never opened", and a
-- back-filled guess would read as evidence. Their history is still in
-- starter_delivery_attempts and in the Resend click events in email_events.
--
-- No new table, so no new grants: the existing table grants cover new columns.
-- Idempotent: every statement can be re-run.

alter table public.starter_deliveries
  add column if not exists first_opened_at timestamptz;

alter table public.starter_deliveries
  add column if not exists first_downloaded_at timestamptz;

comment on column public.starter_deliveries.first_opened_at is
  'First time /starter/downloads (the ?t= email link) served this buyer their file links. Set once by starter-download, never overwritten. NULL on rows delivered before 2026-10-26 means not recorded.';

comment on column public.starter_deliveries.first_downloaded_at is
  'First tap on a file (starter-download ?f= redirect), from the downloads page or the thank-you page. Set once, never overwritten. NULL on rows delivered before 2026-10-26 means not recorded.';
