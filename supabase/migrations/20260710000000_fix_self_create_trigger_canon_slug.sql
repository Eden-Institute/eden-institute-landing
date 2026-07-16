-- Hotfix (2026-07-10, found by the founder's live Practitioner purchase):
-- tg_profiles_create_self_on_upgrade copies profiles.constitution_type (the
-- RAW marketing slug, e.g. 'pressure-cooker') into
-- person_profiles.eden_constitution, which since Phase 0 is FK-bound to the
-- canonical eden_patterns.slug. For a legacy-slug profile with no self card
-- the INSERT violates the FK, which rolls back the ENTIRE tier update and
-- 500s stripe-webhook — the founder paid, the referral logged, and her tier
-- stayed 'free'. Phase 0 canonicalized the quiz bridge trigger but missed
-- this second writer; this migration closes the gap the same way:
-- eden_pattern_canonical_slug() at write time, NULL when unrecognized
-- (Lock #39: never guess a Pattern).

CREATE OR REPLACE FUNCTION public.tg_profiles_create_self_on_upgrade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (OLD.subscription_tier IS NULL OR OLD.subscription_tier = 'free')
     AND NEW.subscription_tier IN ('seed', 'root', 'practitioner')
     AND NOT EXISTS (
       SELECT 1 FROM public.person_profiles
       WHERE user_id = NEW.user_id AND is_self IS TRUE
     )
  THEN
    INSERT INTO public.person_profiles (user_id, name, is_self, eden_constitution)
    VALUES (
      NEW.user_id,
      COALESCE(NULLIF(TRIM(NEW.display_name), ''), 'You'),
      TRUE,
      public.eden_pattern_canonical_slug(NEW.constitution_type)
    );
  END IF;
  RETURN NEW;
END;
$$;
