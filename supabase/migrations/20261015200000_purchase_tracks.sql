-- 2026-10-15, founder rule "every event gets 3 or 4 emails, then everyone is on the shared
-- Friday list" (plan: Eden's Table > Projects > Email Journeys and Nurture >
-- Email_Lifecycle_Plan_2026-10-15, section 2, the rest). Copy approved in her inbox 2026-10-15
-- (scripts/email_proofs/2026-10-15 in the ops folder, README "the rest of plan section 2").
--
-- Six purchase tracks on public.followup_email_queue (the 20261015170000 queue, drained by
-- nurture-emails), enrolled by trg_purchase_tracks_on_order when a paid order is written:
--
--   starter_weeks10      first-band Starter:   pos 1 "Weeks 10 to 36", purchase + 35 days
--   second_band_starter  Starter of a band whose OTHER band the family already owns:
--                        pos 1 + 1 day, pos 2 + 14 days, pos 3 (weeks 10-36) + 35 days
--   print_review         first-band printed year: pos 1 delivery + 28 days
--   two_band_print       both-bands set, or a printed band whose other band they own:
--                        pos 1 + 1 day, pos 2 delivery + 14 days, pos 3 delivery + 28 days
--   book_buyer           Back to Eden (any edition): pos 1 + 1 day, pos 2 + 7 days,
--                        pos 3 + 14 days (PDF) or delivery + 14 days (print)
--   guide_buyer          Deep-Dive Guide: pos 1 + 1 day, pos 2 + 4 days, pos 3 + 7 days
--
-- "Delivery" = delivered_at, provisionally shipped_at + 10 days (the Founding Family rule);
-- those rows wait with scheduled_for null until the order ships, and re-anchor when Lulu
-- reports shipped or delivered. First-band Starter and printed-year families still get the
-- Founding Family d1/d2 and p1/p2 notes. Founding Family now SKIPS a both-bands order and a
-- printed order for a family's second band: those families get two_band_print instead.
--
-- Founder decisions 2026-10-15 (her taps, in session):
--   * Existing buyers: the Starter families who do not own the printed year get "Weeks 10 to
--     36", and the printed-year family the review ask, 7 days after their pending 2-week
--     Founding Family note (purchase_track_backfill, run once at ship time). Guide buyers get
--     nothing new.
--   * Buyers stay on the Friday list during these emails: broadcast_audience is NOT changed.
--   * After a print the print shop cancelled, the refund note is skipped (nurture-emails).
-- Plan section 3: buying ends a lead track. A Deep-Dive Guide order cancels that person's
-- pending quiz emails; a Back to Eden order cancels their pending Chapter 1 track emails.
--
-- Refunded or cancelled orders cancel their pending rows (and the drain re-checks). A global
-- unsubscribe or bounce already cancels every pending followup row (20261015170000, part 4).
-- RLS unchanged (service role only). Idempotent.

-- ── 1. the queue takes the new tracks ──
alter table public.followup_email_queue drop constraint if exists followup_email_queue_track_check;
alter table public.followup_email_queue add constraint followup_email_queue_track_check
  check (track in ('back_to_eden_ch1', 'refund_note', 'starter_weeks10', 'second_band_starter',
                   'print_review', 'two_band_print', 'book_buyer', 'guide_buyer'));
-- A delivery-anchored step waits with no date until the order ships.
alter table public.followup_email_queue alter column scheduled_for drop not null;
alter table public.followup_email_queue add column if not exists anchor text not null default 'order';
alter table public.followup_email_queue drop constraint if exists followup_email_queue_anchor_check;
alter table public.followup_email_queue add constraint followup_email_queue_anchor_check
  check (anchor in ('order', 'delivery'));
create index if not exists followup_email_queue_order_idx on public.followup_email_queue (order_id) where status = 'pending';
comment on table public.followup_email_queue is
  'Back to Eden Chapter 1 track, the refund note, and the purchase tracks (starter_weeks10, second_band_starter, print_review, two_band_print, book_buyer, guide_buyer; 20261015200000). Drained by nurture-emails. Service role only.';

