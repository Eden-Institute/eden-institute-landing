-- Phase 5 fix #4 / launch-blocker #58 — explicit cleanup for coliveira77
-- Founder confirmed in Phase 5 testing that the Deep-Dive Guide $14 CTA
-- "did nothing" (logs confirm: 3× POST 400 from create-checkout calls).
-- The purchased_guide=TRUE on her quiz_completions row was set by the
-- legacy verify-session EF flipping on her Seed checkout (since refunded
-- and canceled, clearing stripe_subscription_id — so the broader cleanup
-- in v3.33.4 didn't catch her).
--
-- Future $14 guide purchases will set purchased_guide=TRUE correctly via
-- the new mode-aware EF deployed in this same v3.33.4 batch.

UPDATE public.quiz_completions
   SET purchased_guide = false
 WHERE email = 'coliveira77@hotmail.com'
   AND purchased_guide = true;

DO $$
DECLARE
  remaining_count int;
BEGIN
  SELECT COUNT(*) INTO remaining_count
    FROM public.quiz_completions
   WHERE email = 'coliveira77@hotmail.com'
     AND purchased_guide = true;
  RAISE NOTICE 'coliveira77 cleanup: % rows still have purchased_guide=true (expected 0)', remaining_count;
END $$;
