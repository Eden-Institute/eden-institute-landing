// Online Year OY3 (punch #472): the webhook dispatch with a fake PostgREST client. Record the sale
// first, grant once, renew without losing days, flag an out-of-area card once, throw when Stripe
// should redeliver, and close licenses on a full refund or a dispute.
import { assert, assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  closeOnlineYearLicenses,
  handleOnlineYearPurchase,
  noteOnlineYearPartialRefund,
  type OnlineYearGrantDeps,
  type OnlineYearSession,
} from "./online-year-webhook.ts";
import { buildOnlineYearMetadata } from "./online-year-checkout.ts";

type Row = Record<string, unknown>;
type Rows = Record<string, Row[]>;

const PURCHASE = new Date("2026-12-01T15:30:00.000Z");
const CREATED = PURCHASE.getTime() / 1000;

function fakeDb(rows: Rows, opts: { rpcError?: string; failTable?: string } = {}) {
  const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
  const updates: { table: string; patch: Row; matched: number }[] = [];
  const from = (table: string) => {
    let data = [...(rows[table] ?? [])];
    let patch: Row | null = null;
    const fail = table === opts.failTable;
    const finish = () => {
      if (fail) return { data: null, error: { message: "boom" } };
      if (patch) {
        for (const r of data) Object.assign(r, patch);
        updates.push({ table, patch, matched: data.length });
      }
      return { data, error: null };
    };
    const q = {
      select: () => q,
      update: (p: Row) => { patch = p; return q; },
      eq: (c: string, v: unknown) => { data = data.filter((r) => r[c] === v); return q; },
      ilike: (c: string, v: string) => { const want = v.replace(/\\(.)/g, "$1").toLowerCase(); data = data.filter((r) => String(r[c]).toLowerCase() === want); return q; },
      maybeSingle: () => Promise.resolve(fail ? finish() : { data: data[0] ?? null, error: null }),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(finish()).then(res, rej),
    };
    return q;
  };
  const rpc = (fn: string, args: Record<string, unknown>) => {
    rpcCalls.push({ fn, args });
    if (opts.rpcError) return Promise.resolve({ data: null, error: { message: opts.rpcError } });
    const lic = args.p_licenses as Row[];
    return Promise.resolve({ data: { status: "ok", parent_id: "p1", inserted: lic.length, already: 0, licenses: [] }, error: null });
  };
  return { db: { from, rpc }, rpcCalls, updates };
}

function session(over: Partial<OnlineYearSession> = {}, children: [string, "first_child" | "sibling"][] = [["Ava", "first_child"], ["Ben", "sibling"]]): OnlineYearSession {
  return {
    id: "cs_test_oy3",
    payment_status: "paid",
    metadata: {
      ...buildOnlineYearMetadata({ band: "sprouts", children: children.map(([name, kind]) => ({ name, kind })), lines: [] }),
      oy_country: "US",
      email: "mom@example.com",
    },
    customer_details: { email: "Mom@Example.com", name: "Jane Doe", address: { country: "US" } },
    ...over,
  };
}

function deps(db: unknown, over: Partial<OnlineYearGrantDeps> = {}) {
  const recorded: [string, string][] = [];
  const alerts: { subject: string; text: string }[] = [];
  const after: string[] = [];
  const d: OnlineYearGrantDeps = {
    db,
    recordOrder: (k, l) => { recorded.push([k, l]); return Promise.resolve(); },
    cardCountry: () => Promise.resolve("US"),
    notifyFounder: (subject, text) => { alerts.push({ subject, text }); return Promise.resolve(); },
    afterOrder: (id) => { after.push(id); return Promise.resolve(); },
    log: () => {},
    ...over,
  };
  return { d, recorded, alerts, after };
}

const ORDERS: Row[] = [{ id: "o-new", order_number: "ET-1100", stripe_checkout_session_id: "cs_test_oy3" }];

Deno.test("unpaid: nothing recorded, nothing granted", async () => {
  const f = fakeDb({ orders: ORDERS });
  const x = deps(f.db);
  const out = await handleOnlineYearPurchase(session({ payment_status: "unpaid" }), CREATED, x.d);
  assertEquals(out, { status: "unpaid" });
  assertEquals(x.recorded.length, 0);
  assertEquals(f.rpcCalls.length, 0);
});

