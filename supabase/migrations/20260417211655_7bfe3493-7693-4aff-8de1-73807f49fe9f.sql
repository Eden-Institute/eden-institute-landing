create table public.tier_2_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  first_name text not null,
  signed_up_at timestamptz not null default now(),
  founding_code_sent boolean not null default false,
  founding_code_sent_at timestamptz
);

alter table public.tier_2_waitlist enable row level security;

create policy "No direct client access"
  on public.tier_2_waitlist
  for all
  to public
  using (false)
  with check (false);

create index tier_2_waitlist_signed_up_at_idx on public.tier_2_waitlist (signed_up_at desc);