// One box per ESA form submission (2026-11-18, Lane 2; Camila's yes via Lane 0). Brianne's Seedlings set and
// extra notebook (one form, paid 3 s apart) became two orders and two boxes. Stubs fetch; nothing leaves the test.
//   deno test --no-lock --allow-env --allow-net --allow-read supabase/functions/_shared/esa-one-box.test.ts
import { assert, assertEquals, assertFalse, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-test-key");
Deno.env.set("RESEND_API_KEY", "re_test");
const {
  applyPayment, boxOrderFields, ESA_SIBLING_MAX_WAIT_DAYS, familyHeldEmail, planEsaPrint, releaseHeldInvoices, shipAddressKey,
} = await import("./esa-fulfil.ts");
const { buildDeliveredEmail, buildShippedEmail } = await import("./order-messages.ts");

const SUB = "3cbe0000-0000-4000-8000-000000000001";
const ADDR = { line1: "12 Oak Ln", line2: "", city: "Conway", region: "AR", zip: "72032" };
// deno-lint-ignore no-explicit-any
type Inv = any;
function inv(over: Record<string, unknown> = {}): Inv {
  return {
    id: "inv-1", submission_id: SUB, invoice_number: "ET-AR-2026-001", is_test: false, state: "AR", invoice_date: "2026-10-26",
    parent_name: "Jane Doe", student_name: "Sam Doe", family_email: "jane@example.com", ship_to: null, ship_address: ADDR,
    phone: null, items: [{ sku: "ET-SDL-35-004", qty: 1, unit_cents: 26100, amount_cents: 26100 }], total_cents: 26100, fee_cents: 0,
    status: "paid", paid_at: "2026-11-05T02:24:22Z", paid_via: "founder_confirm", payment_id: null, fulfilment_status: "none",
    order_id: null, starter_delivery_id: null, created_at: "2026-10-26T14:10:52Z", reminder_sent_at: null, founder_alerted_at: null,
    paid_email_sent_at: null, ...over,
  };
}
const notebook = (over: Record<string, unknown> = {}) =>
  inv({ id: "inv-2", invoice_number: "ET-AR-2026-002", student_name: "Ada Doe", items: [{ sku: "ET-SDL-35-005", qty: 1, unit_cents: 3999, amount_cents: 3999 }], total_cents: 3999, ...over });

// ---------------------------------------------------------------- the plan (pure)
Deno.test("plan: first payment of a two-invoice box waits for the unpaid sibling", () => {
  assertEquals(planEsaPrint(inv(), [notebook({ status: "issued" })]), { kind: "hold", waitingOn: ["ET-AR-2026-002"] });
});

Deno.test("plan: the payment that completes the box ships both as one, keyed by the box's first invoice", () => {
  const p = planEsaPrint(notebook(), [inv({ fulfilment_status: "awaiting_siblings" })]);
  assertEquals(p, { kind: "ship", memberIds: ["inv-1", "inv-2"], groupKey: `${SUB}:ET-AR-2026-001`, shipsSeparately: [] });
});

Deno.test("plan: both paid at the same moment compute the SAME box key (so the index lets only one order through)", () => {
  const a = planEsaPrint(inv(), [notebook()]);
  const b = planEsaPrint(notebook(), [inv()]);
  assert(a.kind === "ship" && b.kind === "ship");
  assertEquals(a.groupKey, b.groupKey);
  assertEquals(a.memberIds, b.memberIds);
});

Deno.test("plan: another band never shares a box (the print job refuses mixed bands), and is named as separate", () => {
  const sprouts = inv({ id: "inv-3", invoice_number: "ET-AR-2026-003", items: [{ sku: "ET-SPR-K2-004", qty: 1, unit_cents: 26100, amount_cents: 26100 }], status: "issued" });
  assertEquals(planEsaPrint(inv(), [sprouts]), { kind: "ship", memberIds: ["inv-1"], groupKey: `${SUB}:ET-AR-2026-001`, shipsSeparately: ["ET-AR-2026-003"] });
});

Deno.test("plan: another address is another box", () => {
  const p = planEsaPrint(inv(), [notebook({ status: "issued", ship_address: { ...ADDR, line1: "99 Elm St" } })]);
  assert(p.kind === "ship");
  assertEquals(p.shipsSeparately, ["ET-AR-2026-002"]);
});

Deno.test("plan: void, refunded, test and Starter siblings are ignored", () => {
  for (const s of [
    notebook({ status: "void" }),
    notebook({ status: "refunded" }),
    notebook({ status: "issued", is_test: true }),
    notebook({ status: "issued", items: [{ sku: "ET-SDL-35-003", qty: 1, unit_cents: 3900, amount_cents: 3900 }] }),
  ]) {
    assertEquals(planEsaPrint(inv(), [s]), { kind: "ship", memberIds: ["inv-1"], groupKey: `${SUB}:ET-AR-2026-001`, shipsSeparately: [] }, s.status);
  }
});

Deno.test("plan: a sibling that already has its own box ships separately, nothing waits for it", () => {
  const p = planEsaPrint(notebook(), [inv({ status: "fulfilled", order_id: "ord-old" })]);
  assertEquals(p, { kind: "ship", memberIds: ["inv-2"], groupKey: `${SUB}:ET-AR-2026-002`, shipsSeparately: ["ET-AR-2026-001"] });
});

Deno.test("plan: release ships what is paid and names the unpaid one as coming separately", () => {
  const p = planEsaPrint(inv(), [notebook({ status: "issued" })], { release: true });
  assertEquals(p, { kind: "ship", memberIds: ["inv-1"], groupKey: `${SUB}:ET-AR-2026-001`, shipsSeparately: ["ET-AR-2026-002"] });
});

Deno.test("address key: case, spaces, punctuation and ZIP+4 do not split a box", () => {
  assertEquals(shipAddressKey(ADDR), shipAddressKey({ line1: " 12  OAK LN. ", line2: "", city: "conway", region: "ar", zip: "72032-1234" }));
  assert(shipAddressKey(ADDR) !== shipAddressKey({ ...ADDR, line2: "Apt 2" }));
  assertEquals(shipAddressKey(null), null);
});

Deno.test("box fields: the set leads even when the notebook invoice sorts first; totals add up", () => {
  const nbFirst = notebook({ invoice_number: "ET-AR-2026-000" });
  const f = boxOrderFields([nbFirst, inv()]);
  assertEquals(f.lookup_key, "seedlings_print_set");
  assertEquals(f.product_label, "Seedlings Printed Curriculum Set + Seedlings Extra Student Notebook");
  assertEquals(f.amount_total_cents, 30099);
  assertEquals(f.quantity, 2);
  assertEquals(f.lines.map((l: { sku: string }) => l.sku), ["seedlings_print_set", "seedlings_nb_print"]);
});

// ---------------------------------------------------------------- copy
Deno.test("held email: says what it waits for, the max wait, and has no em dash", () => {
  const m = familyHeldEmail(inv(), ["ET-AR-2026-002"]);
  assertEquals(m.subject, "Payment received: your Eden's Table books will ship together");
  assertStringIncludes(m.html, "ET-AR-2026-002");
  assertStringIncludes(m.html, "one box");
  assertStringIncludes(m.html, `${ESA_SIBLING_MAX_WAIT_DAYS} days`);
  assertFalse(/[—–]/.test(m.subject + m.html));
  assertStringIncludes(familyHeldEmail(inv(), ["A", "B"]).html, "<b>A</b> and <b>B</b>");
});

Deno.test("shipped + delivered: a box that is only part of the order says the rest is coming; others unchanged", () => {
  const order = { id: "o", order_number: "ET-2001", customer_email: "j@example.com", customer_phone: null, shipping_name: "Jane Doe",
    product_label: "Seedlings Printed Curriculum Set", amount_total_cents: 26100, currency: "usd", sms_consent: false, status: "shipped",
    lookup_key: "seedlings_print_set", shipping_carrier: "USPS", tracking_number: "T1", tracking_url: null };
  const part = { ...order, raw: { source: "esa", esa_ships_separately: ["ET-AR-2026-003"] } };
  for (const build of [buildShippedEmail, buildDeliveredEmail]) {
    assertStringIncludes(build(part as never).html, "This box is one part of your order.");
    assertFalse(build(order as never).html.includes("one part of your order"));
    assertFalse(build({ ...order, raw: { source: "esa", esa_ships_separately: [] } } as never).html.includes("one part of your order"));
  }
});

// ---------------------------------------------------------------- the flow, with fetch stubbed
type Call = { method: string; url: string; body: string };
interface World {
  invoices: Inv[];
  orderConflict?: boolean; // the order insert hits orders_esa_group_key_uniq (a sibling's payment made the box)
}
function stub(w: World) {
  const calls: Call[] = [];
  const orders: { id: string; order_number: string; raw: Record<string, unknown> }[] = [];
  if (w.orderConflict) orders.push({ id: "ord-other", order_number: "ET-2100", raw: { esa_group_key: `${SUB}:ET-AR-2026-001` } });
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = decodeURIComponent(String(input));
    const method = init?.method ?? "GET";
    calls.push({ method, url, body: String(init?.body ?? "") });
    const ok = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
    if (url.includes("/rpc/esa_mark_invoice_paid")) return ok(true);
    if (url.includes("/esa_invoices?") && method === "GET") {
      const id = url.match(/id=eq\.([^&]+)/)?.[1];
      if (url.includes("fulfilment_status=eq.awaiting_siblings")) return ok(w.invoices.filter((i) => i.fulfilment_status === "awaiting_siblings" && !i.order_id && i.status === "paid"));
      if (url.includes("submission_id=eq.")) return ok(w.invoices.filter((i) => i.submission_id === SUB && i.id !== url.match(/id=neq\.([^&]+)/)?.[1]));
      if (id) return ok(w.invoices.filter((i) => i.id === id));
      return ok([]);
    }
    if (url.includes("/esa_invoices?id=eq.") && method === "PATCH") {
      const id = url.match(/id=eq\.([^&]+)/)![1];
      const row = w.invoices.find((i) => i.id === id);
      if (row && !(url.includes("order_id=is.null") && row.order_id)) Object.assign(row, JSON.parse(String(init?.body)));
      return new Response(null, { status: 204 });
    }
    if (url.includes("/products?")) return ok([{ id: "p-set", sku: "seedlings_print_set", fulfillment: "lulu" }, { id: "p-nb", sku: "seedlings_nb_print", fulfillment: "lulu" }]);
    if (url.includes("/rest/v1/orders?") && method === "GET") {
      const key = url.match(/esa_group_key=eq\.([^&]+)/)?.[1];
      if (key) return ok(orders.filter((o) => o.raw.esa_group_key === key));
      return ok([]); // no order made by THIS invoice yet
    }
    if (url.endsWith("/rest/v1/orders") && method === "POST") {
      const body = JSON.parse(String(init?.body));
      if (orders.some((o) => o.raw.esa_group_key && o.raw.esa_group_key === body.raw.esa_group_key)) {
        return new Response(JSON.stringify({ code: "23505", message: "duplicate key value violates unique constraint \"orders_esa_group_key_uniq\"" }), { status: 409 });
      }
      const o = { id: "ord-1", order_number: "ET-2001", raw: body.raw };
      orders.push(o);
      return ok([o]);
    }
    return new Response("", { status: 200 });
  }) as typeof fetch;
  return { calls, orders, restore: () => { globalThis.fetch = original; } };
}
const posts = (calls: Call[], frag: string) => calls.filter((c) => c.method === "POST" && c.url.includes(frag));
const orderPosts = (calls: Call[]) => calls.filter((c) => c.method === "POST" && c.url.endsWith("/rest/v1/orders"));
const emails = (calls: Call[]) => posts(calls, "api.resend.com/emails").map((c) => JSON.parse(c.body) as { subject: string; html: string });

