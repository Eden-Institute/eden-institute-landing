-- ============================================================
-- Stage 2 — Waitlist source-of-truth migration
-- Closes launch-blocker #43.
--
-- Creates public.waitlist_signups as the canonical attribution
-- table (one row per (email, entry_funnel) pair), replaces the
-- now-empty public.tier_2_waitlist with a compatibility view
-- (INSTEAD OF INSERT shim preserves writes for the still-deployed
-- tier-2-waitlist-signup Edge Function), and installs an
-- AFTER INSERT trigger that mirrors every quiz_completions row
-- into waitlist_signups with entry_funnel='quiz_funnel'.
--
-- RLS posture (per Locked Decision §0.8 and Manual §20.18):
--   anon           — no policies (denied by default)
--   authenticated  — SELECT own rows only via email match
--   service_role   — full CRUD (RLS bypass)
--
-- Idempotent throughout. Re-applying against the live DB is a
-- no-op after the first successful apply.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Enum: entry_funnel
-- ------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.entry_funnel AS ENUM (
    'app_beta',
    'course_tier2',
    'edens_table',
    'homeschool',
    'community',
    'quiz_funnel'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ------------------------------------------------------------
-- 2. Table: public.waitlist_signups
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.waitlist_signups (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text NOT NULL,
  first_name        text,
  last_name         text,
  entry_funnel      public.entry_funnel NOT NULL,
  entered_at        timestamptz NOT NULL DEFAULT now(),
  source_url        text,
  referrer          text,
  utm_source        text,
  utm_medium        text,
  utm_campaign      text,
  utm_term          text,
  utm_content       text,
  consents          jsonb NOT NULL DEFAULT '{}'::jsonb,
  resend_contact_id uuid,
  resend_synced_at  timestamptz,
  unsubscribed_at   timestamptz,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT waitlist_signups_email_funnel_uq UNIQUE (email, entry_funnel)
);


-- ------------------------------------------------------------
-- 3. Indexes
-- ------------------------------------------------------------

-- Case-insensitive email lookup (mirrors lower(email) pattern
-- used on the retired tier_2_waitlist and on quiz_completions).
CREATE INDEX IF NOT EXISTS waitlist_signups_lower_email_idx
  ON public.waitlist_signups (lower(email));

-- Funnel-filter index for broadcast segmentation queries.
CREATE INDEX IF NOT EXISTS waitlist_signups_entry_funnel_idx
  ON public.waitlist_signups (entry_funnel);

-- Partial index for the Resend sync worker — pulls rows not yet
-- pushed to Resend and not yet unsubscribed, ordered by arrival.
CREATE INDEX IF NOT EXISTS waitlist_signups_needs_sync_idx
  ON public.waitlist_signups (entered_at)
  WHERE resend_synced_at IS NULL AND unsubscribed_at IS NULL;


-- ------------------------------------------------------------
-- 4. updated_at trigger (reuses set_updated_at() from herb-domain
-- backfill PR #3).
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS waitlist_signups_updated_at ON public.waitlist_signups;
CREATE TRIGGER waitlist_signups_updated_at
  BEFORE UPDATE ON public.waitlist_signups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ------------------------------------------------------------
-- 5. Row-Level Security
-- ------------------------------------------------------------
-- rls_auto_enable_trg (event trigger from herb-domain backfill)
-- already flips this on for newly-created public tables, but
-- the explicit ALTER is idempotent and self-documenting.
ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;

-- Authenticated users see only their own rows, matched by the
-- JWT email claim (case-insensitive, aligned with the lookup idx).
DROP POLICY IF EXISTS "waitlist_signups_authenticated_own_select"
  ON public.waitlist_signups;
CREATE POLICY "waitlist_signups_authenticated_own_select"
  ON public.waitlist_signups FOR SELECT TO authenticated
  USING (lower(email) = lower(auth.jwt() ->> 'email'));

-- No INSERT / UPDATE / DELETE policies for anon or authenticated.
-- Under RLS these are denied-by-default. service_role bypasses RLS.


-- ============================================================
-- tier_2_waitlist → compatibility view
--
-- The table had 0 rows at migration time (verified 2026-04-23).
-- All attribution and future writes flow through waitlist_signups.
-- A VIEW preserves read shape for any legacy caller, and an
-- INSTEAD OF INSERT trigger preserves write shape for the still
-- deployed tier-2-waitlist-signup Edge Function (to be retired
-- or consolidated in Task 2.4).
-- ============================================================

DROP TABLE IF EXISTS public.tier_2_waitlist CASCADE;

CREATE VIEW public.tier_2_waitlist
WITH (security_invoker = on)
AS
  SELECT
    id,
    email,
    first_name,
    entered_at AS created_at
  FROM public.waitlist_signups
  WHERE entry_funnel = 'course_tier2';

-- Route legacy inserts into the canonical table.
CREATE OR REPLACE FUNCTION public.tier_2_waitlist_insert_shim()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.waitlist_signups (email, first_name, entry_funnel, entered_at)
  VALUES (NEW.email, NEW.first_name, 'course_tier2', COALESCE(NEW.created_at, now()))
  ON CONFLICT (email, entry_funnel) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tier_2_waitlist_insert_shim_trg ON public.tier_2_waitlist;
CREATE TRIGGER tier_2_waitlist_insert_shim_trg
  INSTEAD OF INSERT ON public.tier_2_waitlist
  FOR EACH ROW EXECUTE FUNCTION public.tier_2_waitlist_insert_shim();

-- Only service_role reads the view. Legacy function auths with
-- SUPABASE_SERVICE_ROLE_KEY; anon and authenticated have no
-- business with the legacy shape.
GRANT SELECT, INSERT ON public.tier_2_waitlist TO service_role;


-- ============================================================
-- quiz_completions → waitlist_signups (AFTER INSERT trigger)
--
-- Every quiz completion creates a waitlist_signups row with
-- entry_funnel='quiz_funnel'. Quiz constitutional result is
-- stashed in metadata for later segmentation.
--
-- SECURITY DEFINER because the trigger must bypass RLS when
-- inserting on behalf of the anon / authenticated caller.
--
-- Retake semantics: entered_at (attribution timestamp) is
-- preserved from the first quiz take; metadata refreshes to
-- the latest result. Mental model — quiz_completions is the
-- immutable history ledger, waitlist_signups is the current-
-- state projection. A user fixing a misclick, or whose terrain
-- has genuinely shifted over time, will have their broadcast
-- segmentation reflect their latest known state.
-- ============================================================

CREATE OR REPLACE FUNCTION public.quiz_completions_to_waitlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.waitlist_signups (
    email,
    first_name,
    entry_funnel,
    entered_at,
    metadata
  )
  VALUES (
    NEW.email,
    NEW.first_name,
    'quiz_funnel',
    NEW.completed_at,
    jsonb_build_object(
      'quiz_constitution_type',     NEW.constitution_type,
      'quiz_constitution_name',     NEW.constitution_name,
      'quiz_constitution_nickname', NEW.constitution_nickname,
      'quiz_completion_id',         NEW.id
    )
  )
  ON CONFLICT (email, entry_funnel) DO UPDATE
    SET metadata = EXCLUDED.metadata;
    -- entered_at intentionally NOT touched → attribution preserved
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quiz_completions_to_waitlist_trg ON public.quiz_completions;
CREATE TRIGGER quiz_completions_to_waitlist_trg
  AFTER INSERT ON public.quiz_completions
  FOR EACH ROW EXECUTE FUNCTION public.quiz_completions_to_waitlist();


-- ============================================================
-- End of Stage 2 migration. Next: Task 2.4 — resend-waitlist
-- Supabase-first refactor (writes here, then pushes to Resend).
-- ============================================================
