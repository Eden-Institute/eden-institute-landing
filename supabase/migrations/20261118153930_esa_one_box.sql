-- 2026-11-18 (Lane 2; Camila's yes via Lane 0): one box per ESA form submission.
--
-- Brianne's Seedlings set (ET-AR-2026-001) and extra notebook (ET-AR-2026-002) came from ONE /esa form, were
-- paid 3 seconds apart, and became two orders, two Lulu jobs and two boxes four days apart. From now on a paid
-- printed invoice whose same-band, same-address sibling invoices are still unpaid waits, and the payment that
-- completes the set prints all of them as one order (_shared/esa-fulfil.ts planEsaPrint / releaseHeldInvoices).
--
-- 1) esa_invoices.fulfilment_status gains 'awaiting_siblings' (paid, waiting for a sibling, no order yet).
--    The other seven values are exactly the live constraint's (read 2026-11-18).
alter table public.esa_invoices drop constraint if exists esa_invoices_fulfilment_status_check;
alter table public.esa_invoices add constraint esa_invoices_fulfilment_status_check
  check (fulfilment_status in ('none', 'queued', 'files_sent', 'print_queued', 'shipped', 'failed', 'manual', 'awaiting_siblings'));

-- 2) At most one order per ESA box (orders.raw.esa_group_key = submission id + the box's first invoice number),
--    so two payments landing at the same moment cannot both make the box: the second insert fails on this index
--    and that run uses the first run's order (esa-fulfil.ts findEsaBoxOrder). Card orders never set the key.
create unique index if not exists orders_esa_group_key_uniq
  on public.orders ((raw ->> 'esa_group_key'))
  where (raw ->> 'esa_group_key') is not null;
