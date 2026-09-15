-- ESA invoice and payment robustness. Added 2026-09-16 (founder decision 2026-09-15:
-- "fix all five now, one dedicated PR with tests").
--
--   1. Double submit:   esa_invoice_requests keys every form fill by a client idempotency key, so
--                       a retry returns the original invoices instead of numbering new ones.
--   2. Numbering gaps:  esa_insert_pending_invoice() issues the number AND inserts the row in one
--                       transaction (status 'pending'), so a number can never exist without a row.
--                       esa_finish_invoice_request() flips the batch to 'issued', or to 'void' with
--                       the reason recorded, so a failed batch leaves recorded void numbers, not gaps.
--   3. Confirm token:   esa_confirm_payment_token() marks the invoice paid and uses the token in one
--                       transaction, so a failure leaves the founder's link usable.
--   4. Payment intake:  esa_payments.intake_note records a replaced received_at, and
--                       esa_payment_intake_failures keeps the raw notice when intake throws.
--
-- Idempotent. Every new object is private: RLS on with no policies, and table / function access
-- revoked from public, anon and authenticated, then granted to service_role only.
-- Invoice numbers still come ONLY from esa_next_invoice_number() (called inside the new function).

-- ----------------------------------------------------------------------------- esa_invoices status
-- 'pending' = number issued and row recorded, PDF not yet stored. Never matched, reminded or sent.
alter table public.esa_invoices drop constraint if exists esa_invoices_status_check;
alter table public.esa_invoices add constraint esa_invoices_status_check
  check (status in ('pending', 'issued', 'paid', 'fulfilled', 'shipped', 'refunded', 'void'));