-- ── 2. helpers ──
-- Which curriculum band a lookup key covers ('both' for the two-band set), else null.
create or replace function public.purchase_track_band(p_lookup_key text)
returns text language sql immutable as $$
  select case
    when p_lookup_key in ('sprouts_starter_unit', 'sprouts_print_set') then 'sprouts'
    when p_lookup_key in ('seedlings_starter_unit', 'seedlings_print_set') then 'seedlings'
    when p_lookup_key = 'both_bands_print_set' then 'both'
  end
$$;

-- Does this address own a band through ANOTHER paid, live, real order? Kit preorders do not
-- count: those families have nothing in hand until 2027.
create or replace function public.purchase_track_owns_band(p_email text, p_band text, p_except uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.orders o
     where lower(btrim(o.customer_email)) = p_email
       and o.id <> p_except
       and o.payment_status = 'paid'
       and o.status::text not in ('cancelled', 'refunded')
       and o.raw->'metadata'->>'e2e_test' is null
       and (o.lookup_key = 'both_bands_print_set'
            or o.lookup_key in (p_band || '_starter_unit', p_band || '_print_set'))
  )
$$;

-- Offsets from the step's anchor.
create or replace function public.purchase_track_offset(p_track text, p_pos smallint)
returns interval language sql immutable as $$
  select case p_track || ':' || p_pos
    when 'starter_weeks10:1'     then interval '35 days'
    when 'second_band_starter:1' then interval '1 day'
    when 'second_band_starter:2' then interval '14 days'
    when 'second_band_starter:3' then interval '35 days'
    when 'print_review:1'        then interval '28 days'
    when 'two_band_print:1'      then interval '1 day'
    when 'two_band_print:2'      then interval '14 days'
    when 'two_band_print:3'      then interval '28 days'
    when 'book_buyer:1'          then interval '1 day'
    when 'book_buyer:2'          then interval '7 days'
    when 'book_buyer:3'          then interval '14 days'
    when 'guide_buyer:1'         then interval '1 day'
    when 'guide_buyer:2'         then interval '4 days'
    when 'guide_buyer:3'         then interval '7 days'
  end
$$;

-- ── 3. enroll one order ──
-- p_at = the purchase moment the order-anchored offsets count from (the trigger passes now()).
create or replace function public.purchase_track_enroll(p_order_id uuid, p_at timestamptz)
returns integer
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  o public.orders%rowtype;
  v_email text; v_first text; v_key text; v_band text; v_other text;
  v_track text; v_steps smallint[]; v_delivery smallint[] := '{}';
  v_anchor timestamptz; v_n integer := 0; s smallint;
