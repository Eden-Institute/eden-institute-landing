-- Tales & Table Talk podcast waitlist (talesandtabletalk.com).
--
-- A separate funnel, not a source under edens_table, so that podcast listeners are
-- kept out of everything keyed on edens_table: trg_enqueue_launch_sequence (the
-- Eden's Table preorder/Starter series) and list-announce (Eden's Table broadcasts).
-- waitlist_signups is UNIQUE (email, entry_funnel), so one person can sit on both
-- lists independently.
ALTER TYPE public.entry_funnel ADD VALUE IF NOT EXISTS 'podcast';
