-- founder_traffic: add signups to totals + daily so the dashboard can show
-- overall conversion (signups / visitors) and a sign-ups-per-day strip.
create or replace function public.founder_traffic(p_since timestamp with time zone default (now() - '30 days'::interval))
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
declare result jsonb;
begin
  if not public.is_founder() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'totals', (
      select jsonb_build_object(
        'views', count(*),
        'visitors', count(distinct visitor_hash),
        'signups', (select count(*) from public.waitlist_signups where entered_at >= p_since)
      )
      from public.page_views where occurred_at >= p_since and not is_bot
    ),
    'daily', (
      select coalesce(jsonb_agg(d order by d->>'day'), '[]'::jsonb) from (
        select jsonb_build_object(
          'day', pv.day, 'views', pv.views, 'visitors', pv.visitors,
          'signups', coalesce(s.signups, 0)) as d
        from (
          select (occurred_at at time zone 'America/Chicago')::date as day,
                 count(*) as views, count(distinct visitor_hash) as visitors
          from public.page_views where occurred_at >= p_since and not is_bot
          group by 1
        ) pv
        left join (
          select (entered_at at time zone 'America/Chicago')::date as day, count(*) as signups
          from public.waitlist_signups where entered_at >= p_since
          group by 1
        ) s on s.day = pv.day
      ) x
    ),
    'top_pages', (
      select coalesce(jsonb_agg(p order by (p->>'views')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('path', path, 'views', count(*), 'visitors', count(distinct visitor_hash)) as p
        from public.page_views where occurred_at >= p_since and not is_bot
        group by path order by count(*) desc limit 15
      ) x
    ),
    'sources', (
      select coalesce(jsonb_agg(s order by (s->>'views')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('referrer', coalesce(referrer_host,'(direct)'), 'views', count(*)) as s
        from public.page_views
        where occurred_at >= p_since and not is_bot
          and (referrer_host is null or referrer_host not ilike '%edeninstitute.health%')
        group by coalesce(referrer_host,'(direct)') order by count(*) desc limit 15
      ) x
    ),
    'campaigns', (
      select coalesce(jsonb_agg(c order by (c->>'views')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('campaign', cmp.utm_campaign, 'views', cmp.views, 'signups', coalesce(sg.signups,0)) as c
        from (
          select coalesce(utm_campaign,'(none)') as utm_campaign, count(*) as views
          from public.page_views where occurred_at >= p_since and not is_bot
          group by coalesce(utm_campaign,'(none)')
        ) cmp
        left join (
          select coalesce(utm_campaign,'(none)') as utm_campaign, count(*) as signups
          from public.waitlist_signups where entered_at >= p_since
          group by coalesce(utm_campaign,'(none)')
        ) sg on sg.utm_campaign = cmp.utm_campaign
        order by cmp.views desc limit 15
      ) x
    )
  ) into result;

  return result;
end;
$function$;
