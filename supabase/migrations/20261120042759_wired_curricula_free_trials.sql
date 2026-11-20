-- Curriculum finder (2026-11-19, Camila: "include the links to all of their free tries ... a filter for
-- completely free stuff"). One free try-before-you-buy link per curriculum, from the publisher's own
-- site, researched and dated; completely_free = the whole curriculum costs nothing (not just a sample).
alter table public.wired_curricula
  add column if not exists free_trial_url     text,
  add column if not exists free_trial_type    text check (free_trial_type in ('samples', 'free_trial', 'free_lessons', 'placement_test', 'fully_free', 'none')),
  add column if not exists free_trial_note    text,
  add column if not exists completely_free    boolean not null default false,
  add column if not exists free_trial_checked date;
