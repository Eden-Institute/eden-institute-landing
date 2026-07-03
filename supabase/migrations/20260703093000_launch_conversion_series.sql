-- Preorder conversion series (launch sequence positions 8-17).
-- Ships with PR #227: apply this WITH the preorder go-live deploy set, since
-- the cancel trigger references public.orders (created by 20260630120000).
--
-- Ten persistence emails enqueued for the whole homeschool list by
-- scripts/launch-day-blast.sql the moment preorder opens. They PERSIST until
-- a family preorders and STOP as soon as they do:
--   * this trigger cancels the remaining pending 8-17 rows at purchase time;
--   * the nurture-emails drainer double-checks orders before each 8-17 send.

-- 1. Widen the position check (was 1-7 for the vision arc).
alter table public.launch_email_queue
  drop constraint if exists launch_email_queue_sequence_position_check;
alter table public.launch_email_queue
  add constraint launch_email_queue_sequence_position_check
  check (sequence_position between 1 and 17);

-- 2. Stop the conversion series at purchase. Any order that is not
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
       and sequence_position >= 8
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
