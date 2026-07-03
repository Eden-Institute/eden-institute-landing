-- Security fix (2026-07-01): re-lock lead_capture_digest_window to service_role only.
--
-- lead_capture_digest_window(timestamptz, timestamptz) is SECURITY DEFINER and returns
-- lead PII (email, first_name, source_url, utm_*) straight from public.waitlist_signups
-- with no internal auth guard. Prior migrations (20260529230000, 20260530030110) already
-- revoked EXECUTE from PUBLIC and granted only service_role, but the live ACL drifted:
-- a later CREATE OR REPLACE reset the function's ACL to the Postgres default, silently
-- re-granting EXECUTE to anon/authenticated. That exposed every lead's PII to any holder
-- of the public anon key (which ships in the client bundle) via a single RPC call.
--
-- The only legitimate caller is the notify-founder-digest edge function, which runs with
-- the service-role key. Re-assert the intended grant explicitly (revoke by role name as
-- well as PUBLIC so a future default-grant drift is neutralized).
--
-- Idempotent: safe to re-run.

REVOKE EXECUTE ON FUNCTION public.lead_capture_digest_window(timestamptz, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.lead_capture_digest_window(timestamptz, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.lead_capture_digest_window(timestamptz, timestamptz) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.lead_capture_digest_window(timestamptz, timestamptz) TO service_role;
