-- Workstream B (Feature_Request_Intake_Spec.md): structure the feedback
-- intake and connect it to the founder punch list.
--
-- Before: feedback_submissions was a free-text box mirrored to hello@;
-- founder_punch_list was a status list piped into the daily digest; the two
-- were unlinked. After: one typed intake pipeline (bug | feature |
-- improvement | question) with progressive area narrowing driven by a
-- feedback_areas reference table (editable without a deploy), RICE-lite
-- triage scoring, dedup-by-merge, one-click promotion to the punch list
-- (which is already digest-wired), and a status round-trip so punch-list
-- movement reflects back to the submissions that spawned it.
--
-- Write surfaces: intake stays on the submit-feedback EF (service role,
-- verify_jwt=false, Lock #40/#41 single-surface discipline). Triage writes
-- are founder-only SECURITY DEFINER RPCs gated by is_founder() — the same
-- pattern as the /founder dashboard RPCs (Lock #78). Authed submitters get
-- owner-scoped SELECT for the "my submissions" status view.

-- ── 1 · Area taxonomy (editable reference table) ────────────────────────────

CREATE TABLE IF NOT EXISTS public.feedback_areas (
  area_key   text PRIMARY KEY,
  label      text NOT NULL,
  sub_areas  text[] NOT NULL DEFAULT '{}',
  expedited  boolean NOT NULL DEFAULT false,   -- clinical accuracy/safety → priority triage
  sort_order integer NOT NULL DEFAULT 100,
  active     boolean NOT NULL DEFAULT true
);

COMMENT ON TABLE public.feedback_areas IS
  'Feedback intake area taxonomy (Workstream B). Drives the progressive form''s area → sub_area narrowing. Editable without a deploy. expedited=true areas (clinical accuracy / safety) are flagged for priority triage per the scope-of-practice posture.';

ALTER TABLE public.feedback_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY feedback_areas_public_read
  ON public.feedback_areas FOR SELECT
  TO anon, authenticated
  USING (active);

INSERT INTO public.feedback_areas (area_key, label, sub_areas, expedited, sort_order) VALUES
  ('assessment',        'Constitutional Assessment',      ARRAY['Quiz questions','Scoring or results','Reading accuracy','Re-take & history'], false, 10),
  ('herb_directory',    'Herb Directory / Materia Medica',ARRAY['Search','A specific monograph','Missing herb','Energetics data','Images'], false, 20),
  ('matching',          'Constitutional–Herb Matching',   ARRAY['Match/Avoid logic','Framework lenses','Conflicting verdicts','Badges & filters'], false, 30),
  ('formulary',         'Formulary / Protocols',          ARRAY['Blend builder','Dosing','Batch print'], false, 40),
  ('clients',           'Client Roster & Notes',          ARRAY['Profiles','Encounters','Exports'], false, 50),
  ('clinical_safety',   'Clinical Accuracy / Safety',     ARRAY['A claim looks wrong','Citation issue','Safety concern','Contraindication gap'], true,  60),
  ('account_billing',   'Account & Billing',              ARRAY['Subscription','Tier access','Payments'], false, 70),
  ('performance_bug',   'Performance / Bug',              ARRAY['Something broke','Something is slow','Display issue'], false, 80),
  ('content_copy',      'Content & Copy',                 ARRAY['Wording','Worldview framing','Typos'], false, 90),
  ('other',             'Other / General idea',           ARRAY[]::text[], false, 100)
ON CONFLICT (area_key) DO NOTHING;

-- ── 2 · Structured columns on feedback_submissions ──────────────────────────

ALTER TABLE public.feedback_submissions
  ADD COLUMN IF NOT EXISTS type          text CHECK (type IN ('bug','feature','improvement','question')),
  ADD COLUMN IF NOT EXISTS area          text REFERENCES public.feedback_areas(area_key),
  ADD COLUMN IF NOT EXISTS sub_area      text,
  ADD COLUMN IF NOT EXISTS title         text,
  ADD COLUMN IF NOT EXISTS description   text,
  ADD COLUMN IF NOT EXISTS impact        text CHECK (impact IN ('blocking','major','minor','nice_to_have')),
  ADD COLUMN IF NOT EXISTS frequency     text CHECK (frequency IN ('always','often','sometimes','once')),
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS status        text NOT NULL DEFAULT 'new'
                CHECK (status IN ('new','triaged','planned','in_progress','shipped','declined','duplicate')),
  ADD COLUMN IF NOT EXISTS merged_into   uuid REFERENCES public.feedback_submissions(id),
  ADD COLUMN IF NOT EXISTS tier          text,
  ADD COLUMN IF NOT EXISTS punch_list_id uuid REFERENCES public.founder_punch_list(id),
  ADD COLUMN IF NOT EXISTS reach         smallint CHECK (reach BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS impact_score  smallint CHECK (impact_score BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS effort        smallint CHECK (effort BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS triaged_at    timestamptz,
  ADD COLUMN IF NOT EXISTS status_updated_at timestamptz;

COMMENT ON COLUMN public.feedback_submissions.merged_into IS
  'Dedup pointer: this submission was merged into another (status=duplicate). Signal is preserved — promotion counts merged submissions.';
COMMENT ON COLUMN public.feedback_submissions.punch_list_id IS
  'Triage link: the founder_punch_list item this submission was promoted into. Status changes on the punch item reflect back via tg_punch_list_status_reflect.';

CREATE INDEX IF NOT EXISTS feedback_submissions_status_idx
  ON public.feedback_submissions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_submissions_punch_idx
  ON public.feedback_submissions (punch_list_id) WHERE punch_list_id IS NOT NULL;

-- Owner-scoped read for the "my submissions" status view; founder reads all.
CREATE POLICY feedback_submissions_select_own
  ON public.feedback_submissions FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid() OR is_founder());

-- ── 3 · Founder triage RPCs (SECURITY DEFINER, is_founder() gate) ───────────

CREATE OR REPLACE FUNCTION public.feedback_triage(
  p_id uuid, p_status text, p_reach smallint DEFAULT NULL,
  p_impact_score smallint DEFAULT NULL, p_effort smallint DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT is_founder() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.feedback_submissions
     SET status = p_status,
         reach = COALESCE(p_reach, reach),
         impact_score = COALESCE(p_impact_score, impact_score),
         effort = COALESCE(p_effort, effort),
         triaged_at = COALESCE(triaged_at, now()),
         status_updated_at = now()
   WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.feedback_merge(p_duplicate uuid, p_canonical uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT is_founder() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_duplicate = p_canonical THEN RAISE EXCEPTION 'Cannot merge a submission into itself'; END IF;
  UPDATE public.feedback_submissions
     SET status = 'duplicate', merged_into = p_canonical, status_updated_at = now()
   WHERE id = p_duplicate;
END;
$$;

-- Promote a triaged submission to the punch list. sort_order derives from
-- the RICE-lite score (reach × impact ÷ effort, scaled): higher score →
-- lower sort_order → higher in the digest. Merged duplicates follow the
-- canonical submission's punch item automatically.
CREATE OR REPLACE FUNCTION public.feedback_promote(p_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_sub   public.feedback_submissions%ROWTYPE;
  v_rice  numeric;
  v_punch uuid;
  v_dups  integer;
BEGIN
  IF NOT is_founder() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO v_sub FROM public.feedback_submissions WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown submission %', p_id; END IF;

  SELECT count(*) INTO v_dups FROM public.feedback_submissions WHERE merged_into = p_id;

  v_rice := (COALESCE(v_sub.reach, 3)::numeric * COALESCE(v_sub.impact_score, 3))
            / GREATEST(COALESCE(v_sub.effort, 3), 1);

  INSERT INTO public.founder_punch_list (title, detail, owner, status, sort_order)
  VALUES (
    COALESCE(v_sub.title, left(v_sub.message, 80)),
    concat_ws(E'\n',
      v_sub.description,
      'Type: '  || COALESCE(v_sub.type, 'unspecified')
        || ' · Area: ' || COALESCE(v_sub.area, 'unspecified')
        || COALESCE(' / ' || v_sub.sub_area, ''),
      'RICE-lite: ' || round(v_rice, 1)
        || CASE WHEN v_dups > 0 THEN ' · ' || (v_dups + 1) || ' merged reports' ELSE '' END,
      'Source feedback: ' || v_sub.id),
    'AI',
    'open',
    GREATEST(1, 100 - round(v_rice * 8)::integer)
  )
  RETURNING id INTO v_punch;

  UPDATE public.feedback_submissions
     SET punch_list_id = v_punch, status = 'planned',
         triaged_at = COALESCE(triaged_at, now()), status_updated_at = now()
   WHERE id = p_id OR merged_into = p_id;

  RETURN v_punch;
END;
$$;

-- ── 4 · Status round-trip: punch list → submissions ─────────────────────────

CREATE OR REPLACE FUNCTION public.tg_punch_list_status_reflect()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.feedback_submissions
       SET status = CASE NEW.status
                      WHEN 'done'     THEN 'shipped'
                      WHEN 'deferred' THEN 'planned'
                      ELSE 'in_progress'
                    END,
           status_updated_at = now()
     WHERE punch_list_id = NEW.id
       AND status NOT IN ('declined','duplicate');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_punch_list_status_reflect ON public.founder_punch_list;
CREATE TRIGGER trg_punch_list_status_reflect
  AFTER UPDATE ON public.founder_punch_list
  FOR EACH ROW EXECUTE FUNCTION public.tg_punch_list_status_reflect();
