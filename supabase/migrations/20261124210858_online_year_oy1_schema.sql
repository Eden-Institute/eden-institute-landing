-- ============================================================================
-- Eden's Table Online Year (punch #472), ticket OY1: the schema. Built by Lane 2, 2026-11-24.
--
-- Source: Eden's Table (Homeschool Curriculum)/Projects/New Projects Lane/EdensTable_Digital_License_Plan.md,
-- "Build tickets for Lane 2" (NP, 2026-11-24) and the decisions + approved copy (Camila, Nov 20 and Nov 23):
--   - per-child licenses held by one parent account (the email used at checkout); children never log in;
--   - 12 months from purchase; a renewal starts where the old year ends; a sibling bought later gets its own
--     12 months; first child $149 (Teacher's Guide + storybook + that child's notebook), sibling $29;
--   - sign-in = email + a 6-digit code per new device, codes work 10 minutes; devices: 3 with one child's
--     license plus 1 per sibling license, a new device past the limit signs out the one used longest ago;
--   - mom taps "Mark Week [N] done for [Child]"; the dated log builds that child's portfolio and certificate.
--
-- INERT: nothing reads or writes these tables until the online-year edge functions exist (OY2+), and the
-- whole feature ships dark behind ONLINE_YEAR_ENABLED.
--
-- Rules kept:
--   - children's data minimum: a first name or nickname only (approved checkout field), like the Wired quiz;
--   - every table: RLS on, NO policies, service_role only. This project's default privileges still
--     auto-grant new public tables to anon and authenticated, so each table revokes them by name first
--     (house pattern, 20261119144633_wired_quiz_schema_w1.sql; src/test/newTableGrants.test.ts);
--   - no citext: text + a unique index on lower(email);
--   - secrets are stored only as hashes (device tokens, sign-in codes).
--
-- Idempotent: every create is IF NOT EXISTS.
-- ============================================================================