Deno.test("flow: first payment is HELD (no order, no print job) and the family is told why", async () => {
  const w = { invoices: [inv(), notebook({ status: "issued" })] };
  const s = stub(w);
  try {
    const r = await applyPayment("inv-1", "founder_confirm", null);
    assertEquals(r.fulfilment, "awaiting_siblings");
    assertEquals(orderPosts(s.calls).length, 0);
    assertEquals(posts(s.calls, "/rest/v1/lulu_jobs").length, 0);
    assertEquals(posts(s.calls, "/functions/v1/lulu-submit").length, 0);
    const hold = s.calls.find((c) => c.method === "PATCH" && c.body.includes("awaiting_siblings"))!;
    assertStringIncludes(hold.url, "order_id=is.null");
    assertEquals(emails(s.calls).map((e) => e.subject), ["Payment received: your Eden's Table books will ship together"]);
    assert(w.invoices[0].paid_email_sent_at, "the held email is recorded, so no second payment email later");
  } finally { s.restore(); }
});

Deno.test("flow: the second payment makes ONE order with both invoices' items, one job, one kick", async () => {
  const w = { invoices: [inv({ fulfilment_status: "awaiting_siblings", paid_email_sent_at: "2026-11-05T02:24:23Z" }), notebook()] };
  const s = stub(w);
  try {
    const r = await applyPayment("inv-2", "founder_confirm", null);
    assertEquals(r.fulfilment, "print_queued");
    assertEquals(orderPosts(s.calls).length, 1);
    const order = JSON.parse(orderPosts(s.calls)[0].body);
    assertEquals(order.lookup_key, "seedlings_print_set");
    assertEquals(order.amount_total_cents, 30099);
    assertEquals(order.raw.invoice_numbers, ["ET-AR-2026-001", "ET-AR-2026-002"]);
    assertEquals(order.raw.invoice_number, "ET-AR-2026-001");
    assertEquals(order.raw.esa_group_key, `${SUB}:ET-AR-2026-001`);
    assertFalse("esa_ships_separately" in order.raw);
    const items = JSON.parse(posts(s.calls, "/rest/v1/order_items")[0].body);
    assertEquals(items.map((i: { product_id: string }) => i.product_id), ["p-set", "p-nb"]);
    assertEquals(posts(s.calls, "/rest/v1/lulu_jobs").length, 1);
    assertEquals(posts(s.calls, "/functions/v1/lulu-submit").length, 1);
    assertEquals(w.invoices.map((i: Inv) => i.order_id), ["ord-1", "ord-1"], "both invoices point at the one order");
    assertEquals(w.invoices.map((i: Inv) => i.fulfilment_status), ["print_queued", "print_queued"]);
    const subjects = emails(s.calls).map((e) => e.subject);
    assertEquals(subjects, ["Payment received: your Eden's Table books are going to print"], "only the invoice not yet told gets an email");
  } finally { s.restore(); }
});