-- ----------------------------------------------------------------------------- 1. requests
create table if not exists public.esa_invoice_requests (
  idempotency_key uuid primary key,
  -- SHA-256 of the normalised submission: the same key with a different form is refused.
  request_hash    text not null,
  status          text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  submission_id   uuid not null,
  attempts        integer not null default 1,
  invoice_numbers text[] not null default '{}',
  error           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.esa_invoice_requests enable row level security;
revoke all on table public.esa_invoice_requests from public;
revoke all on table public.esa_invoice_requests from anon;
revoke all on table public.esa_invoice_requests from authenticated;
grant all on table public.esa_invoice_requests to service_role;
comment on table public.esa_invoice_requests is
  'One row per ESA invoice form fill (client idempotency key). Private, service role only.';

-- Claims a key for this attempt. Outcomes:
--   claimed    -> go ahead and issue (voided_numbers lists pending invoices of a stale attempt
--                 that this claim voided; the caller removes their PDFs and alerts the founder)
--   completed  -> already issued: return the invoices of submission_id, issue nothing
--   processing -> another attempt is running right now
--   failed     -> the attempts are used up
--   mismatch   -> the key was used for a different form
create or replace function public.esa_claim_invoice_request(
  p_key uuid, p_hash text, p_submission_id uuid, p_max_attempts integer default 3
)
returns table (outcome text, submission_id uuid, voided_numbers text[])
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r public.esa_invoice_requests%rowtype;
  v_voided text[] := '{}';
begin
  insert into public.esa_invoice_requests as q (idempotency_key, request_hash, submission_id)
  values (p_key, p_hash, p_submission_id)
  on conflict (idempotency_key) do nothing;
  if found then
    return query select 'claimed'::text, p_submission_id, v_voided;
    return;
  end if;

  select * into r from public.esa_invoice_requests q where q.idempotency_key = p_key for update;
  if r.request_hash <> p_hash then
    return query select 'mismatch'::text, null::uuid, v_voided;
    return;
  end if;
  if r.status = 'completed' then
    return query select 'completed'::text, r.submission_id, v_voided;
    return;
  end if;
  -- An edge function is killed by its wall-clock limit well inside 10 minutes, so an older
  -- 'processing' row is an abandoned attempt, not a running one.
  if r.status = 'processing' and r.updated_at > now() - interval '10 minutes' then
    return query select 'processing'::text, r.submission_id, v_voided;
    return;
  end if;
  if r.attempts >= p_max_attempts then
    return query select 'failed'::text, r.submission_id, v_voided;
    return;
  end if;

  if r.status = 'processing' then
    with v as (
      update public.esa_invoices i
         set status = 'void',
             notes = concat_ws(E'\n', i.notes, 'void: the attempt that issued this number stopped before finishing'),
             updated_at = now()
       where i.submission_id = r.submission_id and i.status = 'pending'
      returning i.invoice_number
    )
    select coalesce(array_agg(v.invoice_number), '{}') into v_voided from v;
  end if;

  update public.esa_invoice_requests q
     set status = 'processing', submission_id = p_submission_id, attempts = q.attempts + 1,
         error = null, updated_at = now()
   where q.idempotency_key = p_key;
  return query select 'claimed'::text, p_submission_id, v_voided;
end;
$$;
revoke all on function public.esa_claim_invoice_request(uuid, text, uuid, integer) from public;
revoke all on function public.esa_claim_invoice_request(uuid, text, uuid, integer) from anon;
revoke all on function public.esa_claim_invoice_request(uuid, text, uuid, integer) from authenticated;
grant execute on function public.esa_claim_invoice_request(uuid, text, uuid, integer) to service_role;

-- ----------------------------------------------------------------------------- 2. number + row together
-- p_row carries the invoice fields (the same names as the esa_invoices columns). Test invoices pass
-- their own ET-TEST- number and never touch the state counters.
create or replace function public.esa_insert_pending_invoice(p_row jsonb, p_test_number text default null)
returns table (id uuid, invoice_number text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_is_test boolean := coalesce((p_row->>'is_test')::boolean, false);
  v_state   text := p_row->>'state';
  v_date    date := (p_row->>'invoice_date')::date;
  v_number  text;
begin
  if v_is_test then
    if p_test_number is null or p_test_number not like 'ET-TEST-%' then
      raise exception 'esa_insert_pending_invoice: a test invoice needs an ET-TEST- number';
    end if;
    v_number := p_test_number;
  else
    v_number := public.esa_next_invoice_number(v_state, extract(year from v_date)::integer);
  end if;

  return query
  insert into public.esa_invoices as i (
    invoice_number, submission_id, is_test, state, invoice_date, second_date, parent_name,
    student_name, family_email, ship_to, ship_address, phone, items, subtotal_cents, fee_cents,
    total_cents, status
  ) values (
    v_number,
    (p_row->>'submission_id')::uuid,
    v_is_test,
    v_state,
    v_date,
    nullif(p_row->>'second_date', '')::date,
    p_row->>'parent_name',
    p_row->>'student_name',
    p_row->>'family_email',
    p_row->>'ship_to',
    case when jsonb_typeof(p_row->'ship_address') = 'object' then p_row->'ship_address' end,
    nullif(p_row->>'phone', ''),
    p_row->'items',
    (p_row->>'subtotal_cents')::integer,
    coalesce((p_row->>'fee_cents')::integer, 0),
    (p_row->>'total_cents')::integer,
    'pending'
  )
  returning i.id, i.invoice_number;
end;
$$;
revoke all on function public.esa_insert_pending_invoice(jsonb, text) from public;
revoke all on function public.esa_insert_pending_invoice(jsonb, text) from anon;
revoke all on function public.esa_insert_pending_invoice(jsonb, text) from authenticated;
grant execute on function public.esa_insert_pending_invoice(jsonb, text) to service_role;

-- Ends an attempt. p_ok: pending -> issued, request completed. Not ok: pending -> void with the
-- reason, request failed (only while it is still 'processing', so a late failure report can never
-- undo a completed request). Returns the invoice numbers it changed.
create or replace function public.esa_finish_invoice_request(
  p_key uuid, p_submission_id uuid, p_ok boolean, p_error text default null
)
returns text[]
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_numbers text[];
begin
  if p_ok then
    with u as (
      update public.esa_invoices i set status = 'issued', updated_at = now()
       where i.submission_id = p_submission_id and i.status = 'pending'
      returning i.invoice_number
    )
    select coalesce(array_agg(u.invoice_number order by u.invoice_number), '{}') into v_numbers from u;
    update public.esa_invoice_requests q
       set status = 'completed', invoice_numbers = v_numbers, error = null, updated_at = now()
     where q.idempotency_key = p_key and q.submission_id = p_submission_id and q.status = 'processing';
  else
    with u as (
      update public.esa_invoices i
         set status = 'void',
             notes = concat_ws(E'\n', i.notes, 'void: issuing failed: ' || left(coalesce(p_error, 'unknown error'), 400)),
             updated_at = now()
       where i.submission_id = p_submission_id and i.status = 'pending'
      returning i.invoice_number
    )
    select coalesce(array_agg(u.invoice_number order by u.invoice_number), '{}') into v_numbers from u;
    update public.esa_invoice_requests q
       set status = 'failed', error = left(coalesce(p_error, 'unknown error'), 1000), updated_at = now()
     where q.idempotency_key = p_key and q.submission_id = p_submission_id and q.status = 'processing';
  end if;
  return v_numbers;
end;
$$;
revoke all on function public.esa_finish_invoice_request(uuid, uuid, boolean, text) from public;
revoke all on function public.esa_finish_invoice_request(uuid, uuid, boolean, text) from anon;
revoke all on function public.esa_finish_invoice_request(uuid, uuid, boolean, text) from authenticated;
grant execute on function public.esa_finish_invoice_request(uuid, uuid, boolean, text) to service_role;

-- ----------------------------------------------------------------------------- 3. confirm token
-- Outcomes: applied (paid now, token used), used, expired, not_found, not_issued (invoice is no
-- longer 'issued'; the token is left as it was). Raises only on a real error, which rolls back both.
create or replace function public.esa_confirm_payment_token(p_token uuid)
returns table (outcome text, invoice_id uuid, payment_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
  if not public.esa_mark_invoice_paid(t.invoice_id, 'founder_confirm', t.payment_id) then
    return query select 'not_issued'::text, t.invoice_id, t.payment_id;
    return;
  end if;
  update public.esa_payment_confirmations c set used_at = now() where c.token = p_token;
  return query select 'applied'::text, t.invoice_id, t.payment_id;
end;
$$;
revoke all on function public.esa_confirm_payment_token(uuid) from public;
revoke all on function public.esa_confirm_payment_token(uuid) from anon;
revoke all on function public.esa_confirm_payment_token(uuid) from authenticated;
grant execute on function public.esa_confirm_payment_token(uuid) to service_role;

-- ----------------------------------------------------------------------------- 4. payment intake
alter table public.esa_payments add column if not exists intake_note text;

create table if not exists public.esa_payment_intake_failures (
  id                 uuid primary key default gen_random_uuid(),
  gmail_msg_id       text,
  received_at_raw    text,
  from_addr          text,
  subject            text,
  excerpt            text,
  error              text not null,
  founder_alerted_at timestamptz,
  created_at         timestamptz not null default now()
);
create index if not exists esa_payment_intake_failures_msg_idx
  on public.esa_payment_intake_failures (gmail_msg_id, created_at);
alter table public.esa_payment_intake_failures enable row level security;
revoke all on table public.esa_payment_intake_failures from public;
revoke all on table public.esa_payment_intake_failures from anon;
revoke all on table public.esa_payment_intake_failures from authenticated;
grant all on table public.esa_payment_intake_failures to service_role;
comment on table public.esa_payment_intake_failures is
  'Raw ESA payment notices whose intake threw, kept for review. Private, service role only.';
