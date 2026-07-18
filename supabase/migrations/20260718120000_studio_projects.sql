-- studio_projects: the persistence layer behind the founder-only /studio ad
-- workroom (Ad Studio phased build, Phase 1).
--
-- Before this migration the studio held every draft, approval, and founder note
-- in in-memory JS closures: a refresh or a route change lost the whole session.
-- This table is the source of truth for a campaign project, and the archive in
-- Phase 8 reads from it directly.
--
-- is_founder() (JWT email check) is the sole access boundary on every verb,
-- matching the studio-assets bucket and the /founder RPC posture. created_by is
-- recorded for audit and for the day a second studio user exists; it is NOT the
-- access predicate today.

create table if not exists public.studio_projects (
  id            uuid primary key default gen_random_uuid(),
  created_by    uuid not null references auth.users(id) on delete cascade,

  -- Entry screen (Phase 1, Screen I). product drives the AI copy brief; the
  -- other three drive canvas sizing, the Meta handoff, and archive filtering.
  title         text not null default 'Untitled campaign',
  product       text not null default 'kit',
  platforms     text[] not null default array['instagram','facebook'],
  ad_type       text not null default 'feed',
  campaign_tag  text not null default 'general',

  -- Wizard position. Free navigation means this is a resume hint, not a gate.
  current_step  integer not null default 0,
  status        text not null default 'draft',

  -- The studio's own working state (campaign pickers, generated variants,
  -- approved tray, creative-builder fields). Deliberately a jsonb blob rather
  -- than columns: the vanilla core owns this shape and it is still moving.
  -- Anything Phase 8 needs to FILTER on gets promoted to a real column above.
  state         jsonb not null default '{}'::jsonb,

  -- Ordered slide list. Single-image and single-video ads carry exactly one
  -- slide; carousel carries 2 to 10. Modelling it as an array from day one is
  -- what makes carousel a later UI addition instead of a schema rewrite.
  slides        jsonb not null default '[]'::jsonb,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint studio_projects_status_chk
    check (status in ('draft', 'exported', 'archived')),
  constraint studio_projects_ad_type_chk
    check (ad_type in ('reel', 'feed', 'story', 'carousel')),
  constraint studio_projects_campaign_tag_chk
    check (campaign_tag in ('sprouts', 'seedlings', 'cultivators', 'unratified', 'general')),
  -- Guards the carousel invariant at the database rather than trusting the UI.
  constraint studio_projects_slides_is_array
    check (jsonb_typeof(slides) = 'array'),
  constraint studio_projects_platforms_nonempty
    check (array_length(platforms, 1) >= 1)
);

comment on table public.studio_projects is
  'Founder-only /studio ad campaign projects (Ad Studio Phase 1). One row per campaign. state = the vanilla studio core''s working blob; slides = ordered, carousel-ready. Filterable facets are promoted to real columns for the Phase 8 archive. RLS: is_founder() on every verb.';

-- Archive list ordering (Phase 8 reads this exact shape).
create index if not exists studio_projects_owner_updated_idx
  on public.studio_projects (created_by, updated_at desc);

-- Archive filtering by campaign / ad type.
create index if not exists studio_projects_facets_idx
  on public.studio_projects (campaign_tag, ad_type, status);

-- updated_at maintenance. set_updated_at() already exists in this schema and is
-- used by the other founder-facing tables; reuse it rather than adding a twin.
drop trigger if exists tg_studio_projects_updated_at on public.studio_projects;
create trigger tg_studio_projects_updated_at
  before update on public.studio_projects
  for each row execute function public.set_updated_at();

alter table public.studio_projects enable row level security;

drop policy if exists "studio projects founder select" on public.studio_projects;
create policy "studio projects founder select" on public.studio_projects
  for select to authenticated
  using (public.is_founder());

drop policy if exists "studio projects founder insert" on public.studio_projects;
create policy "studio projects founder insert" on public.studio_projects
  for insert to authenticated
  with check (public.is_founder() and created_by = auth.uid());

drop policy if exists "studio projects founder update" on public.studio_projects;
create policy "studio projects founder update" on public.studio_projects
  for update to authenticated
  using (public.is_founder())
  with check (public.is_founder());

drop policy if exists "studio projects founder delete" on public.studio_projects;
create policy "studio projects founder delete" on public.studio_projects
  for delete to authenticated
  using (public.is_founder());