begin
  select * into o from public.orders where id = p_order_id;
  if not found then return 0; end if;
  if o.status::text in ('cancelled', 'refunded') then return 0; end if;
  -- 'no_payment_required' is a 100%-off promo, a legitimate free delivery (stripe-webhook).
  if coalesce(o.payment_status, '') not in ('paid', 'no_payment_required') then return 0; end if;
  v_email := lower(btrim(coalesce(o.customer_email, '')));
  if v_email = '' or v_email = 'hello@edeninstitute.health' then return 0; end if;
  if o.raw->'metadata'->>'e2e_test' is not null then return 0; end if;
  if public.is_internal_tester(v_email) then return 0; end if;

  v_key := coalesce(o.lookup_key, '');
  v_band := public.purchase_track_band(v_key);
  v_other := case v_band when 'sprouts' then 'seedlings' when 'seedlings' then 'sprouts' end;

  if v_key in ('sprouts_starter_unit', 'seedlings_starter_unit') then
    if public.purchase_track_owns_band(v_email, v_other, o.id) then
      v_track := 'second_band_starter'; v_steps := '{1,2,3}';
    else
      v_track := 'starter_weeks10'; v_steps := '{1}';
    end if;
  elsif v_key in ('sprouts_print_set', 'seedlings_print_set', 'both_bands_print_set') then
    if v_band = 'both' or public.purchase_track_owns_band(v_email, v_other, o.id) then
      v_track := 'two_band_print'; v_steps := '{1,2,3}'; v_delivery := '{2,3}';
    else
      v_track := 'print_review'; v_steps := '{1}'; v_delivery := '{1}';
    end if;
  elsif v_key like 'bte\_%' then
    v_track := 'book_buyer'; v_steps := '{1,2,3}';
    if v_key like '%\_print' then v_delivery := '{3}'; end if;
    -- Buying the book ends the Chapter 1 track.
    update public.followup_email_queue
       set status = 'cancelled', error_message = 'bought Back to Eden', updated_at = now()
     where recipient_email = v_email and track = 'back_to_eden_ch1' and status = 'pending';
  elsif v_key = 'deep_dive_guide' then
    v_track := 'guide_buyer'; v_steps := '{1,2,3}';
    -- Buying the guide ends the quiz track.
    update public.nurture_email_queue
       set status = 'cancelled', error_message = left(coalesce(error_message, '') || ' [bought the Deep-Dive Guide]', 500), updated_at = now()
     where lower(recipient_email) = v_email and status = 'pending';
  else
    return 0;
  end if;

  -- Digital orders have no shipping name; fall back to the name typed at Stripe checkout.
  v_first := nullif(btrim(split_part(coalesce(nullif(btrim(o.shipping_name), ''),
                                             o.raw->'customer_details'->>'name', ''), ' ', 1)), '');
  if v_first is not null then v_first := upper(left(v_first, 1)) || substr(v_first, 2); end if;

  v_anchor := coalesce(o.delivered_at, o.shipped_at + interval '10 days');
  foreach s in array v_steps loop
    insert into public.followup_email_queue
      (recipient_email, first_name, track, sequence_position, order_id, scheduled_for, anchor)
    values (v_email, v_first, v_track, s, o.id,
            case
              when s = any (v_delivery) then
                case when v_anchor is null then null
                     else greatest(v_anchor + public.purchase_track_offset(v_track, s), now()) end
              else p_at + public.purchase_track_offset(v_track, s)
            end,
            case when s = any (v_delivery) then 'delivery' else 'order' end)
    on conflict (recipient_email, track, sequence_position) do nothing;
    if found then v_n := v_n + 1; end if;
  end loop;
  return v_n;
end;
$$;

