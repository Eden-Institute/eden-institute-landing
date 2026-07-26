-- Retire the Ad Studio, founder decision 2026-07-26.
--
-- THIS MIGRATION DESTROYS DATA AND CANNOT BE UNDONE. Row counts read from
-- production immediately before it ran:
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
-- Nothing outside the studio reads any of these. Checked before deleting:
-- `_shared/checkout-rate-limit.ts` only MENTIONS the studio limiter in a comment,
-- it does not import it, so the preorder checkout path is untouched.
--
-- STORAGE IS DELIBERATELY ABSENT FROM THIS FILE.
--
-- The first version tried to `delete from storage.objects` and drop the storage
-- policies. Supabase rejects that outright:
--
--   ERROR: Direct deletion from storage tables is not allowed.
--          Use the Storage API instead. (SQLSTATE 42501)
--
-- The whole migration rolled back, so nothing was lost, but the lesson is worth
-- keeping: buckets cannot be torn down from SQL. The three studio buckets
-- (studio-assets, studio-collateral, studio-exports) were emptied and deleted via
-- the Storage API on 2026-07-26 before this migration was re-run, and their
-- policies went with them. Note that the `empty` call is ASYNCHRONOUS: the first
-- delete attempt raced the queued empty job and failed with an empty error body.
-- Retrying after the queue drained succeeded.
--
-- The Canva OAuth token dies with studio_canva_tokens, but the authorisation still
-- exists on Canva's side. Disconnect the app there too for a clean break.

begin;

-- `cascade` handles the FK web between projects, assets, transforms, versions and
-- exports, along with their policies, indexes and triggers.
drop table if exists public.studio_asset_transforms cascade;
drop table if exists public.studio_asset_versions   cascade;
drop table if exists public.studio_exports          cascade;
drop table if exists public.studio_assets           cascade;
drop table if exists public.studio_projects         cascade;
drop table if exists public.studio_brand_tokens     cascade;
drop table if exists public.studio_canva_tokens     cascade;
drop table if exists public.studio_rate_limits      cascade;

-- The rate-limit RPC, dropped after its table so nothing references a missing
-- relation mid-transaction.
drop function if exists public.studio_rate_bump(text);

commit;
