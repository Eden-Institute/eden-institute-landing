-- Eden's Table Sprouts Starter Unit (2026-08-26)
--
-- A $39 digital product: weeks 1-6 of the Sprouts (K-2) band, Teacher's Guide and
-- Student Notebook as PDFs. Its job is conversion to the $249 kit, not standalone
-- margin, so every buyer receives a single-use $39 credit toward the kit.
--
-- WHY THESE TABLES AND NOT THE EXISTING ONES
--
-- The SALE itself still lands in `orders`, exactly like the Deep-Dive Guide
-- (stripe-webhook recordDigitalOrder), so revenue reporting and the founder
-- dashboard keep working with no changes. `founding_units_sold` counts
-- order_items rows filtered by product_id, and a starter sale writes no
-- order_items row at all, so it cannot perturb the 500-kit founding counter.
--
-- What is genuinely new is the credit lifecycle and the delivery pipeline, and
-- both need to be reportable on independently of Stripe (spec section 3). Hence
-- three tables:
--   starter_credits            one row per issued code, plus its redemption
--   starter_deliveries         the work item: one row per purchase, drained async
--   starter_delivery_attempts  append-only attempt log keyed to the session id
--
-- FOUNDER DECISION 2026-08-26 that changed the brief: credits do NOT expire when
-- the founding 500 sell out. They are honoured against the $349 retail price
-- instead. The original spec called for expiring every outstanding code at that
-- moment, which would have taken the founding price AND the credit away from the
-- warmest possible lead in the same instant. The deactivation machinery is still
-- built (starter_credits.deactivated_at, and the phase row below) because the
-- policy is a config constant in _shared/starter-config.ts and could be flipped
-- back, but under the shipped policy the 500th kit only RECORDS a phase change.
--
-- All tables are RLS-enabled with zero policies, i.e. service-role only, matching
-- every other internal table in this project.

-- ---------------------------------------------------------------------------
-- starter_credits
-- ---------------------------------------------------------------------------
create table if not exists public.starter_credits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- IDEMPOTENCY KEY. Stripe retries checkout.session.completed, and a retry must
  -- never mint a second code. This UNIQUE is what makes that true at the database
  -- layer rather than relying on the handler running exactly once.
  stripe_checkout_session_id text not null unique,
  order_id uuid references public.orders(id) on delete set null,

  -- The email lock. Stored lowercased; comparison at redemption is on the
  -- lowercased value. This is OUR check, and it produces the readable error.
  email text not null,
  purchaser_name text,

  -- The Stripe Customer the promotion code is bound to. Stripe independently
  -- rejects redemption by any other customer with `promotion_code_customer_mismatch`
  -- (verified against the live API 2026-08-26). Our email check is the friendly
  -- gate; this is the one that cannot be talked around.
  stripe_customer_id text not null,

  stripe_promotion_code_id text not null unique,
  code text not null unique,
  amount_cents integer not null check (amount_cents > 0),
  issued_at timestamptz not null default now(),

  -- Redemption. Set by stripe-webhook when a kit order completes carrying this
  -- code. redeemed_at is also what makes a second redemption attempt fail fast at
  -- our layer, before Stripe is ever called.
  redeemed_at timestamptz,
  redeemed_order_id uuid references public.orders(id) on delete set null,
  redeemed_session_id text,

  -- Deactivation. Unused under the shipped retail-honour policy; populated if the
  -- policy is ever flipped to hard expiry at the founding cap.
  deactivated_at timestamptz,
  deactivated_reason text
);

comment on table public.starter_credits is
  'One row per Starter Unit purchase: the $39 kit credit issued to that buyer, and its redemption. '
  'Unique on stripe_checkout_session_id so a webhook retry cannot issue a second code. '
  'Email-locked and bound to a Stripe Customer; Stripe rejects a mismatched customer independently.';

create index if not exists starter_credits_email_idx on public.starter_credits (lower(email));
create index if not exists starter_credits_code_idx on public.starter_credits (upper(code));
create index if not exists starter_credits_redeemed_idx on public.starter_credits (redeemed_at);

alter table public.starter_credits enable row level security;

-- ---------------------------------------------------------------------------
-- starter_deliveries
-- ---------------------------------------------------------------------------
-- The work item. The webhook records the sale, issues the credit, inserts this
-- row as 'pending' and returns 200 fast; a separate function does the slow part
-- (stamping two PDFs that total ~20MB and sending the email). Doing that inline
-- would risk the webhook timing out, which makes Stripe retry work that already
-- half-happened.
create table if not exists public.starter_deliveries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  stripe_checkout_session_id text not null unique,
  order_id uuid references public.orders(id) on delete set null,
  email text not null,
  purchaser_name text,

  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'sent', 'failed')),
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,

  -- Storage paths of the two personalised PDFs, once stamped. Null until the
  -- first successful stamp; re-requests reuse these rather than re-stamping.
  tg_object_path text,
  nb_object_path text,

  -- The re-request key. Unguessable and durable: signed URLs expire in 7 days,
  -- and this token is how a buyer asks for fresh ones without us handing out
  -- permanent file access. Same shape as the /partner-sample ?k= broker.
  download_token text not null unique,
  -- When the most recently issued signed URLs lapse. Advisory, for copy only.
  links_expire_at timestamptz
);

comment on table public.starter_deliveries is
  'Fulfilment work item for a Starter Unit purchase, drained by the starter-fulfill edge function. '
  'download_token backs the re-request flow for expired signed URLs.';

