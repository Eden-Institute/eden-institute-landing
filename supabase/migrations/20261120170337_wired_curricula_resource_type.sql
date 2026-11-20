-- ============================================================================
-- Helpful extras (spec answer 38, DECIDED 2026-11-19 ~9:15 PM CT, her tap "Separate extras section"):
-- workbook col 32 resource_type (Curriculum / App / Video library / Course library / Free library / Songs /
-- Devotional / Memory book / Other). The quiz ranks resource_type = Curriculum only (wired-submit-flow.ts
-- approvedCurricula); the finder shows the rest in a "Helpful extras" section. Null = treated as Curriculum
-- (every row before this column).
--
-- 1. one nullable column
-- 2. wired_admin_apply_fields: the live body (migration 20261120151811) + resource_type
-- 3. curriculum_finder_list: the live body + resource_type (return type changes: drop + create, same grants)
-- ============================================================================

alter table public.wired_curricula add column if not exists resource_type text;

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
    price_covers       = case when p ? 'price_covers' then nullif(btrim(p->>'price_covers'), '') else price_covers end,
    multi_age          = case when p ? 'multi_age' then coalesce((p->>'multi_age')::boolean, false) else multi_age end,
    faith_alignment    = case when p ? 'faith_alignment' then nullif(btrim(p->>'faith_alignment'), '') else faith_alignment end,
    screen_based       = case when p ? 'screen_based' then (p->>'screen_based')::boolean else screen_based end,
    resource_type      = case when p ? 'resource_type' then nullif(btrim(p->>'resource_type'), '') else resource_type end,
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

drop function if exists public.curriculum_finder_list();
create function public.curriculum_finder_list()
returns table (
  id uuid, sheet_id text, name text, publisher text, link text, is_affiliate boolean,
  approach text, approach_secondary text, subjects text[], grade_min integer, grade_max integer,
  domains_served text[], prep_load text, price_cents integer, price_basis text, multi_age boolean,
  faith_alignment text, eden_band text, coming_soon boolean,
  free_trial_url text, free_trial_type text, free_trial_note text, completely_free boolean, free_trial_checked date,
  mom_pros text[], mom_cons text[], mom_sources jsonb, mom_note text, esa_yes_states text[], last_verified_at timestamptz,
  price_covers text, screen_based boolean, resource_type text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id, c.sheet_id, c.name, c.publisher,
         case when c.is_affiliate and nullif(c.affiliate_url, '') is not null then c.affiliate_url else c.url end,
         coalesce(c.is_affiliate and nullif(c.affiliate_url, '') is not null, false),
         c.approach, c.approach_secondary, c.subjects, c.grade_min, c.grade_max,
         c.domains_served, c.prep_load, c.price_cents, c.price_basis, c.multi_age,
         c.faith_alignment, c.eden_band, c.coming_soon,
         c.free_trial_url, c.free_trial_type, c.free_trial_note, c.completely_free, c.free_trial_checked,
         c.mom_pros, c.mom_cons, c.mom_sources, c.mom_note,
         coalesce((select array_agg(distinct e.state order by e.state) from public.wired_curriculum_esa e
                   where e.curriculum_id = c.id and e.eligible = 'yes'), '{}'),
         c.last_verified_at,
         c.price_covers, c.screen_based, c.resource_type
  from public.wired_curricula c
  where c.approved
  order by c.name
$$;
revoke execute on function public.curriculum_finder_list() from public;
grant execute on function public.curriculum_finder_list() to anon, authenticated, service_role;
