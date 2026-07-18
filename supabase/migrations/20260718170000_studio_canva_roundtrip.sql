-- Ad Studio Phase 3: the Canva round-trip.
--
-- Export the current creative to a real Canva design, edit it there, then pull
-- the finished version back. Per the spec the reimport OVERWRITES the active
-- version in the studio, with the pre-Canva version retained for recovery but
-- not surfaced as a version picker.
--
-- Note on integration type: Canva gates PRIVATE integrations behind an
-- Enterprise plan, so this is registered as a Public integration that is never
-- submitted for review. Unreviewed public integrations are usable by their
-- creator, which is all a single-founder internal tool needs.

-- ── OAuth tokens ────────────────────────────────────────────────────────────
-- Service-role only. RLS is enabled with ZERO policies, so no client session
-- can read these rows no matter what: the tokens are only ever touched by the
-- canva-connect edge function using the service key.
--
-- Canva access tokens last ~4 hours and REFRESH TOKENS ARE SINGLE USE, so the
-- refresh path must persist the newly returned refresh token every time or the
-- connection dies at the next refresh.

create table if not exists public.studio_canva_tokens (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null unique references auth.users(id) on delete cascade,
  access_token   text not null,
  refresh_token  text not null,
  expires_at     timestamptz not null,
  scope          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.studio_canva_tokens is
  'Canva Connect OAuth tokens for the founder (Ad Studio Phase 3). RLS enabled with NO policies: service-role only, the browser never sees these. Refresh tokens are single-use, so every refresh must overwrite the stored one.';

drop trigger if exists tg_studio_canva_tokens_updated_at on public.studio_canva_tokens;
create trigger tg_studio_canva_tokens_updated_at
  before update on public.studio_canva_tokens
  for each row execute function public.set_updated_at();

alter table public.studio_canva_tokens enable row level security;
-- Deliberately no policies. Do not add one.

-- ── Version history ─────────────────────────────────────────────────────────
-- Every time an asset's bytes are replaced, the previous storage_path is kept
-- here. studio_assets.storage_path is always the ACTIVE version; this table is
-- the recovery trail behind it.

create table if not exists public.studio_asset_versions (
  id             uuid primary key default gen_random_uuid(),
  asset_id       uuid not null references public.studio_assets(id) on delete cascade,
  version_number integer not null,
  source         text not null,
  storage_path   text not null,
  created_at     timestamptz not null default now(),

  constraint studio_asset_versions_source_chk check (source in ('native', 'canva')),
  constraint studio_asset_versions_unique unique (asset_id, version_number)
);

comment on table public.studio_asset_versions is
  'Recovery trail for assets whose bytes have been replaced (Ad Studio Phase 3). studio_assets.storage_path is the active version; these are the superseded ones. source records whether the bytes came from the studio canvas or from a Canva round-trip.';

create index if not exists studio_asset_versions_asset_idx
  on public.studio_asset_versions (asset_id, version_number desc);

alter table public.studio_asset_versions enable row level security;

drop policy if exists "studio asset versions founder all" on public.studio_asset_versions;
create policy "studio asset versions founder all" on public.studio_asset_versions
  for all to authenticated using (public.is_founder()) with check (public.is_founder());

-- ── Project ↔ Canva design link ─────────────────────────────────────────────
-- One Canva design per project. Reimport needs to know which design to pull,
-- and the edit URL is worth keeping so the founder can reopen it.
-- Canva edit/view URLs are documented as valid for 30 days.

alter table public.studio_projects
  add column if not exists canva_design_id  text,
  add column if not exists canva_edit_url   text,
  add column if not exists canva_asset_id   uuid references public.studio_assets(id) on delete set null,
  add column if not exists canva_synced_at  timestamptz;

comment on column public.studio_projects.canva_design_id is
  'The Canva design this project was exported to, if any. Phase 3 reimport pulls from here.';
comment on column public.studio_projects.canva_asset_id is
  'The studio_assets row whose bytes the Canva round-trip overwrites on reimport.';