Deno.test("a new family: the sale is recorded first, then one RPC grants both children from the purchase date", async () => {
  const f = fakeDb({ orders: ORDERS });
  const x = deps(f.db);
  const out = await handleOnlineYearPurchase(session(), CREATED, x.d);
  assertEquals(out, { status: "granted", orderId: "o-new", inserted: 2, already: 0, flagged: 0 });
  assertEquals(x.recorded, [["online_year_sprouts", "Eden's Table Online Year: Sprouts (K-2), first child + 1 sibling"]]);
  assertEquals(x.after, ["o-new"]);
  assertEquals(f.rpcCalls.length, 1);
  const a = f.rpcCalls[0];
  assertEquals(a.fn, "online_year_grant_purchase");
  assertEquals(a.args.p_order_id, "o-new");
  assertEquals(a.args.p_email, "mom@example.com");
  assertEquals(a.args.p_license_name, "Jane Doe");
  assertEquals(a.args.p_band, "sprouts");
  assertEquals(a.args.p_purchased_at, "2026-12-01T15:30:00.000Z");
  assertEquals(a.args.p_licenses, [
    { child_name: "Ava", kind: "first_child", starts_at: "2026-12-01T15:30:00.000Z", ends_at: "2027-12-01T15:30:00.000Z", renews_license_id: null },
    { child_name: "Ben", kind: "sibling", starts_at: "2026-12-01T15:30:00.000Z", ends_at: "2027-12-01T15:30:00.000Z", renews_license_id: null },
  ]);
  assertEquals(x.alerts, []); // US billing + US card: no flag
});

Deno.test("early renewal: the planned start is her live year's end, found by email in any case", async () => {
  const f = fakeDb({
    orders: ORDERS,
    online_year_parents: [{ id: "p1", email: "mom@example.com" }],
    online_year_licenses: [
      { id: "L-old", parent_id: "p1", band: "sprouts", child_name: "Ava", status: "active", ends_at: "2027-03-01T10:00:00+00:00", order_id: "o-old", renews_license_id: null },
      { id: "L-other-band", parent_id: "p1", band: "seedlings", child_name: "Ava", status: "active", ends_at: "2027-09-01T10:00:00+00:00", order_id: "o-x", renews_license_id: null },
    ],
  });
  const x = deps(f.db);
  await handleOnlineYearPurchase(session({}, [["Ava", "first_child"]]), CREATED, x.d);
  assertEquals(f.rpcCalls[0].args.p_licenses, [
    { child_name: "Ava", kind: "first_child", starts_at: "2027-03-01T10:00:00.000Z", ends_at: "2028-03-01T10:00:00.000Z", renews_license_id: "L-old" },
  ]);
});

Deno.test("redelivered event: the order already holds every license, so no RPC and no second alert", async () => {
  const f = fakeDb({
    orders: ORDERS,
    online_year_parents: [{ id: "p1", email: "mom@example.com" }],
    online_year_licenses: [
      { id: "N1", parent_id: "p1", band: "sprouts", child_name: "Ava", status: "active", ends_at: "2027-12-01T15:30:00+00:00", order_id: "o-new", renews_license_id: null },
      { id: "N2", parent_id: "p1", band: "sprouts", child_name: "Ben", status: "active", ends_at: "2027-12-01T15:30:00+00:00", order_id: "o-new", renews_license_id: null },
    ],
  });
  const x = deps(f.db, { cardCountry: () => Promise.resolve("BR") });
  const out = await handleOnlineYearPurchase(session(), CREATED, x.d);
  assertEquals(out, { status: "already", orderId: "o-new", already: 2 });
  assertEquals(f.rpcCalls.length, 0);
  assertEquals(x.alerts, []);
});

Deno.test("out-of-area card: granted anyway, and one founder alert naming the order", async () => {
  const f = fakeDb({ orders: ORDERS });
  const x = deps(f.db, { cardCountry: () => Promise.resolve("BR") });
  const out = await handleOnlineYearPurchase(session(), CREATED, x.d);
  assertEquals(out.status, "granted");
  assert(out.status === "granted" && out.flagged === 1);
  assertEquals(x.alerts.length, 1);
  assertEquals(x.alerts[0].subject, "Online Year order ET-1100 paid from outside the U.S., Canada and Australia");
  assert(x.alerts[0].text.includes("the card is from BR"));
  assert(x.alerts[0].text.includes("Country she picked on our page: US"));
});

Deno.test("out-of-area billing address on the E2E twin: the alert says TEST", async () => {
  const f = fakeDb({ orders: ORDERS });
  const x = deps(f.db, { test: true });
  await handleOnlineYearPurchase(session({ customer_details: { email: "mom@example.com", address: { country: "GB" } } }), CREATED, x.d);
  assertEquals(x.alerts.length, 1);
  assert(x.alerts[0].subject.startsWith("TEST (E2E): Online Year order ET-1100"));
  assert(x.alerts[0].text.includes("the billing address is in GB"));
});

Deno.test("throws so Stripe redelivers: the RPC fails (a stale plan), or the order cannot be re-read", async () => {
  const stale = fakeDb({ orders: ORDERS }, { rpcError: "online_year_grant_purchase: stale plan for Ava" });
  await assertRejects(() => handleOnlineYearPurchase(session(), CREATED, deps(stale.db).d), Error, "stale plan");
  const noOrder = fakeDb({ orders: [] });
  const x = deps(noOrder.db);
  await assertRejects(() => handleOnlineYearPurchase(session(), CREATED, x.d), Error, "could not be re-read");
  assertEquals(x.recorded.length, 1); // the sale itself was still recorded first
  const badRead = fakeDb({ orders: ORDERS }, { failTable: "online_year_parents" });
  await assertRejects(() => handleOnlineYearPurchase(session(), CREATED, deps(badRead.db).d), Error, "parent read failed");
});

