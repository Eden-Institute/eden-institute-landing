-- Email topics: what each family chose on the Resend preference page (punch #22, 2026-11-04).
--
-- WHY. The 10/14 email plan: before the spring push, let a family choose what she gets
-- instead of leaving the whole list. Resend Topics do that on the branded unsubscribe page,
-- and a Broadcast scoped to a topic skips anyone who unticked it. Resend reports each change
-- as a contact.topics.updated webhook event; resend-webhook records it here, so Postgres
-- (where every audience is decided) knows it too.
--
-- 🔴 A TOPIC CHOICE IS NEVER A GLOBAL UNSUBSCRIBE. This table is written ONLY from
-- contact.topics.updated, on its own path in resend-webhook, which never calls
-- waitlist_apply_resend_event and never touches unsubscribed_at. Unticking one topic must
-- not take a family off everything (the 2026-10-14 incident widened 178 list opt-outs
-- into global ones through that RPC). "Unsubscribe from all" still arrives as
-- contact.updated with unsubscribed=true and keeps its existing path.
--
--   email        lowercased address the event named
--   topic_id     Resend topic id (see _shared/email-topics.ts for which topic is which)
--   subscription opt_in or opt_out, the family's latest choice
--   changed_at   the event's own created_at, so an older event arriving late never
--                overwrites a newer choice
--
-- Grants: service_role only, by name (rule from 2026-10-20, src/test/newTableGrants.test.ts).
-- RLS on with no policies. Idempotent: every statement can be re-run.

create table if not exists public.email_topic_preferences (
  email        text        not null,
  topic_id     text        not null,
  subscription text        not null check (subscription in ('opt_in', 'opt_out')),
  changed_at   timestamptz not null,
  received_at  timestamptz not null default now(),
  primary key (email, topic_id),
  constraint email_topic_preferences_email_lower check (email = lower(btrim(email)))
);

comment on table public.email_topic_preferences is
  'Each family''s latest choice per Resend topic, from contact.topics.updated (resend-webhook). A topic opt_out is NOT a global unsubscribe and never writes unsubscribed_at. Service role only.';

alter table public.email_topic_preferences enable row level security;
revoke all on table public.email_topic_preferences from public, anon, authenticated;
grant select, insert, update, delete on table public.email_topic_preferences to service_role;
