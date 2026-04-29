-- §8.1.4 PR 4 — add 'practitioner_waitlist' value to entry_funnel enum.
-- Backs the bottom-of-Apothecary CTA pair: users on /apothecary who want to
-- be notified when the Practitioner tier opens (end of 2027 per Lock #3 + #28
-- + the Pricing.tsx footnote) sign up via this funnel value, distinct from
-- 'app_beta', 'course_tier2', 'edens_table', 'homeschool', 'community',
-- 'quiz_funnel'.
--
-- Why a new enum value rather than reusing 'app_beta':
--   * app_beta = pre-launch Apothecary access waitlist (already-running)
--   * practitioner_waitlist = post-launch tier escalation interest (new)
-- Mixing them collapses two distinct nurture audiences onto one Resend
-- contact tag and undermines downstream segmentation in the Resend dashboard.
--
-- ALTER TYPE ADD VALUE is non-transactional in PostgreSQL, but Supabase's
-- migration runner handles each statement separately. No data backfill
-- needed -- this is purely an additive enum extension.

ALTER TYPE public.entry_funnel ADD VALUE IF NOT EXISTS 'practitioner_waitlist';
