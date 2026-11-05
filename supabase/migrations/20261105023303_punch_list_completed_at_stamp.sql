-- founder_punch_list: stamp completed_at when an item is done (punch #447, 2026-11-05).
--
-- RECORD OF A LIVE CHANGE. This was applied to production on 2026-11-04 ~8:33 PM CT through
-- apply_migration "punch_list_completed_at_stamp", and supabase_migrations.schema_migrations
-- already holds version 20261105023303 for it, so `supabase db push` treats this file as
-- applied and never re-runs it. The SQL below is the statement text stored for that version,
-- read back 2026-11-05 and matched against pg_get_functiondef / pg_get_triggerdef. It is
-- committed only so the repo matches the database.
--
-- Idempotent if it is ever run by hand: `create or replace function`, then the trigger is
-- dropped if it exists and recreated, and the comment is replaced. No table, column or grant
-- is created, so the new-table grant rule (src/test/newTableGrants.test.ts) does not apply.
-- The function keeps Postgres's default EXECUTE for PUBLIC, exactly as live; a trigger
-- function cannot be called except as a trigger.
--
-- Founder 2026-11-04: "We need to have a completion date on everything that we do."
-- Stamp completed_at the moment a punch item becomes 'done' (unless a real date was supplied),
-- and clear it if a done item is reopened, so every finished item carries its date.
create or replace function public.tg_punch_list_completed_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'done' then
    if new.completed_at is null then
      new.completed_at := now();
    end if;
  elsif tg_op = 'UPDATE' and old.status = 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_punch_list_completed_at on public.founder_punch_list;
create trigger trg_punch_list_completed_at
  before insert or update of status, completed_at on public.founder_punch_list
  for each row execute function public.tg_punch_list_completed_at();

comment on function public.tg_punch_list_completed_at() is
  'Founder 2026-11-04: every done punch item carries completed_at. Sets now() when status becomes done with no date; clears it when a done item is reopened.';
