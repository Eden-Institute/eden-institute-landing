-- 2026-11-20, Wired quiz W12 (Lane 2b): the pilot. Camila's go via Lane NP; applied only on her own tap.
-- DARK: nothing is reachable until the WIRED_PILOT_OPEN secret is "true" (and the quiz itself is behind
-- WIRED_ENABLED). Spec section 13, answers 10, 33.
--
-- 1. wired_pilot_applications: the approved application (first name, email, state, years homeschooling, kids,
--    each child's nickname + grade, approach, how she heard, the required commitment), its band buckets, and
--    status applied | selected | declined | withdrawn. One per email.
-- 2. wired_pilot_progress: one row per pilot family: a timestamp per ladder step (1 quiz + UX survey ->
--    Blueprint; 2 accuracy survey -> Family Map; 3 Family Map survey -> advance Ch 1 + Founding Families;
--    4 30-day retake -> advance Ch 4), the Founding Families badge (only with permission) and her optional quote
--    (only with permission; the approved disclosure always shows next to it).
-- 3. wired_surveys: one row per family per survey kind (ux | accuracy | family_map | retake).
-- 4. Founder-only RPCs for the admin page: the list with counts per band, and set status (aal2 like approve).
-- 5. wired_pilot_grant(family, child, product): the pilot unlock (wired_unlocks pilot_blueprint /
--    pilot_family_map, unlocked_via 'pilot' on a free child) + a PDF job, in one transaction. Service role only.
-- 6. wired_delete_family also removes that address's pilot application (answer 10: pilot rows, including any
--    testimonial permission). Progress and surveys go with the family (FK cascade). Body = 20261120210230 plus
--    the marked NEW line.

create table if not exists public.wired_pilot_applications (
  id          uuid primary key default gen_random_uuid(),
  email       text not null check (length(email) between 3 and 254),
  first_name  text check (first_name is null or length(first_name) <= 60),
  state       char(2),
  years       text check (years in ('starting', 'under_1', '1_2', '3_5', '6_plus')),
  kids        text check (kids in ('1', '2', '3', '4', '5plus')),
  children    jsonb not null default '[]'::jsonb,
  bands       text[] not null default '{}',
  approach    text,
  heard       text check (heard in ('facebook_group', 'instagram', 'podcast', 'eden_email', 'friend', 'other')),
  commitment  boolean not null check (commitment),
  status      text not null default 'applied' check (status in ('applied', 'selected', 'declined', 'withdrawn')),
  attribution jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  decided_at  timestamptz
);
create unique index if not exists wired_pilot_applications_email_key on public.wired_pilot_applications (lower(email));
alter table public.wired_pilot_applications enable row level security;
revoke all on table public.wired_pilot_applications from anon, authenticated;
grant select, insert, update, delete on table public.wired_pilot_applications to service_role;

create table if not exists public.wired_pilot_progress (
  family_id        uuid primary key references public.wired_families (id) on delete cascade,
  child_id         uuid references public.wired_children (id) on delete set null,
  step1_at         timestamptz,
  step2_at         timestamptz,
  step3_at         timestamptz,
  step4_at         timestamptz,
  badge_permission boolean not null default false,
  badge_name       text check (badge_name is null or length(badge_name) <= 80),
  quote            text check (quote is null or length(quote) <= 600),
  quote_permission boolean not null default false,
  created_at       timestamptz not null default now()
);
alter table public.wired_pilot_progress enable row level security;
revoke all on table public.wired_pilot_progress from anon, authenticated;
grant select, insert, update, delete on table public.wired_pilot_progress to service_role;

create table if not exists public.wired_surveys (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.wired_families (id) on delete cascade,
  child_id     uuid references public.wired_children (id) on delete set null,
  session_id   uuid references public.wired_sessions (id) on delete set null,
  kind         text not null check (kind in ('ux', 'accuracy', 'family_map', 'retake')),
  version      text not null default 'v1',
  answers      jsonb not null,
  submitted_at timestamptz not null default now()
);
create unique index if not exists wired_surveys_one_per_kind on public.wired_surveys (family_id, kind);
alter table public.wired_surveys enable row level security;
revoke all on table public.wired_surveys from anon, authenticated;
grant select, insert, update, delete on table public.wired_surveys to service_role;

-- ── founder admin ──
create or replace function public.wired_admin_pilot_list()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.wired_admin_guard(false);
  return jsonb_build_object(
    'applications', coalesce((select jsonb_agg(jsonb_build_object(
        'id', a.id, 'first_name', a.first_name, 'email', a.email, 'state', a.state, 'years', a.years, 'kids', a.kids,
        'children', a.children, 'bands', a.bands, 'approach', a.approach, 'heard', a.heard, 'status', a.status,
        'created_at', a.created_at) order by a.created_at) from public.wired_pilot_applications a), '[]'::jsonb),
    'bands', (select jsonb_object_agg(b, jsonb_build_object(
        'applied', (select count(*) from public.wired_pilot_applications a where b = any(a.bands) and a.status = 'applied'),
        'selected', (select count(*) from public.wired_pilot_applications a where b = any(a.bands) and a.status = 'selected')))
      from unnest(array['K-2', '3-5', '6-8', '9-12']) b)
  );
end;
$$;

