-- ============================================================================
-- Eden's Table Online Year (punch #472), ticket OY3: the grant RPC. Built by Lane 2, 2026-11-25.
--
-- stripe-webhook (and its test twin) calls this once per paid Online Year cart, after recording the
-- order. The webhook plans the licenses (supabase/functions/_shared/online-year-grant.ts, unit tested);
-- this function writes the plan in ONE transaction and refuses a plan made from a stale read:
--   - upserts the parent account by lower(email), storing the email lower-cased; keeps the first
--     license name (the card billing name) it was given;
--   - one online_year_licenses row per child, idempotent on online_year_licenses_one_per_child_per_order
--     (order_id, band, lower(child_name)), so a redelivered webhook grants nothing twice;
--   - starts_at = the purchase time, EXCEPT an early renewal of the same child's live license in that
--     band, which starts where that year ends (approved FAQ: "Renewing early doesn't cost you any days")
--     and points back at it (renews_license_id; online_year_licenses_one_renewal);
--   - a sibling with no live license of her own starts on the purchase date, even past the first
--     child's end date (approved FAQ: "their year runs 12 months from the day you add them");
--   - ends_at = starts_at + 12 months, computed HERE in UTC (the planned ends_at is not trusted).
-- Under a lock on the parent row it re-derives every planned start from the live table; any difference
-- raises, the webhook throws, Stripe redelivers, and the next plan reads fresh rows.
--
-- Refunds and disputes close licenses with a plain UPDATE from the webhook (service_role already holds
-- update on online_year_licenses, OY1), so they need no function.
--
-- SECURITY DEFINER, search_path pinned, EXECUTE for service_role only (anon and authenticated revoked by
-- name; house pattern 20261121145819_wired_pilot_family_map_unique.sql). No new table, no table grant.
-- INERT until stripe-webhook is deployed with OY3; the Online Year stays dark behind ONLINE_YEAR_ENABLED.
-- Idempotent: create or replace.
-- ============================================================================

create or replace function public.online_year_grant_purchase(
  p_order_id     uuid,
  p_email        text,
  p_license_name text,
  p_band         text,
  p_purchased_at timestamptz,
  p_licenses     jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email        text := lower(btrim(coalesce(p_email, '')));
  v_name         text := nullif(btrim(coalesce(p_license_name, '')), '');
  v_parent       uuid;
  v_row          jsonb;
  v_child        text;
  v_kind         text;
  v_starts       timestamptz;
  v_renews       uuid;
  v_live_id      uuid;
  v_live_end     timestamptz;
  v_live_renewed boolean;
  v_id           uuid;
  v_inserted     integer := 0;
  v_already      integer := 0;
begin
  if p_order_id is null then
    raise exception 'online_year_grant_purchase: order id is required';
  end if;
  if p_band is null or p_band not in ('sprouts', 'seedlings') then
    raise exception 'online_year_grant_purchase: unknown band %', p_band;
  end if;
  if p_purchased_at is null then
    raise exception 'online_year_grant_purchase: purchase time is required';
  end if;
  if p_licenses is null or jsonb_typeof(p_licenses) <> 'array'
     or jsonb_array_length(p_licenses) < 1 or jsonb_array_length(p_licenses) > 10 then
    raise exception 'online_year_grant_purchase: 1 to 10 licenses are required';
  end if;
  if not exists (select 1 from public.orders o where o.id = p_order_id) then
    raise exception 'online_year_grant_purchase: order % not found', p_order_id;
  end if;
  if length(v_name) > 120 then
    v_name := null;
  end if;

  -- The parent account. ON CONFLICT DO UPDATE also locks the row, so two grants for one family
  -- run one after the other.
  insert into public.online_year_parents as p (email, license_name)
  values (v_email, v_name)
  on conflict ((lower(email))) do update
    set license_name = coalesce(p.license_name, excluded.license_name),
        updated_at   = now()
  returning p.id into v_parent;

  for v_row in select value from jsonb_array_elements(p_licenses) loop
    v_child  := btrim(coalesce(v_row ->> 'child_name', ''));
    v_kind   := v_row ->> 'kind';
    v_starts := (v_row ->> 'starts_at')::timestamptz;
    v_renews := nullif(v_row ->> 'renews_license_id', '')::uuid;
    if v_child = '' or v_starts is null then
      raise exception 'online_year_grant_purchase: every license needs a child name and a start';
    end if;

    -- Already granted by this order (a redelivered event): nothing to do.
    if exists (
      select 1 from public.online_year_licenses l
      where l.order_id = p_order_id and l.band = p_band and lower(l.child_name) = lower(v_child)
    ) then
      v_already := v_already + 1;
      continue;
    end if;

    -- Re-derive the start from the live table: her live year in this band that ends last.
    v_live_id := null; v_live_end := null; v_live_renewed := null;
    select l.id, l.ends_at,
           exists (select 1 from public.online_year_licenses r where r.renews_license_id = l.id)
      into v_live_id, v_live_end, v_live_renewed
      from public.online_year_licenses l
     where l.parent_id = v_parent and l.band = p_band and lower(l.child_name) = lower(v_child)
       and l.status = 'active' and l.ends_at > p_purchased_at
       and l.order_id is distinct from p_order_id
     order by l.ends_at desc
     limit 1;
    -- Compared to the millisecond (the plan comes from JavaScript dates); the stored start is the
    -- database's own value.
    if v_live_id is null then
      if date_trunc('milliseconds', v_starts) <> date_trunc('milliseconds', p_purchased_at) or v_renews is not null then
        raise exception 'online_year_grant_purchase: stale plan for % (no live year; starts at the purchase time)', v_child;
      end if;
      v_starts := p_purchased_at;
    else
      if date_trunc('milliseconds', v_starts) <> date_trunc('milliseconds', v_live_end)
         or v_renews is distinct from (case when v_live_renewed then null else v_live_id end) then
        raise exception 'online_year_grant_purchase: stale plan for % (renewal must start at % and renew %)', v_child, v_live_end, v_live_id;
      end if;
      v_starts := v_live_end;
    end if;

    v_id := null;
    insert into public.online_year_licenses (parent_id, band, child_name, kind, starts_at, ends_at, order_id, renews_license_id)
    values (
      v_parent, p_band, v_child, v_kind, v_starts,
      (v_starts at time zone 'UTC' + interval '12 months') at time zone 'UTC',
      p_order_id, v_renews
    )
    on conflict (order_id, band, (lower(child_name))) where order_id is not null do nothing
    returning id into v_id;
    if v_id is null then
      v_already := v_already + 1;
    else
      v_inserted := v_inserted + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'status', 'ok',
    'parent_id', v_parent,
    'inserted', v_inserted,
    'already', v_already,
    'licenses', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', l.id, 'child_name', l.child_name, 'kind', l.kind,
               'starts_at', l.starts_at, 'ends_at', l.ends_at, 'renews_license_id', l.renews_license_id
             ) order by l.created_at, l.child_name)
        from public.online_year_licenses l
       where l.order_id = p_order_id
    ), '[]'::jsonb)
  );
end;
$$;
revoke execute on function public.online_year_grant_purchase(uuid, text, text, text, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.online_year_grant_purchase(uuid, text, text, text, timestamptz, jsonb) to service_role;
