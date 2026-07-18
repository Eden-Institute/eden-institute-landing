-- Ad Studio Phase 4: record where an asset's bytes came from.
--
-- The spec requires AI-generated images to land "into the same assets table as
-- uploads, tagged source: ai_generated". Without this the gallery cannot tell a
-- photograph the founder shot from an image a model invented, which matters
-- both for her own judgement and for any future disclosure obligation on paid
-- social.

alter table public.studio_assets
  add column if not exists source text not null default 'upload';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'studio_assets_source_chk'
  ) then
    alter table public.studio_assets
      add constraint studio_assets_source_chk
      check (source in ('upload', 'ai_generated', 'canva'));
  end if;
end $$;

comment on column public.studio_assets.source is
  'Where the bytes came from: upload (founder file), ai_generated (Gemini), canva (round-trip reimport). Defaults to upload so pre-existing rows stay truthful.';

-- The prompt that produced an AI image, kept so a generation can be understood
-- or repeated later. Null for everything else.
alter table public.studio_assets
  add column if not exists ai_prompt text;

create index if not exists studio_assets_source_idx
  on public.studio_assets (source, created_at desc);
