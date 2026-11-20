-- 2026-11-20, Wired quiz W10 (Lane 2b): staleness punch rows + the funnel views. Camila's go via Lane NP;
-- applied only on her own tap. Spec section 12 (staleness), section 15 (reporting), answer 17.
--
-- 1. One open/deferred punch row per title for the Wired staleness rows only (answer 17): a partial unique
--    index scoped to titles starting 'Wired quiz: re-verify ' or 'Wired quiz: June sweep', so no other lane's
--    rows are affected. After she marks one done, a later stale period may create a fresh row.
-- 2. public.wired_funnel_daily: one row per Central day (last 400 days): wired button clicks (cta 'wired'),
--    starts (cta 'wired_start'), completions (mom's child quizzes, by band), new learner emails (new families),
--    Blueprint and Family Map purchases. Bots excluded. Counts only, no child data. The daily digest and the
--    weekly briefing read the same numbers from here.
-- 3. public.wired_clicks_by_placement_daily: wired button clicks per Central day per placement (W11 buttons).
-- Both views: security_invoker, service role only.

create unique index if not exists founder_punch_list_wired_stale_open
  on public.founder_punch_list (title)
  where status in ('open', 'deferred')
    and (title like 'Wired quiz: re-verify %' or title like 'Wired quiz: June sweep%');

create or replace view public.wired_funnel_daily with (security_invoker = true) as
with days as (
  select d::date as day
  from generate_series((now() at time zone 'America/Chicago')::date - 400, (now() at time zone 'America/Chicago')::date, interval '1 day') d
),
clicks as (
  select (occurred_at at time zone 'America/Chicago')::date as day,
         count(*) filter (where cta = 'wired') as clicks,
         count(*) filter (where cta = 'wired_start') as starts
  from public.cta_events
  where cta in ('wired', 'wired_start') and coalesce(is_bot, false) = false
  group by 1
),
done as (
  select (completed_at at time zone 'America/Chicago')::date as day,
         count(*) as completions,
         count(*) filter (where grade_at_quiz between 0 and 2) as completions_k2,
         count(*) filter (where grade_at_quiz between 3 and 5) as completions_g3_5,
         count(*) filter (where grade_at_quiz between 6 and 8) as completions_g6_8,
         count(*) filter (where grade_at_quiz between 9 and 12) as completions_g9_12
  from public.wired_sessions
  where rater_role = 'mom' and child_id is not null and completed_at is not null and not is_pilot_retake
  group by 1
),
fams as (
  select (created_at at time zone 'America/Chicago')::date as day, count(*) as new_families
  from public.wired_families group by 1
),
buys as (
  select (purchased_at at time zone 'America/Chicago')::date as day,
         count(*) filter (where product = 'blueprint') as blueprints,
         count(*) filter (where product in ('family_map', 'blueprint_upgrade', 'family_map_upgrade')) as family_maps
  from public.wired_buyers group by 1
)
select d.day,
       coalesce(c.clicks, 0)::int as clicks,
       coalesce(c.starts, 0)::int as starts,
       coalesce(x.completions, 0)::int as completions,
       coalesce(x.completions_k2, 0)::int as completions_k2,
       coalesce(x.completions_g3_5, 0)::int as completions_g3_5,
       coalesce(x.completions_g6_8, 0)::int as completions_g6_8,
       coalesce(x.completions_g9_12, 0)::int as completions_g9_12,
       coalesce(f.new_families, 0)::int as new_learner_emails,
       coalesce(b.blueprints, 0)::int as blueprints,
       coalesce(b.family_maps, 0)::int as family_maps
from days d
left join clicks c on c.day = d.day
left join done x on x.day = d.day
left join fams f on f.day = d.day
left join buys b on b.day = d.day;

create or replace view public.wired_clicks_by_placement_daily with (security_invoker = true) as
select (occurred_at at time zone 'America/Chicago')::date as day,
       coalesce(placement, 'unknown') as placement,
       count(*)::int as clicks
from public.cta_events
where cta = 'wired' and coalesce(is_bot, false) = false
group by 1, 2;

revoke all on public.wired_funnel_daily from anon, authenticated;
revoke all on public.wired_clicks_by_placement_daily from anon, authenticated;
grant select on public.wired_funnel_daily to service_role;
grant select on public.wired_clicks_by_placement_daily to service_role;
