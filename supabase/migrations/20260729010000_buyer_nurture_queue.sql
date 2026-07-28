-- Buyer nurture sequence: keep preorder buyers warm across the wait.
--
-- THE PROBLEM. A family pays $249 in July for a kit that ships early November.
-- Today they receive exactly one email, the preorder confirmation, and then
-- nothing until a shipping status change. That is roughly fourteen weeks of
-- silence after the largest single purchase most of these families will make
-- for their school year. Silence after payment is how buyer's remorse forms,
-- and under the FTC Mail Order Rule they may cancel for a full refund any time
-- before the kit ships, so the cost of that silence is refunds.
--
-- WHY A SEPARATE QUEUE. launch_email_queue is purchase-SUPPRESSED by design:
-- the moment an order lands, every pending launch row for that address is
-- cancelled. Buyers therefore fall out of the only sequence we have. This queue
-- is the other half of that switch, and it is keyed by ORDER rather than by
-- email so a family who buys twice does not get two overlapping sequences from
-- one address and does not silently lose the second.
--
-- SCOPE. Preorders only (is_preorder = true). A deep-dive guide buyer is not
-- waiting on a print run and has nothing to be nurtured through.

create table if not exists public.buyer_email_queue (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders(id) on delete cascade,
  recipient_email   text not null,
  first_name        text,
  sequence_position smallint not null,
  scheduled_for     timestamptz not null,
  sent_at           timestamptz,
  status            text not null default 'pending',
  error_message     text,
  retry_count       integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint buyer_email_queue_position_unique unique (order_id, sequence_position),
  constraint buyer_email_queue_status_check
    check (status in ('pending', 'sent', 'failed', 'cancelled'))
);

create index if not exists buyer_email_queue_due_idx
  on public.buyer_email_queue (scheduled_for)
  where status = 'pending';

create index if not exists buyer_email_queue_order_idx
  on public.buyer_email_queue (order_id);

comment on table public.buyer_email_queue is
  'Post-purchase nurture for preorder buyers. Drained by the nurture-emails edge function.';

alter table public.buyer_email_queue enable row level security;

create trigger buyer_email_queue_updated_at
  before update on public.buyer_email_queue
  for each row execute function public.set_updated_at();

-- ── Enqueue on purchase ───────────────────────────────────────────────────
-- Day offsets are deliberately front-loaded and then widened. The anxious
-- stretch is the first fortnight, when the card charge is fresh and the box is
-- not; by October the relationship is established and a monthly touch is
-- plenty. 3 / 14 / 30 / 50 / 75 / 95 lands the last one shortly before the
-- early-November target with the shipping notification behind it.
create or replace function public.enqueue_buyer_sequence_on_order()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.is_preorder is not true then
    return new;
  end if;
  if new.status in ('cancelled', 'refunded') then
    return new;
  end if;
  if new.customer_email is null or btrim(new.customer_email) = '' then
    return new;
  end if;

  insert into public.buyer_email_queue
    (order_id, recipient_email, first_name, sequence_position, scheduled_for, status)
  select
    new.id,
    lower(new.customer_email),
    coalesce(nullif(btrim(split_part(coalesce(new.shipping_name, ''), ' ', 1)), ''), 'friend'),
    s.pos,
    now() + (s.day_offset * interval '1 day'),
    'pending'
  from (values
    (1, 3), (2, 14), (3, 30), (4, 50), (5, 75), (6, 95)
  ) as s(pos, day_offset)
  on conflict (order_id, sequence_position) do nothing;

  return new;
end;
$function$;

drop trigger if exists trg_enqueue_buyer_sequence on public.orders;
create trigger trg_enqueue_buyer_sequence
  after insert on public.orders
  for each row execute function public.enqueue_buyer_sequence_on_order();

-- ── Stop it if the order dies ─────────────────────────────────────────────
-- A refunded or cancelled buyer must never receive another "your kit is on its
-- way" email. The drainer re-checks order status at send time as well, so this
-- is defence in depth rather than the only guard.
create or replace function public.cancel_buyer_sequence_on_order_death()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.status in ('cancelled', 'refunded')
     and (old.status is distinct from new.status) then
    update public.buyer_email_queue
       set status        = 'cancelled',
           error_message = 'order ' || new.status,
           updated_at    = now()
     where order_id = new.id
       and status = 'pending';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_cancel_buyer_sequence on public.orders;
create trigger trg_cancel_buyer_sequence
  after update of status on public.orders
  for each row execute function public.cancel_buyer_sequence_on_order_death();
