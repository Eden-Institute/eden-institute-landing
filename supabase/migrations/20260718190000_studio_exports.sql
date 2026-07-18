-- Ad Studio Phase 7: the export record.
--
-- Exporting was previously a browser download and nothing else: no trace that
-- an ad had ever been finished. Phase 8's archive needs to know which projects
-- produced files, in which sizes, and when, so every export now leaves a row.

create table if not exists public.studio_exports (
  id           uuid primary key default gen_random_uuid(),
  created_by   uuid not null references auth.users(id) on delete cascade,
  project_id   uuid not null references public.studio_projects(id) on delete cascade,

  format       text not null,
  aspect_ratio text not null,
  width        integer,
  height       integer,
  -- Path in the studio-exports bucket. Null when the founder took a plain
  -- browser download without publishing a copy.
  storage_path text,
  -- Groups the three sizes produced by a single "export all" click.
  batch_id     uuid,

  exported_at  timestamptz not null default now(),

  constraint studio_exports_format_chk check (format in ('png', 'jpg', 'mp4')),
  constraint studio_exports_ratio_chk check (aspect_ratio in ('1:1', '4:5', '9:16'))
);

comment on table public.studio_exports is
  'One row per exported file (Ad Studio Phase 7). batch_id groups the sizes from a single one-click multi-size export. The Phase 8 archive reads this to show what a project actually produced.';

create index if not exists studio_exports_project_idx
  on public.studio_exports (project_id, exported_at desc);
create index if not exists studio_exports_batch_idx
  on public.studio_exports (batch_id);

alter table public.studio_exports enable row level security;

drop policy if exists "studio exports founder all" on public.studio_exports;
create policy "studio exports founder all" on public.studio_exports
  for all to authenticated using (public.is_founder()) with check (public.is_founder());

-- Private bucket for kept copies of finished creative. Not the public
-- studio-collateral bucket: these are working exports, not published assets.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'studio-exports', 'studio-exports', false,
  209715200,
  array['image/png','image/jpeg','video/mp4','video/webm','application/zip']
)
on conflict (id) do nothing;

drop policy if exists "studio exports bucket founder all" on storage.objects;
create policy "studio exports bucket founder all" on storage.objects
  for all to authenticated
  using (bucket_id = 'studio-exports' and public.is_founder())
  with check (bucket_id = 'studio-exports' and public.is_founder());
