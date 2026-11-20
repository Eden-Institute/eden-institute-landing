-- 2026-11-20, Wired quiz W8 (Lane 2b). Camila's go for W8 via Lane NP 11:08; applied only on her own tap.
--
-- 1. public.nurture_send_log: the one-Eden-nurture-email-a-day guard (spec section 11, answer 5).
--    One row per address per Central calendar day (unique email_lower + sent_on). The shared send
--    function claims the day right before calling Resend and releases it if the send fails
--    (_shared/send-day-guard.ts). Read and written by nurture-emails (every drip queue) and the wired
--    learner drain. Email 1 and transactional emails are exempt (never logged). Friday Broadcasts do not
--    count. Service role only. A wired data deletion (W9) purges that address's rows (answer 10).
-- 2. The global unsubscribe/bounce trigger also stops every unsent wired_email_queue row for that
--    address (answer 6: a global unsubscribe cancels everything).
-- 3. A 'learner' opt-out (email_list_unsubscribes.list = 'learner') stops that address's unsent learner
--    emails (drip + july). Transactional kinds (observer invite/reminder, teen-ready, updated PDF) are
--    not on a list and keep going. The drains also check public.email_send_blocked at send time.

-- ── 1. nurture_send_log ────────────────────────────────────────────────────
create table if not exists public.nurture_send_log (
  id           uuid primary key default gen_random_uuid(),
  email_lower  text not null check (email_lower = lower(trim(email_lower)) and email_lower <> ''),
  sent_on      date not null,
  source       text not null,
  queue_row_id uuid not null,
  created_at   timestamptz not null default now()
);
create unique index if not exists nurture_send_log_one_a_day on public.nurture_send_log (email_lower, sent_on);
create index if not exists nurture_send_log_row_idx on public.nurture_send_log (queue_row_id);
alter table public.nurture_send_log enable row level security;
revoke all on table public.nurture_send_log from anon, authenticated;
grant select, insert, update, delete on table public.nurture_send_log to service_role;

-- ── 2. global unsubscribe / bounce: the wired queue too ────────────────────
-- Body = live definition (pg_get_functiondef 2026-11-20) plus the marked NEW block.
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

    update public.followup_email_queue
       set status = 'cancelled',
           error_message = left(coalesce(error_message,'') ||
             ' [auto-cancelled '||now()::text||': recipient unsubscribed/bounced]', 500),
           updated_at = now()
     where status = 'pending'
       and lower(recipient_email) = lower(new.email);

    -- NEW 2026-11-20 (W8): every unsent wired email for this address, learner and transactional.
    update public.wired_email_queue
       set skipped_reason = 'unsubscribed_or_bounced'
     where sent_at is null and failed_at is null and skipped_reason is null
       and lower(email) = lower(new.email);
  end if;
  return new;
end;
$function$;

-- ── 3. a 'learner' opt-out stops the unsent learner emails ─────────────────
create or replace function public.cancel_wired_learner_on_list_unsubscribe()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.list = 'learner' and new.unsubscribed_at is not null then
    update public.wired_email_queue
       set skipped_reason = 'learner_unsubscribed'
     where sent_at is null and failed_at is null and skipped_reason is null
       and kind in ('drip', 'july')
       and created_at <= new.unsubscribed_at
       and lower(email) = lower(trim(new.email));
  end if;
  return new;
end;
$function$;
revoke all on function public.cancel_wired_learner_on_list_unsubscribe() from public, anon, authenticated;

drop trigger if exists trg_cancel_wired_learner_on_list_unsubscribe on public.email_list_unsubscribes;
create trigger trg_cancel_wired_learner_on_list_unsubscribe
  after insert or update of unsubscribed_at on public.email_list_unsubscribes
  for each row execute function public.cancel_wired_learner_on_list_unsubscribe();
