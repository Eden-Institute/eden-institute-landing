-- studio-assets: the private media library behind the founder-only /studio ad
-- workroom. Uploaded product photos, mockups, and video clips persist here and
-- the studio's Creative/Video builders pull from it as a gallery.
--
-- is_founder() (JWT email check) is the sole access boundary on every verb,
-- matching the /founder RPC posture. The bucket is never public; the client
-- reads through short-lived signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'studio-assets', 'studio-assets', false,
  209715200, -- 200 MB per object: room for short video clips
  array['image/png','image/jpeg','image/webp','image/gif',
        'video/mp4','video/webm','video/quicktime']
)
on conflict (id) do nothing;

drop policy if exists "studio assets founder select" on storage.objects;
create policy "studio assets founder select" on storage.objects
  for select to authenticated
  using (bucket_id = 'studio-assets' and public.is_founder());

drop policy if exists "studio assets founder insert" on storage.objects;
create policy "studio assets founder insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'studio-assets' and public.is_founder());

drop policy if exists "studio assets founder update" on storage.objects;
create policy "studio assets founder update" on storage.objects
  for update to authenticated
  using (bucket_id = 'studio-assets' and public.is_founder())
  with check (bucket_id = 'studio-assets' and public.is_founder());

drop policy if exists "studio assets founder delete" on storage.objects;
create policy "studio assets founder delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'studio-assets' and public.is_founder());

-- studio-collateral: PUBLIC bucket for marketing collateral the founder
-- explicitly publishes from the studio (finished ad images for email and web,
-- where a hosted URL is required: Gmail strips data URIs). Public READ is the
-- point; every write verb stays founder-only.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'studio-collateral', 'studio-collateral', true,
  20971520, -- 20 MB per image
  array['image/png','image/jpeg','image/webp']
)
on conflict (id) do nothing;

drop policy if exists "studio collateral founder insert" on storage.objects;
create policy "studio collateral founder insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'studio-collateral' and public.is_founder());

drop policy if exists "studio collateral founder update" on storage.objects;
create policy "studio collateral founder update" on storage.objects
  for update to authenticated
  using (bucket_id = 'studio-collateral' and public.is_founder())
  with check (bucket_id = 'studio-collateral' and public.is_founder());

drop policy if exists "studio collateral founder delete" on storage.objects;
create policy "studio collateral founder delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'studio-collateral' and public.is_founder());
