-- Founding Family check-ins: an EARLY cohort for families who bought before the sequence existed.
-- Founder 2026-10-08: "the ones who bought a while ago should be tweaked because it won't be just two
-- weeks after purchase. can we do a special sequence just for them?"
--
-- cohort 'early' = enrolled by founding_family_backfill(). Same steps, different wording (templates
-- read `early`), and one timing change: an early print family's p2 ("How was Week 1?") goes 14 days
-- after their thank-you instead of 14 days after delivery, which would otherwise land days after it.
-- p3-p5 stay anchored on delivery for everyone.

alter table public.founding_family_queue
  add column if not exists cohort text not null default 'new' check (cohort in ('new', 'early'));

drop function if exists public.founding_family_enroll(uuid, timestamptz);

create or replace function public.founding_family_enroll(
  p_order_id uuid, p_first_at timestamptz, p_cohort text default 'new')
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
    (order_id, recipient_email, first_name, band, track, step, scheduled_for, cohort)
  values (o.id, v_email, v_first, v_band, v_track,
          case v_track when 'digital' then 'd1' else 'p1' end, p_first_at, p_cohort)
  on conflict (recipient_email, step) do nothing;
  get diagnostics v_n = row_count;

  if v_track = 'digital' then
    insert into public.founding_family_queue
      (order_id, recipient_email, first_name, band, track, step, scheduled_for, cohort)
    select o.id, v_email, v_first, v_band, 'digital', s, p_first_at + public.founding_family_offset(s), p_cohort
      from unnest(array['d2','d3','d4','d5']) s
    on conflict (recipient_email, step) do nothing;
  else
    v_anchor := coalesce(o.delivered_at, o.shipped_at + interval '10 days');
    insert into public.founding_family_queue
      (order_id, recipient_email, first_name, band, track, step, scheduled_for, cohort)
    select o.id, v_email, v_first, v_band, 'print', s,
           case
             when p_cohort = 'early' and s = 'p2' and v_anchor is not null
               then greatest(v_anchor, p_first_at) + interval '14 days'
             when v_anchor is null then null
             else greatest(v_anchor + public.founding_family_offset(s), p_first_at)
           end,
           p_cohort
      from unnest(array['p2','p3','p4','p5']) s
    on conflict (recipient_email, step) do nothing;
  end if;
  return v_n;
end;
$$;

-- Re-anchor print steps on ship/delivery. An early family's p2 keeps its thank-you spacing.
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
     set scheduled_for = case
           when q.cohort = 'early' and q.step = 'p2'
             then greatest(q.scheduled_for, v_anchor + interval '14 days')
           else greatest(v_anchor + public.founding_family_offset(q.step), now())
         end,
         updated_at = now()
   where q.order_id = p_order_id and q.track = 'print'
     and q.step in ('p2','p3','p4','p5') and q.status = 'pending';
end;
$$;

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
    v_total := v_total + public.founding_family_enroll(r.id, now(), 'early');
  end loop;
  return v_total;
end;
$$;

revoke all on function public.founding_family_enroll(uuid, timestamptz, text) from public, anon, authenticated;
revoke all on function public.founding_family_reanchor(uuid) from public, anon, authenticated;
revoke all on function public.founding_family_backfill() from public, anon, authenticated;