Deno.test("flow: a payment landing at the same moment uses the other run's box: no second order, items or job", async () => {
  const w = { invoices: [inv(), notebook()], orderConflict: true };
  const s = stub(w);
  try {
    const r = await applyPayment("inv-2", "founder_confirm", null);
    assertEquals(r.fulfilment, "print_queued");
    assertEquals(posts(s.calls, "/rest/v1/order_items").length, 0);
    assertEquals(posts(s.calls, "/rest/v1/lulu_jobs").length, 0);
    assertEquals(posts(s.calls, "/functions/v1/lulu-submit").length, 0);
    assertEquals(w.invoices.find((i: Inv) => i.id === "inv-2").order_id, "ord-other");
  } finally { s.restore(); }
});

Deno.test("daily: a held invoice past the wait ships on its own, marked as part of the order; the founder is told", async () => {
  const paid = new Date(Date.now() - (ESA_SIBLING_MAX_WAIT_DAYS + 1) * 86400000).toISOString();
  const w = { invoices: [inv({ fulfilment_status: "awaiting_siblings", paid_at: paid, paid_email_sent_at: paid }), notebook({ status: "issued" })] };
  const s = stub(w);
  try {
    const r = await releaseHeldInvoices();
    assertEquals(r, { checked: 1, shipped: ["ET-AR-2026-001"], releasedAlone: ["ET-AR-2026-001"] });
    const order = JSON.parse(orderPosts(s.calls)[0].body);
    assertEquals(order.raw.esa_ships_separately, ["ET-AR-2026-002"]);
    assertEquals(order.amount_total_cents, 26100);
    assert(emails(s.calls).some((e) => e.subject.startsWith("ESA: 1 held invoice sent to print")));
  } finally { s.restore(); }
});

