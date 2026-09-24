// deno test --allow-env supabase/functions/_shared/esa-fulfil.test.ts
// Stubs fetch, so nothing reaches Supabase, Resend or Lulu.
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-test-key");
Deno.env.set("RESEND_API_KEY", "re_test");
const { applyPayment, confirmWithToken, ESA_STARTER_SKUS } = await import("./esa-fulfil.ts");

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

function stub(invoice: Record<string, unknown>, markPaidReturns = true, confirm: Response | (() => Response) | null = null) {
  const calls: Call[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ method, url, body: String(init?.body ?? "") });
    const ok = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
    if (url.includes("/rpc/esa_mark_invoice_paid")) return ok(markPaidReturns);
    if (url.includes("/rpc/esa_confirm_payment_token") && confirm) return typeof confirm === "function" ? confirm() : confirm;
    if (url.includes("/esa_invoices?id=eq.") && method === "GET") return ok([invoice]);
    if (url.includes("/products?")) return ok([{ id: "p-set", sku: "sprouts_print_set", fulfillment: "lulu" }, { id: "p-nb", sku: "sprouts_nb_print", fulfillment: "lulu" }, { id: "p-sdl", sku: "seedlings_print_set", fulfillment: "lulu" }, { id: "p-sdl-nb", sku: "seedlings_nb_print", fulfillment: "lulu" }]);
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

Deno.test("printed order: the student's name is not copied into orders.raw, order_items or the ledger", async () => {
  const s = stub(baseInvoice());
  try {
    await applyPayment("inv-1", "manual", null);
    for (const t of ["orders", "order_items", "lulu_jobs", "payments"]) {
      for (const c of posted(s.calls, t)) assert(!c.body.includes("Sam Doe") && !c.body.includes("student_name"), `${t}: ${c.body}`);
    }
    const order = JSON.parse(posted(s.calls, "orders")[0].body);
    assertEquals(order.shipping_name, "Jane Doe");
    assertEquals(order.raw.invoice_number, "ET-AZ-2026-001");
  } finally { s.restore(); }
});

Deno.test("Confirm paid: one atomic RPC, then fulfilment; the token is never PATCHed from the function", async () => {
  const s = stub(baseInvoice(), true, new Response(JSON.stringify([{ outcome: "applied", invoice_id: "inv-1", payment_id: "pay-1" }]), { status: 200 }));
  try {
    const r = await confirmWithToken("11111111-1111-4111-8111-111111111111");
    assertEquals(r.outcome, "applied");
    assertEquals(r.result?.fulfilment, "print_queued");
    assert(!s.calls.some((c) => c.url.includes("esa_payment_confirmations")), "token use happens inside the RPC");
    assert(!s.calls.some((c) => c.url.includes("/rpc/esa_mark_invoice_paid")), "no second mark-paid call");
  } finally { s.restore(); }
});

Deno.test("Confirm paid: if the atomic RPC fails, nothing is used, paid or fulfilled, so the link still works", async () => {
  const s = stub(baseInvoice(), true, () => new Response("connection reset", { status: 503 }));
  try {
    let threw = false;
    try {
      await confirmWithToken("11111111-1111-4111-8111-111111111111");
    } catch {
      threw = true;
    }
    assert(threw);
    assert(!s.calls.some((c) => c.method !== "GET" && !c.url.includes("/rpc/esa_confirm_payment_token")), s.calls.map((c) => `${c.method} ${c.url}`).join(" | "));
    assertEquals(posted(s.calls, "orders").length, 0);
  } finally { s.restore(); }
});

Deno.test("Confirm paid: used / expired / not issued change nothing", async () => {
  for (const outcome of ["used", "expired", "not_found", "not_issued"]) {
    const s = stub(baseInvoice(), true, new Response(JSON.stringify([{ outcome, invoice_id: "inv-1", payment_id: null }]), { status: 200 }));
    try {
      const r = await confirmWithToken("11111111-1111-4111-8111-111111111111");
      assertEquals(r.outcome, outcome);
      assertEquals(r.result, undefined);
      assertEquals(s.calls.length, 1, outcome);
    } finally { s.restore(); }
  }
});

Deno.test("esa-payment-confirm no longer uses the token before applying", async () => {
  const src = await Deno.readTextFile(new URL("../esa-payment-confirm/index.ts", import.meta.url));
  assert(!src.includes("used_at: new Date()"), "the function must not PATCH used_at itself");
  assert(src.includes("confirmWithToken("));
});

// Seedlings (grades 3-5), 2026-09-24.
const patched = (calls: Call[]) => calls.filter((c) => c.method === "PATCH" && c.url.includes("/rest/v1/esa_invoices")).map((c) => JSON.parse(c.body));

