-- Founding Family check-ins: personal emails from Camila to every Starter Unit and printed-set buyer.
-- 2026-10-08, founder spec. Copy: Biblical Herbalism/Eden's Table (Homeschool Curriculum)/Projects/
-- Email Journeys and Nurture/Founding_Family_Sequences_2026-10-08.docx (founder approves before send).
--
--   digital (Starter Unit): d1 next day, d2 +2 weeks, d3 +2 months, d4 +4 months, d5 +6 months
--   print (printed set):    p1 next day; p2 +2 weeks, p3 +2 months, p4 +4 months, p5 +6 months
--                           counted from DELIVERY. Until Lulu reports delivery they are provisionally
--                           counted from shipped_at + 10 days, and re-anchored the moment delivered_at lands.
--   (The shipped and delivered emails themselves stay in order-messages.ts.)
--
-- Rules from the founder:
--   * Replies do NOT stop the sequence (founder 2026-10-08: "I would like the founding families to get
--     all of them whether or not they respond. This is a great way to keep in touch"). The scan lists
--     who replied (scripts/founding_family_replies.py) so Camila answers them personally.
--     founding_family_stop() exists only for a manual stop the founder asks for.
--   * The Founding 50 group invite in d1/p1 drops out once the group reaches 50 members
--     (founding_family_settings.group_invite_open, flipped by the wrap check).
--   * Nothing sends until founding_family_settings.sending_enabled is true (founder copy approval).
--   * A Starter family who later buys a printed set moves to the print track; nobody gets both.
-- One sequence per address: the unique (recipient_email, step) makes a second Starter order a no-op.
--
-- Security: RLS on, no policies; the drainer uses the service role.

create table if not exists public.founding_family_settings (
  id                boolean primary key default true check (id),
  sending_enabled   boolean not null default false,
  group_invite_open boolean not null default true,
  updated_at        timestamptz not null default now()
);
insert into public.founding_family_settings (id) values (true) on conflict (id) do nothing;
alter table public.founding_family_settings enable row level security;

create table if not exists public.founding_family_queue (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders(id) on delete cascade,
  recipient_email  text not null,
  first_name       text,
  band             text not null,              -- 'Sprouts' | 'Seedlings' | 'Sprouts and Seedlings'
  track            text not null check (track in ('digital', 'print')),
  step             text not null check (step in ('d1','d2','d3','d4','d5','p1','p2','p3','p4','p5')),
  scheduled_for    timestamptz,                -- null = print step waiting for a ship/delivery date
  status           text not null default 'pending'
                   check (status in ('pending', 'sent', 'cancelled', 'failed')),
  sent_at          timestamptz,
  error_message    text,
  retry_count      integer not null default 0,
  next_attempt_at  timestamptz,
  first_failed_at  timestamptz,
  gave_up_at       timestamptz,
  founder_alerted_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (recipient_email, step)
);
alter table public.founding_family_queue enable row level security;
create index if not exists founding_family_queue_due_idx
  on public.founding_family_queue (scheduled_for) where status = 'pending';

-- ------------------------------------------------------------ helpers
create or replace function public.founding_family_track(p_lookup_key text)
returns text language sql immutable as $$
  select case
    when p_lookup_key in ('sprouts_starter_unit', 'seedlings_starter_unit') then 'digital'
    when p_lookup_key in ('sprouts_print_set', 'seedlings_print_set', 'both_bands_print_set') then 'print'
  end
$$;

create or replace function public.founding_family_band(p_lookup_key text)
returns text language sql immutable as $$
  select case
    when p_lookup_key like 'both_bands%' then 'Sprouts and Seedlings'
    when p_lookup_key like 'seedlings%' then 'Seedlings'
    else 'Sprouts'
  end
$$;

-- Steps after the first, as offsets from their anchor (enrollment for digital, delivery for print).
create or replace function public.founding_family_offset(p_step text)
returns interval language sql immutable as $$
  select case p_step
    when 'd2' then interval '14 days'
    when 'd3' then interval '2 months'
    when 'd4' then interval '4 months'
    when 'd5' then interval '6 months'
    when 'p2' then interval '14 days'
    when 'p3' then interval '2 months'
    when 'p4' then interval '4 months'
    when 'p5' then interval '6 months'
  end
$$;

-- Enroll one order. p_first_at = when d1/p1 goes out. Used by the order trigger (next day) and by
-- the one-time backfill (now). Skips test and internal orders.
create or replace function public.founding_family_enroll(p_order_id uuid, p_first_at timestamptz)
returns integer
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  o public.orders%rowtype;
  v_track text; v_band text; v_email text; v_first text; v_n integer := 0;
  v_anchor timestamptz;
begin
  select * into o from public.orders where id = p_order_id;
  if not found then return 0; end if;
  v_track := public.founding_family_track(o.lookup_key);
  if v_track is null then return 0; end if;
  if o.status::text in ('cancelled', 'refunded') then return 0; end if;
  v_email := lower(btrim(coalesce(o.customer_email, '')));
  if v_email = '' or v_email = 'hello@edeninstitute.health' then return 0; end if;
  if o.raw->'metadata'->>'e2e_test' is not null then return 0; end if;
  if public.is_internal_tester(v_email) then return 0; end if;

  v_band  := public.founding_family_band(o.lookup_key);
  -- Digital orders have no shipping name; fall back to the name typed at Stripe checkout.
  v_first := nullif(btrim(split_part(coalesce(nullif(btrim(o.shipping_name), ''),
                                             o.raw->'customer_details'->>'name', ''), ' ', 1)), '');
  if v_first is not null then v_first := upper(left(v_first, 1)) || substr(v_first, 2); end if;

  if v_track = 'print' then
    -- A Starter family moving up: their remaining digital check-ins stop.
    update public.founding_family_queue
       set status = 'cancelled', error_message = 'moved to print track', updated_at = now()
     where recipient_email = v_email and track = 'digital' and status = 'pending';
  elsif exists (select 1 from public.founding_family_queue
                 where recipient_email = v_email and track = 'print') then
    return 0;   -- already on the print track; a Starter purchase adds nothing
  end if;

  insert into public.founding_family_queue
    (order_id, recipient_email, first_name, band, track, step, scheduled_for)
  values (o.id, v_email, v_first, v_band, v_track,
          case v_track when 'digital' then 'd1' else 'p1' end, p_first_at)
  on conflict (recipient_email, step) do nothing;
  get diagnostics v_n = row_count;

  if v_track = 'digital' then
    insert into public.founding_family_queue
      (order_id, recipient_email, first_name, band, track, step, scheduled_for)
    select o.id, v_email, v_first, v_band, 'digital', s, p_first_at + public.founding_family_offset(s)
      from unnest(array['d2','d3','d4','d5']) s
    on conflict (recipient_email, step) do nothing;
  else
    v_anchor := coalesce(o.delivered_at, o.shipped_at + interval '10 days');
    insert into public.founding_family_queue
      (order_id, recipient_email, first_name, band, track, step, scheduled_for)
    select o.id, v_email, v_first, v_band, 'print', s,
           case when v_anchor is null then null
                else greatest(v_anchor + public.founding_family_offset(s), p_first_at) end
      from unnest(array['p2','p3','p4','p5']) s
    on conflict (recipient_email, step) do nothing;
  end if;
  return v_n;
end;
$$;

-- Re-anchor print steps p2-p5 when an order ships (provisional) or is delivered (final).
create or replace function public.founding_family_reanchor(p_order_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare o public.orders%rowtype; v_anchor timestamptz;
begin
  select * into o from public.orders where id = p_order_id;
  if not found then return; end if;
  v_anchor := coalesce(o.delivered_at, o.shipped_at + interval '10 days');
  if v_anchor is null then return; end if;
  update public.founding_family_queue q
     set scheduled_for = greatest(v_anchor + public.founding_family_offset(q.step), now()),
         updated_at = now()
   where q.order_id = p_order_id and q.track = 'print'
     and q.step in ('p2','p3','p4','p5') and q.status = 'pending';
end;
$$;

-- Stop every remaining email for one family. MANUAL ONLY, when the founder asks (not on reply).
create or replace function public.founding_family_stop(p_email text, p_reason text)
returns integer
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_n integer;
begin
  update public.founding_family_queue
     set status = 'cancelled', error_message = left(coalesce(p_reason, 'stopped'), 300), updated_at = now()
   where recipient_email = lower(btrim(p_email)) and status = 'pending';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ------------------------------------------------------------ triggers
create or replace function public.trg_founding_family_on_order()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  -- Never let a check-in problem block an order write (stripe-webhook inserts here).
  begin
  if tg_op = 'INSERT' then
    perform public.founding_family_enroll(new.id, now() + interval '1 day');
  else
    if new.status::text in ('cancelled', 'refunded') and old.status is distinct from new.status then
      update public.founding_family_queue
         set status = 'cancelled', error_message = 'order ' || new.status::text, updated_at = now()
       where order_id = new.id and status = 'pending';
    elsif (new.shipped_at is distinct from old.shipped_at)
       or (new.delivered_at is distinct from old.delivered_at) then
      perform public.founding_family_reanchor(new.id);
    end if;
  end if;
  exception when others then
    raise warning 'founding_family trigger skipped order %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists trg_founding_family_on_order on public.orders;
create trigger trg_founding_family_on_order
  after insert or update of status, shipped_at, delivered_at on public.orders
  for each row execute function public.trg_founding_family_on_order();

-- ------------------------------------------------------------ one-time backfill
-- Founder 2026-10-08: everyone who already bought starts fresh the day sending is switched on.
-- Run once, at switch-on: select public.founding_family_backfill();
create or replace function public.founding_family_backfill()
returns integer
language plpgsql security definer set search_path = public, pg_temp
as $$
declare r record; v_total integer := 0;
begin
  for r in
    select o.id from public.orders o
     where public.founding_family_track(o.lookup_key) is not null
       and o.status::text not in ('cancelled', 'refunded')
       and not exists (select 1 from public.payments p
                        where p.stripe_payment_intent_id = o.raw->>'payment_intent' and p.is_internal)
     order by o.created_at
  loop
    v_total := v_total + public.founding_family_enroll(r.id, now());
  end loop;
  return v_total;
end;
$$;

revoke all on function public.founding_family_enroll(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.founding_family_reanchor(uuid) from public, anon, authenticated;
revoke all on function public.founding_family_stop(text, text) from public, anon, authenticated;
revoke all on function public.founding_family_backfill() from public, anon, authenticated;
grant execute on function public.founding_family_stop(text, text) to service_role;
