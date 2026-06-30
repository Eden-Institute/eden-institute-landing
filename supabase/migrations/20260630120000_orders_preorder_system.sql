-- Preorder system, Phase 1. Evolves the empty homeschool_orders scaffold into the
-- general `orders` table and adds the products / order_items / message_log / stripe_events
-- model + the order_status state machine. 0 rows in homeschool_orders, so the renames and
-- the text->enum conversion are free.
--
-- COORDINATION: the rename breaks the current stripe-webhook's homeschool-kit branch until
-- the patched webhook is redeployed. Those kits are not selling yet (0 orders) and the
-- subscription/guide/course branches do not touch this table, so the live blast radius is
-- nil -- but apply this migration and deploy the patched stripe-webhook as a PAIR.

begin;

-- 1. Full state machine now; Phase 1 only reaches paid -> preorder_hold (+ refunded/cancelled).
create type public.order_status as enum (
  'paid','preorder_hold','ready_to_fulfill','label_created',
  'shipped','delivered','cancelled','refunded'
);

-- 2. Evolve homeschool_orders -> orders.
alter table public.homeschool_orders rename to orders;
alter table public.orders rename column stripe_session_id to stripe_checkout_session_id;  -- keeps its UNIQUE
alter table public.orders rename column email             to customer_email;
alter table public.orders rename column amount_total      to amount_total_cents;

alter table public.orders
  add column stripe_payment_intent_id text,
  add column customer_phone           text,
  add column tax_cents                integer,
  add column sms_consent              boolean     not null default false,
  add column is_preorder              boolean     not null default true,   -- origin marker for the broadcast list (not a state)
  add column updated_at               timestamptz not null default now();

-- status text -> order_status enum (no rows, so the CASE is a formality).
alter table public.orders alter column status drop default;
alter table public.orders alter column status type public.order_status
  using (case status when 'preorder' then 'preorder_hold' else status end::public.order_status);
alter table public.orders alter column status set default 'paid';

-- Retained from homeschool_orders: id, stripe_customer_id, lookup_key, product_label,
-- quantity, currency, payment_status, shipping_name, shipping_address(jsonb), raw(jsonb),
-- created_at. (quantity stays for back-compat; canonical per-line quantity is in order_items.)

alter table public.orders enable row level security;  -- service-role only; admin read policy added with the admin view

-- 3. Products.
create table public.products (
  id                          uuid primary key default gen_random_uuid(),
  sku                         text not null unique,
  name                        text not null,
  product_type                text not null check (product_type in ('kit','notebook')),
  retail_price_cents          integer not null check (retail_price_cents   >= 0),
  founding_price_cents        integer not null check (founding_price_cents >= 0),
  -- Founding price is limited by quantity and/or time. When BOTH limits are null it is
  -- open-ended; checkout falls back to the retail price once a limit is reached.
  founding_qty_limit          integer check (founding_qty_limit is null or founding_qty_limit > 0), -- e.g. 500 kits; null = uncapped
  founding_until              date,                 -- optional time-bound founding window; null = none
  is_preorder                 boolean not null default true,
  ships_on                    date,
  active                      boolean not null default true,
  stripe_founding_price_id    text,                 -- Stripe Price ID for the founding amount
  stripe_retail_price_id      text,                 -- Stripe Price ID for the retail amount
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
alter table public.products enable row level security;

-- 4. Order line items.
create table public.order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders(id)   on delete cascade,
  product_id       uuid not null references public.products(id),
  quantity         integer not null default 1 check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  is_founding      boolean not null default false,   -- sold at the founding price? drives the founding-allocation counter
  created_at       timestamptz not null default now()
);
alter table public.order_items enable row level security;

-- 5. Message log (audit + double-send guard).
create table public.message_log (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders(id) on delete cascade,
  channel             text not null check (channel in ('email','sms')),
  template_key        text not null,
  triggered_by_status public.order_status not null,
  status              text not null check (status in ('sent','failed')),
  provider_id         text,
  created_at          timestamptz not null default now()
);
-- One SUCCESSFUL send per (order, template, transition). Failures don't take the slot,
-- so a retry can still succeed.
create unique index message_log_sent_once
  on public.message_log (order_id, template_key, triggered_by_status)
  where status = 'sent';
alter table public.message_log enable row level security;

-- 6. Stripe event idempotency ledger (event-level gate).
create table public.stripe_events (
  event_id     text primary key,        -- Stripe evt_... id
  type         text not null,
  status       text not null default 'received' check (status in ('received','processed','error')),
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  error        text,
  payload      jsonb
);
alter table public.stripe_events enable row level security;

commit;
