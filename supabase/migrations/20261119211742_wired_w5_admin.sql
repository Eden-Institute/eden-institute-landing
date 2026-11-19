-- ============================================================================
-- Fearfully & Wonderfully Wired, ticket W5: the founder admin page's database side.
--
-- Spec section 12 + section 18 answer 16: SECURITY DEFINER RPCs that check is_founder();
-- approve, unapprove, rollback and import ALSO require is_founder_mfa() (aal2, her
-- authenticator code). The history trigger (W1) records every change with changed_by from
-- the JWT. Nothing reaches the public until approved = true (wired-matches reads approved
-- rows only).
--
-- Errors the page understands: 'FOUNDER_ONLY' (not the founder) and 'MFA_REQUIRED' (the
-- step-up prompt then asks for her code), both errcode 42501.
--
-- Import rule: rows are keyed on the workbook's own curriculum_id (new column sheet_id);
-- a NEW row always arrives approved = false; a row she already APPROVED is never changed by
-- an import (skipped and counted); an unapproved row is updated in place. ESA rows are keyed
-- on (curriculum, state, program).
-- ============================================================================

alter table public.wired_curricula add column if not exists sheet_id text;
create unique index if not exists wired_curricula_sheet_id_uniq on public.wired_curricula (sheet_id) where sheet_id is not null;

