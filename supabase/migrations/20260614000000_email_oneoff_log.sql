-- One-time / ad-hoc email campaign send log. Used to guarantee idempotency
-- for operational broadcasts (e.g. the founders-pricing freebie apology blast
-- sent by the founders-freebie-blast Edge Function). Service-role only.
create table if not exists public.email_oneoff_log (
  campaign    text        not null,
  email       text        not null,
  sent_at     timestamptz not null default now(),
  status      text        not null default 'sent',
  error       text,
  primary key (campaign, email)
);

alter table public.email_oneoff_log enable row level security;
