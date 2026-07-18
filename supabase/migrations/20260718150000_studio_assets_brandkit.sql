-- Ad Studio Phase 2: the brand asset layer.
--
-- Phase 1 gave campaigns a home. This gives the assets one. Before this the
-- studio-assets bucket was raw files with no metadata: no tags, no filtering,
-- no way to know which campaign a photo belonged to, and no record of the
-- adjustments made to it. The brand kit did not exist as data at all, it was
-- hardcoded HTML and CSS constants.
--
-- Access boundary is is_founder() throughout, matching studio_projects and the
-- buckets themselves.

-- ── Asset metadata ──────────────────────────────────────────────────────────
-- One row per object in the studio-assets bucket. storage_path is the join key
-- and the uniqueness guarantee: the bucket remains the file store, this table
-- is only what we know ABOUT each file.

create table if not exists public.studio_assets (
  id            uuid primary key default gen_random_uuid(),
  created_by    uuid not null references auth.users(id) on delete cascade,

  storage_path  text not null unique,
  filename      text not null,
  mime_type     text,
  kind          text not null default 'image',

  -- Tagged with the campaign that was active at upload. Phase 8 may infer tags
  -- automatically; this is the manual truth until then.
  campaign_tag  text not null default 'general',
  -- Nullable on purpose: assets are reusable across campaigns, so the project
  -- an asset was first uploaded for is provenance, not ownership.
  project_id    uuid references public.studio_projects(id) on delete set null,

  size_bytes    bigint,
  created_at    timestamptz not null default now(),

  constraint studio_assets_kind_chk
    check (kind in ('image', 'video')),
  constraint studio_assets_campaign_tag_chk
    check (campaign_tag in ('sprouts', 'seedlings', 'cultivators', 'unratified', 'general'))
);

comment on table public.studio_assets is
  'Metadata for objects in the studio-assets bucket (Ad Studio Phase 2). The bucket stores bytes; this stores tags, kind, and provenance so the gallery can filter. storage_path is the join key. RLS: is_founder().';

create index if not exists studio_assets_tag_idx
  on public.studio_assets (campaign_tag, created_at desc);

alter table public.studio_assets enable row level security;

drop policy if exists "studio assets meta founder select" on public.studio_assets;
create policy "studio assets meta founder select" on public.studio_assets
  for select to authenticated using (public.is_founder());

drop policy if exists "studio assets meta founder insert" on public.studio_assets;
create policy "studio assets meta founder insert" on public.studio_assets
  for insert to authenticated with check (public.is_founder() and created_by = auth.uid());

drop policy if exists "studio assets meta founder update" on public.studio_assets;
create policy "studio assets meta founder update" on public.studio_assets
  for update to authenticated using (public.is_founder()) with check (public.is_founder());

drop policy if exists "studio assets meta founder delete" on public.studio_assets;
create policy "studio assets meta founder delete" on public.studio_assets
  for delete to authenticated using (public.is_founder());

-- ── Non-destructive adjustments ─────────────────────────────────────────────
-- Adjustments are a RECORD, never a baked-in edit: the uploaded file is never
-- rewritten. One row per (project, asset), so the same photo can be cropped one
-- way for a reel and another way for a feed post without duplicating the file.

create table if not exists public.studio_asset_transforms (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.studio_projects(id) on delete cascade,
  asset_id     uuid not null references public.studio_assets(id) on delete cascade,

  -- 0..1
  opacity      numeric not null default 1,
  -- { x, y, scale } in canvas-relative units
  crop         jsonb not null default '{}'::jsonb,
  -- { brightness, contrast, saturation }, each 0..2 with 1 = unchanged
  color_adjust jsonb not null default '{}'::jsonb,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint studio_asset_transforms_unique unique (project_id, asset_id),
  constraint studio_asset_transforms_opacity_chk check (opacity >= 0 and opacity <= 1)
);

comment on table public.studio_asset_transforms is
  'Non-destructive per-project adjustments to an asset (Ad Studio Phase 2). The stored file is never modified; the creative builder applies these at render time. One row per (project, asset).';

drop trigger if exists tg_studio_asset_transforms_updated_at on public.studio_asset_transforms;
create trigger tg_studio_asset_transforms_updated_at
  before update on public.studio_asset_transforms
  for each row execute function public.set_updated_at();

alter table public.studio_asset_transforms enable row level security;

drop policy if exists "studio transforms founder all" on public.studio_asset_transforms;
create policy "studio transforms founder all" on public.studio_asset_transforms
  for all to authenticated using (public.is_founder()) with check (public.is_founder());

