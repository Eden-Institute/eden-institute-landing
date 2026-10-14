-- 2026-10-14, founder decision (Gina's punchlist recs #352): new sign-ups are no longer
-- enrolled in the old launch drip (positions 8-12 and 19-21, days 9 to 31). A free-week
-- family now gets: the welcome (resend-waitlist), the next-morning note (magnet position 1,
-- ~18h), the day-7 check-in (magnet position 2), and then the every-other-Friday list emails.
-- Why: ten emails in a month against the founder's fewer-better rule, and dated copy
-- ("On August 20 I recorded with...", "all summer", "flat $12 shipping").
--
-- The trigger stays and the function becomes a no-op, so the drip can be restored by
-- re-applying 20260925100000_back_to_eden_ch1_skips_launch_sequence.sql's definition.
-- Rows already queued are handled separately (cancelled, with a backup), not here.

create or replace function public.enqueue_launch_sequence_on_signup()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  -- Retired 2026-10-14 (#352). See the header of this migration.
  return new;
end;
$function$;
