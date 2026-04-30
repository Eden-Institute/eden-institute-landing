-- Save-favorites — herb_favorites table
--
-- Per Camila's Decision 4 picks (2026-04-30):
--   (a) Per-active-profile favorites — keyed by person_profile_id, NOT
--       user_id. Each family member's profile has its own favorites list.
--   (b) Seed-and-up only. Tier gating happens implicitly via the
--       person_profiles cap chain: Free has cap=0 → no person_profile
--       rows → no FK target → no herb_favorites rows possible. The hook
--       and UI also enforce explicitly.
--   (c) Heart icon on every HerbCard (Seed+) plus a dedicated
--       /apothecary/favorites list page.
--
-- FK shape note: herbs.herb_id is text, not uuid (verified via
-- information_schema 2026-04-30). The favorite row's herb_id column
-- mirrors that.
--
-- ON DELETE CASCADE both ways — deleting a person_profile cascades to
-- their favorites; deleting an herb (rare; would only happen if an
-- entry is retired from the materia medica) cascades too.
--
-- No UPDATE policy — favorites are toggle-on / toggle-off, no editable
-- fields. INSERT for "favorite this herb", DELETE for "unfavorite".
--
-- Lock context: implements Manual §0.8 save-favorites surface deferred
-- from launch baseline. Stage 7.X feature.

CREATE TABLE public.herb_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_profile_id uuid NOT NULL REFERENCES public.person_profiles(id) ON DELETE CASCADE,
  herb_id text NOT NULL REFERENCES public.herbs(herb_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_profile_id, herb_id)
);

-- Index supports the primary read path: list all favorites for the
-- active profile (ordered by created_at desc).
CREATE INDEX idx_herb_favorites_person_profile_id
  ON public.herb_favorites(person_profile_id);

-- Secondary index for the inverse query path (which profiles favorited
-- this herb), used for any future "popular among Frozen Knot users"
-- analytics surface. Cheap to maintain.
CREATE INDEX idx_herb_favorites_herb_id
  ON public.herb_favorites(herb_id);

-- RLS — scope every row to the authed user via the person_profiles
-- ownership chain.
ALTER TABLE public.herb_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY herb_favorites_select_own
  ON public.herb_favorites FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.person_profiles pp
      WHERE pp.id = herb_favorites.person_profile_id
        AND pp.user_id = auth.uid()
    )
  );

CREATE POLICY herb_favorites_insert_own
  ON public.herb_favorites FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.person_profiles pp
      WHERE pp.id = herb_favorites.person_profile_id
        AND pp.user_id = auth.uid()
    )
  );

CREATE POLICY herb_favorites_delete_own
  ON public.herb_favorites FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.person_profiles pp
      WHERE pp.id = herb_favorites.person_profile_id
        AND pp.user_id = auth.uid()
    )
  );

-- No UPDATE policy intentionally. Favorites are toggle-only.

COMMENT ON TABLE public.herb_favorites IS
  'Per-active-profile herb favorites (Camila Decision 4a, 2026-04-30). Each row is one (person_profile, herb) tuple the active profile has saved. Tier gating is implicit via the person_profiles cap chain: Free=0 profiles → no FK target → no favorites possible. Hook + UI enforce Seed+ explicitly for clearer error states. Stage 7.X.';

COMMENT ON COLUMN public.herb_favorites.person_profile_id IS
  'FK to person_profiles. ON DELETE CASCADE so deleting a profile clears their favorites.';

COMMENT ON COLUMN public.herb_favorites.herb_id IS
  'FK to herbs(herb_id). Text, not uuid — herbs uses slug-shaped text IDs (e.g. "ashwagandha", "chamomile").';
