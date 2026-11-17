-- 2026-11-17, Lane 2 deep audit area 10 (founder dashboard), founder tap "Yes, build + ship". Dashboard-only.
-- D1: public.crm_people marked "Customer" only for the retired guide, the retired course or an active app
--     subscription, and held only people who joined a list, so the CRM tab showed 5 customers while 22 people had
--     bought. Now a paid, not refunded or cancelled order (outside addresses) also makes a Customer, and buyers who
--     never joined a list are included. CTEs w, q, hm, nq, pr are copied verbatim from the live view; every existing
--     column keeps its name, order and type; bought_curriculum is appended. Read only by founder_crm_feed /
--     founder_crm_summary (is_founder-guarded); grants unchanged (postgres + service_role only).
-- D2: founder_funnel's active_subscribers uses founder_revenue's rule, so the Funnel and Revenue tabs agree.
--     Body = the live definition plus that one marked change.

create or replace view public.crm_people as
 WITH w AS (
         SELECT lower(TRIM(BOTH FROM waitlist_signups.email)) AS email,
            min(waitlist_signups.entered_at) AS first_seen,
            (array_agg(waitlist_signups.first_name ORDER BY waitlist_signups.entered_at) FILTER (WHERE waitlist_signups.first_name IS NOT NULL))[1] AS first_name,
            (array_agg(waitlist_signups.last_name ORDER BY waitlist_signups.entered_at) FILTER (WHERE waitlist_signups.last_name IS NOT NULL))[1] AS last_name,
            (array_agg(waitlist_signups.entry_funnel::text ORDER BY waitlist_signups.entered_at))[1] AS entry_funnel,
            (array_agg(COALESCE(waitlist_signups.source, '(unattributed)'::text) ORDER BY waitlist_signups.entered_at))[1] AS source,
            (array_agg(waitlist_signups.utm_source ORDER BY waitlist_signups.entered_at) FILTER (WHERE waitlist_signups.utm_source IS NOT NULL))[1] AS utm_source,
            (array_agg(waitlist_signups.utm_campaign ORDER BY waitlist_signups.entered_at) FILTER (WHERE waitlist_signups.utm_campaign IS NOT NULL))[1] AS utm_campaign,
            bool_or(waitlist_signups.unsubscribed_at IS NOT NULL) AS unsubscribed
           FROM waitlist_signups
          WHERE waitlist_signups.email IS NOT NULL AND NOT is_internal_tester(waitlist_signups.email)
          GROUP BY (lower(TRIM(BOTH FROM waitlist_signups.email)))
        ), q AS (
         SELECT lower(TRIM(BOTH FROM quiz_completions.email)) AS email,
            max(quiz_completions.constitution_nickname) AS quiz_pattern,
            max(quiz_completions.completed_at) AS quiz_at,
            bool_or(COALESCE(quiz_completions.purchased_guide, false)) AS bought_guide,
            bool_or(COALESCE(quiz_completions.purchased_course, false)) AS bought_course
           FROM quiz_completions
          WHERE quiz_completions.email IS NOT NULL
          GROUP BY (lower(TRIM(BOTH FROM quiz_completions.email)))
        ), hm AS (
         SELECT lower(TRIM(BOTH FROM magnet_email_queue.recipient_email)) AS email,
            array_to_string(array_agg(DISTINCT magnet_email_queue.band ORDER BY magnet_email_queue.band), ', '::text) AS homeschool_bands,
            count(*) FILTER (WHERE magnet_email_queue.status = 'sent'::text) AS magnet_sent
           FROM magnet_email_queue
          WHERE magnet_email_queue.recipient_email IS NOT NULL
          GROUP BY (lower(TRIM(BOTH FROM magnet_email_queue.recipient_email)))
        ), nq AS (
         SELECT lower(TRIM(BOTH FROM nurture_email_queue.recipient_email)) AS email,
            max(nurture_email_queue.sequence_position) AS nurture_pos,
            count(*) FILTER (WHERE nurture_email_queue.status = 'sent'::text) AS nurture_sent
           FROM nurture_email_queue
          WHERE nurture_email_queue.recipient_email IS NOT NULL
          GROUP BY (lower(TRIM(BOTH FROM nurture_email_queue.recipient_email)))
        ), pr AS (
         SELECT lower(TRIM(BOTH FROM profiles.email)) AS email,
            max(profiles.subscription_tier) AS subscription_tier,
            max(profiles.subscription_status) AS subscription_status,
            bool_or(COALESCE(profiles.is_founding_member, false)) AS is_founding_member
           FROM profiles
          WHERE profiles.email IS NOT NULL
          GROUP BY (lower(TRIM(BOTH FROM profiles.email)))
        ), ob AS (
         -- NEW 2026-11-17 (area 10 D1): everyone with a paid, not refunded or cancelled order (books, printed
         -- sets, Starter, kits), outside addresses only. Before this the CRM never looked at orders.
         SELECT lower(TRIM(BOTH FROM orders.customer_email)) AS email,
            min(orders.created_at) AS first_order_at,
            (array_agg(orders.shipping_name ORDER BY orders.created_at) FILTER (WHERE orders.shipping_name IS NOT NULL))[1] AS shipping_name
           FROM orders
          WHERE orders.customer_email IS NOT NULL
            AND orders.payment_status = 'paid'::text
            AND (orders.status::text <> ALL (ARRAY['refunded'::text, 'cancelled'::text]))
            AND NOT is_internal_email(orders.customer_email)
          GROUP BY (lower(TRIM(BOTH FROM orders.customer_email)))
        ), people AS (
         -- NEW 2026-11-17 (area 10 D1): list sign-ups AND buyers who never joined a list.
         SELECT w_1.email FROM w w_1
        UNION
         SELECT ob_1.email FROM ob ob_1
        )
 SELECT p.email,
    COALESCE(w.first_name, NULLIF(split_part(ob.shipping_name, ' '::text, 1), ''::text)) AS first_name,
    w.last_name,
    COALESCE(w.first_seen, ob.first_order_at) AS first_seen,
    COALESCE(w.entry_funnel, 'purchase'::text) AS entry_funnel,
    COALESCE(w.source, '(purchase)'::text) AS source,
    w.utm_source,
    w.utm_campaign,
    COALESCE(w.unsubscribed, false) AS unsubscribed,
    q.quiz_pattern,
    q.quiz_at,
    COALESCE(q.bought_guide, false) AS bought_guide,
    COALESCE(q.bought_course, false) AS bought_course,
    hm.homeschool_bands,
    COALESCE(hm.magnet_sent, 0::bigint) AS magnet_sent,
    nq.nurture_pos,
    COALESCE(nq.nurture_sent, 0::bigint) AS nurture_sent,
    pr.subscription_tier,
    pr.subscription_status,
    COALESCE(pr.is_founding_member, false) AS is_founding_member,
        CASE
            WHEN COALESCE(q.bought_guide, false) OR COALESCE(q.bought_course, false) OR pr.subscription_status = 'active'::text
                 OR ob.email IS NOT NULL THEN 'Customer'::text
            WHEN q.quiz_pattern IS NOT NULL THEN 'Quiz-taker'::text
            ELSE 'Lead'::text
        END AS stage,
    ob.email IS NOT NULL AS bought_curriculum
   FROM people p
     LEFT JOIN w ON w.email = p.email
     LEFT JOIN q ON q.email = p.email
     LEFT JOIN hm ON hm.email = p.email
     LEFT JOIN nq ON nq.email = p.email
     LEFT JOIN pr ON pr.email = p.email
     LEFT JOIN ob ON ob.email = p.email;

