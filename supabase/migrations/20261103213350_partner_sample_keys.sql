-- Per-recipient partner sample keys, and a log of what each key serves
-- (punch #244 FIX 2 and FIX 3, founder approved 2026-11-03).
--
-- WHY. Every partner sample link carried ONE shared secret, PARTNER_SAMPLE_KEY. On
-- 2026-09-10 a podcast host put her link in her show notes; rotating the key cut off
-- all 67 people who held it and took 36 apology emails. Nothing noticed the leak
-- either: the host told the founder.
--
--   partner_sample_keys    one row per issued link. A leak is now a one-row revoke
--                          (set revoked_at) that nobody else feels, and the row says
--                          whose link it was. Only the SHA-256 of the key is stored,
--                          so a `select *` never puts a live link in a transcript or
--                          a log. Rows are written by scripts/issue_sample_key.py in
--                          the Biblical Herbalism folder, never by the site.
--   partner_sample_serves  one row per download api/partner-sample.ts serves. key_id
--                          NULL means the old shared key, which keeps working for the
--                          links already sent (retiring it is the founder's call).
--                          visitor_hash is a keyed hash of the visitor's network (an
--                          IPv6 address is cut to its /64 first, so one household is
--                          one visitor); no IP address is stored. The daily founder
--                          digest counts distinct visitors per key per day and flags
--                          a link that has gone public.
--
-- Grants: both tables are new, so each grants service_role by name (the 2026-10-30
-- Supabase change: new public tables get no default grants). No anon or
-- authenticated grant and no policy: service role only, like every internal table.
-- Idempotent: every statement can be re-run.

create table if not exists public.partner_sample_keys (
  id uuid primary key default gen_random_uuid(),
  key_sha256 text not null unique check (key_sha256 ~ '^[0-9a-f]{64}$'),
  email text not null check (email = lower(email)),
  name text,
  role text check (role in ('partner', 'reviewer', 'host', 'other')),
  note text,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_reason text
);

create index if not exists partner_sample_keys_email_idx on public.partner_sample_keys (email);

alter table public.partner_sample_keys enable row level security;

grant select, insert, update on table public.partner_sample_keys to service_role;

comment on table public.partner_sample_keys is
  'One row per partner sample link issued (punch #244). key_sha256 = hex SHA-256 of the key in the link; the key itself is never stored. Revoke a leaked link by setting revoked_at; never delete a row (partner_sample_serves points at it).';

create table if not exists public.partner_sample_serves (
  id uuid primary key default gen_random_uuid(),
  served_at timestamptz not null default now(),
  key_id uuid references public.partner_sample_keys (id),
  visitor_hash text not null,
  slug text not null
);

create index if not exists partner_sample_serves_served_at_idx on public.partner_sample_serves (served_at);
create index if not exists partner_sample_serves_key_served_at_idx on public.partner_sample_serves (key_id, served_at);

alter table public.partner_sample_serves enable row level security;

grant select, insert on table public.partner_sample_serves to service_role;

comment on table public.partner_sample_serves is
  'One row per sample download served by api/partner-sample.ts. key_id NULL = the shared PARTNER_SAMPLE_KEY. visitor_hash is keyed and network-level (IPv6 /64); no IP is stored. Read by notify-founder-digest to flag a link opened from an unusual number of places in a day.';
