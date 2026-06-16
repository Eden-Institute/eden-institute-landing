-- Email engagement tracking — opens + clicks from the Resend webhook.
--
-- Why: the founder dashboard needs to answer "which nurture email gets
-- engagement, and which CTA gets clicked." Resend already knows this; we just
-- have to capture the email.opened / email.clicked webhook events (which
-- resend-webhook currently ignores) into a durable table the dashboard can
-- aggregate. Each nurture send is tagged (campaign + email_key) so events
-- attribute back to a specific email without a separate sends-log join.
--
-- Prerequisite to data flowing (operator action, not code):
--   1. Resend dashboard → enable Open tracking + Click tracking on the
--      edeninstitute.health sending domain.
--   2. Resend webhook endpoint → subscribe email.opened + email.clicked
--      (in addition to the existing bounced/complained/contact events).
-- Until both are on, this table simply stays empty — nothing breaks.

create table if not exists public.email_events (
  id            bigint generated always as identity primary key,
  resend_email_id text,                 -- Resend message id (data.email_id)
  event_type    text not null check (event_type in ('opened','clicked','delivered','bounced','complained')),
  recipient     text,                   -- lowercased recipient address
  campaign      text,                   -- list/funnel, e.g. 'constitution','homeschool'
  email_key     text,                   -- specific email, e.g. 'constitution_2','arc_1','magnet_w2_sprouts'
  clicked_url   text,                   -- populated for 'clicked' (data.click.link)
  occurred_at   timestamptz not null default now(),  -- event time per Resend (data.created_at)
  raw           jsonb,                  -- full event payload for forensics
  inserted_at   timestamptz not null default now()
);

comment on table public.email_events is
  'Resend open/click engagement events for the founder dashboard. Written by the resend-webhook EF (service role). RLS-walled, service-role only. Stays empty until Open+Click tracking is enabled in Resend and the two events are subscribed at the webhook endpoint.';

-- Dedupe: Resend/svix can redeliver the same event. One row per
-- (email_id, type, url, occurred_at). Expression index handles NULL urls.
create unique index if not exists email_events_dedupe_idx
  on public.email_events (resend_email_id, event_type, coalesce(clicked_url, ''), occurred_at);

create index if not exists email_events_email_key_idx on public.email_events (email_key);
create index if not exists email_events_occurred_at_idx on public.email_events (occurred_at);

alter table public.email_events enable row level security;
-- No policies: service-role only (mirrors email_list_unsubscribes / feedback_submissions).

-- ── Founder aggregate RPC ──
-- SECURITY DEFINER + is_founder() gate, matching founder_lead_summary etc.
create or replace function public.founder_email_engagement(p_since timestamptz)
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
    -- Per-email rollup: opens / unique opens / clicks / unique clicks.
    'by_email', coalesce((
      select json_agg(row_to_json(t)) from (
        select
          email_key,
          campaign,
          count(*) filter (where event_type = 'opened')                       as opens,
          count(distinct recipient) filter (where event_type = 'opened')      as unique_opens,
          count(*) filter (where event_type = 'clicked')                      as clicks,
          count(distinct recipient) filter (where event_type = 'clicked')     as unique_clicks
        from public.email_events
        where occurred_at >= p_since
          and email_key is not null
        group by email_key, campaign
        order by clicks desc, opens desc
      ) t
    ), '[]'::json),
    -- Per-CTA rollup: which destination URL gets the clicks, per email.
    'by_cta', coalesce((
      select json_agg(row_to_json(u)) from (
        select
          email_key,
          clicked_url,
          count(*)                  as clicks,
          count(distinct recipient) as unique_clicks
        from public.email_events
        where occurred_at >= p_since
          and event_type = 'clicked'
          and clicked_url is not null
        group by email_key, clicked_url
        order by clicks desc
        limit 200
      ) u
    ), '[]'::json)
  ) into result;

  return result;
end;
$$;

grant execute on function public.founder_email_engagement(timestamptz) to authenticated;
