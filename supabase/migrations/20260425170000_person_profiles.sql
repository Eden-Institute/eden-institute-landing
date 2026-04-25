-- Stage 6.3.5 Phase B opening — person_profiles table
-- Per Manual §0.8 #28-#34: uniform schema for Free/Seed/Root family-care profiles
-- Caps enforced by trigger: Free=0, Seed=1, Root=6, Practitioner=500 (Solo placeholder until Phase 3)
-- Applied to noeqztssupewjidpvhar via SQL Editor on 2026-04-25 prior to this PR.

-- 1. Enums
CREATE TYPE public.biological_sex_enum AS ENUM ('male', 'female');
CREATE TYPE public.profile_kind_enum AS ENUM ('adult', 'child');

-- 2. Table
CREATE TABLE public.person_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  date_of_birth date NOT NULL CHECK (date_of_birth BETWEEN '1900-01-01' AND current_date),
  biological_sex public.biological_sex_enum NOT NULL,
  profile_kind public.profile_kind_enum NOT NULL,
  is_self boolean NOT NULL DEFAULT false,
  eden_constitution text,
  secondary_framework_match text,
  allergies text,
  medications text,
  conditions text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Indexes
CREATE INDEX idx_person_profiles_user_id ON public.person_profiles(user_id);
CREATE UNIQUE INDEX uniq_person_profiles_self_per_user
  ON public.person_profiles(user_id)
  WHERE is_self IS TRUE;

-- 4. updated_at maintenance
CREATE OR REPLACE FUNCTION public.tg_person_profiles_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.person_profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_person_profiles_set_updated_at();

-- 5. Cap helper
CREATE OR REPLACE FUNCTION public.person_profile_cap_for_tier(tier text)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE tier
    WHEN 'anon' THEN 0
    WHEN 'free' THEN 0
    WHEN 'seed' THEN 1
    WHEN 'root' THEN 6
    WHEN 'practitioner' THEN 500
    ELSE 0
  END;
$$;

-- 6. Cap-enforcement trigger
CREATE OR REPLACE FUNCTION public.tg_person_profiles_enforce_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier text;
  v_cap int;
  v_count int;
BEGIN
  v_tier := public.current_user_tier();
  v_cap := public.person_profile_cap_for_tier(v_tier);

  SELECT count(*) INTO v_count
  FROM public.person_profiles
  WHERE user_id = NEW.user_id;

  IF v_count >= v_cap THEN
    RAISE EXCEPTION 'profile_cap_exceeded:tier=%,cap=%,current=%', v_tier, v_cap, v_count
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_cap
BEFORE INSERT ON public.person_profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_person_profiles_enforce_cap();

-- 7. RLS
ALTER TABLE public.person_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY person_profiles_select_own
  ON public.person_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY person_profiles_insert_own
  ON public.person_profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY person_profiles_update_own
  ON public.person_profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY person_profiles_delete_own
  ON public.person_profiles FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 8. Comments (architectural auditability per Manual §0.7)
COMMENT ON TABLE public.person_profiles IS 'Family-care person cards. Uniform schema across Free/Seed/Root tiers per Manual §0.8 #28. Caps enforced by trigger: Free=0, Seed=1, Root=6, Practitioner=500.';
COMMENT ON COLUMN public.person_profiles.is_self IS 'Marks the profile representing the account holder. Partial unique index ensures exactly one self per user.';
COMMENT ON COLUMN public.person_profiles.eden_constitution IS 'One of the eight Patterns of Eden (Manual §0.8 #16). Written by quiz-completion trigger at Seed tier; Root quiz also writes secondary_framework_match.';
COMMENT ON COLUMN public.person_profiles.profile_kind IS 'Adult vs child routes to different quiz paths per Manual §0.8 #31, #34.';
