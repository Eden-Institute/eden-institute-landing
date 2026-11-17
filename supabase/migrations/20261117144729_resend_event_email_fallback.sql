-- 2026-11-17, Lane 2 deep audit area 8, finding U4 (founder tap "Yes, build + ship").
--
-- public.waitlist_apply_resend_event is how resend-webhook saves a Resend unsubscribe,
-- contact deletion, hard bounce or complaint. For contact events it matched ONLY by
-- resend_contact_id whenever Resend sent one (it always does), and never fell back to the
-- email. resend-waitlist leaves resend_contact_id empty when Resend answers 409 (contact
-- already exists), and nothing fills it in later, so a family with no stored id who pressed
-- "unsubscribe" in a Broadcast was blocked by Resend but not saved here: our own drip emails
-- would not know (19 addresses had no id on 2026-11-17, 2 of them subscribed to the
-- homeschool list).
--
-- Change: when the contact-id update touches no row and an email came with the event, the
-- same update runs by email. Nothing else changes: same events, same "should unsubscribe"
-- rule, same metadata patch, same return value (rows touched). The 10/14 echo guard in
-- resend-webhook runs BEFORE this function and is untouched.
--
-- Body = the live definition read with pg_get_functiondef on 2026-11-17 plus the marked
-- fallback block. CREATE OR REPLACE keeps the existing grants (not executable by anon or
-- authenticated; resend-webhook calls it with the service role).

create or replace function public.waitlist_apply_resend_event(p_event_type text, p_contact_id uuid, p_email text, p_metadata_patch jsonb)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_rows          integer := 0;
  v_should_unsub  boolean;
  v_bounce_type   text;
BEGIN
  v_bounce_type := COALESCE(p_metadata_patch->>'bounce_type', '');

  v_should_unsub := (
    p_event_type IN ('contact.unsubscribed', 'contact.deleted', 'email.complained')
  ) OR (
    p_event_type = 'email.bounced'
    AND (v_bounce_type ILIKE '%hard%' OR v_bounce_type ILIKE '%permanent%')
  );

  IF p_contact_id IS NOT NULL THEN
    UPDATE public.waitlist_signups
       SET unsubscribed_at = CASE
             WHEN v_should_unsub THEN COALESCE(unsubscribed_at, now())
             ELSE unsubscribed_at
           END,
           metadata = COALESCE(metadata, '{}'::jsonb)
                   || COALESCE(p_metadata_patch, '{}'::jsonb)
     WHERE resend_contact_id = p_contact_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
  END IF;

  -- NEW 2026-11-17 (area 8 U4): no contact id, OR a contact id that matched no row
  -- (resend_contact_id never stored): fall back to the email.
  IF v_rows = 0 AND p_email IS NOT NULL AND length(trim(p_email)) > 0 THEN
    UPDATE public.waitlist_signups
       SET unsubscribed_at = CASE
             WHEN v_should_unsub THEN COALESCE(unsubscribed_at, now())
             ELSE unsubscribed_at
           END,
           metadata = COALESCE(metadata, '{}'::jsonb)
                   || COALESCE(p_metadata_patch, '{}'::jsonb)
     WHERE lower(email) = lower(p_email);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
  END IF;

  RETURN v_rows;
END;
$function$;
