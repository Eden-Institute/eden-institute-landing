-- ESA payments: ClassWallet / Odyssey payment notices matched to esa_invoices, the founder's one-tap
-- confirmations, and the switch to fully automatic once 3 matched payments have been confirmed.
-- Added 2026-09-15 (part 2 of the ESA automation; part 1 = 20260914230000_esa_invoices.sql).
--
-- Flow: scripts/esa_payment_intake.py (local, reads Gmail) posts each notice to the esa-payment
-- edge function, which matches it (_shared/esa-payment-match.ts) and records it here.
--   matched + fewer than 3 founder confirmations -> founder gets a Confirm paid link
--   matched + 3 or more                          -> applied automatically
--   anything else                                -> founder alert, nothing applied
-- Private: RLS on with no policies. Service role only.

create table if not exists public.esa_payments (
  id             uuid primary key default gen_random_uuid(),
  gmail_msg_id   text not null unique,
  received_at    timestamptz,
  from_addr      text,
  subject        text,
  excerpt        text,
  amounts_cents  integer[] not null default '{}',
  match_status   text not null check (match_status in ('matched', 'amount_only', 'ambiguous', 'amount_mismatch', 'unmatched')),
  match_reason   text,
  invoice_id     uuid references public.esa_invoices(id),
  applied        boolean not null default false,
  founder_notified_at timestamptz,
  created_at     timestamptz not null default now()
);
alter table public.esa_payments enable row level security;

-- One single-use token per (notice, candidate invoice). The confirm page is a GET that shows the
-- invoice and a POST button, so an email link scanner can never mark anything paid.
create table if not exists public.esa_payment_confirmations (
  token       uuid primary key default gen_random_uuid(),
  payment_id  uuid references public.esa_payments(id),
  invoice_id  uuid not null references public.esa_invoices(id),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '60 days',
  used_at     timestamptz
);
create index if not exists esa_payment_confirmations_invoice_idx on public.esa_payment_confirmations (invoice_id);
alter table public.esa_payment_confirmations enable row level security;

alter table public.esa_invoices
  add column if not exists paid_via text check (paid_via in ('founder_confirm', 'auto', 'manual')),
  add column if not exists payment_id uuid references public.esa_payments(id),
  add column if not exists fulfilment_status text not null default 'none'
    check (fulfilment_status in ('none', 'queued', 'files_sent', 'print_queued', 'shipped', 'failed', 'manual')),
  add column if not exists fulfilment_note text,
  add column if not exists fulfilled_at timestamptz,
  add column if not exists founder_alerted_at timestamptz,
  -- Structured address and optional phone from the form (Lulu needs both parts, and a phone).
  add column if not exists ship_address jsonb,
  add column if not exists phone text,
  -- Links into the existing fulfilment: orders (+ order_items, lulu_jobs) for printed books,
  -- starter_deliveries for the 9-week download.
  add column if not exists order_id uuid references public.orders(id),
  add column if not exists starter_delivery_id uuid references public.starter_deliveries(id);

-- The switch: fully automatic only after the founder has confirmed 3 real payments that the matcher
-- called "matched". Test invoices never count.
create or replace function public.esa_auto_confirm_ready()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select count(*) >= 3
  from public.esa_invoices i
  join public.esa_payments p on p.id = i.payment_id
  where i.paid_via = 'founder_confirm' and not i.is_test and p.match_status = 'matched';
$$;
revoke all on function public.esa_auto_confirm_ready() from public, anon, authenticated;
grant execute on function public.esa_auto_confirm_ready() to service_role;

-- Marks one issued invoice paid, exactly once. Returns true only for the call that changed it, so a
-- double-click or a retry can never fulfil twice.
create or replace function public.esa_mark_invoice_paid(p_invoice_id uuid, p_via text, p_payment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer;
begin
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
$$;
revoke all on function public.esa_mark_invoice_paid(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.esa_mark_invoice_paid(uuid, text, uuid) to service_role;
