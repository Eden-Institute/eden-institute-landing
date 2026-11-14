// ESA payment intake, E1 + E2 (2026-11-13, Lane 2 deep audit area 4; founder go "Yes, build + ship"):
// a notice is finished only once the founder is told; an unfinished one is picked up again by the next
// run and reuses its Confirm links; an auto-applied one whose fulfilment never started is started.
// Stubs fetch; nothing leaves the test.
//   deno test --no-lock --allow-env --allow-net --allow-read supabase/functions/_shared/esa-intake.test.ts
import { assert, assertEquals, assertFalse, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-test-key");
Deno.env.set("RESEND_API_KEY", "re_test");
const { intake } = await import("./esa-intake.ts");
const { intakeResumeStep } = await import("./esa-payment-intake.ts");
const { retryFulfilment } = await import("./esa-fulfil.ts");

type Call = { method: string; url: string; body: string };

function invoice(over: Record<string, unknown> = {}) {
  return {
    id: "inv-1", invoice_number: "ET-AZ-2026-001", is_test: false, state: "AZ", invoice_date: "2026-11-01",
    parent_name: "Jane Doe", student_name: "Sam Doe", family_email: "jane@example.com",
    ship_to: "1 Main St\nMesa, AZ 85201", ship_address: { line1: "1 Main St", line2: "", city: "Mesa", region: "AZ", zip: "85201" },
    phone: null, items: [{ sku: "ET-SPR-K2-004", qty: 1, unit_cents: 26100, amount_cents: 26100 }],
    total_cents: 26633, fee_cents: 533, status: "issued", paid_at: null, paid_via: null, payment_id: null,
    fulfilment_status: "none", order_id: null, starter_delivery_id: null, created_at: "2026-11-01T00:00:00Z",
    reminder_sent_at: null, founder_alerted_at: null, ...over,
  };
}

interface World {
  prior?: Record<string, unknown> | null;
  open?: Record<string, unknown>[];
  inv?: Record<string, unknown>;
  autoReady?: boolean;
  markPaid?: boolean;
  openTokens?: { token: string }[];
  fail?: (method: string, url: string) => boolean;
}

function stub(w: World = {}) {
  const calls: Call[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ method, url, body: String(init?.body ?? "") });
    const ok = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
    if (w.fail?.(method, url)) return new Response("boom", { status: 500 });
    if (url.includes("api.resend.com/emails")) return ok({ id: "re-1" });
    if (url.includes("/rest/v1/esa_payments?gmail_msg_id=")) return ok(w.prior ? [w.prior] : []);
    if (url.endsWith("/rest/v1/esa_payments") && method === "POST") return ok([{ id: "pay-new" }]);
    if (url.includes("/rest/v1/esa_invoices?status=eq.issued")) return ok(w.open ?? []);
    if (url.includes("/rpc/esa_auto_confirm_ready")) return ok(w.autoReady ?? false);
    if (url.includes("/rpc/esa_mark_invoice_paid")) return ok(w.markPaid ?? true);
    if (url.includes("/esa_invoices?id=eq.") && method === "GET") return ok([w.inv ?? invoice()]);
    if (url.includes("/rest/v1/esa_payment_confirmations?") && method === "GET") return ok(w.openTokens ?? []);
    if (url.endsWith("/rest/v1/esa_payment_confirmations") && method === "POST") return ok([{ token: "tok-new" }]);
    if (url.includes("/products?")) return ok([{ id: "p-set", sku: "sprouts_print_set", fulfillment: "lulu" }]);
    if (url.includes("/rest/v1/orders?") && method === "GET") return ok([]);
    if (url.endsWith("/rest/v1/orders") && method === "POST") return ok([{ id: "ord-1", order_number: "ET-2001" }]);
    if (url.includes("/rest/v1/order_items?") && method === "GET") return ok([]);
    return new Response("", { status: 200 });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

const posts = (c: Call[], frag: string) => c.filter((x) => x.method === "POST" && x.url.includes(frag));
const patches = (c: Call[], frag: string) => c.filter((x) => x.method === "PATCH" && x.url.includes(frag));
const emails = (c: Call[]) => posts(c, "api.resend.com/emails").map((x) => JSON.parse(x.body) as { subject: string; html: string; to: string[] });
const stamped = (c: Call[]) => patches(c, "/esa_payments?id=eq.").some((x) => x.body.includes("founder_notified_at"));

const AMOUNT_ONLY = "A payment of $266.33 has been issued to your account.";
const MATCHED = "Payment for invoice ET-AZ-2026-001 of $266.33 has been issued.";
const notice = (body: string) => ({ gmail_msg_id: "gm-1", from: "noreply@classwallet.com", subject: "Payment issued", received_at: "2026-11-13T15:00:00Z", body });

// ---------------------------------------------------------------- the step decision
Deno.test("E1 step: new / resume / finish_applied / done", () => {
  assertEquals(intakeResumeStep(null), "new");
  assertEquals(intakeResumeStep({ applied: false, founder_notified_at: null }), "resume");
  assertEquals(intakeResumeStep({ applied: true, founder_notified_at: null }), "finish_applied");
  assertEquals(intakeResumeStep({ applied: false, founder_notified_at: "2026-11-13T15:00:00Z" }), "done");
  assertEquals(intakeResumeStep({ applied: true, founder_notified_at: "2026-11-13T15:00:00Z" }), "done");
});

// ---------------------------------------------------------------- done notices
Deno.test("E1 done: a notice the founder was told about is a duplicate, and nothing is written or sent", async () => {
  const s = stub({ prior: { id: "pay-1", match_status: "amount_only", applied: false, founder_notified_at: "2026-11-12T03:00:00Z", invoice_id: "inv-1" } });
  try {
    const r = await intake(notice(AMOUNT_ONLY));
    assertEquals(r.status, 200);
    assertEquals(r.body.duplicate, true);
    assertEquals(s.calls.filter((c) => c.method !== "GET").length, 0, "no writes, no email");
  } finally { s.restore(); }
});

// ---------------------------------------------------------------- resume
Deno.test("E1 resume: saved but never told -> matched again, the open Confirm link REUSED, email sent, stamped", async () => {
  const s = stub({
    prior: { id: "pay-1", match_status: "amount_only", applied: false, founder_notified_at: null, invoice_id: "inv-1" },
    open: [invoice()],
    openTokens: [{ token: "tok-old" }],
  });
  try {
    const r = await intake(notice(AMOUNT_ONLY));
    assertEquals(r.status, 200);
    assertEquals(r.body.resumed, true);
    assertEquals(r.body.awaiting_confirm, ["ET-AZ-2026-001"]);
    assertEquals(posts(s.calls, "/rest/v1/esa_payments").filter((c) => c.url.endsWith("/esa_payments")).length, 0, "no second payment row");
    assertEquals(posts(s.calls, "/rest/v1/esa_payment_confirmations").length, 0, "no second Confirm link");
    const mail = emails(s.calls);
    assertEquals(mail.length, 1);
    assertStringIncludes(mail[0].html, "t=tok-old");
    assert(stamped(s.calls), "founder_notified_at stamped after the email went");
  } finally { s.restore(); }
});

Deno.test("E1 resume: no open link left (expired or never made) -> one new link", async () => {
  const s = stub({ prior: { id: "pay-1", match_status: "amount_only", applied: false, founder_notified_at: null, invoice_id: null }, open: [invoice()] });
  try {
    await intake(notice(AMOUNT_ONLY));
    assertEquals(posts(s.calls, "/rest/v1/esa_payment_confirmations").length, 1);
    assertStringIncludes(emails(s.calls)[0].html, "t=tok-new");
    const look = s.calls.find((c) => c.method === "GET" && c.url.includes("esa_payment_confirmations?"))!;
    assertStringIncludes(look.url, "used_at=is.null");
    assertStringIncludes(look.url, "expires_at=gt.");
  } finally { s.restore(); }
});

Deno.test("E1 resume: the confirm email fails -> NOT stamped, so the next run tries again", async () => {
  const s = stub({ prior: null, open: [invoice()], fail: (_m, u) => u.includes("api.resend.com") });
  try {
    const r = await intake(notice(AMOUNT_ONLY));
    assertEquals(r.status, 200);
    assertFalse(stamped(s.calls));
  } finally { s.restore(); }
});

// ---------------------------------------------------------------- the stamp never throws
Deno.test("E1 stamp: a failed founder_notified_at write after full success is NOT an intake failure", async () => {
  const s = stub({ prior: null, open: [], fail: (m, u) => m === "PATCH" && u.includes("/esa_payments?id=eq.") });
  try {
    const r = await intake(notice("Your ClassWallet statement is ready, $12.00"));
    assertEquals(r.status, 200, "no throw, so no false 'could not be processed' alert");
    assertEquals(r.body.match_status, "unmatched");
    assertEquals(emails(s.calls).length, 1);
  } finally { s.restore(); }
});

Deno.test("E1 unmatched: the 'matched nothing' alert is stamped once it goes, so the nightly re-send is quiet", async () => {
  const s = stub({ prior: null, open: [] });
  try {
    await intake(notice("Your ClassWallet statement is ready, $12.00"));
    assertStringIncludes(emails(s.calls)[0].subject, "did not match any invoice");
    assert(stamped(s.calls));
  } finally { s.restore(); }
});

// ---------------------------------------------------------------- auto path
Deno.test("E1 auto: matched + ready applies, fulfils and tells the founder", async () => {
  const s = stub({ prior: null, open: [invoice()], autoReady: true, inv: invoice({ status: "paid", paid_via: "auto" }) });
  try {
    const r = await intake(notice(MATCHED));
    assertEquals(r.body.applied, true);
    assertEquals(r.body.fulfilment, "print_queued");
    assert(emails(s.calls).some((m) => m.subject.startsWith("ESA payment applied: ET-AZ-2026-001")));
    assert(stamped(s.calls));
  } finally { s.restore(); }
});

Deno.test("E1 auto: an invoice already paid another way is reported as NOT applied, not as applied", async () => {
  const s = stub({ prior: null, open: [invoice()], autoReady: true, markPaid: false, inv: invoice({ status: "fulfilled", fulfilment_status: "print_queued" }) });
  try {
    const r = await intake(notice(MATCHED));
    assertEquals(r.body.applied, false);
    const subj = emails(s.calls).map((m) => m.subject);
    assert(subj.some((x) => x.startsWith("ESA payment NOT applied")), subj.join(" | "));
    assertFalse(subj.some((x) => x.startsWith("ESA payment applied")));
  } finally { s.restore(); }
});

// ---------------------------------------------------------------- finish_applied
Deno.test("E1 finish: auto-applied, then the run stopped before fulfilment -> fulfilment STARTED now", async () => {
  const s = stub({
    prior: { id: "pay-1", match_status: "matched", applied: true, founder_notified_at: null, invoice_id: "inv-1" },
    inv: invoice({ status: "paid", paid_via: "auto", fulfilment_status: "none" }),
  });
  try {
    const r = await intake(notice(MATCHED));
    assertEquals(r.body.resumed, true);
    assertEquals(r.body.fulfilment, "print_queued");
    assertEquals(posts(s.calls, "/rpc/esa_mark_invoice_paid").length, 0, "not marked paid again");
    assertEquals(posts(s.calls, "/rest/v1/orders").filter((c) => c.url.endsWith("/orders")).length, 1, "one order made");
    assert(emails(s.calls).some((m) => m.html.includes("stopped before fulfilment started")));
    assert(stamped(s.calls));
  } finally { s.restore(); }
});

Deno.test("E1 finish: she confirmed it herself (founder_confirm) -> only the stamp, no email, no fulfilment", async () => {
  const s = stub({
    prior: { id: "pay-1", match_status: "amount_only", applied: true, founder_notified_at: null, invoice_id: "inv-1" },
    inv: invoice({ status: "fulfilled", paid_via: "founder_confirm", fulfilment_status: "print_queued", order_id: "ord-9" }),
  });
  try {
    const r = await intake(notice(AMOUNT_ONLY));
    assertEquals(r.body.duplicate, true);
    assertEquals(emails(s.calls).length, 0);
    assertEquals(posts(s.calls, "/rest/v1/orders").length, 0);
    assert(stamped(s.calls));
  } finally { s.restore(); }
});

// ---------------------------------------------------------------- E2 retry
Deno.test("E2 retry: a PAID invoice whose fulfilment failed is fulfilled (one order, the family email)", async () => {
  const s = stub({ inv: invoice({ status: "paid", paid_via: "founder_confirm", fulfilment_status: "failed" }) });
  try {
    const r = await retryFulfilment("inv-1");
    assertEquals(r.changed, true);
    assertEquals(r.fulfilment, "print_queued");
    assertEquals(posts(s.calls, "/rpc/esa_mark_invoice_paid").length, 0, "retry never re-marks paid");
    assert(emails(s.calls).some((m) => m.subject.includes("Payment received")));
  } finally { s.restore(); }
});

Deno.test("E2 retry: refuses an unpaid invoice and one whose fulfilment already went through", async () => {
  for (const over of [{ status: "issued" }, { status: "fulfilled", fulfilment_status: "print_queued" }, { status: "paid", fulfilment_status: "queued" }]) {
    const s = stub({ inv: invoice(over) });
    try {
      const r = await retryFulfilment("inv-1");
      assertEquals(r.changed, false, JSON.stringify(over));
      assertStringIncludes(r.note ?? "", "nothing to retry");
      assertEquals(s.calls.filter((c) => c.method !== "GET").length, 0, "nothing written or sent");
    } finally { s.restore(); }
  }
});

Deno.test("E1 read-back: marked paid, then the invoice cannot be read -> marked failed + founder alert, no throw", async () => {
  const { applyPayment } = await import("./esa-fulfil.ts");
  const s = stub({ fail: (m, u) => m === "GET" && u.includes("/esa_invoices?id=eq.") });
  try {
    const r = await applyPayment("inv-1", "auto", "pay-1");
    assertEquals(r.changed, true);
    assertEquals(r.fulfilment, "failed");
    const p = patches(s.calls, "/esa_invoices?id=eq.inv-1").map((c) => JSON.parse(c.body));
    assert(p.some((b) => b.fulfilment_status === "failed"));
    const mail = emails(s.calls);
    assertEquals(mail.length, 1);
    assertStringIncludes(mail[0].subject, "ESA fulfilment FAILED");
    assertStringIncludes(mail[0].html, "retry ESA fulfilment for invoice inv-1");
  } finally { s.restore(); }
});
