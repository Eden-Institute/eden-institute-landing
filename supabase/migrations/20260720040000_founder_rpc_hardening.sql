-- Founder RPC hardening: grants, search_path, and three metrics that did not mean
-- what their labels said.
--
-- From the 2026-07-19 dashboard audit. Nothing here was exploitable and nothing here was
-- crashing; every item is a number that reads plausibly and is wrong, or a defense layer
-- that silently eroded.

begin;

-- ── 1. Close the anon EXECUTE grants ────────────────────────────────────────
--
-- Nine admin RPCs are callable by the `anon` role. Not exploitable: every body checks
-- is_founder() first and an anon JWT carries no email claim, so all nine correctly refuse.
-- But the function BODY runs before refusing, which means the in-body check is the only
-- thing between an anonymous caller and the orders/payments tables.
--
-- Root cause, worth recording so it stops recurring: Supabase's default privileges grant
-- EXECUTE to anon and authenticated on every function created in `public`. Writing
--     revoke all on function f from public;
-- does NOT remove that grant, because it is an explicit grant to `anon`, not to PUBLIC.
-- The migrations that got this right (founder_lead_feed, founder_lead_summary,
-- founder_traffic, founder_funnel) all say `from public, anon` and their live ACLs are
-- clean. The ones below said only `from public`. Always name anon explicitly.

-- Driven off pg_proc rather than a literal list, because founder_crm_feed and
-- founder_crm_summary currently exist ONLY in production: no migration in this repo
-- defines them (flagged separately in the audit). Naming them literally would make this
-- file fail on a fresh `supabase db reset`, which is exactly the kind of migration that
-- gets deleted in a hurry later. This form is correct in both environments and simply
-- skips what is not there.

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'founder_orders', 'founder_payments', 'founder_revenue',
        'founder_email_engagement', 'founder_crm_feed', 'founder_crm_summary',
        'feedback_triage', 'feedback_merge', 'feedback_promote'
      )
  loop
    execute format('revoke execute on function %s from public, anon', fn.sig);
    execute format('grant execute on function %s to authenticated', fn.sig);
    raise notice 'locked down %', fn.sig;
  end loop;
end $$;

-- ── 2. Pin pg_temp in SECURITY DEFINER search paths ─────────────────────────
--
-- Postgres searches pg_temp FIRST for relations when it is not explicitly listed, so a
-- role able to create temp tables could shadow `orders` or `payments` inside a definer
-- function. No reachable path was found from a PostgREST client, so this is hardening
-- rather than a live hole, but the sibling functions all do it and these four drifted.
--
-- Same existence-driven form, same reason.

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname in (
        'founder_payments', 'founder_email_engagement',
        'founder_crm_feed', 'founder_crm_summary'
      )
      and not coalesce(array_to_string(p.proconfig, ',') like '%pg_temp%', false)
  loop
    execute format('alter function %s set search_path = public, pg_temp', fn.sig);
  end loop;
end $$;

-- ── 3. founder_orders: stop counting our own test orders as sales ───────────
--
-- Live at time of writing: the Orders tab reported $14.97 gross while the payments panel
-- one tab over reported $4.99 for the same money. The difference is entirely internal
-- test purchases. is_internal_email() already existed and simply was not applied here.
--
-- Definition below is the live one (pg_get_functiondef), changed in exactly four places:
--   * summary aggregates exclude internal orders
--   * internal_cents / internal_count exposed so the gap to Stripe stays explainable
--   * is_internal returned per row so the UI can grey them rather than hide them
--   * search_path gains pg_temp
-- Everything else, including the correlated subqueries for items and messages, is
-- untouched. Those subqueries are deliberately NOT joins: a join would fan out one row
-- per line item and inflate gross_cents.

create or replace function public.founder_orders(p_since timestamptz)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $function$
  select case
    when not public.is_founder() then jsonb_build_object('error', 'Not authorized')
    else jsonb_build_object(
      'summary', (
        select jsonb_build_object(
          'total',         count(*) filter (where not public.is_internal_email(customer_email)),
          'preorder_hold', count(*) filter (where status = 'preorder_hold' and not public.is_internal_email(customer_email)),
          'cancelled',     count(*) filter (where status = 'cancelled' and not public.is_internal_email(customer_email)),
          'refunded',      count(*) filter (where status = 'refunded' and not public.is_internal_email(customer_email)),
          -- SMS opt-ins previously counted cancelled and refunded orders, overstating the
          -- messageable list. Every other field here filters terminal statuses.
          'sms_consent',   count(*) filter (where sms_consent
                                              and status not in ('cancelled','refunded')
                                              and not public.is_internal_email(customer_email)),
          'gross_cents',   coalesce(sum(amount_total_cents) filter (
                             where status not in ('cancelled','refunded')
                               and not public.is_internal_email(customer_email)), 0),
          'tax_cents',     coalesce(sum(tax_cents) filter (
                             where status not in ('cancelled','refunded')
                               and not public.is_internal_email(customer_email)), 0),
          'internal_cents', coalesce(sum(amount_total_cents) filter (
                             where status not in ('cancelled','refunded')
                               and public.is_internal_email(customer_email)), 0),
          'internal_count', count(*) filter (where public.is_internal_email(customer_email))
        )
        from orders
        where created_at >= p_since
      ),
      'orders', (
        select coalesce(jsonb_agg(row_to_json(o)), '[]'::jsonb)
        from (
          select
            ord.id, ord.order_number, ord.customer_email, ord.shipping_name, ord.status,
            ord.amount_total_cents, ord.tax_cents, ord.currency,
            ord.sms_consent, ord.is_preorder, ord.product_label, ord.created_at,
            public.is_internal_email(ord.customer_email) as is_internal,
            (
              select coalesce(jsonb_agg(jsonb_build_object(
                'sku', p.sku,
                'name', p.name,
                'quantity', oi.quantity,
                'unit_price_cents', oi.unit_price_cents,
                'is_founding', oi.is_founding)), '[]'::jsonb)
              from order_items oi
              join products p on p.id = oi.product_id
              where oi.order_id = ord.id
            ) as items,
            (
              select coalesce(jsonb_agg(jsonb_build_object(
                'channel', ml.channel,
                'template_key', ml.template_key,
                'status', ml.status,
                'created_at', ml.created_at)
                order by ml.created_at), '[]'::jsonb)
              from message_log ml
              where ml.order_id = ord.id
            ) as messages
          from orders ord
          where ord.created_at >= p_since
          order by ord.created_at desc
          limit 500
        ) o
      )
    )
  end;
