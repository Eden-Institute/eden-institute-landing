-- Seed tier: up to 5 person-profiles for yourself AND family, as sold.
--
-- Founder decision 2026-11-06 (Camila, one-tap question): "Seed = 5 family".
-- Seed is sold everywhere as a family tier: the /apothecary/pricing card
-- ("Profiles for up to 5 family members"), the /apothecary tier cards
-- (src/lib/apothecaryTiers.ts, "Create up to 5 person-profiles for yourself
-- and family members"), and both live Stripe Seed product descriptions
-- ("Homeschool Parent tier ... 5 family profiles"). The cap function already
-- returns seed = 5 (20260430140000_tier_cap_restructure_v2.sql).
--
-- But v4.3.1 (20260502142601) added a rule to this trigger that raised
-- 'seed_tier_subprofiles_forbidden' for every is_self = FALSE insert on Seed,
-- so a Seed member could keep only their own profile: the Add profile button
-- showed for Seed and then failed. That rule is removed here. Everything else
-- is unchanged:
--   - the total-count cap (person_profile_cap_for_tier: free 0, seed 5,
--     root 10, practitioner 500),
--   - at most ONE is_self = TRUE profile per user,
--   - tier read from profiles.subscription_tier (not current_user_tier()),
--   - SECURITY DEFINER with search_path pinned to public, pg_temp
--     (20260915100000_audit_hardening.sql, item 15).
--
-- Idempotent: CREATE OR REPLACE of the function body only. The enforce_cap
-- BEFORE INSERT trigger on public.person_profiles already points at this
-- function and is not touched. No table, no grant, no data change.

CREATE OR REPLACE FUNCTION public.tg_person_profiles_enforce_cap()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_tier text;
  v_cap int;
  v_count int;
  v_self_count int;
BEGIN
  -- Source-of-truth tier lookup (NOT current_user_tier() — that returns 'free' for
  -- service-role contexts and would block the auto-create trigger).
  SELECT COALESCE(subscription_tier, 'free') INTO v_tier
  FROM public.profiles
  WHERE user_id = NEW.user_id;
  v_tier := COALESCE(v_tier, 'free');

  v_cap := public.person_profile_cap_for_tier(v_tier);

  -- Total-count cap per tier.
  SELECT count(*) INTO v_count
  FROM public.person_profiles
  WHERE user_id = NEW.user_id;

  IF v_count >= v_cap THEN
    RAISE EXCEPTION 'profile_cap_exceeded:tier=%,cap=%,current=%', v_tier, v_cap, v_count
      USING ERRCODE = 'P0001';
  END IF;

  -- Each user may have AT MOST ONE is_self=TRUE profile.
  IF NEW.is_self = TRUE THEN
    SELECT count(*) INTO v_self_count
    FROM public.person_profiles
    WHERE user_id = NEW.user_id AND is_self IS TRUE;
    IF v_self_count >= 1 THEN
      RAISE EXCEPTION 'self_profile_already_exists:user_id=%,existing_count=%', NEW.user_id, v_self_count
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.tg_person_profiles_enforce_cap IS
  '2026-11-06: per-tier total cap (person_profile_cap_for_tier) plus at most one is_self=TRUE profile per user. The v4.3.1 Seed self-only rule is removed: Seed holds up to 5 profiles for the member and family, as sold. Tier read from profiles.subscription_tier directly rather than current_user_tier().';
