-- Waitlists for the grade bands that are not on sale yet: Cultivators (6-8) and
-- Practitioners (9-12). Founder decision 2026-09-24: collect email and an
-- OPTIONAL phone, with an unticked, separately worded consent box for launch
-- texts (Terms §18 and Privacy §4 updated the same day).
--
-- WHY A NEW TABLE and not columns on waitlist_signups: waitlist_signups is
-- UNIQUE (email, entry_funnel), and resend-waitlist returns the existing row on
-- conflict without writing anything. So a family already on the list (say from
-- the Sprouts free week) who clicked "Tell me when Cultivators opens" left no
-- trace of that interest at all. One row per (email, band) here, written by
-- resend-waitlist on every band-waitlist signup, fixes that.
--
-- sms_consent is only ever true alongside a phone number and the exact consent
-- wording the person saw (sms_consent_text) with the time they agreed
-- (sms_consent_at). That is the record a texting provider audit asks for.
-- Nothing texts these numbers until the texting registration covers launch
-- alerts; this table only stores them.
--
-- Service role only: RLS on, no policies. The public never reads it.

create table if not exists public.band_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  band text not null check (band in ('cultivators', 'practitioners')),
  first_name text,
  phone text check (phone is null or phone ~ '^\+1[2-9][0-9]{9}$'),
  sms_consent boolean not null default false,
  sms_consent_text text,
  sms_consent_at timestamptz,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email, band),
  constraint band_waitlist_consent_needs_phone check (not sms_consent or (phone is not null and sms_consent_text is not null and sms_consent_at is not null))
);

comment on table public.band_waitlist is
  'Waitlist for grade bands not yet on sale (cultivators, practitioners). One row per email per band. Written by resend-waitlist. Phone + sms_consent = launch-alert texts, never sent until the A2P campaign covers them.';

alter table public.band_waitlist enable row level security;

create index if not exists band_waitlist_band_idx on public.band_waitlist (band);
