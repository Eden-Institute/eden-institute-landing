-- 20260916090000_revoke_client_view_writes.sql
--
-- SECURITY FIX, applied to production 2026-09-15 by Management API and recorded
-- in the migration history under this version.
--
-- Found during the Appendix B herb-tier work: anon and authenticated held the
-- full default table privileges (INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES,
-- TRIGGER) on public views. Several of those views are auto-updatable and run
-- with the owner's rights (no security_invoker), so a request with only the
-- public site key could write through them to the base table, bypassing RLS:
--   herbs_directory_v, herbs_public         -> public.herbs
--   contraindications_safety_v              -> public.contraindications
--   print_products_public                   -> public.products (retail prices)
-- No client or edge function writes through any view (grep of src/, web/,
-- api/, supabase/functions on 2026-09-15). Reads are unchanged: SELECT stays.
-- A check of products and herbs on 2026-09-15 showed no sign of tampering
-- (last product change 2026-09-12, herbs 2026-07-14, prices as expected).
--
-- Idempotent. Applies to every view in public, so a future view created with
-- default grants is covered by re-running this block (or by the assertion
-- below failing in a later migration that copies it).

do $revoke$
declare
  v record;
begin
  for v in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('v', 'm')
  loop
    execute format(
      'revoke insert, update, delete, truncate, references, trigger on public.%I from public, anon, authenticated',
      v.relname
    );
  end loop;
end
$revoke$;

-- Fail loudly if any client role can still write through a public view.
do $assert$
declare
  bad text;
begin
  select string_agg(format('%s:%s', c.relname, r.rolname), ', ')
    into bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join (values ('anon'), ('authenticated')) as r(rolname)
  where n.nspname = 'public'
    and c.relkind in ('v', 'm')
    and (
      has_table_privilege(r.rolname, c.oid, 'INSERT')
      or has_table_privilege(r.rolname, c.oid, 'UPDATE')
      or has_table_privilege(r.rolname, c.oid, 'DELETE')
      or has_table_privilege(r.rolname, c.oid, 'TRUNCATE')
    );
  if bad is not null then
    raise exception 'client roles can still write through public views: %', bad;
  end if;
end
$assert$;
