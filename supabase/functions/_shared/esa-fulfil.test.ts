// deno test --allow-env supabase/functions/_shared/esa-fulfil.test.ts
// Stubs fetch, so nothing reaches Supabase, Resend or Lulu.
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-test-key");
Deno.env.set("RESEND_API_KEY", "re_test");
const { applyPayment } = await import("./esa-fulfil.ts");

type Call = { method: string; url: string; body: string };

function baseInvoice(over: Record<string, unknown> = {}) {
  return {
    id: "inv-1", invoice_number: "ET-AZ-2026-001", is_test: false, state: "AZ", invoice_date: "2026-09-15",
    parent_name: "Jane Doe", student_name: "Sam Doe", family_email: "jane@example.com",
    ship_to: "1 Main St\nMesa, AZ 85201", ship_address: { line1: "1 Main St", line2: "", city: "Mesa", region: "AZ", zip: "85201" },
    phone: null, items: [{ sku: "ET-SPR-K2-004", qty: 1, unit_cents: 26100, amount_cents: 26100 }],
    total_cents: 26633, fee_cents: 533, status: "paid", paid_at: "2026-09-15T15:00:00Z", paid_via: "manual", payment_id: null,
    fulfilment_status: "none", order_id: null, starter_delivery_id: null, created_at: "2026-09-15T00:00:00Z",
    reminder_sent_at: null, founder_alerted_at: null, ...over,
  };
}

function stub(invoice: Record<string, unknown>, markPaidReturns = true) {
  const calls: Call[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ method, url, body: String(init?.body ?? "") });
    const ok = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
    if (url.includes("/rpc/esa_mark_invoice_paid")) return ok(markPaidReturns);
    if (url.includes("/esa_invoices?id=eq.") && method === "GET") return ok([invoice]);
    if (url.includes("/products?")) return ok([{ id: "p-set", sku: "sprouts_print_set", fulfillment: "lulu" }, { id: "p-nb", sku: "sprouts_nb_print", fulfillment: "lulu" }]);
    if (url.endsWith("/rest/v1/orders") && method === "POST") return ok([{ id: "ord-1", order_number: "ET-2001" }]);
    if (url.endsWith("/rest/v1/starter_deliveries") && method === "POST") return ok([{ id: "del-1" }]);
    return new Response("", { status: 200 });
  }) as typeof fetch;
  return { calls, restore: () => (globalThis.fetch = original) };
}

const posted = (calls: Call[], path: string) => calls.filter((c) => c.method === "POST" && c.url.includes(`/rest/v1/${path}`));

Deno.test("TEST invoice: no order, no Lulu job, no delivery, no ledger row", async () => {
  const s = stub(baseInvoice({ is_test: true }));
  try {
    const r = await applyPayment("inv-1", "manual", null);
    assertEquals(r.fulfilment, "manual");
    for (const t of ["orders", "order_items", "lulu_jobs", "starter_deliveries", "payments"]) assertEquals(posted(s.calls, t).length, 0, t);
    assert(!s.calls.some((c) => c.url.includes("/functions/v1/lulu-submit")));
  } finally { s.restore(); }
});

Deno.test("printed invoice: order at ready_to_fulfill, not a preorder, lulu job, kick, ledger", async () => {
  const s = stub(baseInvoice());
  try {
    const r = await applyPayment("inv-1", "manual", null);
    assertEquals(r.fulfilment, "print_queued");
    const order = JSON.parse(posted(s.calls, "orders")[0].body);
    assertEquals([order.status, order.is_preorder, order.fulfillment, order.customer_phone], ["ready_to_fulfill", false, "lulu", "(931) 575-5895"]);
    assertEquals(order.shipping_address.country, "US");
    assert(order.stripe_checkout_session_id.startsWith("esa_") && order.stripe_checkout_session_id.length > 40);
    assertEquals(JSON.parse(posted(s.calls, "order_items")[0].body)[0].unit_price_cents, 26100);
    assertEquals(JSON.parse(posted(s.calls, "lulu_jobs")[0].body).status, "pending");
    assert(s.calls.some((c) => c.url.includes("/functions/v1/lulu-submit")));
    assertEquals(JSON.parse(posted(s.calls, "payments")[0].body).stripe_event_id, "esa:ET-AZ-2026-001");
  } finally { s.restore(); }
});

Deno.test("Starter invoice: delivery with an unguessable key and no order link, no Lulu", async () => {
  const s = stub(baseInvoice({ state: "AL", invoice_number: "ET-AL-2026-001", ship_address: null, items: [{ sku: "ET-SPR-K2-003", qty: 1, unit_cents: 3900, amount_cents: 3900 }], total_cents: 3900, fee_cents: 0 }));
  try {
    const r = await applyPayment("inv-1", "manual", null);
    assertEquals(r.fulfilment, "queued");
    const d = JSON.parse(posted(s.calls, "starter_deliveries")[0].body);
    assertEquals(d.order_id, null);
    assert(d.stripe_checkout_session_id.length >= 60 && d.download_token.length === 64);
    assertEquals(posted(s.calls, "orders").length, 0);
    assertEquals(posted(s.calls, "lulu_jobs").length, 0);
    assert(s.calls.some((c) => c.url.includes("/functions/v1/starter-fulfill")));
  } finally { s.restore(); }
});

Deno.test("already paid: a second apply changes nothing and fulfils nothing", async () => {
  const s = stub(baseInvoice(), false);
  try {
    const r = await applyPayment("inv-1", "founder_confirm", null);
    assertEquals(r.changed, false);
    assertEquals(posted(s.calls, "orders").length, 0);
  } finally { s.restore(); }
});
