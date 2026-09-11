-- Outbound clicks + Foundations Course funnel.
--
-- Why: the Foundations Course ($97) sells on LearnWorlds, outside our Stripe,
-- so nothing on this side has ever shown whether the course CTAs on the site
-- do anything. Resend logs the EMAIL clicks (public.email_events), and
-- course_sales will hold purchases once the LearnWorlds webhook is wired, but
-- a click on the site itself (courses page, Results, the Deep-Dive guide, the
-- Tier 2 card, the homepage journey CTA) went straight to
-- learn.edeninstitute.health and left no row anywhere. Since July, 550 email
-- clicks were logged and only 4 of them went to the course; site clicks were
-- simply unknown, so "is the course worth keeping" could not be answered.
--
-- Every site link to the course now points at /go/course?src=<page>, a Vercel
-- function (api/go/course.ts) that writes one row here and 302s on to the
-- course. founder_course_funnel stitches the three stages together for the
-- founder dashboard (RevenueTab):
--   1. Site clicks   → public.outbound_clicks   (this migration, via api/go/course.ts)
--   2. Email clicks  → public.email_events      (Resend webhook, already live)
--   3. Sales         → public.course_sales      (LearnWorlds webhook)
--
-- `target` is generic on purpose: the same table can log any other off-site
-- destination later (e.g. 'book') without another migration.

create table if not exists public.outbound_clicks (
  id           bigint generated always as identity primary key,
  target       text not null,        -- what was clicked, e.g. 'course'
  source       text,                 -- which page/CTA sent them: 'courses','results','guide','tier2','journey'
  referer      text,                 -- Referer header as received (often null; browsers strip it)
  path         text,                 -- request path incl. query, e.g. /go/course?src=results
  user_agent   text,
  occurred_at  timestamptz not null default now()
);

comment on table public.outbound_clicks is
  'Clicks from the site to an off-site destination we cannot otherwise see (today: the Foundations Course on LearnWorlds). Written by the Vercel function api/go/course.ts (service role) before it 302s the visitor on. RLS-walled, service-role only. Read by founder_course_funnel for the dashboard.';

create index if not exists outbound_clicks_occurred_at_idx on public.outbound_clicks (occurred_at);

alter table public.outbound_clicks enable row level security;
-- No policies: service-role only (mirrors course_sales / email_events).

-- ── Course funnel RPC ──
-- SECURITY DEFINER + is_founder() gate, matching founder_revenue etc.
-- All stages are windowed by p_since.
--
-- Email timing: email_events.occurred_at is the SEND time of the message, not
-- the event time (the webhook copies data.created_at of the email, not of the
-- open/click). The real event time is raw->>'created_at' when present, so the
-- window uses that and falls back to occurred_at. The cast is guarded because
-- raw->>'created_at' can be null or something that is not a timestamp.
--
-- email_cta_opens counts people who opened an email that actually carries the
-- course link. Verified against the templates on 2026-09-10:
--   constitution_2..5  → _shared/nurture-email-templates.ts (buildNurtureEmail2..5)
--   arc_1              → _shared/nurture-email-templates.ts (buildNurtureArc1, ARC_COURSE_URL)
--   magnet_w4_course   → _shared/homeschool-followup-templates.ts (COURSE_URL)
create or replace function public.founder_course_funnel(p_since timestamptz)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
begin
  if not public.is_founder() then
    raise exception 'Not authorized';
  end if;

  select json_build_object(
    'site_clicks', (
      select count(*) from public.outbound_clicks
      where target = 'course' and occurred_at >= p_since
    ),
    'site_clicks_by_source', coalesce((
      select json_agg(json_build_object('source', s.source, 'clicks', s.clicks) order by s.clicks desc, s.source)
      from (
        select coalesce(source, 'unknown') as source, count(*) as clicks
        from public.outbound_clicks
        where target = 'course' and occurred_at >= p_since
        group by coalesce(source, 'unknown')
      ) s
    ), '[]'::json),
    'email_clicks', (
      select count(*) from public.email_events e
      where e.event_type = 'clicked'
        and e.clicked_url ilike '%learn.edeninstitute.health%'
        and (case when e.raw->>'created_at' ~ '^\d{4}-' then (e.raw->>'created_at')::timestamptz else e.occurred_at end) >= p_since
    ),
    'email_clickers', (
      select count(distinct e.recipient) from public.email_events e
      where e.event_type = 'clicked'
        and e.clicked_url ilike '%learn.edeninstitute.health%'
        and (case when e.raw->>'created_at' ~ '^\d{4}-' then (e.raw->>'created_at')::timestamptz else e.occurred_at end) >= p_since
    ),
    'email_cta_opens', (
      select count(distinct e.recipient) from public.email_events e
      where e.event_type = 'opened'
        and e.email_key in ('constitution_2','constitution_3','constitution_4','constitution_5','arc_1','magnet_w4_course')
        and (case when e.raw->>'created_at' ~ '^\d{4}-' then (e.raw->>'created_at')::timestamptz else e.occurred_at end) >= p_since
    ),
    'sales', (
      select count(*) from public.course_sales where occurred_at >= p_since
    ),
    'revenue_cents', coalesce((
      select sum(amount_cents) from public.course_sales where occurred_at >= p_since
    ), 0)
  ) into result;

  return result;
end;
$$;

grant execute on function public.founder_course_funnel(timestamptz) to authenticated;
