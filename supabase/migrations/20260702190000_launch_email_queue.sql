-- July 2026 Sprouts preorder launch sequence ("The Table Is Being Set").
-- 7-email progressive-reveal arc to the homeschool list, drained by the
-- nurture-emails Edge Function (same Vercel cron as the other queues).
--
-- Two entry paths, one queue:
--   * FIXED-DATE cohort (everyone on the list before July 9): backfilled by
--     scripts/launch-sequence-backfill.sql with the broadcast dates
--     Jul 9 / 11 / 13 / 15 / 17 / 20 / 22, 13:00 UTC (8 AM Central).
--   * LATE SUBSCRIBERS (signups from July 9 onward): the trigger below
--     enqueues the same 7 emails on a 2-day drip relative to signup
--     (+2d, +4d, ... +14d), so they experience the same arc.
--
-- NOTE (apply path): per house convention this DDL is applied to prod via the
-- Supabase dashboard SQL editor (role=postgres); the file is committed so the
-- repo stays the source of truth.

create table if not exists public.launch_email_queue (
  id uuid primary key default gen_random_uuid(),
  recipient_email   text        not null,
  first_name        text,
  sequence_position smallint    not null check (sequence_position between 1 and 7),
  scheduled_for     timestamptz not null,
  sent_at           timestamptz,
  status            text        not null default 'pending',
  error_message     text,
  retry_count       integer     not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (recipient_email, sequence_position)
);

create index if not exists idx_launch_email_queue_due
  on public.launch_email_queue (status, scheduled_for);

-- Edge functions use the service-role key (bypasses RLS). Enable RLS with no
-- public policies so the table is locked down to everyone else.
alter table public.launch_email_queue enable row level security;

-- ── Extend the global-unsubscribe cascade to the new queue ──
-- Same body as the live function (it currently cancels magnet_email_queue +
-- nurture_email_queue when waitlist_signups.unsubscribed_at flips), plus the
-- launch queue.
create or replace function public.cancel_queued_emails_on_unsubscribe()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.unsubscribed_at is not null and old.unsubscribed_at is null then
    update public.magnet_email_queue
       set status = 'cancelled',
           error_message = left(coalesce(error_message,'') ||
             ' [auto-cancelled '||now()::text||': recipient unsubscribed/bounced]', 500),
           updated_at = now()
     where status = 'pending'
       and lower(recipient_email) = lower(new.email);

    update public.nurture_email_queue
       set status = 'cancelled',
           error_message = left(coalesce(error_message,'') ||
             ' [auto-cancelled '||now()::text||': recipient unsubscribed/bounced]', 500),
           updated_at = now()
     where status = 'pending'
       and lower(recipient_email) = lower(new.email);

    update public.launch_email_queue
       set status = 'cancelled',
           error_message = left(coalesce(error_message,'') ||
             ' [auto-cancelled '||now()::text||': recipient unsubscribed/bounced]', 500),
           updated_at = now()
     where status = 'pending'
       and lower(recipient_email) = lower(new.email);
  end if;
  return new;
end;
$function$;

-- ── Late-subscriber drip: enqueue the full arc on homeschool signup ──
-- Fires on new edens_table signups (all sources: sprouts_magnet,
-- seedlings_magnet, reserve). waitlist_signups upserts only touch this on true
-- INSERTs, so re-submissions never re-enqueue; the unique constraint is a
-- second belt anyway (on conflict do nothing).
--
-- Start gate: inert before the launch-day broadcast so a signup on e.g. July 5
-- is covered by the backfill cohort instead of getting a duplicate drip.
-- SUNSET: once preorder is open and the sequence has run its course, disable
-- with:  drop trigger trg_enqueue_launch_sequence on public.waitlist_signups;
create or replace function public.enqueue_launch_sequence_on_signup()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  launch_start constant timestamptz := '2026-07-09 13:00:00+00';
begin
  if now() < launch_start then
    return new;
  end if;
  if new.entry_funnel::text <> 'edens_table' then
    return new;
  end if;
  if new.unsubscribed_at is not null then
    return new;
  end if;

  insert into public.launch_email_queue
    (recipient_email, first_name, sequence_position, scheduled_for, status)
  select
    lower(new.email),
    coalesce(nullif(trim(new.first_name), ''), 'friend'),
    pos,
    now() + (pos * interval '2 days'),
    'pending'
  from generate_series(1, 7) as pos
  on conflict (recipient_email, sequence_position) do nothing;

  return new;
end;
$function$;

drop trigger if exists trg_enqueue_launch_sequence on public.waitlist_signups;
create trigger trg_enqueue_launch_sequence
  after insert on public.waitlist_signups
  for each row
  execute function public.enqueue_launch_sequence_on_signup();
