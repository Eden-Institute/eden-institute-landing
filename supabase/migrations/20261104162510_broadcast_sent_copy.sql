-- founder-broadcast: keep the exact copy each order received (punch #143, 2026-11-04).
--
-- WHY. Every founder-broadcast email is personalised per order (first name, order number,
-- and on a delay notice the opt-in wording and two signed consent links), so
-- broadcasts.body_html cannot hold what a buyer actually got; for delay notices it is
-- NULL on purpose. A delay notice the buyer consents to is the evidence of that consent.
-- The 2026-08-26 notice left no stored copy and had to be rebuilt byte for byte from the
-- sent Gmail messages (punch #143, 11/3). From now on founder-broadcast writes the subject
-- and HTML onto the order's claimed log row BEFORE the Resend call, and an order whose
-- copy cannot be written is not mailed.
--
--   sent_subject   the subject line this order's email carried (a delay notice's subject
--                  follows that order's opt-in, so it can differ between orders)
--   sent_html      the full rendered HTML handed to Resend for this order
--
-- APPLY THIS BEFORE DEPLOYING founder-broadcast from the same PR: the function writes these
-- columns, and without them every send stops at that write (nothing is mailed).
--
-- Rows from before this migration stay NULL: nothing kept a copy then, so NULL means
-- "not recorded", not "empty". No new table, so no new grants: the existing table grants
-- (service_role only) cover new columns. Idempotent: every statement can be re-run.

alter table public.broadcast_recipient_sends
  add column if not exists sent_subject text;

alter table public.broadcast_recipient_sends
  add column if not exists sent_html text;

comment on column public.broadcast_recipient_sends.sent_subject is
  'Subject line of the email this order was sent, written by founder-broadcast before the Resend call. NULL on rows from before 2026-11-04 means not recorded.';

comment on column public.broadcast_recipient_sends.sent_html is
  'Full rendered HTML of the email this order was sent (personalised: name, order number, consent links on a delay notice), written by founder-broadcast before the Resend call. NULL on rows from before 2026-11-04 means not recorded.';
