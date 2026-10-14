-- 2026-10-14, founder decision: list emails move to Resend Broadcasts. A Broadcast skips a
-- contact only when Resend's own `unsubscribed` flag is true, so every opt-out held in Postgres
-- (waitlist_signups.unsubscribed_at, email_list_unsubscribes list 'homeschool') is pushed to
-- Resend once by contact-properties-sync (mode sync_unsubscribes, plus a nightly pass). This
-- table records each push so it is done once. Service role only: RLS on, no policies.
create table if not exists public.resend_unsubscribe_sync (
  email text primary key,
  status text not null check (status in ('ok', 'absent', 'failed')),
  http_status integer,
  error text,
  synced_at timestamptz not null default now()
);

alter table public.resend_unsubscribe_sync enable row level security;

comment on table public.resend_unsubscribe_sync is
  'One row per opt-out pushed to Resend as unsubscribed:true by contact-properties-sync (ok), or found absent from Resend (absent), or failed and retried next run (failed). Service role only.';
