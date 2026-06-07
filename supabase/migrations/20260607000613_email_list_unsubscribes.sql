-- Per-list voluntary email unsubscribes (one-click, RFC 8058).
-- One row per (email, list). Service-role only; no RLS policies.
-- Bounces/complaints/Resend-level unsubscribes remain GLOBAL via
-- resend-webhook -> waitlist_signups.metadata; this table is purely the
-- voluntary, per-funnel opt-out that senders consult before each send.
create table if not exists public.email_list_unsubscribes (
  email text not null,
  list text not null,
  unsubscribed_at timestamptz not null default now(),
  source text,
  primary key (email, list)
);

create index if not exists email_list_unsubscribes_email_idx
  on public.email_list_unsubscribes (email);

alter table public.email_list_unsubscribes enable row level security;

comment on table public.email_list_unsubscribes is
  'Per-list voluntary email unsubscribes (one-click / List-Unsubscribe). One row per (email, list). Service-role only, no RLS policies. Bounces/complaints stay global via resend-webhook. Lists: constitution (quiz drip + 3-arc + assessment), homeschool (magnet weeks + Eden''s Table welcome).';
