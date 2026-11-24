-- "How did you hear about us?" (2026-11-24; Gina / UHPN's ask, Camila's taps "Yes, add it" and "Use these").
-- One optional answer per free-week sign-up (waitlist_signups) and per order (orders). Null = not answered.
-- The allowed values are supabase/functions/_shared/heard-about.ts HEARD_ABOUT_OPTIONS (src/test/heardAbout.test.ts
-- keeps this list and that one equal). The code drops anything else before writing, so the CHECK never rejects a
-- sign-up or a sale; it only keeps the column clean. Adding a choice later = this list + that file, one PR.
-- Both tables are small; adding a nullable column with no default is instant, and each CHECK scans once.

alter table public.waitlist_signups add column if not exists heard_about text;
alter table public.waitlist_signups drop constraint if exists waitlist_signups_heard_about_check;
alter table public.waitlist_signups add constraint waitlist_signups_heard_about_check check (
  heard_about is null or heard_about in (
    'talesandtabletalk', 'uhpn', 'anotherpodcast', 'facebook', 'instagram', 'pinterest', 'search', 'friendfamily', 'other'
  )
);

alter table public.orders add column if not exists heard_about text;
alter table public.orders drop constraint if exists orders_heard_about_check;
alter table public.orders add constraint orders_heard_about_check check (
  heard_about is null or heard_about in (
    'talesandtabletalk', 'uhpn', 'anotherpodcast', 'facebook', 'instagram', 'pinterest', 'search', 'friendfamily', 'other'
  )
);

comment on column public.waitlist_signups.heard_about is 'Free-week form: "How did you hear about us?" (optional; first answer kept).';
comment on column public.orders.heard_about is 'Checkout: "How did you hear about us?" (optional Stripe dropdown; stamped by stripe-webhook).';
