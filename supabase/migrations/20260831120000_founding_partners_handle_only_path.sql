-- Founding partners: a handle-only path for partners served outside email.
--
-- WHY: some creators never receive a welcome email at all. The `/partner-sample?k=` link is
-- pasted straight into the Instagram DM, so there is no Gmail Sent copy, no address on file,
-- and `founding_partners.email` was NOT NULL, which made the row impossible to create. The
-- partner has the sample and is perfectly happy, but she is invisible to the entire follow-up
-- cadence and to the founder dashboard. Mariama (@ Biblical Motherhood + Spirit-led Homeschool)
-- was served this way on 2026-08-20 and was found only by reading the Partnership inbox by hand
-- on 2026-08-31.
--
-- This is the same failure class as the 2026-08-17 incident: a partner served on a rail the
-- tooling does not watch is one the tooling reports as fine, every week, forever.
--
-- THE DANGER THIS MIGRATION MUST NOT CREATE. Simply dropping NOT NULL is not safe on its own.
-- `partner-followup-check` selects everything not in ('responded','declined','resting') and then
-- drafts a Gmail reply to that partner's address. A row with a null email would be selected as
-- DUE and the task would draft to nobody, and its reconcile step would run `in:sent to:` with an
-- empty address. So the row must be INERT by construction, which is what `awaiting_email` and the
-- guards below are for. A handle-only partner is recorded, visible, and never mailed.
--
-- Applied to production 2026-08-31 via the Management API (the Supabase MCP is read-only).
-- This file exists so `db push` stays a no-op and the schema is reproducible from the repo.
-- Fully idempotent.

-- 1. The column itself.
--    Safe on existing data: all 46 rows at time of writing carry an email, so nothing changes.
--    NOTE: `founding_partners_email_key` is a plain UNIQUE btree. Postgres treats NULLs as
--    distinct, so many handle-only rows can coexist without colliding. No index change needed.
--    NOTE: `founding_partners_email_lower_ck` is CHECK (email = lower(email)), which evaluates
--    to NULL (and therefore passes) on a null email. No constraint change needed there either.
alter table public.founding_partners
  alter column email drop not null;

comment on column public.founding_partners.email is
  'Nullable since 2026-08-31. NULL means the partner was served outside email (an Instagram DM link) and no address is known. Such a row must carry status = ''awaiting_email'' and is excluded from the follow-up cadence until an address arrives.';

-- 2. A row must still be reachable somehow. Email or handle, at least one.
--    Without this, dropping NOT NULL would permit a row identifying nobody at all.
alter table public.founding_partners
  drop constraint if exists founding_partners_contact_ck;

alter table public.founding_partners
  add constraint founding_partners_contact_ck
  check (email is not null or handle is not null);

-- 3. The new status. The cadence already skips rows by status, so this is the natural lever:
--    'awaiting_email' = we owe this partner nothing, we owe ourselves an address for her.
alter table public.founding_partners
  drop constraint if exists founding_partners_status_ck;

alter table public.founding_partners
  add constraint founding_partners_status_ck
  check (status = any (array[
    'draft_created'::text,
    'sent'::text,
    'followed_up'::text,
    'responded'::text,
    'declined'::text,
    'resting'::text,
    'awaiting_email'::text
  ]));

comment on column public.founding_partners.status is
  'draft_created | sent | followed_up | responded | declined | resting | awaiting_email. The last four are all terminal for the cadence. awaiting_email means served on Instagram with no address on file: recorded, never mailed, waiting on Camila to supply the address.';

-- 4. Belt and braces on the reader that drives the founder dashboard.
--    Status alone would be enough if every caller respected it, but a null email reaching the
--    draft step is severe enough to guard twice. `founder_partner_due()` now refuses to surface
--    a partner it would be impossible to actually write to.
create or replace function public.founder_partner_due()
returns table (
  name           text,
  email          text,
  handle         text,
  welcome_sent_at timestamptz,
  last_touch_at  timestamptz,
  follow_ups     integer,
  next_due       date,
  days_overdue   integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_founder() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  return query
  select p.name, p.email, p.handle, p.welcome_sent_at, p.last_touch_at, p.follow_ups,
         d.next_due,
         greatest(0, (current_date - d.next_due))::integer as days_overdue
  from public.founding_partners p
  cross join lateral (
    select (coalesce(p.last_touch_at, p.welcome_sent_at)
            + case p.follow_ups
                when 0 then interval '28 days'   -- welcome -> +28
                when 1 then interval '21 days'   -- -> +21
                when 2 then interval '21 days'   -- -> +21
                else null                        -- sequence spent, rests
              end)::date as next_due
  ) d
  where d.next_due is not null
    and coalesce(p.welcome_sent_at, p.last_touch_at) is not null
    -- Added 2026-08-31 with the handle-only path. A partner with no address cannot be
    -- followed up, so showing her as "due" would be an instruction nobody can carry out.
    and p.email is not null
    and p.status <> 'awaiting_email'
  order by d.next_due asc;
end;
$$;

revoke execute on function public.founder_partner_due() from public, anon;
grant  execute on function public.founder_partner_due() to authenticated;

-- 5. A companion reader, so the handle-only partners are visible SOMEWHERE rather than merely
--    excluded. Without this the migration would trade a loud gap for a quiet one.
create or replace function public.founder_partner_awaiting_email()
returns table (
  id             uuid,
  name           text,
  handle         text,
  welcome_sent_at timestamptz,
  days_waiting   integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_founder() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  return query
  select p.id, p.name, p.handle, p.welcome_sent_at,
         greatest(0, (current_date - p.welcome_sent_at::date))::integer as days_waiting
  from public.founding_partners p
  where p.email is null
  order by p.welcome_sent_at asc nulls last;
end;
$$;

revoke execute on function public.founder_partner_awaiting_email() from public, anon;
grant  execute on function public.founder_partner_awaiting_email() to authenticated;
