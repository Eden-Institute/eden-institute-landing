-- Preorder system, Phase 1 (part 4): one-way founding latch + founder milestone ledger.
-- Depends on 20260714120000_preorder_cart_and_acceptance.sql. Apply with the same deploy
-- set (create-checkout + stripe-webhook + preorder-status + nurture-emails +
-- notify-founder-digest + resend-waitlist redeploy): every founding-window consumer moves
-- to the founding_gate RPC in this migration.
--
-- Two concerns:
--   1. The founding window must be a ONE-WAY latch. founding_units_sold is net of
--      refunds (correct for progress display), so on its own a full refund after the
--      500th kit would drop the count to 499 and silently REOPEN founding pricing,
--      contradicting the shipped promise "when the 500 are claimed, $249 is gone for
--      good" (launch-sequence-templates.ts). founding_gate stamps
--      products.founding_closed_at the first time the cap is reached; once stamped,
--      the window stays closed no matter what the net count later does.
--   2. Founder milestone notifications (250 / 400 / 475 / 490 / cap) need an
--      exactly-once claim per milestone that is safe under concurrent webhook
--      deliveries. founding_milestones' primary key is that claim: only the inserter
--      that wins sends the email.

begin;

-- 1. The latch. NULL = founding window open (or never capped); a timestamp = the
-- moment the cap was first observed reached. Never cleared by code.
alter table public.products
  add column founding_closed_at timestamptz;

-- 2. Latch-aware gate, the single founding-window truth for ALL consumers
-- (create-checkout price selection, preorder-status public display, nurture-emails
-- copy variant, notify-founder-digest, resend-waitlist welcome copy).
--   sold   = net founding units (founding_units_sold: SUM(quantity) excluding
--            cancelled/refunded) — the honest progress number.
--   cap    = products.founding_qty_limit (null = uncapped, window never closes).
--   closed = latch stamped, OR cap reached right now (in which case this call
--            stamps the latch). VOLATILE on purpose: readers advance the latch.
create or replace function public.founding_gate(p_product_id uuid)
returns table (sold integer, cap integer, closed boolean)
language plpgsql
set search_path = public
as $$
declare
  v_cap       integer;
  v_closed_at timestamptz;
  v_sold      integer;
begin
  select p.founding_qty_limit, p.founding_closed_at
    into v_cap, v_closed_at
    from products p
   where p.id = p_product_id;
  if not found then
    return query select 0, null::integer, false;
    return;
  end if;

  v_sold := founding_units_sold(p_product_id);

  if v_closed_at is null and v_cap is not null and v_sold >= v_cap then
    update products
       set founding_closed_at = now()
     where id = p_product_id
       and founding_closed_at is null;  -- set-once under concurrency
    v_closed_at := now();
  end if;

  return query select v_sold, v_cap, (v_closed_at is not null);
end;
$$;

revoke all on function public.founding_gate(uuid) from public, anon, authenticated;
grant execute on function public.founding_gate(uuid) to service_role;

-- 3. Milestone ledger. PK (product_id, milestone) is the exactly-once claim:
-- a concurrent webhook's duplicate insert gets 23505 and sends nothing.
create table public.founding_milestones (
  product_id     uuid not null references public.products(id) on delete cascade,
  milestone      integer not null check (milestone > 0),
  sold_at_notify integer not null,   -- the count observed when the claim was won
  notified_at    timestamptz not null default now(),
  primary key (product_id, milestone)
);

alter table public.founding_milestones enable row level security;  -- service-role only

commit;
