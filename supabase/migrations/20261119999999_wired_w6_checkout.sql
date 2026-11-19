-- Fearfully & Wonderfully Wired, W6: checkout grants (spec 9.3, section 18 answers 2, 3, 15).
--
-- 1. wired_pending_checkouts.paid_at / paid_order_id: the webhook marks the row it honoured.
-- 2. wired_pdf_jobs: the durable purchase-PDF queue (answer 3). The webhook enqueues here in
--    the same transaction as the unlocks; the drain that builds and emails the PDFs is W7.
-- 3. wired_grant_purchase(...): the ONE writer for a paid wired cart. Called only by
--    stripe-webhook with the service role, after the orders row is recorded. Idempotent on
--    the order: a redelivered Stripe event changes nothing and returns the same answer.
--
-- Unlock precedence (an unlock is sticky, W1 trigger): free < blueprint < family_map. A
-- Blueprint never downgrades a Family Map child; 'pilot' is left as it is.

alter table public.wired_pending_checkouts
  add column if not exists paid_at timestamptz,
  add column if not exists paid_order_id uuid references public.orders (id) on delete set null;

create table if not exists public.wired_pdf_jobs (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.wired_families (id) on delete cascade,
  child_id    uuid references public.wired_children (id) on delete cascade,
  order_id    uuid references public.orders (id) on delete set null,
  buyer_id    uuid references public.wired_buyers (id) on delete set null,
  kind        text not null check (kind in ('blueprint', 'family_map')),
  quiz_year   integer not null,
  status      text not null default 'queued' check (status in ('queued', 'building', 'sent', 'failed')),
  attempts    integer not null default 0,
  last_error  text,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);
create unique index if not exists wired_pdf_jobs_order_kind_child_uniq
  on public.wired_pdf_jobs (order_id, kind, child_id) nulls not distinct;
create index if not exists wired_pdf_jobs_queued_idx on public.wired_pdf_jobs (created_at) where status = 'queued';
alter table public.wired_pdf_jobs enable row level security;
revoke all on table public.wired_pdf_jobs from anon, authenticated;
grant select, insert, update, delete on table public.wired_pdf_jobs to service_role;

create or replace function public.wired_unlock_rank(v text)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select case v when 'family_map' then 3 when 'blueprint' then 2 when 'pilot' then 2 when 'free' then 1 else 0 end
$$;
revoke execute on function public.wired_unlock_rank(text) from public, anon, authenticated;
grant execute on function public.wired_unlock_rank(text) to service_role;

create or replace function public.wired_grant_purchase(
  p_pending_id   uuid,
  p_order_id     uuid,
  p_email        text,
  p_name         text,
  p_amount_cents integer,
  p_customer     text,
  p_unlock_as    text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pending  public.wired_pending_checkouts%rowtype;
  v_buyer    uuid;
  v_covered  uuid[];
  v_unlocked integer := 0;
  v_jobs     integer := 0;
  v_upgrade_ok boolean := null;
  v_n integer;
begin
  if p_unlock_as not in ('blueprint', 'family_map') then
    raise exception 'wired_grant_purchase: unlock_as must be blueprint or family_map, got %', p_unlock_as;
  end if;
  if p_order_id is null then
    raise exception 'wired_grant_purchase: order id is required';
  end if;

  select * into v_pending from public.wired_pending_checkouts where id = p_pending_id for update;
  if not found then
    -- The family deleted its quiz data between checkout and payment (cascade), or a forged id.
    return jsonb_build_object('status', 'no_pending');
  end if;
  if v_pending.paid_order_id is not null and v_pending.paid_order_id <> p_order_id then
    return jsonb_build_object('status', 'pending_used_by_other_order', 'paid_order_id', v_pending.paid_order_id);
  end if;

  -- The later $28 upgrade was gated before charging (answer 2); re-check and REPORT here.
  -- She has paid either way, so the grant goes ahead; a false here is an alert, not a refusal.
  if v_pending.product = 'family_map_upgrade' then
    select exists (
      select 1 from public.wired_buyers b
      where b.family_id = v_pending.family_id and b.quiz_year = v_pending.quiz_year
        and b.product in ('blueprint') and b.refunded_at is null and b.disputed_at is null
        and b.order_id is distinct from p_order_id
    ) into v_upgrade_ok;
  end if;

  insert into public.wired_buyers (family_id, order_id, email, purchaser_name, product, amount_cents, quiz_year, channel, stripe_customer_id)
  values (v_pending.family_id, p_order_id, lower(btrim(p_email)), nullif(btrim(coalesce(p_name, '')), ''), v_pending.product,
          greatest(coalesce(p_amount_cents, 0), 0), v_pending.quiz_year, 'stripe', nullif(p_customer, ''))
  on conflict (order_id, product) do nothing
  returning id into v_buyer;
  if v_buyer is null then
    select id into v_buyer from public.wired_buyers where order_id = p_order_id and product = v_pending.product;
  end if;

  -- Only children that still belong to this family and are not removed.
  select coalesce(array_agg(c.id order by c.created_at), '{}') into v_covered
  from public.wired_children c
  where c.family_id = v_pending.family_id and c.removed_at is null and c.id = any (v_pending.child_ids);

  insert into public.wired_unlocks (family_id, child_id, product, order_id)
  select v_pending.family_id, cid, p_unlock_as, p_order_id
  from unnest(v_covered) as cid
  where not exists (select 1 from public.wired_unlocks u where u.order_id = p_order_id and u.child_id = cid);
  get diagnostics v_n = row_count;

  update public.wired_children c
     set unlocked_via = p_unlock_as, unlocked_at = coalesce(c.unlocked_at, now())
   where c.id = any (v_covered)
     and public.wired_unlock_rank(c.unlocked_via) < public.wired_unlock_rank(p_unlock_as);
  get diagnostics v_unlocked = row_count;

  if p_unlock_as = 'blueprint' then
    insert into public.wired_pdf_jobs (family_id, child_id, order_id, buyer_id, kind, quiz_year)
    select v_pending.family_id, cid, p_order_id, v_buyer, 'blueprint', v_pending.quiz_year from unnest(v_covered) as cid
    on conflict (order_id, kind, child_id) do nothing;
  elsif cardinality(v_covered) > 0 then
    insert into public.wired_pdf_jobs (family_id, child_id, order_id, buyer_id, kind, quiz_year)
    values (v_pending.family_id, null, p_order_id, v_buyer, 'family_map', v_pending.quiz_year)
    on conflict (order_id, kind, child_id) do nothing;
  end if;
  get diagnostics v_jobs = row_count;

  update public.wired_pending_checkouts set paid_at = coalesce(paid_at, now()), paid_order_id = p_order_id where id = p_pending_id;

  return jsonb_build_object(
    'status', 'ok',
    'family_id', v_pending.family_id,
    'product', v_pending.product,
    'buyer_id', v_buyer,
    'covered', to_jsonb(v_covered),
    'missing_children', cardinality(v_pending.child_ids) - cardinality(v_covered),
    'unlock_rows_added', v_n,
    'children_unlocked', v_unlocked,
    'pdf_jobs_added', v_jobs,
    'upgrade_verified', v_upgrade_ok
  );
end;
$$;
revoke execute on function public.wired_grant_purchase(uuid, uuid, text, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.wired_grant_purchase(uuid, uuid, text, text, integer, text, text) to service_role;
