-- ESA / scholarship invoices issued by the public order form on /esa/<state>.
-- Added 2026-09-14 (founder: "as automated and painless as possible").
--
-- One row per invoice, and one invoice per STUDENT: New Hampshire EFAs are per pupil
-- (CSF handbook p.18, p.29) and every program prints the student's name on the invoice,
-- so a sibling's notebook is that sibling's own invoice.
--
-- Invoice numbers keep the format the manual tooling already uses (scripts/esa_invoice.py):
-- ET-<STATE>-<YEAR>-<NNN>, a running number PER STATE PER YEAR. This table's counter is the
-- single issuer from now on, so a hand-made invoice and a form invoice can never share a
-- number. No invoice had been issued in any state before this migration.
--
-- Private: RLS on with no policies. Reached only by the esa-invoice edge function (service
-- role) and the founder's Management API tooling. Holds children's names; never expose it.

create table if not exists public.esa_invoice_counters (
  state   text    not null,
  year    integer not null,
  last_no integer not null default 0,
  primary key (state, year)
);
alter table public.esa_invoice_counters enable row level security;
-- Deliberately no policies: written only by esa_next_invoice_number() below.

create or replace function public.esa_next_invoice_number(p_state text, p_year integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if p_state not in ('AZ', 'AR', 'AL', 'NH') then
    raise exception 'esa_next_invoice_number: unsupported state %', p_state;
  end if;
  insert into public.esa_invoice_counters as c (state, year, last_no)
  values (p_state, p_year, 1)
  on conflict (state, year) do update set last_no = c.last_no + 1
  returning c.last_no into n;
  return format('ET-%s-%s-%s', p_state, p_year, lpad(n::text, 3, '0'));
end;
$$;
revoke all on function public.esa_next_invoice_number(text, integer) from public, anon, authenticated;
grant execute on function public.esa_next_invoice_number(text, integer) to service_role;

create table if not exists public.esa_invoices (
  id                uuid primary key default gen_random_uuid(),
  invoice_number    text not null unique,
  submission_id     uuid not null,
  is_test           boolean not null default false,
  state             text not null check (state in ('AZ', 'AR', 'AL', 'NH')),
  invoice_date      date not null,
  -- Alabama "Date(s) of service" / Arkansas "Expected ship date": invoice date + 21 days when
  -- printed books are on the invoice, else the invoice date (founder decisions 2026-09-14).
  second_date       date,
  parent_name       text not null,
  student_name      text not null,
  family_email      text not null,
  ship_to           text,
  items             jsonb not null,
  subtotal_cents    integer not null check (subtotal_cents > 0),
  fee_cents         integer not null default 0 check (fee_cents >= 0),
  total_cents       integer not null check (total_cents > 0),
  status            text not null default 'issued'
                    check (status in ('issued', 'paid', 'fulfilled', 'shipped', 'refunded', 'void')),
  pdf_path          text,
  family_emailed_at timestamptz,
  reminder_sent_at  timestamptz,
  paid_at           timestamptz,
  payment_email_msg_id text,
  sheet_synced_at   timestamptz,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists esa_invoices_status_idx on public.esa_invoices (status, created_at);
create index if not exists esa_invoices_submission_idx on public.esa_invoices (submission_id);
alter table public.esa_invoices enable row level security;
-- Deliberately no policies: written only by the esa-invoice edge function (service role).

comment on table public.esa_invoices is
  'ESA scholarship invoices from the /esa order form, one per student. Private (children''s names). '
  'Mirrored to the Outreach Bible ESA Invoices tab by scripts/esa_invoices_sync.py.';

-- Private bucket for the issued PDFs (small, text-only invoices).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('esa-invoices', 'esa-invoices', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;
