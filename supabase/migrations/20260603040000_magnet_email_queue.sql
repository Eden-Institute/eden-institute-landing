-- Phase 3.1.2: Sprouts/Seedlings lead-magnet nurture queue.
-- Separate from public.nurture_email_queue (the quiz constitution drip).
-- Drained by the nurture-emails Edge Function (Vercel cron, every 15 min).
create table if not exists public.magnet_email_queue (
  id uuid primary key default gen_random_uuid(),
  recipient_email   text        not null,
  first_name        text,
  band              text        not null check (band in ('sprouts','seedlings')),
  sequence_position smallint    not null,   -- 2 = Week 2, 3 = Week 3 (Facebook)
  scheduled_for     timestamptz not null,
  sent_at           timestamptz,
  status            text        not null default 'pending',
  error_message     text,
  retry_count       integer     not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (recipient_email, band, sequence_position)
);

create index if not exists idx_magnet_email_queue_due
  on public.magnet_email_queue (status, scheduled_for);

-- Edge functions use the service-role key (bypasses RLS). Enable RLS with no
-- public policies so the table is locked down to everyone else.
alter table public.magnet_email_queue enable row level security;
