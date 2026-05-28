-- =============================================================================
-- Homeschool Bundle Buyer flag — v1 conversion-pivot launch (2026-08-01 Sprouts)
-- =============================================================================
--
-- Adds two nullable columns to public.profiles that flag a user as a
-- Two-Band Family Bundle purchaser. The flag gates the Add-on Student
-- Notebook ($39 nb_addon Stripe product) at the create-checkout EF
-- boundary: only bundle buyers may purchase the add-on, enforced via
-- authenticated session + DB read inside the EF.
--
-- Architecture notes:
--   * Set by stripe-webhook EF when a `two_band_bundle` checkout.session.completed
--     event fires. The webhook auto-provisions a Supabase auth.users row via
--     supabase.auth.admin.inviteUserByEmail, which triggers handle_new_user →
--     INSERT INTO profiles ... ON CONFLICT DO NOTHING. The webhook then
--     UPDATEs profiles.homeschool_bundle_buyer = true and
--     homeschool_bundle_purchased_at = now() for that user_id.
--   * Read by create-checkout EF when a `nb_addon` checkout is requested.
--     Requires JWT auth (same path as subscriptions); reads
--     profiles.homeschool_bundle_buyer for the calling user; returns 403
--     with code BUNDLE_REQUIRED if false.
--   * The Customer Portal at /homeschool/account (v1.1, separate PR) reads
--     this flag to render the "Add Extra Student Notebook" CTA only for
--     bundle buyers.
--
-- Idempotency: ADD COLUMN IF NOT EXISTS makes this safe to replay.
-- Backfill: not needed — pre-launch nobody has purchased the bundle.
-- RLS: profiles already has user-scoped RLS; these two columns inherit it.
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS homeschool_bundle_buyer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS homeschool_bundle_purchased_at timestamptz;

-- Index on the boolean flag for the Customer Portal's "show add-on" check.
-- Partial index — only the small set of true rows gets indexed, keeping
-- the index tiny while making the WHERE homeschool_bundle_buyer = true
-- read fast as the bundle-buyer cohort grows.
CREATE INDEX IF NOT EXISTS profiles_homeschool_bundle_buyer_idx
  ON public.profiles (user_id)
  WHERE homeschool_bundle_buyer = true;

-- Comment columns for future-Claude clarity in dashboard schema view.
COMMENT ON COLUMN public.profiles.homeschool_bundle_buyer IS
  'TRUE iff user has purchased the Two-Band Family Bundle (lookup_key=two_band_bundle). Set by stripe-webhook EF on checkout.session.completed. Gates the nb_addon add-on purchase in create-checkout EF.';

COMMENT ON COLUMN public.profiles.homeschool_bundle_purchased_at IS
  'Timestamp when the user purchased the Two-Band Family Bundle. Set together with homeschool_bundle_buyer by stripe-webhook EF. Used by Customer Portal to show order date.';
