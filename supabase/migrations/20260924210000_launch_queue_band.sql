-- 2026-09-24: both elementary bands are on sale, so the automatic launch series
-- (positions 8-12 and 19-21) is band-aware. Until now every edens_table signup got
-- the Sprouts copy, including Seedlings free-week signups (waitlist source
-- 'seedlings_magnet'), who were being sold the K-2 year. The copy for both bands
-- lives in supabase/functions/_shared/launch-sequence-templates.ts; this gives
-- each queue row the band to render.
--
-- (a) launch_email_queue.band: 'sprouts' or 'seedlings', default 'sprouts', so
--     every existing row and any insert that does not name a band stays Sprouts.
--     The nurture-emails drainer treats a missing or NULL band as Sprouts too, so
--     the code can deploy before or after this migration.
-- (b) enqueue_launch_sequence_on_signup(): the definition from
--     20260924200000_waitlist_skips_launch_sequence.sql, copied exactly, with ONE
--     addition: the band column in the insert, 'seedlings' when the signup source
--     is 'seedlings_magnet', else 'sprouts'.
-- (c) Backfill: pending rows for people whose edens_table signup came from the
--     Seedlings free week become 'seedlings'. Sent and cancelled rows are history
--     and are left alone. (waitlist_signups is unique on email + entry_funnel, so
--     each address has one edens_table row, and its source is the first signup.)

alter table public.launch_email_queue
  add column if not exists band text not null default 'sprouts'
  check (band in ('sprouts', 'seedlings'));

create or replace function public.enqueue_launch_sequence_on_signup()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  launch_start constant timestamptz := '2026-07-03 00:00:00+00';
begin
  if now() < launch_start then
    return new;
  end if;
  if new.entry_funnel::text <> 'edens_table' then
    return new;
  end if;
  if new.unsubscribed_at is not null then
    return new;
  end if;
  -- 2026-09-24: band waitlists (Cultivators, Practitioners) are not enrolled.
  if coalesce(new.source, '') in ('cultivators_waitlist', 'practitioners_waitlist') then
    return new;
  end if;

  insert into public.launch_email_queue
    (recipient_email, first_name, sequence_position, scheduled_for, status, band)
  select
    lower(new.email),
    coalesce(nullif(trim(new.first_name), ''), 'friend'),
    s.pos,
    now() + (s.day_offset * interval '1 day'),
    'pending',
    -- 2026-09-24: Seedlings free-week signups get the Seedlings copy.
    case when new.source = 'seedlings_magnet' then 'seedlings' else 'sprouts' end
  from (values
    -- Preorder conversion series.
    (8, 9), (9, 11), (10, 13), (11, 16), (12, 19),
    -- Post-delay Starter Unit arc. Replaces the cancelled 13 to 17.
    (19, 22), (20, 26), (21, 31)
  ) as s(pos, day_offset)
  on conflict (recipient_email, sequence_position) do nothing;

  return new;
end;
$function$;

update public.launch_email_queue q
   set band = 'seedlings'
 where q.status = 'pending'
   and q.band <> 'seedlings'
   and q.recipient_email in (
     select lower(w.email) from public.waitlist_signups w
      where w.entry_funnel = 'edens_table'
        and w.source = 'seedlings_magnet'
   );
