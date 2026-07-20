-- Separate our own test charges from customer revenue.
--
-- The Stripe backfill found 6 paid subscription invoices totalling $57.45. Five of them
-- are internal: three plus-addressed end-to-end test accounts from the stage-4/stage-5
-- builds, one $0.50 Practitioner tier test, and the founder's own root subscription. The
-- two Deep-Dive Guide purchases already in the ledger are the founder's as well.
--
-- Real customer revenue in that set is a single $7.99 seed subscription.
--
-- These are all genuine live-mode charges, so they belong in the ledger: it must
-- reconcile line-for-line against Stripe or it is not a ledger. But reporting them as
-- revenue would recreate exactly the failure this whole ledger was built to fix, which is
-- a number that looks like money and is not. So they are recorded and flagged, never
-- dropped, and the dashboard shows both figures.

begin;

alter table public.payments
  add column is_internal boolean not null default false;

comment on column public.payments.is_internal is
  'True for our own test/staff charges. Real money, real Stripe rows, but not customer '
  'revenue. Set automatically by trigger; see is_internal_email().';

-- Classification lives in one function so the webhook, the backfill script, and anything
-- added later all agree without each having to remember the rule.
create or replace function public.is_internal_email(p_email text)
returns boolean
language sql
immutable
as $$
  select case
    when p_email is null then false
    else lower(trim(p_email)) = any (array[
           'hello@edeninstitute.health',
           'grammarswag@gmail.com'
         ])
      -- Any plus-addressed alias on our own domain. This is how the e2e suites and manual
      -- checkout tests generate unique buyers, so it catches future ones for free.
      or lower(trim(p_email)) like 'hello+%@edeninstitute.health'
  end;
$$;

comment on function public.is_internal_email(text) is
  'Is this address ours rather than a customer''s? Add addresses here, not in app code.';

-- A trigger rather than a default, so every write path is covered: the Stripe webhook,
-- scripts/backfill-payments.ts, and manual repair SQL. None of them has to opt in.
create or replace function public.payments_set_internal()
returns trigger
language plpgsql
as $$
begin
  -- Only classify when the caller did not decide for itself, so a deliberate override
  -- (marking a refunded staff charge as customer-facing, say) is not silently undone.
  if tg_op = 'INSERT' and new.is_internal is not distinct from false then
    new.is_internal := public.is_internal_email(new.customer_email);
  end if;
  return new;
end;
$$;

create trigger payments_set_internal_trg
  before insert on public.payments
  for each row execute function public.payments_set_internal();

-- Classify what is already recorded (the two guide purchases, both the founder's).
update public.payments
   set is_internal = true
 where public.is_internal_email(customer_email)
   and is_internal = false;

create index payments_customer_revenue_idx
  on public.payments (occurred_at desc)
  where is_internal = false and status = 'paid';

-- ── Founder revenue read, now honest about whose money it is ────────────────
--
-- Headline figures count CUSTOMER payments only. Internal charges are still returned in
-- the row list and totalled separately, so nothing vanishes from the founder's view;
-- it just stops being counted as sales.

create or replace function public.founder_payments(p_since timestamptz)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select case
    when not public.is_founder() then jsonb_build_object('error', 'Not authorized')
    else jsonb_build_object(
      'summary', (
        select jsonb_build_object(
          'gross_cents',        coalesce(sum(amount_cents) filter (where status = 'paid' and not is_internal), 0),
          'refunded_cents',     coalesce(sum(amount_cents) filter (where status = 'refunded' and not is_internal), 0),
          'net_cents',          coalesce(sum(amount_cents) filter (where status = 'paid' and not is_internal), 0)
                                - coalesce(sum(amount_cents) filter (where status = 'refunded' and not is_internal), 0),
          'subscription_cents', coalesce(sum(amount_cents) filter (where status = 'paid' and not is_internal and kind = 'subscription'), 0),
          'one_off_cents',      coalesce(sum(amount_cents) filter (where status = 'paid' and not is_internal and kind = 'one_off'), 0),
          'paid_count',         count(*) filter (where status = 'paid' and not is_internal),
          'failed_count',       count(*) filter (where status = 'failed' and not is_internal),
          -- Shown as a footnote so the gap between this and the Stripe dashboard is
          -- always explainable rather than alarming.
          'internal_cents',     coalesce(sum(amount_cents) filter (where status = 'paid' and is_internal), 0),
          'internal_count',     count(*) filter (where status = 'paid' and is_internal)
        )
        from payments where occurred_at >= p_since
      ),
      'payments', (
        select coalesce(jsonb_agg(row_to_json(p) order by p.occurred_at desc), '[]'::jsonb)
        from (
          select id, occurred_at, kind, status, description, lookup_key,
                 amount_cents, currency, customer_email, is_internal,
                 stripe_invoice_id, stripe_subscription_id, period_start, period_end
          from payments
          where occurred_at >= p_since
          order by occurred_at desc
          limit 500
        ) p
      )
    )
  end;
$$;

revoke all on function public.founder_payments(timestamptz) from public;
grant execute on function public.founder_payments(timestamptz) to authenticated;

commit;