-- Re-anchor delivery steps when an order ships (provisional) or is delivered (final).
create or replace function public.purchase_track_reanchor(p_order_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare o public.orders%rowtype; v_anchor timestamptz;
begin
  select * into o from public.orders where id = p_order_id;
  if not found then return; end if;
  v_anchor := coalesce(o.delivered_at, o.shipped_at + interval '10 days');
  if v_anchor is null then return; end if;
  update public.followup_email_queue q
     set scheduled_for = greatest(v_anchor + public.purchase_track_offset(q.track, q.sequence_position), now()),
         updated_at = now()
   where q.order_id = p_order_id and q.anchor = 'delivery' and q.status = 'pending';
end;
$$;

create or replace function public.trg_purchase_tracks_on_order()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  -- Never let a follow-up email problem block an order write (stripe-webhook inserts here).
  begin
    if tg_op = 'INSERT' then
      perform public.purchase_track_enroll(new.id, now());
    else
      if new.status::text in ('cancelled', 'refunded') and old.status is distinct from new.status then
        update public.followup_email_queue
           set status = 'cancelled', error_message = 'order ' || new.status::text, updated_at = now()
         where order_id = new.id and status = 'pending' and track <> 'refund_note';
      elsif (new.shipped_at is distinct from old.shipped_at)
         or (new.delivered_at is distinct from old.delivered_at) then
        perform public.purchase_track_reanchor(new.id);
      end if;
    end if;
  exception when others then
    raise warning 'purchase tracks trigger skipped order %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists trg_purchase_tracks_on_order on public.orders;
create trigger trg_purchase_tracks_on_order
  after insert or update of status, shipped_at, delivered_at on public.orders
  for each row execute function public.trg_purchase_tracks_on_order();

-- ── 4. Founding Family skips two-band printed orders ──
-- Re-created from the LIVE definition (pg_get_functiondef, 2026-10-15, = 20261015030000) with
-- one change, marked NEW: a both-bands order, or a printed order for a band whose other band
-- the family already owns, returns before touching anything. Those families get two_band_print
-- above, and any pending digital note about their first band is left alone.
create or replace function public.founding_family_enroll(p_order_id uuid, p_first_at timestamp with time zone, p_cohort text DEFAULT 'new'::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

  -- NEW 2026-10-15: two bands in print get the two_band_print emails, not p1/p2.
  if v_track = 'print' and (
       o.lookup_key = 'both_bands_print_set'
       or public.purchase_track_owns_band(
            v_email,
            case public.purchase_track_band(o.lookup_key) when 'sprouts' then 'seedlings' else 'sprouts' end,
            o.id)) then
    return 0;
  end if;

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
      from unnest(array['d2']) s
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
      from unnest(array['p2']) s
    on conflict (recipient_email, step) do nothing;
  end if;
  return v_n;
end;
$function$;

-- ── 5. one-time backfill (founder 2026-10-15: "Starter + printed") ──
-- Run ONCE at ship time: select public.purchase_track_backfill();
-- Starter families with a pending Founding Family d2 who do not own that band in print get
-- "Weeks 10 to 36" 7 days after their d2; printed-year families with a pending p2 get the
-- review ask 7 days after their p2. Same eligibility as a new order (real, paid, not refunded,
-- not a tester, not internal). Returns the number of rows queued.
create or replace function public.purchase_track_backfill()
returns integer
language plpgsql security definer set search_path = public, pg_temp
as $$
declare r record; v_n integer := 0; v_one integer;
begin
  for r in
    select f.order_id, f.step, f.scheduled_for, f.recipient_email, f.first_name, o.lookup_key
      from public.founding_family_queue f
      join public.orders o on o.id = f.order_id
     where f.status = 'pending' and f.step in ('d2', 'p2') and f.scheduled_for is not null
       and o.payment_status = 'paid' and o.status::text not in ('cancelled', 'refunded')
       and o.raw->'metadata'->>'e2e_test' is null
       and not public.is_internal_tester(f.recipient_email)
       and not exists (select 1 from public.payments p
                        where p.stripe_payment_intent_id = o.raw->>'payment_intent' and p.is_internal)
  loop
    if r.step = 'd2' and r.lookup_key in ('sprouts_starter_unit', 'seedlings_starter_unit') then
      if exists (select 1 from public.orders x
                  where lower(btrim(x.customer_email)) = r.recipient_email
                    and x.payment_status = 'paid' and x.status::text not in ('cancelled', 'refunded')
                    and x.lookup_key in ('both_bands_print_set', public.purchase_track_band(r.lookup_key) || '_print_set')) then
        continue;
      end if;
      insert into public.followup_email_queue (recipient_email, first_name, track, sequence_position, order_id, scheduled_for, anchor)
      values (r.recipient_email, r.first_name, 'starter_weeks10', 1, r.order_id, r.scheduled_for + interval '7 days', 'order')
      on conflict (recipient_email, track, sequence_position) do nothing;
    elsif r.step = 'p2' and r.lookup_key in ('sprouts_print_set', 'seedlings_print_set') then
      insert into public.followup_email_queue (recipient_email, first_name, track, sequence_position, order_id, scheduled_for, anchor)
      values (r.recipient_email, r.first_name, 'print_review', 1, r.order_id, r.scheduled_for + interval '7 days', 'order')
      on conflict (recipient_email, track, sequence_position) do nothing;
    else
      continue;
    end if;
    get diagnostics v_one = row_count;
    v_n := v_n + v_one;
  end loop;
  return v_n;
end;
$$;

revoke all on function public.purchase_track_owns_band(text, text, uuid) from public, anon, authenticated;
revoke all on function public.purchase_track_enroll(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.purchase_track_reanchor(uuid) from public, anon, authenticated;
revoke all on function public.purchase_track_backfill() from public, anon, authenticated;
revoke all on function public.founding_family_enroll(uuid, timestamptz, text) from public, anon, authenticated;