Deno.test("Seedlings Starter invoice: delivery carries band 'seedlings', no kit-list note", async () => {
  const s = stub(baseInvoice({ state: "AL", invoice_number: "ET-AL-2026-002", ship_address: null, items: [{ sku: "ET-SDL-35-003", qty: 1, unit_cents: 3900, amount_cents: 3900 }], total_cents: 3900, fee_cents: 0 }));
  try {
    const r = await applyPayment("inv-1", "manual", null);
    assertEquals(r.fulfilment, "queued");
    const d = JSON.parse(posted(s.calls, "starter_deliveries")[0].body);
    assertEquals(d.band, "seedlings");
    assertEquals(d.order_id, null);
    assertEquals(posted(s.calls, "orders").length, 0);
    assertEquals(posted(s.calls, "lulu_jobs").length, 0);
    assert(s.calls.some((c) => c.url.includes("/functions/v1/starter-fulfill")));
    const note = patched(s.calls).find((p) => p.fulfilment_note)?.fulfilment_note ?? "";
    assert(note.includes("seedlings") && !note.includes("kit relaunch"), note);
  } finally { s.restore(); }
});

Deno.test("Sprouts Starter invoice: band left to the column default, kit-list note unchanged", async () => {
  const s = stub(baseInvoice({ state: "AL", invoice_number: "ET-AL-2026-003", ship_address: null, items: [{ sku: "ET-SPR-K2-003", qty: 1, unit_cents: 3900, amount_cents: 3900 }], total_cents: 3900, fee_cents: 0 }));
  try {
    await applyPayment("inv-1", "manual", null);
    const d = JSON.parse(posted(s.calls, "starter_deliveries")[0].body);
    assert(!("band" in d), JSON.stringify(d));
    const note = patched(s.calls).find((p) => p.fulfilment_note)?.fulfilment_note ?? "";
    assertEquals(note, "starter delivery queued; kit relaunch list (L-29)");
  } finally { s.restore(); }
});

Deno.test("Seedlings set invoice: order for seedlings_print_set, lookup_key drives the Lulu band", async () => {
  const s = stub(baseInvoice({ items: [{ sku: "ET-SDL-35-004", qty: 1, unit_cents: 26100, amount_cents: 26100 }] }));
  try {
    const r = await applyPayment("inv-1", "manual", null);
    assertEquals(r.fulfilment, "print_queued");
    assert(s.calls.some((c) => c.method === "GET" && c.url.includes("/products?sku=in.(seedlings_print_set)")));
    const order = JSON.parse(posted(s.calls, "orders")[0].body);
    assertEquals(order.lookup_key, "seedlings_print_set");
    assertEquals(order.product_label, "Seedlings Printed Curriculum Set");
    assertEquals([order.status, order.is_preorder, order.fulfillment], ["ready_to_fulfill", false, "lulu"]);
    const items = JSON.parse(posted(s.calls, "order_items")[0].body);
    assertEquals(items, [{ order_id: "ord-1", product_id: "p-sdl", quantity: 1, unit_price_cents: 26100 }]);
    assertEquals(JSON.parse(posted(s.calls, "lulu_jobs")[0].body).status, "pending");
    assertEquals(posted(s.calls, "starter_deliveries").length, 0);
    assert(s.calls.some((c) => c.url.includes("/functions/v1/lulu-submit")));
    const { printBandForOrder } = await import("./lulu-config.ts");
    assertEquals(printBandForOrder(order), "seedlings");
  } finally { s.restore(); }
});

Deno.test("Seedlings extra notebook invoice: order for seedlings_nb_print, NB-only Lulu job in the Seedlings band", async () => {
  const s = stub(baseInvoice({ items: [{ sku: "ET-SDL-35-005", qty: 1, unit_cents: 3999, amount_cents: 3999 }], total_cents: 4081, fee_cents: 82 }));
  try {
    const r = await applyPayment("inv-1", "manual", null);
    assertEquals(r.fulfilment, "print_queued");
    assert(s.calls.some((c) => c.method === "GET" && c.url.includes("/products?sku=in.(seedlings_nb_print)")));
    const order = JSON.parse(posted(s.calls, "orders")[0].body);
    assertEquals(order.lookup_key, "seedlings_nb_print");
    assertEquals(order.product_label, "Seedlings Extra Student Notebook");
    const items = JSON.parse(posted(s.calls, "order_items")[0].body);
    assertEquals(items, [{ order_id: "ord-1", product_id: "p-sdl-nb", quantity: 1, unit_price_cents: 3999 }]);
    assertEquals(posted(s.calls, "starter_deliveries").length, 0);
    const { printBandForOrder, luluProductBySku } = await import("./lulu-config.ts");
    assertEquals(printBandForOrder(order), "seedlings");
    assertEquals(luluProductBySku("seedlings_nb_print")?.books, ["nb"]);
  } finally { s.restore(); }
});

Deno.test("esa-payment-confirm treats both Starter SKUs as Starters", async () => {
  assertEquals([...ESA_STARTER_SKUS].sort(), ["ET-SDL-35-003", "ET-SPR-K2-003"]);
  const src = await Deno.readTextFile(new URL("../esa-payment-confirm/index.ts", import.meta.url));
  assert(src.includes("ESA_STARTER_SKUS.includes(i.sku)"));
  assert(!src.includes('i.sku === "ET-SPR-K2-003"'));
});