$function$;

-- ── 4. founder_revenue: stop reading a boolean latch as a sales figure ──────
--
-- 'guide.purchased_total' counted rows in quiz_completions where purchased_guide = true.
-- Three separate ways that misleads, all of them live:
--   * quiz_completions is UNIQUE on lower(email), so a second purchase by the same person
--     re-sets an already-true boolean. This is the exact bug that started the 07-19
--     investigation, and it survived the first fix because that fix only added the orders
--     record; this card kept reading the old source.
--   * a buyer who never took the quiz has no row at all, so their sale can never appear.
--     The webhook logs this case explicitly.
--   * internal purchases were counted as customer sales.
--
-- The payments ledger already answers this correctly, so read from it. Both figures are
-- returned because they answer different questions and the old name answered neither
-- reliably: buyers = distinct people, sales = transactions.
--
-- Subscription counts get the same internal-exclusion treatment; the root subscription is
-- the founder's own and was being reported as a customer.

create or replace function public.founder_revenue(p_since timestamptz)
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

  select json_build_object(
    'subscriptions', json_build_object(
      'active_seed', (select count(*) from public.profiles
                       where subscription_status = 'active' and subscription_tier = 'seed'
                         and not public.is_internal_email(email)),
      'active_root', (select count(*) from public.profiles
                       where subscription_status = 'active' and subscription_tier = 'root'
                         and not public.is_internal_email(email)),
      'active_practitioner', (select count(*) from public.profiles
                       where subscription_status = 'active' and subscription_tier = 'practitioner'
                         and not public.is_internal_email(email)),
      'active_total', (select count(*) from public.profiles
                       where subscription_status = 'active'
                         and subscription_tier in ('seed','root','practitioner')
                         and not public.is_internal_email(email)),
      'canceled', (select count(*) from public.profiles
                       where subscription_status = 'canceled'
                         and not public.is_internal_email(email))
    ),
    'guide', json_build_object(
      -- Distinct people, so the existing "Guide buyers" label stays true.
      'purchased_total', (select count(distinct customer_email) from public.payments
                           where lookup_key = 'deep_dive_guide'
                             and status = 'paid' and not is_internal),
      -- Transactions. A repeat buyer now shows up here, which is the whole point.
      'sales_total',     (select count(*) from public.payments
                           where lookup_key = 'deep_dive_guide'
                             and status = 'paid' and not is_internal),
      'revenue_cents',   (select coalesce(sum(amount_cents), 0) from public.payments
                           where lookup_key = 'deep_dive_guide'
                             and status = 'paid' and not is_internal)
    ),
    'course', json_build_object(
      'orders', (select count(*) from public.course_sales where occurred_at >= p_since),
      'revenue_cents', coalesce((select sum(amount_cents) from public.course_sales where occurred_at >= p_since), 0),
      'currency', coalesce((select currency from public.course_sales order by occurred_at desc limit 1), 'usd')
    )
  ) into result;

  return result;
end;
$function$;

-- Recreating a function resets its ACL to the default grants, so re-apply the intended
-- ones. Order matters: revoke first, then grant only authenticated.
revoke execute on function
  public.founder_orders(timestamptz),
  public.founder_revenue(timestamptz)
from public, anon;

grant execute on function
  public.founder_orders(timestamptz),
  public.founder_revenue(timestamptz)
to authenticated;

-- ── 5. Remove anon write privileges on the money tables ─────────────────────
--
-- These tables grant INSERT/UPDATE/DELETE/TRUNCATE to anon and authenticated by Supabase
-- default. Safe today only because RLS is enabled with no permissive policies. That makes
-- RLS a single point of failure: one accidental `disable row level security`, or one loose
-- policy added under launch pressure, exposes anonymous WRITES to the order and payment
-- ledgers, not just reads.
--
-- Every legitimate write goes through the service role (stripe-webhook, order-db.ts),
-- which bypasses both RLS and these grants, so nothing real depends on them.

revoke insert, update, delete, truncate on
  public.orders, public.order_items, public.payments
from anon, authenticated;

commit;
