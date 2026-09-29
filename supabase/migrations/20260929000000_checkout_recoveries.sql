-- Abandoned-checkout recovery emails (founder decision 2026-09-28).
--
-- create-checkout now opens the main one-off, print and Back to Eden PDF sessions
-- with a 3-hour expiry, Stripe's promotional-consent checkbox and a recovery URL.
-- When one expires unpaid, stripe-webhook (checkout.session.expired) sends at most
-- ONE reminder, and only to a shopper who ticked that box. See
-- supabase/functions/_shared/checkout-recovery.ts.
--
-- public.checkout_recoveries is the record of every decision, one row per expired
-- session:
--   - status 'sent' with the Resend id, or 'skipped' with the reason (no consent,
--     already purchased, unsubscribed, reminded in the last 30 days, ...).
--   - The row is claimed (reason 'send_in_progress') BEFORE the email goes, and the
--     session id is the primary key, so a redelivered Stripe event can never send a
--     second reminder for the same cart.
--   - The 30-day "one reminder per address" rule reads it by lower(email) and
--     created_at, hence the index.
--   - recovered_session_id / recovered_at are filled when a later
--     checkout.session.completed carries recovered_from = this session, which is
--     how the reminders' conversion is measured.
--
-- It holds shopper email addresses, so it is service role only: RLS on, no policies.
-- Only the edge functions read or write it.

begin;

create table if not exists public.checkout_recoveries (
  session_id            text primary key,
  email                 text,
  status                text not null check (status in ('sent', 'skipped')),
  reason                text,
  recovery_url          text,
  items                 text,
  resend_id             text,
  created_at            timestamptz not null default now(),
  recovered_session_id  text,
  recovered_at          timestamptz
);

create index if not exists checkout_recoveries_email_created_idx
  on public.checkout_recoveries (lower(email), created_at);

comment on table public.checkout_recoveries is
  'One row per expired Stripe Checkout Session considered for an abandoned-cart reminder: sent or skipped (with reason), and whether the cart was later recovered. Written by stripe-webhook. Service role only.';

alter table public.checkout_recoveries enable row level security;
-- No policies on purpose: only the service role (edge functions) reads or writes it.

commit;
