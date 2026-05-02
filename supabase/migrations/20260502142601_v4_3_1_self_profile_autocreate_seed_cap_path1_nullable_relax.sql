-- v4.3.1 Architectural cleanup — path 1 (NOT NULL relaxation + auto-create stub).
-- Closes the two defects flagged in v4.3 §9.4 "Architectural Defects Surfaced":
--   #1 Paid-tier users should auto-receive an is_self=TRUE person_profile
--      when subscription_tier transitions from free.
--   #2 tg_person_profiles_enforce_cap should enforce the design's is_self
--      semantics, not just the total-row count.

-- ============================================================
-- STEP 1 — Relax NOT NULL on clinical-data columns.
-- ============================================================
-- date_of_birth, biological_sex, and profile_kind are clinical-data fields the
-- user fills in via Account.tsx when they want clinical depth. The auto-create
-- trigger below stubs profiles with name + is_self only; the user adds the
-- rest. Aligns with Lock language "columns populate by tier."

ALTER TABLE public.person_profiles ALTER COLUMN date_of_birth DROP NOT NULL;
ALTER TABLE public.person_profiles ALTER COLUMN biological_sex DROP NOT NULL;
ALTER TABLE public.person_profiles ALTER COLUMN profile_kind DROP NOT NULL;

-- ============================================================
-- STEP 2 — Extend tg_person_profiles_enforce_cap with is_self rules.
-- ============================================================
-- (a) Seed tier may only contain is_self=TRUE profiles (sub-profiles require
--     Root or higher per the design "Seed=1 self only").
-- (b) Each user may have AT MOST ONE is_self=TRUE profile.
-- Tier read from profiles.subscription_tier directly because current_user_tier()
-- RPC returns 'free' for service-role / migration / system-trigger contexts and
-- would block legitimate auto-create.

CREATE OR REPLACE FUNCTION public.tg_person_profiles_enforce_cap()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_tier text;
  v_cap int;
  v_count int;
  v_self_count int;
BEGIN
  -- Source-of-truth tier lookup (NOT current_user_tier() — that returns 'free' for
  -- service-role contexts and would block the auto-create trigger below).
  SELECT COALESCE(subscription_tier, 'free') INTO v_tier
  FROM public.profiles
  WHERE user_id = NEW.user_id;
  v_tier := COALESCE(v_tier, 'free');

  v_cap := public.person_profile_cap_for_tier(v_tier);

  -- Existing total-count check, preserved.
  SELECT count(*) INTO v_count
  FROM public.person_profiles
  WHERE user_id = NEW.user_id;

  IF v_count >= v_cap THEN
    RAISE EXCEPTION 'profile_cap_exceeded:tier=%,cap=%,current=%', v_tier, v_cap, v_count
      USING ERRCODE = 'P0001';
  END IF;

  -- v4.3.1: Seed tier may only contain is_self=TRUE profiles.
  IF v_tier = 'seed' AND NEW.is_self = FALSE THEN
    RAISE EXCEPTION 'seed_tier_subprofiles_forbidden:tier=%,is_self=%', v_tier, NEW.is_self
      USING ERRCODE = 'P0001';
  END IF;

  -- v4.3.1: Each user may have AT MOST ONE is_self=TRUE profile.
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
  'v4.3.1 (2026-05-02): cap enforcement extended with two is_self rules. (a) Seed tier may only contain is_self=TRUE profiles. (b) Each user may have AT MOST ONE is_self=TRUE profile. Tier read from profiles.subscription_tier directly rather than current_user_tier() RPC.';

-- ============================================================
-- STEP 3 — Auto-create is_self=TRUE on tier upgrade from free.
-- ============================================================

CREATE OR REPLACE FUNCTION public.tg_profiles_create_self_on_upgrade()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
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
      NEW.constitution_type
    );
  END IF;
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.tg_profiles_create_self_on_upgrade IS
  'v4.3.1 (2026-05-02): auto-create is_self=TRUE person_profile when subscription_tier transitions from free (or NULL) to a paid tier AND the user has no is_self profile yet. Idempotent. Stubs name + eden_constitution; date_of_birth + biological_sex + profile_kind left NULL for the user to fill in via Account.tsx (NOT NULL relaxed in same migration).';

DROP TRIGGER IF EXISTS tg_profiles_create_self_on_upgrade ON public.profiles;
CREATE TRIGGER tg_profiles_create_self_on_upgrade
  AFTER UPDATE OF subscription_tier ON public.profiles
  FOR EACH ROW
  WHEN (OLD.subscription_tier IS DISTINCT FROM NEW.subscription_tier)
  EXECUTE FUNCTION public.tg_profiles_create_self_on_upgrade();

-- ============================================================
-- STEP 4 — Fix the founder's grammarswag@gmail.com test account.
-- ============================================================
-- Disable session_replication_role so the new cap trigger doesn't block the
-- bootstrap — we need to delete and insert in the same transaction.

SET LOCAL session_replication_role = 'replica';

DELETE FROM public.person_profiles
WHERE id = '7ed9657c-0c9d-4946-a46c-d0027f7b0f72';

INSERT INTO public.person_profiles (user_id, name, is_self, eden_constitution)
VALUES (
  '08cb3b6c-968f-4c8c-a6fe-067f53c8531b',
  'Camila Johnson',
  TRUE,
  'pressure-cooker'
);

SET LOCAL session_replication_role = 'origin';
