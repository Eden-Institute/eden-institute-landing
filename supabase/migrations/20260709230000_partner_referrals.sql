-- Partner referral tracking (founder decision 2026-07-09): every partner
-- gets their OWN Stripe promotion code on the shared $5/month Practitioner
-- coupon, and the code IS the attribution. stripe-webhook records one row
-- per subscription that redeemed a promotion code, so "how many subs did
-- each partner drive" is a GROUP BY away, and the reward model can be
-- decided later against real counts (track now, decide rewards later).
--
-- Builds ON the existing capture-log posture: append-style, service-role
-- only, no PII beyond the subscriber email already held in profiles.

CREATE TABLE IF NOT EXISTS public.partner_referrals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id  text NOT NULL UNIQUE,      -- Stripe subscription id (upsert key)
  promo_code       text NOT NULL,             -- human code the partner shared (e.g. PARTNER-JANE)
  promo_code_id    text,                      -- Stripe promotion_code id
  coupon_id        text,                      -- Stripe coupon id
  customer_email   text,
  tier             text,                      -- resolved subscription tier at redemption
  lookup_key       text,                      -- price lookup_key redeemed against
  status           text,                      -- subscription status at last webhook touch
  first_seen_at    timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.partner_referrals IS
  'Partner attribution log: one row per Stripe subscription that redeemed a promotion code. Written by stripe-webhook (service role) on customer.subscription.* reconcile. Partner performance = count(*) grouped by promo_code. RLS service-role only.';

CREATE INDEX IF NOT EXISTS partner_referrals_code_idx
  ON public.partner_referrals (promo_code, first_seen_at DESC);

ALTER TABLE public.partner_referrals ENABLE ROW LEVEL SECURITY;