-- ── Brand kit (locked) ──────────────────────────────────────────────────────
-- "Locked" is enforced, not merely a UI convention: the founder role gets
-- SELECT and nothing else. There is deliberately no insert/update/delete policy
-- for authenticated users, so changing the brand kit requires a migration or
-- the service role. The UI cannot edit it because the database will not let it.
--
-- Values are transcribed from the authoritative source, eden-ops
-- "_Strategy & Planning/Institute-Wide/Eden_Brand_Voice_Guide.docx" §4.1-4.2.
--
-- Note for reviewers: the phased build prompt quoted Forest #2C3E2D, Sage
-- #5C7A5C and Cream #F5F0E8. Those do not match the brand guide and are not
-- used here. The guide's values are what src/studio/studio.css already ships.

create table if not exists public.studio_brand_tokens (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null,
  token_key  text not null unique,
  label      text not null,
  value      text not null,
  usage      text,
  sort_order integer not null default 0,

  constraint studio_brand_tokens_kind_chk check (kind in ('color', 'font'))
);

comment on table public.studio_brand_tokens is
  'The locked Eden brand kit (Ad Studio Phase 2): palette and typography, transcribed from Eden_Brand_Voice_Guide.docx. Read-only to the founder role by design, there is no write policy. Changing brand values is a migration, not a UI action.';

alter table public.studio_brand_tokens enable row level security;

drop policy if exists "studio brand tokens founder read" on public.studio_brand_tokens;
create policy "studio brand tokens founder read" on public.studio_brand_tokens
  for select to authenticated using (public.is_founder());

insert into public.studio_brand_tokens (kind, token_key, label, value, usage, sort_order) values
  ('color', 'forest',      'Deep Forest Green',  '#2B3A1E', 'Headers, dark sections, logo lockup',            10),
  ('color', 'amber',       'Golden Amber',       '#C5A44E', 'Accent elements, buttons, CTAs, callout borders', 20),
  ('color', 'linen',       'Warm Linen',         '#F5EDD6', 'Page and card backgrounds, email',               30),
  ('color', 'near_black',  'Near Black',         '#1E1E14', 'Body copy, paragraph text',                      40),
  ('color', 'walnut',      'Dark Walnut',        '#5C4A28', 'Subheadings, secondary text emphasis',           50),
  ('color', 'soft_gold',   'Soft Gold',          '#E8D5A3', 'Highlight boxes, light accents',                 60),
  ('color', 'rich_gold',   'Rich Gold',          '#D4A843', 'Premium-tier signifiers, certificate borders',   70),
  ('color', 'olive',       'Olive Green',        '#6B7F3A', 'Secondary green, icons, supporting elements',    80),
  ('color', 'sage',        'Sage Green',         '#8A9A5B', 'Soft green, supporting elements',                90),
  ('color', 'teal',        'Muted Teal',         '#4A7068', 'Cool accent, diagrams, clinical elements',      100),
  ('color', 'terracotta',  'Terracotta',         '#B5643C', 'Earthy emphasis',                               110),
  ('color', 'dusty_rose',  'Dusty Rose',         '#C4A99A', 'Soft accent, optional',                         120),
  ('color', 'deep_cream',  'Deep Cream',         '#FAF6EE', 'Lighter background alternative to Warm Linen',  130),
  ('font',  'heading',     'Headlines',          'Cinzel Decorative', 'Bold. Titles, headings, logo lockup',   10),
  ('font',  'subheading',  'Subheadings',        'Cinzel',            'Regular. Section titles, card titles',  20),
  ('font',  'body',        'Body',               'EB Garamond',       'Regular. Paragraphs, captions, email',  30),
  ('font',  'caption',     'Captions and labels','Cinzel',            '11pt, wide letter-spacing. Metadata',   40)
on conflict (token_key) do nothing;

-- ── Backfill ────────────────────────────────────────────────────────────────
-- Objects already in the bucket predate this table. Give them rows so the
-- gallery does not appear to lose them, tagged 'general' for the founder to
-- re-tag. owner is the uploading user; fall back to the founder's own id.

insert into public.studio_assets (created_by, storage_path, filename, mime_type, kind, campaign_tag, size_bytes, created_at)
select
  coalesce(o.owner, (select id from auth.users where lower(email) = 'hello@edeninstitute.health' limit 1)),
  o.name,
  regexp_replace(o.name, '^\d+-', ''),
  o.metadata ->> 'mimetype',
  case when coalesce(o.metadata ->> 'mimetype', '') like 'video/%' then 'video' else 'image' end,
  'general',
  nullif(o.metadata ->> 'size', '')::bigint,
  coalesce(o.created_at, now())
from storage.objects o
where o.bucket_id = 'studio-assets'
  and coalesce(o.owner, (select id from auth.users where lower(email) = 'hello@edeninstitute.health' limit 1)) is not null
on conflict (storage_path) do nothing;
