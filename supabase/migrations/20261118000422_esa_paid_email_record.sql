-- Record the ESA "Payment received" family email (2026-11-17, Lane 2 area 1 finding 2; Camila's tap).
--
-- WHY. _shared/esa-fulfil.ts emailFamilyPaid sent the email straight to Resend and kept nothing,
-- so no check could see whether a family heard their books were going to print, and a retried
-- fulfilment could send it twice. Now the send time and Resend's message id are stored here, and
-- the email goes out once per invoice.
--
-- payment_email_msg_id (20260914230000_esa_invoices.sql) is left alone: no function writes it today and
-- its purpose is not documented, so it is not reused on a guess.
--
-- New columns on an existing table: the table's grants and RLS already cover them.

alter table public.esa_invoices
  add column if not exists paid_email_sent_at timestamptz,
  add column if not exists paid_email_resend_id text;

comment on column public.esa_invoices.paid_email_sent_at is
  'When the family''s "Payment received: your books are going to print" email went out (esa-fulfil.ts).';
comment on column public.esa_invoices.paid_email_resend_id is
  'Resend message id of that email.';
