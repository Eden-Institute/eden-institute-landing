-- Database tidy-up (2026-11-17, Lane 2 deep audit area 14 finding R2; Camila's tap).
--
-- 1. Trigger functions no longer callable through the API. Supabase's advisor listed these 16 as
--    SECURITY DEFINER functions anon and signed-in users can "execute" via /rest/v1/rpc. Postgres
--    refuses to run a trigger function outside its trigger, so nothing was exposed, but the grant
--    is noise (32 advisor rows) and the house pattern is to revoke what nobody calls. Triggers keep
--    firing: Postgres checks EXECUTE on a trigger function only when the trigger is CREATED, never
--    when it fires (proven in the rolled-back dry run: an insert as a role with no EXECUTE still ran
--    the trigger). rls_auto_enable is an event trigger (ensure_rls), same rule.
-- 2. search_path pinned on the 5 plain helpers the advisor flagged (SECURITY INVOKER, text/interval).
-- 3. The 8 founder-only storage rules for the studio-assets, studio-collateral and studio-exports
--    buckets, which no longer exist (only book-files, esa-invoices, partner-assets and starter-unit
--    do). The restrictive "Deny client access to constitution-guides" rule is left alone.

revoke execute on function public.cancel_buyer_sequence_on_order_death() from public, anon, authenticated;
revoke execute on function public.cancel_launch_emails_on_order() from public, anon, authenticated;
revoke execute on function public.cancel_queued_emails_on_unsubscribe() from public, anon, authenticated;
revoke execute on function public.enqueue_buyer_sequence_on_order() from public, anon, authenticated;
revoke execute on function public.enqueue_launch_sequence_on_signup() from public, anon, authenticated;
revoke execute on function public.enqueue_refund_note() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.quiz_completions_to_waitlist() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.tg_diagnostic_completion_sync_profile() from public, anon, authenticated;
revoke execute on function public.tg_person_profiles_enforce_cap() from public, anon, authenticated;
revoke execute on function public.tg_profiles_create_self_on_upgrade() from public, anon, authenticated;
revoke execute on function public.tg_punch_list_status_reflect() from public, anon, authenticated;
revoke execute on function public.tg_quiz_completion_sync_constitution() from public, anon, authenticated;
revoke execute on function public.trg_founding_family_on_order() from public, anon, authenticated;
revoke execute on function public.trg_purchase_tracks_on_order() from public, anon, authenticated;

alter function public.founding_family_track(text) set search_path = public, pg_temp;
alter function public.founding_family_band(text) set search_path = public, pg_temp;
alter function public.founding_family_offset(text) set search_path = public, pg_temp;
alter function public.purchase_track_band(text) set search_path = public, pg_temp;
alter function public.purchase_track_offset(text, smallint) set search_path = public, pg_temp;

drop policy if exists "studio assets founder delete" on storage.objects;
drop policy if exists "studio assets founder insert" on storage.objects;
drop policy if exists "studio assets founder select" on storage.objects;
drop policy if exists "studio assets founder update" on storage.objects;
drop policy if exists "studio collateral founder delete" on storage.objects;
drop policy if exists "studio collateral founder insert" on storage.objects;
drop policy if exists "studio collateral founder update" on storage.objects;
drop policy if exists "studio exports bucket founder all" on storage.objects;