create or replace function public.wired_admin_pilot_set_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.wired_admin_guard(true);
  if p_status not in ('applied', 'selected', 'declined', 'withdrawn') then
    raise exception 'bad status %', p_status using errcode = '22023';
  end if;
  update public.wired_pilot_applications
     set status = p_status, updated_at = now(), decided_at = case when p_status = 'applied' then null else now() end
   where id = p_id;
  if not found then raise exception 'no such application' using errcode = '22023'; end if;
end;
$$;
revoke all on function public.wired_admin_pilot_list() from public, anon;
revoke all on function public.wired_admin_pilot_set_status(uuid, text) from public, anon;
grant execute on function public.wired_admin_pilot_list() to authenticated, service_role;
grant execute on function public.wired_admin_pilot_set_status(uuid, text) to authenticated, service_role;

-- ── the pilot unlock: wired_unlocks + unlocked_via + a PDF job, one transaction ──
create or replace function public.wired_pilot_grant(p_family uuid, p_child uuid, p_product text, p_quiz_year integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job uuid;
begin
  if p_product not in ('pilot_blueprint', 'pilot_family_map') then
    raise exception 'bad product %', p_product using errcode = '22023';
  end if;
  if exists (select 1 from public.wired_unlocks where family_id = p_family and product = p_product
             and (p_product = 'pilot_family_map' or child_id = p_child)) then
    return jsonb_build_object('status', 'already');
  end if;
  if p_product = 'pilot_blueprint' then
    insert into public.wired_unlocks (family_id, child_id, product) values (p_family, p_child, p_product);
    update public.wired_children set unlocked_via = 'pilot', unlocked_at = coalesce(unlocked_at, now())
     where id = p_child and family_id = p_family and (unlocked_via is null or unlocked_via = 'free');
    insert into public.wired_pdf_jobs (family_id, child_id, kind, quiz_year, status)
    values (p_family, p_child, 'blueprint', p_quiz_year, 'queued') returning id into v_job;
  else
    -- The Family Map covers every child on the family's file (up to the 5 a Family Map includes).
    insert into public.wired_unlocks (family_id, child_id, product)
    select p_family, c.id, p_product from public.wired_children c
     where c.family_id = p_family and c.removed_at is null order by c.created_at limit 5;
    update public.wired_children set unlocked_via = 'pilot', unlocked_at = coalesce(unlocked_at, now())
     where family_id = p_family and removed_at is null and (unlocked_via is null or unlocked_via = 'free')
       and id in (select child_id from public.wired_unlocks where family_id = p_family and product = p_product);
    insert into public.wired_pdf_jobs (family_id, child_id, kind, quiz_year, status)
    values (p_family, null, 'family_map', p_quiz_year, 'queued') returning id into v_job;
  end if;
  return jsonb_build_object('status', 'granted', 'pdf_job', v_job);
end;
$$;
revoke all on function public.wired_pilot_grant(uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.wired_pilot_grant(uuid, uuid, text, integer) to service_role;

-- ── delete: the pilot application too (NEW line marked) ──
create or replace function public.wired_delete_family(p_family uuid, p_email_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email   text;
  v_free    integer;
  v_year    integer;
  v_q       integer := 0;
  v_f       integer := 0;
  v_l       integer := 0;
  v_e       integer := 0;
  v_p       integer := 0;
begin
  if p_family is null or coalesce(p_email_hash, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'wired_delete_family: family id and a 64-hex email hash are required' using errcode = '22023';
  end if;
  select lower(btrim(email)) into v_email from public.wired_families where id = p_family for update;
  if v_email is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  select count(*) into v_free from public.wired_children where family_id = p_family and free_slot;
  select max(r.quiz_year) into v_year
    from public.wired_results r join public.wired_children c on c.id = r.child_id
   where c.family_id = p_family;

  insert into public.wired_tombstones (email_hash, free_slots_used, last_quiz_year, deleted_at)
  values (p_email_hash, least(2, v_free), v_year, now())
  on conflict (email_hash) do update
    set free_slots_used = least(2, public.wired_tombstones.free_slots_used + least(2, v_free)),
        last_quiz_year  = greatest(public.wired_tombstones.last_quiz_year, excluded.last_quiz_year),
        deleted_at      = now();

  delete from public.wired_email_queue where family_id = p_family or lower(btrim(email)) = v_email;
  get diagnostics v_q = row_count;
  delete from public.wired_failures where email_lower = v_email;
  get diagnostics v_f = row_count;
  delete from public.nurture_send_log where email_lower = v_email;
  get diagnostics v_l = row_count;
  delete from public.email_events where lower(btrim(recipient)) = v_email;
  get diagnostics v_e = row_count;
  delete from public.wired_pilot_applications where lower(btrim(email)) = v_email; -- NEW (W12)
  get diagnostics v_p = row_count;

  delete from public.wired_families where id = p_family;

  return jsonb_build_object('status', 'deleted', 'queue_rows', v_q, 'failures', v_f, 'send_log', v_l, 'email_events', v_e,
                            'pilot_applications', v_p, 'free_slots_kept', least(2, v_free), 'last_quiz_year', v_year);
end;
$$;
revoke all on function public.wired_delete_family(uuid, text) from public, anon, authenticated;
grant execute on function public.wired_delete_family(uuid, text) to service_role;