create or replace function public.founder_funnel(p_since timestamp with time zone DEFAULT (now() - '30 days'::interval))
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  result jsonb;
begin
  if not public.is_founder() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    -- Named funnel stages (plan Â§14). quiz_completes/accounts come from
    -- the tables that already record those moments; only clicks are new.
    'stages', jsonb_build_object(
      'quiz_starts', (
        select count(*) from public.cta_events
        where cta = 'quiz-start' and not is_bot and occurred_at >= p_since
      ),
      'quiz_completes', (
        select count(*) from public.quiz_completions
        where completed_at >= p_since
      ),
      'accounts_created', (
        select count(*) from public.profiles
        where created_at >= p_since
      ),
      'seed_cta_clicks', (
        -- Clicks on Seed-labelled upgrade CTAs (cta name contains "seed":
        -- results-upgrade-seed, card-locked-unlock-seed, monograph-*-seed,
        -- favorites-free-seed, etc.). Counted by cta NAME only â€” NOT by
        -- lookup_key â€” so a single Seed checkout journey (which emits both
        -- checkout-intent-signup and checkout-start with a seed_* key) is
        -- not double-counted into this upstream "intent" stage.
        select count(*) from public.cta_events
        where not is_bot and occurred_at >= p_since
          and cta ilike '%seed%'
      ),
      'checkout_starts', (
        select count(*) from public.cta_events
        where cta = 'checkout-start' and not is_bot and occurred_at >= p_since
      ),
      -- 2026-11-17 (area 10 D2): the same rule as founder_revenue's active_total, so the Funnel and Revenue
      -- tabs show one number (internal and test accounts out, the three paid tiers only).
      'active_subscribers', (
        select count(*) from public.profiles
        where subscription_status = 'active'
          and subscription_tier in ('seed', 'root', 'practitioner')
          and not public.is_internal_email(email)
      )
    ),
    'by_cta', (
      select coalesce(jsonb_agg(row_j order by (row_j->>'clicks')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'cta', cta,
          'clicks', count(*),
          'visitors', count(distinct visitor_hash),
          'last', max(occurred_at)
        ) as row_j
        from public.cta_events
        where not is_bot and occurred_at >= p_since
        group by cta
        order by count(*) desc
        limit 40
      ) x
    ),
    'by_path', (
      select coalesce(jsonb_agg(row_j order by (row_j->>'clicks')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'path', path,
          'clicks', count(*)
        ) as row_j
        from public.cta_events
        where not is_bot and occurred_at >= p_since
        group by path
        order by count(*) desc
        limit 20
      ) x
    ),
    'by_checkout_product', (
      select coalesce(jsonb_agg(row_j order by (row_j->>'starts')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'lookup_key', coalesce(lookup_key, '(unknown)'),
          'starts', count(*)
        ) as row_j
        from public.cta_events
        where cta = 'checkout-start' and not is_bot and occurred_at >= p_since
        group by coalesce(lookup_key, '(unknown)')
        order by count(*) desc
      ) x
    ),
    'daily', (
      select coalesce(jsonb_agg(row_j order by row_j->>'day'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'day', (occurred_at at time zone 'America/Chicago')::date,
          'clicks', count(*)
        ) as row_j
        from public.cta_events
        where not is_bot and occurred_at >= p_since
        group by (occurred_at at time zone 'America/Chicago')::date
      ) x
    )
  ) into result;

  return result;
end;
$function$;
