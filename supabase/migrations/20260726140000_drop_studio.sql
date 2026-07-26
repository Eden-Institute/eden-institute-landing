-- Retire the Ad Studio, founder decision 2026-07-26.
--
-- THIS MIGRATION DESTROYS DATA AND CANNOT BE UNDONE. Row counts read from
-- production immediately before it was written:
--
--   studio_projects          4
--   studio_assets            4
--   studio_brand_tokens     17
--   studio_canva_tokens      1   <- a live Canva Connect OAuth token
--   studio_asset_transforms  0
--   studio_asset_versions    0
--   studio_exports           0
--   studio_rate_limits       0
--
-- Nothing outside the studio reads any of these. Checked before writing:
-- `_shared/checkout-rate-limit.ts` only MENTIONS the studio limiter in a comment,
-- it does not import it, so the preorder checkout path is untouched.
--
-- Storage: three buckets go with it. Objects must be deleted before the bucket
-- row, or the delete fails on the foreign key.
--
-- The Canva token is revoked implicitly by dropping it, but the authorisation
-- still exists on Canva's side. Disconnect the app from the Canva account too if
-- a clean break is wanted.

begin;

-- ── Storage: objects first, then the buckets ──
delete from storage.objects
 where bucket_id in ('studio-assets', 'studio-collateral', 'studio-exports');

drop policy if exists "studio assets founder select"      on storage.objects;
drop policy if exists "studio assets founder insert"      on storage.objects;
drop policy if exists "studio assets founder update"      on storage.objects;
drop policy if exists "studio assets founder delete"      on storage.objects;
drop policy if exists "studio collateral founder insert"  on storage.objects;
drop policy if exists "studio collateral founder update"  on storage.objects;
drop policy if exists "studio collateral founder delete"  on storage.objects;
drop policy if exists "studio exports bucket founder all" on storage.objects;

delete from storage.buckets
 where id in ('studio-assets', 'studio-collateral', 'studio-exports');

-- ── Tables. `cascade` handles the FK web between projects, assets,
--    transforms, versions and exports, plus their policies and triggers. ──
drop table if exists public.studio_asset_transforms cascade;
drop table if exists public.studio_asset_versions   cascade;
drop table if exists public.studio_exports          cascade;
drop table if exists public.studio_assets           cascade;
drop table if exists public.studio_projects         cascade;
drop table if exists public.studio_brand_tokens     cascade;
drop table if exists public.studio_canva_tokens     cascade;
drop table if exists public.studio_rate_limits      cascade;

-- ── The rate-limit RPC. Dropped after its table so nothing references a
--    missing relation mid-transaction. ──
drop function if exists public.studio_rate_bump(text);

commit;