-- ── 1. Parents: one account per checkout email ─────────────────────────────
create table if not exists public.online_year_parents (
  id           uuid primary key default gen_random_uuid(),
  email        text not null check (length(email) between 3 and 254),
  -- "Hi [first name]" in the emails; null = the email's generic greeting.
  first_name   text check (first_name is null or length(btrim(first_name)) between 1 and 60),
  -- "Licensed to [parent's name] · [email]" on every reader page and printed page (the card billing name,
  -- as the Starter PDFs are stamped; Stripe does not promise one, so null = the email alone).
  license_name text check (license_name is null or length(btrim(license_name)) between 1 and 120),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists online_year_parents_email_lower_uniq on public.online_year_parents (lower(email));
alter table public.online_year_parents enable row level security;
revoke all on table public.online_year_parents from anon, authenticated;
grant select, insert, update, delete on table public.online_year_parents to service_role;

-- ── 2. Licenses: one per child per year ─────────────────────────────────────
create table if not exists public.online_year_licenses (
  id                   uuid primary key default gen_random_uuid(),
  parent_id            uuid not null references public.online_year_parents (id) on delete restrict,
  band                 text not null check (band in ('sprouts', 'seedlings')),
  -- The approved checkout field: "Child's first name or nickname" (no last name).
  child_name           text not null check (length(btrim(child_name)) between 1 and 40),
  -- first_child = $149 (Teacher's Guide + storybook + this child's notebook); sibling = $29 (notebook only).
  kind                 text not null check (kind in ('first_child', 'sibling')),
  starts_at            timestamptz not null,
  ends_at              timestamptz not null,
  -- The paid order (financial records outlive everything else here).
  order_id             uuid references public.orders (id) on delete set null,
  -- A renewal points at the year it continues; it starts where that one ends.
  renews_license_id    uuid references public.online_year_licenses (id) on delete set null,
  status               text not null default 'active' check (status in ('active', 'closed')),
  closed_at            timestamptz,
  closed_reason        text check (closed_reason in ('refunded', 'disputed', 'cancelled', 'admin')),
  -- Email 3 (14 days before the end) and Email 4 (the end day): sent once each, or never if renewed.
  renew_notice_sent_at timestamptz,
  ended_notice_sent_at timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (ends_at > starts_at),
  check ((status = 'closed') = (closed_at is not null)),
  check (closed_reason is null or status = 'closed')
);
create index if not exists online_year_licenses_parent_idx on public.online_year_licenses (parent_id);
create index if not exists online_year_licenses_order_idx on public.online_year_licenses (order_id);
create index if not exists online_year_licenses_active_end_idx on public.online_year_licenses (ends_at) where status = 'active';
-- A year is renewed at most once.
create unique index if not exists online_year_licenses_one_renewal
  on public.online_year_licenses (renews_license_id) where renews_license_id is not null;
-- One license per child per band per order (NP QA 2026-11-24): a retried Stripe webhook (the 504 double-send trap,
-- memory r_supabase_gateway_504_double_sends) can never grant the same child a second year from one payment.
create unique index if not exists online_year_licenses_one_per_child_per_order
  on public.online_year_licenses (order_id, band, lower(child_name)) where order_id is not null;
alter table public.online_year_licenses enable row level security;
revoke all on table public.online_year_licenses from anon, authenticated;
grant select, insert, update, delete on table public.online_year_licenses to service_role;

-- ── 3. Devices: one row per signed-in device ────────────────────────────────
create table if not exists public.online_year_devices (
  id                uuid primary key default gen_random_uuid(),
  parent_id         uuid not null references public.online_year_parents (id) on delete cascade,
  -- SHA-256 (hex) of the random token saved on the device; the token itself is never stored.
  token_hash        text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  -- A short label for "signed in on [N] devices" (e.g. "iPhone, Safari"); never the full user agent.
  label             text check (label is null or length(label) <= 80),
  created_at        timestamptz not null default now(),
  last_seen_at      timestamptz not null default now(),
  signed_out_at     timestamptz,
  signed_out_reason text check (signed_out_reason in ('limit', 'user', 'admin')),
  check ((signed_out_at is null) = (signed_out_reason is null))
);
create unique index if not exists online_year_devices_token_uniq on public.online_year_devices (token_hash);
create index if not exists online_year_devices_live_idx
  on public.online_year_devices (parent_id, last_seen_at) where signed_out_at is null;
alter table public.online_year_devices enable row level security;
revoke all on table public.online_year_devices from anon, authenticated;
grant select, insert, update, delete on table public.online_year_devices to service_role;

-- ── 4. Sign-in codes: 6 digits, 10 minutes, a few tries ─────────────────────
create table if not exists public.online_year_signin_codes (
  id             uuid primary key default gen_random_uuid(),
  -- Lower-cased as typed. Kept whether or not the email has a license, so the answer is the same either way.
  email_lower    text not null check (length(email_lower) between 3 and 254 and email_lower = lower(email_lower)),
  -- HMAC-SHA-256 (hex) of the code; the code itself is never stored.
  code_hash      text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  attempts       integer not null default 0 check (attempts between 0 and 10),
  used_at        timestamptz,
  -- SHA-256 (hex) of the requester's IP, for rate limits only.
  requester_hash text check (requester_hash is null or requester_hash ~ '^[0-9a-f]{64}$'),
  check (expires_at > created_at and expires_at <= created_at + interval '10 minutes')
);
create index if not exists online_year_signin_codes_email_idx on public.online_year_signin_codes (email_lower, created_at desc);
create index if not exists online_year_signin_codes_requester_idx on public.online_year_signin_codes (requester_hash, created_at desc);
alter table public.online_year_signin_codes enable row level security;
revoke all on table public.online_year_signin_codes from anon, authenticated;
grant select, insert, update, delete on table public.online_year_signin_codes to service_role;

-- ── 5. Weeks done: "Mark Week [N] done for [Child]" (portfolio + certificate) ──
create table if not exists public.online_year_weeks_done (
  license_id uuid not null references public.online_year_licenses (id) on delete cascade,
  week       integer not null check (week between 1 and 36),
  done_on    date not null,
  created_at timestamptz not null default now(),
  primary key (license_id, week)
);
alter table public.online_year_weeks_done enable row level security;
revoke all on table public.online_year_weeks_done from anon, authenticated;
grant select, insert, update, delete on table public.online_year_weeks_done to service_role;
