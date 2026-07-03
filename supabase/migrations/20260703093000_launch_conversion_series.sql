-- Preorder conversion series (launch sequence positions 8-17).
-- Ships with PR #227: apply this WITH the preorder go-live deploy set, since
-- the cancel trigger references public.orders (created by 20260630120000).
--
-- Ten persistence emails enqueued for the whole homeschool list by
-- scripts/launch-day-blast.sql the moment preorder opens. They PERSIST until
-- a family preorders and STOP as soon as they do:
--   * the trigger below cancels ALL remaining pending launch rows (1-17) at
--     purchase time; a buyer should not get "the doors are about to open";
--   * the nurture-emails drainer double-checks orders before every send.
--
-- Copy phase: while the founding gate is open (fewer than
-- products.founding_qty_limit founding sprouts_kit line-items sold, the same
-- rule create-checkout enforces) the 8-17 copy carries the $249 founding
-- offer. Once the 500 fill, the drainer automatically switches every
-- remaining send to the retail variant: no "founding" language, $349 flat.
-- No manual action needed at sellout.

-- 1. Widen the position check (was 1-7 for the vision arc).
alter table public.launch_email_queue
  drop constraint if exists launch_email_queue_sequence_position_check;
alter table public.launch_email_queue
  add constraint launch_email_queue_sequence_position_check
  check (sequence_position between 1 and 17);

-- 2. Stop ALL launch emails at purchase. Any order that is not
-- cancelled/refunded counts as a preorder. Fires on INSERT: an order row is
-- created at checkout completion, which is exactly the stop moment.
create or replace function public.cancel_launch_emails_on_order()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.status not in ('cancelled', 'refunded') then
    update public.launch_email_queue
       set status = 'cancelled',
           error_message = left(coalesce(error_message,'') ||
             ' [auto-cancelled '||now()::text||': recipient preordered]', 500),
           updated_at = now()
     where status = 'pending'
       and lower(recipient_email) = lower(new.customer_email);
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_cancel_launch_emails_on_order on public.orders;
create trigger trg_cancel_launch_emails_on_order
  after insert on public.orders
  for each row
  execute function public.cancel_launch_emails_on_order();

-- 3. Extend the signup drip to the FULL 17-email journey. Supersedes the
-- 1-7 version applied with migration 20260702190000: a mid-window signup
-- gets the vision arc on the same 2-day cadence (days 2-14), then rolls
-- straight into the conversion series (day 16 onward, same spacing the
-- launch cohort gets). Purchase-suppression stops everything pending the
-- moment they preorder, and the founding/retail copy variant is decided at
-- SEND time by the drainer, so a signup that straddles the sellout gets the
-- right offer automatically.
-- SUNSET (when preorder closes entirely):
--   drop trigger trg_enqueue_launch_sequence on public.waitlist_signups;
create or replace function public.enqueue_launch_sequence_on_signup()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  launch_start constant timestamptz := '2026-07-03 00:00:00+00';
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
    s.pos,
    now() + (s.day_offset * interval '1 day'),
    'pending'
  from (values
    -- vision arc: every 2 days
    (1, 2), (2, 4), (3, 6), (4, 8), (5, 10), (6, 12), (7, 14),
    -- conversion series: rolls on 2 days after Email 7, launch-cohort spacing
    (8, 16), (9, 18), (10, 20), (11, 23), (12, 26),
    (13, 29), (14, 32), (15, 36), (16, 40), (17, 44)
  ) as s(pos, day_offset)
  on conflict (recipient_email, sequence_position) do nothing;

  return new;
end;
$function$;

drop trigger if exists trg_enqueue_launch_sequence on public.waitlist_signups;
create trigger trg_enqueue_launch_sequence
  after insert on public.waitlist_signups
  for each row
  execute function public.enqueue_launch_sequence_on_signup();
