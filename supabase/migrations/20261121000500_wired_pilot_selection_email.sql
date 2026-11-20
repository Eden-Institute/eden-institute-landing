-- 2026-11-20, Wired quiz W12 follow-up (Lane 2b): the pilot selection emails (copy APPROVED by Camila 2026-11-20
-- ~5:44 PM CT, "Use both as written"). DARK: the sender (wired-pdf -> _shared/wired-pilot-email.ts) runs only
-- while WIRED_PILOT_OPEN is "true". Applied only on her own tap.
--
-- 1. wired_pilot_applications.selection_email_kind / _at / _id: which email went (selected | declined), when,
--    and the Resend id. kind set + at null = claimed by a sender run. One email per application, ever.
-- 2. wired_admin_pilot_list adds 'emailed' (the kind once sent) so the founder page shows it.
-- 3. wired_admin_pilot_set_status: once an email has gone, the only change left is 'withdrawn' (a tester who
--    drops out); picking someone she already told "not this round", or the reverse, is refused.

alter table public.wired_pilot_applications
  add column if not exists selection_email_kind text check (selection_email_kind is null or selection_email_kind in ('selected', 'declined')),
  add column if not exists selection_email_at   timestamptz,
  add column if not exists selection_email_id   text;

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
        'created_at', a.created_at,
        'emailed', case when a.selection_email_at is not null then a.selection_email_kind end) order by a.created_at)
      from public.wired_pilot_applications a), '[]'::jsonb),
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
declare
  v_kind text;
begin
  perform public.wired_admin_guard(true);
  if p_status not in ('applied', 'selected', 'declined', 'withdrawn') then
    raise exception 'bad status %', p_status using errcode = '22023';
  end if;
  select selection_email_kind into v_kind from public.wired_pilot_applications where id = p_id for update;
  if not found then raise exception 'no such application' using errcode = '22023'; end if;
  if v_kind is not null and p_status <> 'withdrawn' then
    raise exception 'her email has already gone; only withdrawn is allowed now' using errcode = '22023';
  end if;
  update public.wired_pilot_applications
     set status = p_status, updated_at = now(), decided_at = case when p_status = 'applied' then null else now() end
   where id = p_id;
end;
$$;
revoke all on function public.wired_admin_pilot_list() from public, anon;
revoke all on function public.wired_admin_pilot_set_status(uuid, text) from public, anon;
grant execute on function public.wired_admin_pilot_list() to authenticated, service_role;
grant execute on function public.wired_admin_pilot_set_status(uuid, text) to authenticated, service_role;