Deno.test("daily: a held invoice still inside the wait keeps waiting (no order, no second family email)", async () => {
  const paid = new Date(Date.now() - 86400000).toISOString();
  const w = { invoices: [inv({ fulfilment_status: "awaiting_siblings", paid_at: paid, paid_email_sent_at: paid }), notebook({ status: "issued" })] };
  const s = stub(w);
  try {
    const r = await releaseHeldInvoices();
    assertEquals(r, { checked: 1, shipped: [], releasedAlone: [] });
    assertEquals(orderPosts(s.calls).length, 0);
    assertEquals(emails(s.calls).length, 0);
  } finally { s.restore(); }
});

Deno.test("daily: a held invoice whose unpaid sibling was voided ships right away (not counted as released alone)", async () => {
  const paid = new Date(Date.now() - 86400000).toISOString();
  const w = { invoices: [inv({ fulfilment_status: "awaiting_siblings", paid_at: paid, paid_email_sent_at: paid }), notebook({ status: "void" })] };
  const s = stub(w);
  try {
    const r = await releaseHeldInvoices();
    assertEquals(r, { checked: 1, shipped: ["ET-AR-2026-001"], releasedAlone: [] });
    assertFalse("esa_ships_separately" in JSON.parse(orderPosts(s.calls)[0].body).raw);
  } finally { s.restore(); }
});
