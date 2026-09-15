-- Reliability safety nets (founder decisions 2026-09-15). Idempotent: safe to run twice.
--
-- APPLY THIS BEFORE DEPLOYING founder-broadcast, nurture-emails, founder-evening-recap or
-- lulu-webhook from the same PR. Those functions read and write the columns and tables below;
-- nurture-emails' drain query filters on next_attempt_at, so deployed first it would select
-- nothing (400 from PostgREST) until this runs.
--
--   1. broadcast_recipient_sends   per-recipient send log for founder-broadcast, so an
--                                  interrupted cohort send can be resumed without mailing
--                                  anyone twice. broadcasts.recipient_log marks broadcasts
--                                  that keep this log (older ones are never resumed).
--   2. queue backoff columns       next_attempt_at, first_failed_at, gave_up_at and
--                                  founder_alerted_at on the four nurture-emails queues, for
--                                  24 hours of exponential backoff on transient Resend errors.
--   3. recap_runs                  run claim for founder-evening-recap (retry pass 01:37 UTC),
--                                  twin of digest_runs and weekly_trends_runs.
--   4. lulu_events.founder_alerted_at   once-per-event founder alert when lulu-webhook
--                                  cannot apply a Lulu status update and answers 200 anyway.
--
-- Grants: every new table has RLS on with no policies, and all table privileges revoked from
-- public, anon and authenticated BY NAME (Supabase's default privileges grant anon and
-- authenticated explicitly, which REVOKE ... FROM PUBLIC alone does not remove), then granted
-- to service_role only. No functions are created, so there is no SECURITY DEFINER surface.

begin;

-- 1. founder-broadcast: per-recipient send log --------------------------------------------------

alter table public.broadcasts
  add column if not exists recipient_log boolean not null default false;

comment on column public.broadcasts.recipient_log is
  'True for broadcasts whose recipients are logged in broadcast_recipient_sends, which makes '
  'them resumable. Rows created before 2026-09-16 stay false and are never resumed (no record '
  'of who received them).';

create table if not exists public.broadcast_recipient_sends (
  id                uuid primary key default gen_random_uuid(),
  broadcast_id      uuid not null references public.broadcasts(id) on delete cascade,
  idempotency_key   text not null,
  order_id          uuid not null,
  recipient_email   text not null,
  status            text not null default 'sending' check (status in ('sending', 'sent')),
  claimed_at        timestamptz not null default now(),
  sent_at           timestamptz,
  resend_message_id text,
  created_at        timestamptz not null default now(),
  constraint broadcast_recipient_sends_key_email_order_key unique (idempotency_key, recipient_email, order_id),
  constraint broadcast_recipient_sends_email_lower check (recipient_email = lower(btrim(recipient_email))),
  constraint broadcast_recipient_sends_sent_has_time check (status <> 'sent' or sent_at is not null)
);

create index if not exists broadcast_recipient_sends_broadcast_idx
  on public.broadcast_recipient_sends (broadcast_id);
create index if not exists broadcast_recipient_sends_key_status_idx
  on public.broadcast_recipient_sends (idempotency_key, status);

comment on table public.broadcast_recipient_sends is
  'founder-broadcast send log. A row is claimed (sending) before the Resend call and marked sent '
  'with the Resend message id immediately after, so pressing Send again with the same message '
  'mails only orders with no sent row. Unique on (idempotency_key, recipient_email, order_id): '
  'one row per order per address per message, because a delay notice is a per-order legal notice '
  'and a buyer with two orders must get one for each. order_id is deliberately not a foreign key, '
  'so deleting an order never erases the record that it was mailed. Service role only.';

alter table public.broadcast_recipient_sends enable row level security;
revoke all on table public.broadcast_recipient_sends from public, anon, authenticated;
grant select, insert, update, delete on table public.broadcast_recipient_sends to service_role;

-- 2. nurture-emails: backoff columns on the four queues ------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['nurture_email_queue', 'magnet_email_queue', 'launch_email_queue', 'buyer_email_queue'] loop
    execute format('alter table public.%I add column if not exists next_attempt_at timestamptz', t);
    execute format('alter table public.%I add column if not exists first_failed_at timestamptz', t);
    execute format('alter table public.%I add column if not exists gave_up_at timestamptz', t);
    execute format('alter table public.%I add column if not exists founder_alerted_at timestamptz', t);
    execute format(
      'comment on column public.%I.next_attempt_at is %L', t,
      'Earliest time a pending row that failed transiently may be tried again (exponential backoff, '
      '_shared/send-backoff.ts). Null for rows that never failed. The drain skips rows still waiting.'
    );
    execute format(
      'comment on column public.%I.first_failed_at is %L', t,
      'First failed send attempt. Transient failures retry for 24 hours from here, then the row is failed.'
    );
    execute format(
      'comment on column public.%I.gave_up_at is %L', t,
      'Set when a row was failed because 24 hours of transient retries ran out (not for permanent errors). '
      'Rows with this set and founder_alerted_at null are in the next founder alert.'
    );
    execute format(
      'comment on column public.%I.founder_alerted_at is %L', t,
      'When the founder was emailed about this row giving up. Makes the alert once per row.'
    );
    -- The give-up alert reads failed rows that have not been reported yet.
    execute format(
      'create index if not exists %I on public.%I (gave_up_at) where gave_up_at is not null and founder_alerted_at is null',
      t || '_gave_up_unalerted_idx', t
    );
  end loop;
end
$$;

-- 3. founder-evening-recap: run claim ------------------------------------------------------------

create table if not exists public.recap_runs (
  id            uuid primary key default gen_random_uuid(),
  recap_date    date not null unique,
  status        text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  triggered_at  timestamptz not null default now(),
  completed_at  timestamptz,
  resend_id     text,
  error_message text,
  created_at    timestamptz not null default now()
);

comment on table public.recap_runs is
  'Run claim for the scheduled founder evening recap, one row per Central-time day. The 01:00 UTC '
  'run and the 01:37 UTC retry pass both claim it through _shared/digest-run-claim.ts: sent is '
  'skipped, failed or a stale pending row is taken over. A manual {"date"} re-send does not use it. '
  'Service role only.';

alter table public.recap_runs enable row level security;
revoke all on table public.recap_runs from public, anon, authenticated;
grant select, insert, update, delete on table public.recap_runs to service_role;

-- 4. lulu-webhook: once-per-event founder alert --------------------------------------------------

alter table public.lulu_events
  add column if not exists founder_alerted_at timestamptz;

comment on column public.lulu_events.founder_alerted_at is
  'When the founder was emailed that this Lulu event could not be applied (the webhook still '
  'answered 200 so Lulu keeps it active). Claimed with a conditional update so it is sent once.';

-- Assertions: abort the whole migration if a new table is reachable by anon or authenticated.
do $$
declare
  t text;
  r text;
begin
  foreach t in array array['public.broadcast_recipient_sends', 'public.recap_runs'] loop
    if not (select relrowsecurity from pg_class where oid = t::regclass) then
      raise exception 'RLS is not enabled on %', t;
    end if;
    foreach r in array array['anon', 'authenticated'] loop
      if has_table_privilege(r, t, 'SELECT') or has_table_privilege(r, t, 'INSERT')
        or has_table_privilege(r, t, 'UPDATE') or has_table_privilege(r, t, 'DELETE') then
        raise exception '% still has a privilege on %', r, t;
      end if;
    end loop;
    if not has_table_privilege('service_role', t, 'INSERT') then
      raise exception 'service_role cannot write %', t;
    end if;
  end loop;
end
$$;

commit;