-- ── guards ──
create or replace function public.wired_admin_guard(p_need_mfa boolean)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  -- Trusted server-side callers pass: the service role (Lane 2's import job) and a direct
  -- database session (session_user postgres / supabase_admin, i.e. the Management API). Both
  -- can already write these tables directly, so this protects nothing extra by refusing them.
  -- Browser calls arrive as session_user 'authenticator' with her JWT and get the full check.
  if coalesce(auth.role(), '') = 'service_role' or session_user in ('postgres', 'supabase_admin') then
    return;
  end if;
  if not coalesce(public.is_founder(), false) then
    raise exception 'FOUNDER_ONLY' using errcode = '42501';
  end if;
  if p_need_mfa and not coalesce(public.is_founder_mfa(), false) then
    raise exception 'MFA_REQUIRED' using errcode = '42501';
  end if;
end;
$$;
revoke execute on function public.wired_admin_guard(boolean) from public, anon, authenticated;

-- ── list: every curriculum with its ESA rows ──
create or replace function public.wired_admin_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.wired_admin_guard(false);
  return coalesce((
    select jsonb_agg(to_jsonb(c) || jsonb_build_object(
             'esa', coalesce((select jsonb_agg(to_jsonb(e) order by e.state, e.program)
                                from public.wired_curriculum_esa e where e.curriculum_id = c.id), '[]'::jsonb))
           order by c.name)
      from public.wired_curricula c), '[]'::jsonb);
end;
$$;

-- ── the editable fields, shared by save and import ──
-- (approved / approved_at are never set from here: wired_admin_set_approved does that.)
create or replace function public.wired_admin_apply_fields(p_id uuid, p jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.wired_curricula set
    name               = coalesce(nullif(btrim(p->>'name'), ''), name),
    publisher          = case when p ? 'publisher' then nullif(btrim(p->>'publisher'), '') else publisher end,
    approach           = case when p ? 'approach' then nullif(btrim(p->>'approach'), '') else approach end,
    approach_secondary = case when p ? 'approach_secondary' then nullif(btrim(p->>'approach_secondary'), '') else approach_secondary end,
    subjects           = case when p ? 'subjects' then coalesce(array(select jsonb_array_elements_text(p->'subjects')), '{}') else subjects end,
    grade_min          = case when p ? 'grade_min' then (p->>'grade_min')::integer else grade_min end,
    grade_max          = case when p ? 'grade_max' then (p->>'grade_max')::integer else grade_max end,
    domains_served     = case when p ? 'domains_served' then coalesce(array(select jsonb_array_elements_text(p->'domains_served')), '{}') else domains_served end,
    prep_load          = case when p ? 'prep_load' then nullif(btrim(p->>'prep_load'), '') else prep_load end,
    price_cents        = case when p ? 'price_cents' then (p->>'price_cents')::integer else price_cents end,
    price_basis        = case when p ? 'price_basis' then nullif(btrim(p->>'price_basis'), '') else price_basis end,
    multi_age          = case when p ? 'multi_age' then coalesce((p->>'multi_age')::boolean, false) else multi_age end,
    faith_alignment    = case when p ? 'faith_alignment' then nullif(btrim(p->>'faith_alignment'), '') else faith_alignment end,
    url                = case when p ? 'url' then nullif(btrim(p->>'url'), '') else url end,
    affiliate_url      = case when p ? 'affiliate_url' then nullif(btrim(p->>'affiliate_url'), '') else affiliate_url end,
    is_affiliate       = case when p ? 'is_affiliate' then coalesce((p->>'is_affiliate')::boolean, false) else is_affiliate end,
    eden_band          = case when p ? 'eden_band' then nullif(btrim(p->>'eden_band'), '') else eden_band end,
    coming_soon        = case when p ? 'coming_soon' then coalesce((p->>'coming_soon')::boolean, false) else coming_soon end,
    last_verified_at   = case when p ? 'last_verified_at' then nullif(p->>'last_verified_at', '')::timestamptz else last_verified_at end,
    dm_name            = case when p ? 'dm_name' then nullif(btrim(p->>'dm_name'), '') else dm_name end,
    dm_role            = case when p ? 'dm_role' then nullif(btrim(p->>'dm_role'), '') else dm_role end,
    dm_email           = case when p ? 'dm_email' then nullif(btrim(p->>'dm_email'), '') else dm_email end,
    dm_source_url      = case when p ? 'dm_source_url' then nullif(btrim(p->>'dm_source_url'), '') else dm_source_url end,
    updated_at         = now()
  where id = p_id;
end;
$$;
revoke execute on function public.wired_admin_apply_fields(uuid, jsonb) from public, anon, authenticated;

-- ── save one curriculum (new or edit); founder only ──
create or replace function public.wired_admin_save(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid := nullif(p->>'id', '')::uuid;
begin
  perform public.wired_admin_guard(false);
  if v_id is null then
    if nullif(btrim(coalesce(p->>'name', '')), '') is null then
      raise exception 'a curriculum needs a name' using errcode = '22023';
    end if;
    insert into public.wired_curricula (name, approved) values (btrim(p->>'name'), false) returning id into v_id;
  elsif not exists (select 1 from public.wired_curricula where id = v_id) then
    raise exception 'no such curriculum' using errcode = '22023';
  end if;
  perform public.wired_admin_apply_fields(v_id, p);
  return v_id;
end;
$$;

-- ── approve / unapprove; founder + authenticator code ──
create or replace function public.wired_admin_set_approved(p_id uuid, p_approved boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.wired_admin_guard(true);
  update public.wired_curricula
     set approved = p_approved, approved_at = case when p_approved then now() else null end, updated_at = now()
   where id = p_id;
  if not found then raise exception 'no such curriculum' using errcode = '22023'; end if;
end;
$$;

-- ── one ESA row (eligible yes/no/unknown, its own verified date); founder only ──
create or replace function public.wired_admin_esa_save(p jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.wired_admin_guard(false);
  insert into public.wired_curriculum_esa (curriculum_id, state, program, eligible, verified_at, source_url, notes)
  values ((p->>'curriculum_id')::uuid, upper(btrim(p->>'state')), btrim(p->>'program'),
          coalesce(nullif(p->>'eligible', ''), 'unknown'), nullif(p->>'verified_at', '')::date,
          nullif(btrim(coalesce(p->>'source_url', '')), ''), nullif(btrim(coalesce(p->>'notes', '')), ''))
  on conflict (curriculum_id, state, program) do update
    set eligible = excluded.eligible, verified_at = excluded.verified_at,
        source_url = excluded.source_url, notes = excluded.notes;
end;
$$;

-- ── import (workbook rows already mapped by the page); founder + authenticator code ──
create or replace function public.wired_admin_import(p_rows jsonb, p_esa jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r jsonb;
  v_id uuid;
  v_approved boolean;
  n_new int := 0; n_upd int := 0; n_skip int := 0; n_esa int := 0; n_esa_skip int := 0;
begin
  perform public.wired_admin_guard(true);
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    if nullif(btrim(coalesce(r->>'sheet_id', '')), '') is null or nullif(btrim(coalesce(r->>'name', '')), '') is null then
      n_skip := n_skip + 1;
      continue;
    end if;
    select id, approved into v_id, v_approved from public.wired_curricula where sheet_id = btrim(r->>'sheet_id');
    if v_id is null then
      insert into public.wired_curricula (name, sheet_id, approved) values (btrim(r->>'name'), btrim(r->>'sheet_id'), false)
      returning id into v_id;
      perform public.wired_admin_apply_fields(v_id, r);
      n_new := n_new + 1;
    elsif v_approved then
      n_skip := n_skip + 1;      -- an approved row is never changed by an import
    else
      perform public.wired_admin_apply_fields(v_id, r);
      n_upd := n_upd + 1;
    end if;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_esa, '[]'::jsonb)) loop
    select id, approved into v_id, v_approved from public.wired_curricula where sheet_id = btrim(coalesce(r->>'sheet_id', ''));
    if v_id is null or v_approved or nullif(btrim(coalesce(r->>'state', '')), '') is null or nullif(btrim(coalesce(r->>'program', '')), '') is null then
      n_esa_skip := n_esa_skip + 1;
      continue;
    end if;
    insert into public.wired_curriculum_esa (curriculum_id, state, program, eligible, verified_at, source_url, notes)
    values (v_id, upper(btrim(r->>'state')), btrim(r->>'program'), coalesce(nullif(r->>'eligible', ''), 'unknown'),
            nullif(r->>'verified_at', '')::date, nullif(btrim(coalesce(r->>'source_url', '')), ''), nullif(btrim(coalesce(r->>'notes', '')), ''))
    on conflict (curriculum_id, state, program) do update
      set eligible = excluded.eligible, verified_at = excluded.verified_at, source_url = excluded.source_url, notes = excluded.notes;
    n_esa := n_esa + 1;
  end loop;

  return jsonb_build_object('inserted', n_new, 'updated', n_upd, 'skipped', n_skip, 'esa_rows', n_esa, 'esa_skipped', n_esa_skip);
end;
$$;

-- ── history for one curriculum, newest first; founder only ──
create or replace function public.wired_admin_history(p_curriculum uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.wired_admin_guard(false);
  return coalesce((select jsonb_agg(to_jsonb(h) order by h.changed_at desc)
                     from public.wired_curricula_history h where h.curriculum_id = p_curriculum), '[]'::jsonb);
end;
$$;

-- ── one-click rollback: write a history row's `before` back (itself logged); founder + code ──
create or replace function public.wired_admin_rollback(p_history_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  h public.wired_curricula_history;
  c public.wired_curricula;
  e public.wired_curriculum_esa;
begin
  perform public.wired_admin_guard(true);
  select * into h from public.wired_curricula_history where id = p_history_id;
  if h.id is null then raise exception 'no such history row' using errcode = '22023'; end if;

  if h.table_name = 'wired_curricula' then
    if h.op = 'INSERT' then
      delete from public.wired_curricula where id = h.curriculum_id;           -- undo a creation
    else
      c := jsonb_populate_record(null::public.wired_curricula, h.before);
      insert into public.wired_curricula select (c).*
      on conflict (id) do update set
        name = excluded.name, publisher = excluded.publisher, approach = excluded.approach,
        approach_secondary = excluded.approach_secondary, subjects = excluded.subjects,
        grade_min = excluded.grade_min, grade_max = excluded.grade_max, domains_served = excluded.domains_served,
        prep_load = excluded.prep_load, price_cents = excluded.price_cents, price_basis = excluded.price_basis,
        multi_age = excluded.multi_age, faith_alignment = excluded.faith_alignment, url = excluded.url,
        affiliate_url = excluded.affiliate_url, is_affiliate = excluded.is_affiliate, eden_band = excluded.eden_band,
        coming_soon = excluded.coming_soon, approved = excluded.approved, approved_at = excluded.approved_at,
        last_verified_at = excluded.last_verified_at, dm_name = excluded.dm_name, dm_role = excluded.dm_role,
        dm_email = excluded.dm_email, dm_source_url = excluded.dm_source_url, sheet_id = excluded.sheet_id,
        updated_at = now();
    end if;
  else
    if h.op = 'INSERT' then
      delete from public.wired_curriculum_esa
       where curriculum_id = (h.after->>'curriculum_id')::uuid and state = h.after->>'state' and program = h.after->>'program';
    else
      e := jsonb_populate_record(null::public.wired_curriculum_esa, h.before);
      insert into public.wired_curriculum_esa select (e).*
      on conflict (curriculum_id, state, program) do update
        set eligible = excluded.eligible, verified_at = excluded.verified_at, source_url = excluded.source_url, notes = excluded.notes;
    end if;
  end if;
end;
$$;

-- The founder calls these from the browser with her own session (authenticated); every one
-- checks is_founder() itself, so the six other accounts get FOUNDER_ONLY.
revoke execute on function public.wired_admin_list() from public, anon;
revoke execute on function public.wired_admin_save(jsonb) from public, anon;
revoke execute on function public.wired_admin_set_approved(uuid, boolean) from public, anon;
revoke execute on function public.wired_admin_esa_save(jsonb) from public, anon;
revoke execute on function public.wired_admin_import(jsonb, jsonb) from public, anon;
revoke execute on function public.wired_admin_history(uuid) from public, anon;
revoke execute on function public.wired_admin_rollback(uuid) from public, anon;
grant execute on function public.wired_admin_list() to authenticated, service_role;
grant execute on function public.wired_admin_save(jsonb) to authenticated, service_role;
grant execute on function public.wired_admin_set_approved(uuid, boolean) to authenticated, service_role;
grant execute on function public.wired_admin_esa_save(jsonb) to authenticated, service_role;
grant execute on function public.wired_admin_import(jsonb, jsonb) to authenticated, service_role;
grant execute on function public.wired_admin_history(uuid) to authenticated, service_role;
grant execute on function public.wired_admin_rollback(uuid) to authenticated, service_role;
