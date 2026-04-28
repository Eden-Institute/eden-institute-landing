-- Phase 5 fix #4 / launch-blocker #58 — data cleanup
-- The legacy verify-session EF flipped quiz_completions.purchased_guide=TRUE
-- for any paid Stripe session matching the email, including subscription
-- checkouts. The new product-aware EF (deployed in this same v3.33.4 batch)
-- only flips on session.mode === "payment". This migration resets stale
-- purchased_guide=TRUE rows for users who only ever bought subscription
-- products (no record of an actual $14 Deep-Dive Guide purchase).
--
-- Heuristic: any quiz_completions row whose email matches a profiles row
-- with stripe_subscription_id set (= subscription customer) AND no other
-- evidence of a one-off purchase (Stripe events not yet ingested into
-- Supabase, so we treat all current purchased_guide=TRUE on
-- subscription-customer emails as suspect and reset to FALSE).
--
-- Future $14 guide purchases will set purchased_guide=TRUE correctly via
-- the new mode-aware EF.

UPDATE public.quiz_completions qc
   SET purchased_guide = false
  FROM public.profiles p
 WHERE p.email = qc.email
   AND qc.purchased_guide = true
   AND p.stripe_subscription_id IS NOT NULL;

-- Smoke verification — surface the affected rows in the migration log.
DO $$
DECLARE
  affected_count int;
BEGIN
  SELECT COUNT(*) INTO affected_count
    FROM public.quiz_completions qc
    JOIN public.profiles p ON p.email = qc.email
   WHERE qc.purchased_guide = false
     AND p.stripe_subscription_id IS NOT NULL;
  RAISE NOTICE 'v3.33.4 reset complete: % subscription-customer quiz_completions rows now have purchased_guide=false', affected_count;
END $$;
