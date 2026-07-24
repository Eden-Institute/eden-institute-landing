-- Founding-partner roster + engagement RPC for the founder dashboard.
--
-- Why this exists: the founding-partner roster has lived only in a markdown file
-- (Biblical Herbalism/Partner Program/partner_tracker.md). That is fine for a human
-- but invisible to the dashboard, so there has been no way to see at a glance which
-- partners opened or clicked the six-week sample. This puts the roster in Postgres
-- and joins it to public.email_events.
--
-- Scope discipline: the markdown tracker keeps carrying the narrative (per-partner
-- notes, at-cost Stripe link mapping, follow-up cadence). This table carries only
-- what the dashboard needs to render and to join on. The two are expected to coexist;
-- the table is the SSOT for "who is a partner and when were they welcomed".
--
-- Related: 2026-07-24 deliverability incident. The root domain had no SPF record, so
-- Gmail-sent partner mail passed DMARC on DKIM alone and at least one hotmail.com
-- partner never received it. Partner mail now goes out via Resend (SPF + DKIM both
-- aligned), which is also the only rail that produces open/click events at all.

begin;

-- ── 1. The roster ───────────────────────────────────────────────────────────
--
-- email is the join key to email_events.recipient, which the resend-webhook EF
-- writes lower-cased. Store it lower-cased here too and enforce it, so the join
-- never silently misses on a capitalised address.

create table if not exists public.founding_partners (
  id              uuid primary key default gen_random_uuid(),
  name            text        not null,
  email           text        not null,
  handle          text,                       -- social handle, nullable: not known for every partner
  welcome_sent_at timestamptz,                -- NULL = welcome not sent yet. The follow-up clock reads this.
  status          text        not null default 'sent',
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint founding_partners_email_lower_ck check (email = lower(email)),
  constraint founding_partners_status_ck check (
    status in ('draft_created','sent','followed_up','responded','declined','resting')
  )
);

create unique index if not exists founding_partners_email_key
  on public.founding_partners (email);

-- ── 2. RLS: no policies, by design ──────────────────────────────────────────
--
-- Reads reach the dashboard only through the SECURITY DEFINER RPC below, which
-- checks is_founder(). Writes go through the service role, which bypasses RLS.
-- So there is deliberately no permissive policy here: an authenticated non-founder
-- gets nothing from a direct PostgREST select.
--
-- Also strip the default anon/authenticated write grants. Per the 2026-07-20 RPC
-- hardening migration, Supabase grants these by default and RLS alone should not be
-- the single thing standing between anon and a table.

alter table public.founding_partners enable row level security;

revoke insert, update, delete, truncate on public.founding_partners
  from anon, authenticated;

-- ── 3. Seed the four known partners ─────────────────────────────────────────
--
-- Send dates verified 2026-07-24 against Gmail Sent, message by message, because the
-- markdown tracker had drifted and still showed all three of the 07-23 sends as
-- unsent drafts. Handles are left NULL where not confirmed rather than guessed.
--
-- ON CONFLICT DO NOTHING so this is safe to re-run and never clobbers a later edit.

insert into public.founding_partners (name, email, handle, welcome_sent_at, status, notes)
values
  ('Amy Fewell', 'amy@amyfewell.com', null,
   '2026-07-22 21:59:07+00', 'sent',
   'Sent by founder. Has a separate live guest-pitch thread.'),
  ('Aubrey', 'heyaubreyco@gmail.com', null,
   '2026-07-23 22:38:14+00', 'sent',
   'First name confirmed by founder, not inferred from the address.'),
  ('Karyn', 'karyn_elizabeth@hotmail.com', null,
   '2026-07-23 22:48:42+00', 'sent',
   'First name confirmed by founder, not inferred from the address.'),
  ('Christy Kendall', 'christykendall12@hotmail.com', '@fromthestates',
   '2026-07-23 12:55:57+00', 'sent',
   'Alaska homeschool mom. Reported non-receipt 2026-07-24; cause was the missing root SPF record. Re-sent via Resend. Do NOT use info@fromthestates.shop, unrelated company sharing the FB vanity URL.')
on conflict (email) do nothing;

-- ── 4. The engagement RPC ───────────────────────────────────────────────────
--
-- Deliberately takes NO p_since, unlike the sibling founder_* RPCs. Those measure
-- campaigns inside a window. This is a small, long-running relationship list where
-- "did Christy ever open it" is the question, and a 7-day window would render that
-- as a zero. Lifetime totals only, and the UI says so.
--
-- LEFT JOIN so a partner with no events still appears as a row. A partner who is
-- missing from the list is a different problem from a partner who has not engaged,
-- and the dashboard should not conflate them.
--
-- Open counts are NOT trustworthy on their own: an open is a tracking pixel loading,
-- and Outlook/Hotmail block images by default while Apple Mail pre-fetches them. Two
-- of the four partners here are on hotmail.com. Clicks are the honest signal, so the
-- ordering puts clicks first and the UI labels opens as unreliable.

create or replace function public.founder_partner_engagement()
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  result json;
begin
  if not public.is_founder() then
    raise exception 'Not authorized';
  end if;

  select coalesce(json_agg(row_to_json(t) order by t.clicks desc, t.opens desc, t.name), '[]'::json)
  into result
  from (
    select
      fp.name,
      fp.email,
      fp.handle,
      fp.status,
      fp.welcome_sent_at,
      count(*) filter (where e.event_type = 'opened')  as opens,
      count(*) filter (where e.event_type = 'clicked') as clicks,
      min(e.occurred_at) filter (where e.event_type = 'opened')  as first_open,
      max(e.occurred_at) filter (where e.event_type = 'clicked') as last_click,
      coalesce(
        json_agg(distinct e.clicked_url) filter (where e.event_type = 'clicked' and e.clicked_url is not null),
        '[]'::json
      ) as clicked_urls
    from public.founding_partners fp
    left join public.email_events e
      on lower(e.recipient) = fp.email
    group by fp.id, fp.name, fp.email, fp.handle, fp.status, fp.welcome_sent_at
  ) t;

  return result;
end;
$function$;

-- Creating a function resets its ACL to Supabase's defaults, which include an explicit
-- grant to anon. Naming anon here is required; `revoke ... from public` alone does not
-- remove it. Same lesson as the 2026-07-20 hardening migration.
revoke execute on function public.founder_partner_engagement() from public, anon;
grant execute on function public.founder_partner_engagement() to authenticated;

commit;
