-- public.podcast_appearances (punch #474): the project's default privileges still gave anon and authenticated every
-- table privilege on the new table (read back 2026-11-24). RLS already blocks their writes (the only policy is
-- SELECT of published rows), but the public roles should hold SELECT only. service_role keeps its grants.
revoke all on table public.podcast_appearances from anon, authenticated;
grant select on table public.podcast_appearances to anon, authenticated;
