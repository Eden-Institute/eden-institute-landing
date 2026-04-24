-- 20260424000000_resend_webhook_sync.sql
-- Eden Apothecary — Launch-blocker #45 (Stage 2 follow-up).
-- RPC used by the resend-webhook Edge Function to apply inbound Resend events
-- (contact.unsubscribed, contact.deleted, email.bounced, email.complained) to
-- public.waitlist_signups.
--
-- Design rationale:
--   The Edge Function stays thin (svix verification + dispatch). All state
--   transitions on waitlist_signups live in SQL so logic is version-controlled
--   and independently testable. metadata jsonb is merged with || so existing
--   attribution is never overwritten. unsubscribed_at uses COALESCE so the
--   first-arriving unsubscribe wins — idempotent against replays.
--
--   Hard bounces and complaints are treated as implicit unsubscribes per
--   email-hygiene best practice. Soft bounces are logged in metadata only.
--
-- Security:
--   SECURITY DEFINER because the function writes to an RLS-enabled table.
--   Owned by the Supabase postgres role; EXECUTE granted only to service_role.
--   No anon/authenticated grant — callers route through the Edge Function JWT.

CREATE OR REPLACE FUNCTION public.waitlist_apply_resend_event(
  p_event_type    text,
  p_contact_id    uuid,
  p_email         text,
  p_metadata_patch jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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

  ELSIF p_email IS NOT NULL AND length(trim(p_email)) > 0 THEN
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
$$;

REVOKE ALL ON FUNCTION public.waitlist_apply_resend_event(text, uuid, text, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.waitlist_apply_resend_event(text, uuid, text, jsonb) TO service_role;

COMMENT ON FUNCTION public.waitlist_apply_resend_event(text, uuid, text, jsonb) IS
  'Applies inbound Resend webhook events to public.waitlist_signups. Called from the resend-webhook Edge Function. Idempotent on unsubscribe timestamp; merges metadata jsonb. Hard bounces and complaints auto-unsubscribe per email-hygiene best practice.';
