-- 2026-11-20, Wired quiz cart reminder (Lane 2b). Camila's go via Lane NP; applied only on her own tap.
-- Spec answers 15, 20-22, 26: ONE reminder for an abandoned wired checkout, about 24 hours after it started, to
-- consenting shoppers only, with a 50/50 holdout recorded on the same checkout_recoveries row the store uses
-- (one table for store and wired, so the 30-day cooldown spans both).
--   arm               'remind' | 'holdout' (wired rows only; null for store rows)
--   send_after        when the wired reminder is due (session created + 24 h); null for holdout and store rows
--   wired_pending_id  the wired_pending_checkouts row (product, children) the reminder names
-- Existing grants on checkout_recoveries are unchanged (new columns inherit them).

alter table public.checkout_recoveries add column if not exists arm text check (arm is null or arm in ('remind', 'holdout'));
alter table public.checkout_recoveries add column if not exists send_after timestamptz;
alter table public.checkout_recoveries add column if not exists wired_pending_id uuid;
create index if not exists checkout_recoveries_wired_due_idx on public.checkout_recoveries (send_after) where reason = 'wired_scheduled';