create index if not exists starter_deliveries_status_idx
  on public.starter_deliveries (status, created_at)
  where status in ('pending', 'failed');

alter table public.starter_deliveries enable row level security;

-- ---------------------------------------------------------------------------
-- starter_delivery_attempts
-- ---------------------------------------------------------------------------
-- Append-only. Spec requirement: "Log every fulfillment attempt against the
-- Stripe session ID so failures can be traced and manually re-sent." Every stage
-- writes a row, success or failure, so a support question about one buyer is a
-- single indexed lookup on the session id rather than a log search.
create table if not exists public.starter_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  stripe_checkout_session_id text not null,
  delivery_id uuid references public.starter_deliveries(id) on delete cascade,
  attempt integer not null,
  -- Named stages so a failure says WHICH step broke without parsing a message.
  stage text not null
    check (stage in ('claim', 'fetch_master', 'stamp', 'upload', 'sign', 'email', 'complete')),
  ok boolean not null,
  detail text,
  duration_ms integer
);

comment on table public.starter_delivery_attempts is
  'Append-only per-stage log of every Starter Unit fulfilment attempt, keyed to the Stripe session id.';

create index if not exists starter_delivery_attempts_session_idx
  on public.starter_delivery_attempts (stripe_checkout_session_id, created_at desc);

alter table public.starter_delivery_attempts enable row level security;

-- ---------------------------------------------------------------------------
-- starter_credit_phases
-- ---------------------------------------------------------------------------
-- Exactly-once record of the founding-500 crossing.
--
-- The PRIMARY KEY on `phase` is the claim: the first caller to insert 'retail'
-- wins, every concurrent or later caller gets 23505 and does nothing. This is the
-- same pattern founding_milestones uses, with one deliberate difference: that
-- table DELETES its claim row when the notification email fails, so the ping
-- retries. This one must never release, because the phase transition is a fact
-- about the world, not a message. Re-running it would double-count.
create table if not exists public.starter_credit_phases (
  phase text primary key check (phase in ('retail')),
  triggered_at timestamptz not null default now(),
  founding_units_at_trigger integer not null,
  -- How many outstanding codes were affected. Zero under the retail-honour policy,
  -- non-zero only if the policy is flipped to hard expiry.
  codes_affected integer not null default 0,
  policy text not null
);

comment on table public.starter_credit_phases is
  'Exactly-once record that the founding 500 sold out and starter credits moved to their post-founding '
  'policy. PK on phase is the claim; unlike founding_milestones this row is never released on failure.';

alter table public.starter_credit_phases enable row level security;

-- ---------------------------------------------------------------------------
-- Reporting
-- ---------------------------------------------------------------------------
-- Spec section 5: "starter units sold, credit codes issued, credit codes
-- redeemed, and time elapsed between the two purchases. This starter-to-kit
-- conversion rate is the single metric that determines if this product works."
--
-- STABLE, service-role only (RLS on the underlying tables still applies to
-- callers; this runs as the invoker deliberately so it cannot leak buyer emails
-- to an anon session).
create or replace function public.starter_conversion_report()
returns table (
  units_sold bigint,
  codes_issued bigint,
  codes_redeemed bigint,
  codes_outstanding bigint,
  redemption_rate numeric,
  median_days_to_redeem numeric,
  gross_starter_cents bigint,
  attributed_kit_cents bigint
)
language sql
stable
set search_path to 'public'
as $function$
  with credits as (
    select
      c.issued_at,
      c.redeemed_at,
      c.amount_cents,
      o.amount_total_cents as kit_cents
    from starter_credits c
    left join orders o on o.id = c.redeemed_order_id
    where c.deactivated_at is null
  )
  select
    (select count(*) from orders where lookup_key = 'sprouts_starter_unit'
       and status not in ('cancelled', 'refunded'))                          as units_sold,
    count(*)                                                                  as codes_issued,
    count(*) filter (where redeemed_at is not null)                           as codes_redeemed,
    count(*) filter (where redeemed_at is null)                               as codes_outstanding,
    round(
      100.0 * count(*) filter (where redeemed_at is not null)
      / nullif(count(*), 0), 2)                                               as redemption_rate,
    -- The number that decides whether this product works: how long a buyer takes
    -- to come back for the kit.
    percentile_cont(0.5) within group (
      order by extract(epoch from (redeemed_at - issued_at)) / 86400.0
    ) filter (where redeemed_at is not null)                                  as median_days_to_redeem,
    (select coalesce(sum(amount_total_cents), 0) from orders
       where lookup_key = 'sprouts_starter_unit'
         and status not in ('cancelled', 'refunded'))                         as gross_starter_cents,
    coalesce(sum(kit_cents) filter (where redeemed_at is not null), 0)::bigint as attributed_kit_cents
  from credits;
$function$;

comment on function public.starter_conversion_report() is
  'Starter Unit funnel: units sold, credits issued/redeemed/outstanding, redemption rate, median days '
  'from starter purchase to kit purchase, and revenue on both sides.';

-- ---------------------------------------------------------------------------
-- Private storage bucket for the per-buyer stamped PDFs
-- ---------------------------------------------------------------------------
-- PRIVATE, and it must stay that way. These objects carry the buyer's name and
-- email in every page footer, so a public bucket would publish customer PII at a
-- guessable URL, not merely leak the curriculum. Access is exclusively via
-- short-lived signed URLs minted server-side.
--
-- Separate from partner-assets on purpose: the masters live there and are read
-- but never written, so the founding-partner gift files cannot be touched by
-- anything in this feature.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('starter-unit', 'starter-unit', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;
