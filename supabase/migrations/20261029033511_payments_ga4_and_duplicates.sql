-- Payments ledger: what Google Analytics was told, and the same sale counted once (2026-10-28).
--
-- GA4 FROM THE SERVER. stripe-webhook now reports every paid checkout, subscription
-- invoice and refund to GA4 through the Measurement Protocol (_shared/ga4-mp.ts) and
-- writes the outcome onto the payments row:
--
--   ga4_status          'sent', 'failed', or why it was not sent:
--                       skipped_test (Stripe test mode / E2E), skipped_internal
--                       (is_internal), skipped_declined (the buyer clicked Decline on
--                       the cookie banner), skipped_no_secret (GA4_MP_API_SECRET not
--                       set), skipped_unmatched (a refund with no sale GA knows),
--                       skipped_not_subscription (a curriculum receipt invoice; its
--                       checkout row reports the sale)
--   ga4_transaction_id  the transaction id GA holds: checkoutRef(session id) for a
--                       checkout, the invoice id for a subscription payment
--   ga4_sent_at         when it was sent
--
-- So GA4 purchase revenue for a month equals
--   sum(amount_cents) where status = 'paid'     and ga4_status = 'sent'
-- - sum(amount_cents) where status = 'refunded' and ga4_status = 'sent'
-- and every other paid row names the reason GA does not show it. Rows from before
-- this migration stay NULL: nothing recorded what GA was told then.
--
-- THE SAME SALE, ONCE. A curriculum checkout (Starter Unit, printed set) turns on
-- Stripe's invoice_creation, and that invoice fires invoice.paid seconds before
-- checkout.session.completed, so the ledger held two 'paid' rows for one payment:
-- the invoice (kind 'subscription', billing_reason 'manual', no subscription) and the
-- checkout. Four of them, 2026-09-19 to 09-25, $390.50 of real sales plus $1.10
-- internal, counted twice in founder_payments. stripe-webhook now marks the invoice
-- row 'duplicate' (or does not write it when the checkout row is already there).
-- 'duplicate' rows stay for the audit trail; every revenue total sums status = 'paid',
-- so they leave the totals without any query changing. The four existing ones are
-- matched exactly: an invoice with no subscription whose id is the `invoice` of a
-- checkout.session row.
--
-- No new table, so no new grants: the existing table grants cover new columns.
-- Idempotent: every statement can be re-run.

alter table public.payments
  add column if not exists ga4_status text;

alter table public.payments
  add column if not exists ga4_transaction_id text;

alter table public.payments
  add column if not exists ga4_sent_at timestamptz;

comment on column public.payments.ga4_status is
  'What stripe-webhook told GA4 (2026-10-28): sent, failed, or skipped_test / skipped_internal / skipped_declined / skipped_no_secret / skipped_unmatched / skipped_not_subscription. NULL = before 2026-10-28.';

comment on column public.payments.ga4_transaction_id is
  'transaction_id GA4 holds for this payment: checkoutRef(session id) for a checkout, the invoice id for a subscription payment.';

comment on column public.payments.ga4_sent_at is
  'When stripe-webhook sent this payment to GA4.';

alter table public.payments
  drop constraint if exists payments_status_check;

alter table public.payments
  add constraint payments_status_check
  check (status = any (array['paid'::text, 'failed'::text, 'refunded'::text, 'duplicate'::text]));

update public.payments i
   set status = 'duplicate'
 where i.status = 'paid'
   and i.raw->>'object' = 'invoice'
   and i.stripe_subscription_id is null
   and coalesce(i.raw->'parent'->'subscription_details'->>'subscription', i.raw->>'subscription') is null
   and i.stripe_invoice_id is not null
   and exists (
     select 1 from public.payments c
      where c.raw->>'object' = 'checkout.session'
        and c.raw->>'invoice' = i.stripe_invoice_id
   );
