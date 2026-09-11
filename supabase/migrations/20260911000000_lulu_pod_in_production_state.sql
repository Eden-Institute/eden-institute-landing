-- Lulu print-on-demand fulfilment, part 1 of 2: the order state that means
-- "handed to the printer".
--
-- The order_status enum already carries the full ship-it-ourselves lifecycle
-- (paid -> preorder_hold -> ready_to_fulfill -> label_created -> shipped ->
-- delivered). A print-on-demand order never has a label WE bought; the printer
-- prints, packs and ships it. Reusing label_created for that would make the
-- founder dashboard say "label created" about an order that has no label, so
-- the state gets its own name.
--
-- THIS FILE ONLY ADDS THE ENUM VALUE. Postgres refuses to use a freshly added
-- enum value inside the same transaction that added it ("unsafe use of new
-- value"), and the CLI wraps each migration in one transaction. Everything that
-- references 'in_production' (columns, the founder_orders RPC) lives in the next
-- file, 20260911000100_lulu_pod_fulfillment.sql, so the pair applies cleanly in
-- one `db push`.
--
-- Idempotent: IF NOT EXISTS makes a re-run a no-op.

alter type public.order_status add value if not exists 'in_production' after 'label_created';
