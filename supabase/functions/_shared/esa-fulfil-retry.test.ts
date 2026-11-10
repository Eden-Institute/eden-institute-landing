// ESA fulfilment D4, 2026-11-10 (Lane 2 deep audit area 2; founder go "Yes, build + ship
// all 5"): a retry after a part-way failure reuses what the invoice already created, and
// the founder alert says what was actually created. Stubs fetch; nothing leaves the test.
//   deno test --no-lock --allow-env --allow-net --allow-read supabase/functions/_shared/esa-fulfil-retry.test.ts
import { assert, assertEquals, assertFalse, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Same values as esa-fulfil.test.ts (the module reads them once, at first import).
Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-test-key");
Deno.env.set("RESEND_API_KEY", "re_test");
const { applyPayment, esaFailureLines } = await import("./esa-fulfil.ts");

type Call = { method: string; url: string; body: string };

function invoice(over: Record<string, unknown> = {}) {
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
const starterInvoice = () =>
  invoice({ state: "AL", invoice_number: "ET-AL-2026-001", ship_address: null, items: [{ sku: "ET-SPR-K2-003", qty: 1, unit_cents: 3900, amount_cents: 3900 }], total_cents: 3900, fee_cents: 0 });

interface World {
  existingOrder?: { id: string; order_number: string } | null;
  existingItems?: boolean;
  existingJob?: boolean;
  existingDelivery?: { id: string; stripe_checkout_session_id: string } | null;
  fail?: (method: string, url: string) => boolean;
}

function stub(inv: Record<string, unknown>, w: World = {}) {
  const calls: Call[] = [];
  let order = w.existingOrder ?? null; // becomes visible to the lookup once created
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ method, url, body: String(init?.body ?? "") });
    const ok = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
    if (w.fail?.(method, url)) return new Response("boom", { status: 500 });
    if (url.includes("/rpc/esa_mark_invoice_paid")) return ok(true);
    if (url.includes("/esa_invoices?id=eq.") && method === "GET") return ok([inv]);
    if (url.includes("/products?")) return ok([{ id: "p-set", sku: "sprouts_print_set", fulfillment: "lulu" }, { id: "p-nb", sku: "sprouts_nb_print", fulfillment: "lulu" }]);
    if (url.includes("/rest/v1/orders?") && method === "GET") return ok(order ? [order] : []);
    if (url.endsWith("/rest/v1/orders") && method === "POST") { order = { id: "ord-1", order_number: "ET-2001" }; return ok([order]); }
    if (url.includes("/rest/v1/order_items?") && method === "GET") return ok(w.existingItems ? [{ id: "oi-1" }] : []);
    if (url.includes("/rest/v1/lulu_jobs?order_id=") && method === "GET") return ok(w.existingJob ? [{ id: "lj-1" }] : []);
    if (url.includes("/rest/v1/starter_deliveries?") && method === "GET") return ok(w.existingDelivery ? [w.existingDelivery] : []);
    if (url.endsWith("/rest/v1/starter_deliveries") && method === "POST") return ok([{ id: "del-1" }]);
    return new Response("", { status: 200 });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

const posts = (calls: Call[], frag: string) => calls.filter((c) => c.method === "POST" && c.url.includes(frag));
const invoicePatches = (calls: Call[]) => calls.filter((c) => c.method === "PATCH" && c.url.includes("/esa_invoices?id=eq."));
const resendBodies = (calls: Call[]) => posts(calls, "api.resend.com/emails").map((c) => JSON.parse(c.body) as { subject: string; html: string; to: string[] });

// ---------------------------------------------------------------- reuse on retry
Deno.test("D4 print retry: an order this invoice already made is REUSED (no second order, no second set)", async () => {
  const s = stub(invoice(), { existingOrder: { id: "ord-old", order_number: "ET-1999" } });
  try {
    const r = await applyPayment("inv-1", "manual", null);
    assertEquals(r.fulfilment, "print_queued");
    assertEquals(posts(s.calls, "/rest/v1/orders").filter((c) => c.url.endsWith("/rest/v1/orders")).length, 0, "no new order");
    assertEquals(JSON.parse(posts(s.calls, "/rest/v1/order_items")[0].body)[0].order_id, "ord-old", "missing items filled in");
    const job = posts(s.calls, "/rest/v1/lulu_jobs")[0];
    assertStringIncludes(job.url, "on_conflict=order_id");
    assertEquals(JSON.parse(job.body).order_id, "ord-old");
    const patch = JSON.parse(invoicePatches(s.calls).at(-1)!.body);
    assertEquals(patch.order_id, "ord-old");
    assertStringIncludes(patch.fulfilment_note, "reused");
    assert(resendBodies(s.calls).some((b) => b.subject.includes("Payment received")), "the family's payment email still goes");
  } finally { s.restore(); }
});

Deno.test("D4 print retry: a reused order that already has its items gets none added", async () => {
  const s = stub(invoice(), { existingOrder: { id: "ord-old", order_number: "ET-1999" }, existingItems: true });
  try {
    await applyPayment("inv-1", "manual", null);
    assertEquals(posts(s.calls, "/rest/v1/order_items").length, 0);
  } finally { s.restore(); }
});

Deno.test("D4 first run: nothing to reuse, so it creates exactly one order, its items and its job", async () => {
  const s = stub(invoice());
  try {
    await applyPayment("inv-1", "manual", null);
    assertEquals(posts(s.calls, "/rest/v1/orders").filter((c) => c.url.endsWith("/rest/v1/orders")).length, 1);
    assertEquals(posts(s.calls, "/rest/v1/order_items").length, 1);
    assertEquals(posts(s.calls, "/rest/v1/lulu_jobs").length, 1);
  } finally { s.restore(); }
});

Deno.test("D4 Starter retry: a delivery already queued for this family is REUSED and kicked by its own key", async () => {
  const s = stub(starterInvoice(), { existingDelivery: { id: "del-old", stripe_checkout_session_id: "esa_" + "f".repeat(64) } });
  try {
    const r = await applyPayment("inv-1", "manual", null);
    assertEquals(r.fulfilment, "queued");
    assertEquals(posts(s.calls, "/rest/v1/starter_deliveries").length, 0, "no second delivery");
    const lookup = s.calls.find((c) => c.method === "GET" && c.url.includes("/rest/v1/starter_deliveries?"))!;
    for (const f of ["email=eq.jane%40example.com", "stripe_checkout_session_id=like.esa_*", "band=eq.sprouts", "created_at=gte."]) {
      assertStringIncludes(lookup.url, f);
    }
    assertEquals(JSON.parse(invoicePatches(s.calls).at(-1)!.body).starter_delivery_id, "del-old");
    const kick = posts(s.calls, "/functions/v1/starter-fulfill")[0];
    assertEquals(JSON.parse(kick.body).session_id, "esa_" + "f".repeat(64));
  } finally { s.restore(); }
});

// ---------------------------------------------------------------- the alert says what exists
Deno.test("D4 alert: order made, then its items failed: says the order WAS created and is NOT queued", async () => {
  const s = stub(invoice(), { fail: (m, u) => m === "POST" && u.includes("/rest/v1/order_items") });
  try {
    const r = await applyPayment("inv-1", "manual", null);
    assertEquals(r.fulfilment, "failed");
    const alert = resendBodies(s.calls).find((b) => b.subject.startsWith("ESA fulfilment FAILED"))!;
    assertStringIncludes(alert.html, "Order ET-2001 WAS created");
    assertStringIncludes(alert.html, "was not queued");
    assertFalse(alert.html.includes("nothing was sent to print"), "the old always-wrong sentence is gone");
  } finally { s.restore(); }
});

Deno.test("D4 alert: the invoice write itself failed (both writes): the alert still goes, and says the job is queued", async () => {
  const s = stub(invoice(), { existingJob: true, fail: (m, u) => m === "PATCH" && u.includes("/esa_invoices?id=eq.") });
  try {
    const r = await applyPayment("inv-1", "manual", null);
    assertEquals(r.fulfilment, "failed");
    const alert = resendBodies(s.calls).find((b) => b.subject.startsWith("ESA fulfilment FAILED"));
    assert(alert, "the alert is sent even though marking the invoice failed also failed");
    assertStringIncludes(alert!.html, "WAS created for it and its Lulu print job is queued");
    assertStringIncludes(alert!.html, "Do NOT make another order");
  } finally { s.restore(); }
});

Deno.test("D4 alert: failure before anything was made says so", async () => {
  const s = stub(invoice(), { fail: (m, u) => m === "GET" && u.includes("/products?") });
  try {
    await applyPayment("inv-1", "manual", null);
    const alert = resendBodies(s.calls).find((b) => b.subject.startsWith("ESA fulfilment FAILED"))!;
    assertStringIncludes(alert.html, "Nothing was created for it yet");
  } finally { s.restore(); }
});

Deno.test("D4 lines: every case, plain wording, no em dashes, always names the retry", () => {
  const cases = [
    esaFailureLines({ order: null, luluJob: false, delivery: null, lookupFailed: true }, "ET-X-1"),
    esaFailureLines({ order: { id: "o", order_number: "ET-9" }, luluJob: true, delivery: null, lookupFailed: false }, "ET-X-1"),
    esaFailureLines({ order: { id: "o", order_number: "ET-9" }, luluJob: false, delivery: null, lookupFailed: false }, "ET-X-1"),
    esaFailureLines({ order: null, luluJob: false, delivery: { id: "d" }, lookupFailed: false }, "ET-X-1"),
    esaFailureLines({ order: null, luluJob: false, delivery: null, lookupFailed: false }, "ET-X-1"),
  ];
  assertStringIncludes(cases[0].join(" "), "could not check");
  assertStringIncludes(cases[1].join(" "), "will print");
  assertStringIncludes(cases[2].join(" "), "will not print yet");
  assertStringIncludes(cases[3].join(" "), "Starter delivery WAS queued");
  assertStringIncludes(cases[4].join(" "), "Nothing retries this automatically");
  for (const lines of cases) {
    const t = lines.join(" ");
    assertStringIncludes(t, "retry ESA fulfilment for ET-X-1");
    assertFalse(t.includes("—"), "no em dash");
  }
});
