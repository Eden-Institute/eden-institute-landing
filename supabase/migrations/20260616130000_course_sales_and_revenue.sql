-- Course sales (LearnWorlds) + unified revenue view.
--
-- Why: the Foundations Course ($97) — the dominant CTA across the nurture
-- emails — sells on LearnWorlds, which Stripe/Supabase never see. So the
-- founder dashboard could not show course revenue at all, making "nobody has
-- purchased" partly a measurement blind spot. This captures LearnWorlds
-- purchase webhooks into course_sales and exposes a founder_revenue RPC that
-- unifies all three revenue systems:
--   1. App subscriptions      → public.profiles (Stripe, via stripe-webhook)
--   2. Deep-Dive Guide $4.99   → public.quiz_completions.purchased_guide (Stripe)
--   3. Foundations Course $97  → public.course_sales (LearnWorlds, via learnworlds-webhook)
--
-- NOTE: subscription_events is intentionally NOT used — stripe-webhook never
-- writes to it (it reconciles profiles + quiz_completions directly), so it is a
-- dead table. Revenue reads profiles + quiz_completions + course_sales.

create table if not exists public.course_sales (
  id            bigint generated always as identity primary key,
  lw_event_id   text,                 -- LearnWorlds event/order id (dedupe key)
  product_id    text,
  product_title text,
  email         text,                 -- lowercased buyer email
  amount_cents  integer,              -- gross amount in minor units
  currency      text default 'usd',
  occurred_at   timestamptz not null default now(),
  raw           jsonb,
  inserted_at   timestamptz not null default now()
);

comment on table public.course_sales is
  'LearnWorlds course purchases (Foundations Course $97). Written by the learnworlds-webhook EF (service role) on purchase events. RLS-walled, service-role only. The dashboard reads this so course revenue is finally visible alongside Stripe subscriptions + the Deep-Dive guide.';

-- Dedupe on the LearnWorlds event id (webhooks can redeliver).
create unique index if not exists course_sales_event_dedupe_idx
  on public.course_sales (lw_event_id)
  where lw_event_id is not null;

create index if not exists course_sales_occurred_at_idx on public.course_sales (occurred_at);

alter table public.course_sales enable row level security;
-- No policies: service-role only (mirrors email_list_unsubscribes / email_events).

-- ── Unified revenue RPC ──
-- SECURITY DEFINER + is_founder() gate, matching founder_lead_summary etc.
-- Subscriptions are reported as a current snapshot (profiles has no per-event
-- history); guide + course are windowed by p_since where a timestamp exists.
-- quiz_completions.purchased_guide has no purchase timestamp, so guide is
-- reported as an all-time total (documented in the dashboard copy).
create or replace function public.founder_revenue(p_since timestamptz)
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
    'subscriptions', json_build_object(
      'active_seed', (select count(*) from public.profiles where subscription_status = 'active' and subscription_tier = 'seed'),
      'active_root', (select count(*) from public.profiles where subscription_status = 'active' and subscription_tier = 'root'),
      'active_practitioner', (select count(*) from public.profiles where subscription_status = 'active' and subscription_tier = 'practitioner'),
      'active_total', (select count(*) from public.profiles where subscription_status = 'active' and subscription_tier in ('seed','root','practitioner')),
      'canceled', (select count(*) from public.profiles where subscription_status = 'canceled')
    ),
    'guide', json_build_object(
      -- All-time (no purchase timestamp on quiz_completions.purchased_guide).
      'purchased_total', (select count(*) from public.quiz_completions where purchased_guide = true)
    ),
    'course', json_build_object(
      'orders', (select count(*) from public.course_sales where occurred_at >= p_since),
      'revenue_cents', coalesce((select sum(amount_cents) from public.course_sales where occurred_at >= p_since), 0),
      'currency', coalesce((select currency from public.course_sales order by occurred_at desc limit 1), 'usd')
    )
  ) into result;

  return result;
end;
$$;

grant execute on function public.founder_revenue(timestamptz) to authenticated;
