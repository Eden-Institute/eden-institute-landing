-- Seedlings Starter Unit: make the starter delivery table band-aware (2026-09-23).
--
-- Founder decision 2026-09-23: a second $39 Starter Unit, for Seedlings (grades
-- 3-5), same shape as Sprouts. The purchase and delivery rails are shared, so each
-- delivery row now records WHICH band it belongs to. The band decides the master
-- PDFs that get stamped, the filenames, the delivery email and the receipt.
--
-- NO CREDIT FOR SEEDLINGS (founder decision 2026-09-23: "this was for the kit only
-- and we are not doing it for seedlings"). A Seedlings purchase never writes a
-- starter_credits row, so starter_credits gets no band column: every row in it is
-- a Sprouts credit, as it always has been.
--
-- EXISTING ROWS ARE ALL SPROUTS, because Sprouts was the only Starter Unit. The
-- column default 'sprouts' backfills them in place (Postgres 11+ applies a constant
-- default without rewriting the table), and code reading a row with no band also
-- treats it as Sprouts (normalizeStarterBand in _shared/starter-config.ts).
--
-- ORDER OF OPERATIONS. The Sprouts code path does not name this column on insert
-- or select, so Sprouts keeps working whether this runs before or after the
-- function deploy. The Seedlings path DOES write it, so this migration must be
-- applied before the first Seedlings sale. create-checkout probes for the column
-- and refuses to sell Seedlings until it exists.
--
-- Idempotent: every statement is guarded and can be re-run.

-- ---------------------------------------------------------------------------
-- starter_deliveries.band
-- ---------------------------------------------------------------------------
alter table public.starter_deliveries
  add column if not exists band text not null default 'sprouts';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'starter_deliveries_band_check'
      and conrelid = 'public.starter_deliveries'::regclass
  ) then
    alter table public.starter_deliveries
      add constraint starter_deliveries_band_check check (band in ('sprouts', 'seedlings'));
  end if;
end $$;

comment on column public.starter_deliveries.band is
  'Which band''s Starter Unit this delivery is: sprouts or seedlings. Picks the master PDFs, the '
  'delivered filenames, the email copy and the receipt line.';

-- ---------------------------------------------------------------------------
-- Reporting
-- ---------------------------------------------------------------------------
-- starter_conversion_report() is unchanged in meaning: every credit is a Sprouts
-- credit, and it counts Sprouts sales by lookup_key. Seedlings sales are simply
-- orders with lookup_key 'seedlings_starter_unit', with no credit to convert, so
-- they need no report function; count them from orders directly.