Deno.test("a broken cart: the sale is still recorded under online_year_cart and the founder is told; nothing granted", async () => {
  const f = fakeDb({ orders: ORDERS });
  const x = deps(f.db);
  const s = session();
  s.metadata = { ...s.metadata!, oy_children: "5" };
  const out = await handleOnlineYearPurchase(s, CREATED, x.d);
  assertEquals(out, { status: "needs_a_look", reason: "bad_metadata", orderId: "o-new" });
  assertEquals(x.recorded, [["online_year_cart", "Eden's Table Online Year"]]);
  assertEquals(f.rpcCalls.length, 0);
  assertEquals(x.alerts.length, 1);
  assertEquals(x.alerts[0].subject, "Online Year purchase needs a look");
});

// ── closing ─────────────────────────────────────────────────────────────────

function closeRows(): Rows {
  return {
    orders: [
      { id: "o-oy", order_number: "ET-1100", lookup_key: "online_year_sprouts", customer_email: "mom@example.com", stripe_payment_intent_id: "pi_oy" },
      { id: "o-starter", order_number: "ET-1101", lookup_key: "sprouts_starter_unit", customer_email: "x@example.com", stripe_payment_intent_id: "pi_starter" },
    ],
    online_year_licenses: [
      { id: "N1", order_id: "o-oy", child_name: "Ava", status: "active" },
      { id: "N2", order_id: "o-oy", child_name: "Ben", status: "active" },
      { id: "N0", order_id: "o-oy", child_name: "Cy", status: "closed" },
    ],
  };
}

Deno.test("full refund: the order's active licenses close as refunded; no founder email (she issued it)", async () => {
  const rows = closeRows();
  const f = fakeDb(rows);
  const alerts: string[] = [];
  const r = await closeOnlineYearLicenses("pi_oy", "refunded", {
    db: f.db, notifyFounder: (s) => { alerts.push(s); return Promise.resolve(); }, now: () => PURCHASE, log: () => {},
  });
  assertEquals(r, { closed: 2, orders: 1 });
  assertEquals(f.updates[0].patch, { status: "closed", closed_at: "2026-12-01T15:30:00.000Z", closed_reason: "refunded", updated_at: "2026-12-01T15:30:00.000Z" });
  assertEquals(rows.online_year_licenses.map((l) => `${l.id}:${l.status}:${l.closed_reason ?? ""}`), ["N1:closed:refunded", "N2:closed:refunded", "N0:closed:"]);
  assertEquals(alerts, []);
});

Deno.test("dispute: licenses close as disputed and the founder is told", async () => {
  const f = fakeDb(closeRows());
  const alerts: string[] = [];
  const r = await closeOnlineYearLicenses("pi_oy", "disputed", {
    db: f.db, notifyFounder: (s) => { alerts.push(s); return Promise.resolve(); }, log: () => {},
  });
  assertEquals(r.closed, 2);
  assertEquals(alerts, ["Online Year order ET-1100 was disputed: access closed"]);
});

Deno.test("any other product's refund or dispute touches no license", async () => {
  const f = fakeDb(closeRows());
  const r = await closeOnlineYearLicenses("pi_starter", "disputed", { db: f.db, notifyFounder: () => Promise.reject(new Error("no")), log: () => {} });
  assertEquals(r, { closed: 0, orders: 0 });
  assertEquals(f.updates.length, 0);
  const none = await closeOnlineYearLicenses("pi_unknown", "refunded", { db: f.db, notifyFounder: () => Promise.resolve(), log: () => {} });
  assertEquals(none, { closed: 0, orders: 0 });
});

Deno.test("a close that fails to read orders throws (the dispute case lets Stripe redeliver)", async () => {
  const f = fakeDb(closeRows(), { failTable: "orders" });
  await assertRejects(() => closeOnlineYearLicenses("pi_oy", "disputed", { db: f.db, notifyFounder: () => Promise.resolve(), log: () => {} }), Error, "orders read failed");
});

Deno.test("partial refund: nothing closes; the founder is told only for an Online Year order", async () => {
  const f = fakeDb(closeRows());
  const alerts: string[] = [];
  const d = { db: f.db, notifyFounder: (s: string) => { alerts.push(s); return Promise.resolve(); }, log: () => {} };
  assertEquals(await noteOnlineYearPartialRefund("pi_oy", d), true);
  assertEquals(await noteOnlineYearPartialRefund("pi_starter", d), false);
  assertEquals(alerts, ["Online Year order ET-1100: partial refund, licenses left open"]);
  assertEquals(f.updates.length, 0);
});
