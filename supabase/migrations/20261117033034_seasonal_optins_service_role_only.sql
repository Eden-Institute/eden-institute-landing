-- 2026-11-17: public.seasonal_optins is written and read only by resend-waitlist (service role)
-- and public.broadcast_audience (security definer). The project's default ACL still auto-grants
-- new public tables to anon and authenticated; RLS (on, no policies) already blocks them, and this
-- removes the grants too, so the table is service-role only by grant as well as by policy.
revoke all on table public.seasonal_optins from anon, authenticated;
