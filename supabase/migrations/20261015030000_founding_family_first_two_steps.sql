-- 2026-10-15, founder rule ("3 or 4 emails that nurture after each thing ... Then, the entire
-- list is on the same schedule"): the Founding Family check-ins stop after the 2-week note.
-- New Starter buyers get d1 (next day) + d2 (+2 weeks); new printed-set buyers get p1 (next day)
-- + p2 (2 weeks after delivery). The 2-, 4- and 6-month notes (d3-d5, p3-p5) are retired; the
-- Friday list carries those families from then on. Rows already queued for d3-d5/p3-p5 were
-- cancelled by id the same day (backup scripts/_backup_old_sequences_retire_20261015.json).
--
-- founding_family_enroll is re-created from its LIVE definition (pg_get_functiondef, which
-- includes the 20261008233000 early-cohort version) with only the two step arrays changed.
-- founding_family_offset and the d3-d5/p3-p5 templates stay, unused, so this is reversible.
-- Idempotent (create or replace).

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

revoke all on function public.founding_family_enroll(uuid, timestamptz, text) from public, anon, authenticated;
