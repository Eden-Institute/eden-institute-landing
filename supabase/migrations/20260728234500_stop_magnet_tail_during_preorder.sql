-- Stop the magnet W3-W7 tail so it cannot compete with the preorder series.
--
-- Companion to 20260728233000 (which re-routed new signups) and to the
-- resend-waitlist change that stops enqueueing magnet position 3. Those two
-- only affect FUTURE signups. This clears the rows already queued for existing
-- recipients, which were scheduled Jul 28 - Aug 11 and therefore landed on top
-- of the preorder series (Jul 29 - Aug 26).
--
-- Without this, roughly a hundred families would receive the $249 founding kit
-- pitch and the $97 course pitch in the same week from the same sender, and the
-- tail would keep regenerating: MAGNET_CHAIN_NEXT enqueues position N+1 when N
-- sends, so every position 3 that went out would spawn a new position 4.
-- Cancelling position 3 is what actually breaks that chain.
--
-- Position 2 (free week 2) is deliberately NOT touched. It is one of the two
-- free weeks the founder wants every lead to receive, and it does not chain:
-- MAGNET_CHAIN_NEXT starts at 3, so a position 2 send enqueues nothing.
--
-- Only 'pending' rows are affected, so nothing already sent is rewritten.
--
-- REPLAY GUARD: bounded to rows scheduled before 2026-10-01. This is a
-- launch-window operation, not a permanent policy, and the bound keeps a replay
-- in some future environment from silently cancelling unrelated future sends.

update public.magnet_email_queue
   set status        = 'cancelled',
       error_message = 'superseded: preorder series takes priority 2026-07-28',
       updated_at    = now()
 where status = 'pending'
   and sequence_position between 3 and 7
   and scheduled_for < '2026-10-01T00:00:00+00';
