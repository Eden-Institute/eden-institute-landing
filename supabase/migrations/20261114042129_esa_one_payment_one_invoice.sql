-- ESA hardening E3 (2026-11-13, Lane 2 deep audit area 4; founder go 2026-11-13 "Yes, build + ship"):
-- one ClassWallet / Odyssey payment can never pay two invoices.
--
-- An ambiguous or mismatched notice gets one Confirm link per candidate invoice (esa-payment intake).
-- Confirming one left the others valid for 60 days, and neither function below looked at
-- esa_payments.applied, so a second tap marked a second invoice paid: two orders and two print sets
-- from one payment.
--
-- Both functions now lock the payment row first (so two taps at the same moment run one after the
-- other) and refuse a payment that is already applied to a DIFFERENT invoice. Re-applying to the same
-- invoice is unchanged (mark-paid still changes only an 'issued' invoice, so it stays a no-op).
-- esa_confirm_payment_token returns the new outcome 'payment_used' for that case; the Confirm page
-- (esa-payment-confirm) shows it as "already confirmed for invoice X, nothing was changed".
--
-- Lock order is payment row, then invoice row, in both functions (the token row is locked before
-- either in esa_confirm_payment_token), so the two cannot deadlock each other.
-- CREATE OR REPLACE with unchanged signatures keeps the owner, SECURITY DEFINER and the existing
-- grants (anon was revoked on both in 20260916110000). Idempotent: safe to run again.

create or replace function public.esa_mark_invoice_paid(p_invoice_id uuid, p_via text, p_payment_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  changed integer;
begin
  if p_payment_id is not null then
    perform 1 from public.esa_payments p where p.id = p_payment_id for update;
    if exists (
      select 1 from public.esa_payments p
       where p.id = p_payment_id and p.applied and p.invoice_id is distinct from p_invoice_id
    ) then
      return false;
    end if;
  end if;
  update public.esa_invoices
     set status = 'paid', paid_at = now(), paid_via = p_via,
         payment_id = coalesce(p_payment_id, payment_id), updated_at = now()
   where id = p_invoice_id and status = 'issued';
  get diagnostics changed = row_count;
  if changed = 1 and p_payment_id is not null then
    update public.esa_payments set applied = true, invoice_id = p_invoice_id where id = p_payment_id;
  end if;
  return changed = 1;
end;
$function$;

create or replace function public.esa_confirm_payment_token(p_token uuid)
returns table(outcome text, invoice_id uuid, payment_id uuid)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  t public.esa_payment_confirmations%rowtype;
begin
  select * into t from public.esa_payment_confirmations c where c.token = p_token for update;
  if not found then
    return query select 'not_found'::text, null::uuid, null::uuid;
    return;
  end if;
  if t.used_at is not null then
    return query select 'used'::text, t.invoice_id, t.payment_id;
    return;
  end if;
  if t.expires_at < now() then
    return query select 'expired'::text, t.invoice_id, t.payment_id;
    return;
  end if;
  if t.payment_id is not null then
    perform 1 from public.esa_payments p where p.id = t.payment_id for update;
    if exists (
      select 1 from public.esa_payments p
       where p.id = t.payment_id and p.applied and p.invoice_id is distinct from t.invoice_id
    ) then
      return query select 'payment_used'::text, t.invoice_id, t.payment_id;
      return;
    end if;
  end if;
  if not public.esa_mark_invoice_paid(t.invoice_id, 'founder_confirm', t.payment_id) then
    return query select 'not_issued'::text, t.invoice_id, t.payment_id;
    return;
  end if;
  update public.esa_payment_confirmations c set used_at = now() where c.token = p_token;
  return query select 'applied'::text, t.invoice_id, t.payment_id;
end;
$function$;
