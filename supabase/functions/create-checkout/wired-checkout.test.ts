// Handler tests for the wired cart branch, with a fake PostgREST client and a fake Stripe.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.env.set("WIRED_LINK_SECRET", "test-secret-test-secret-test-secret-0123");
const { signWiredToken } = await import("../_shared/wired-token.ts");
const { handleWiredCheckout } = await import("./wired-checkout.ts");

const FAM = "11111111-1111-4111-8111-111111111111";
const K1 = "22222222-2222-4222-8222-222222222221";
const K2 = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";

type Rows = Record<string, Record<string, unknown>[]>;

function fakeDb(rows: Rows) {
  const inserted: Record<string, unknown[]> = {};
  const updated: Record<string, unknown[]> = {};
  const from = (table: string) => {
    let data = [...(rows[table] ?? [])];
    let mode: "select" | "insert" | "update" = "select";
    let payload: unknown = null;
    const q = {
      select: () => q,
      eq: (c: string, v: unknown) => { data = data.filter((r) => r[c] === v); return q; },
      is: (c: string, v: unknown) => { data = data.filter((r) => (r[c] ?? null) === v); return q; },
      in: (c: string, vs: unknown[]) => { data = data.filter((r) => vs.includes(r[c])); return q; },
      gte: (c: string, v: string) => { data = data.filter((r) => String(r[c]) >= v); return q; },
      order: () => q,
      limit: () => q,
      insert: (p: unknown) => { mode = "insert"; payload = p; (inserted[table] ??= []).push(p); return q; },
      update: (p: unknown) => { mode = "update"; payload = p; (updated[table] ??= []).push(p); return q; },
      maybeSingle: () => Promise.resolve({ data: data[0] ?? null, error: null }),
      single: () => Promise.resolve(mode === "insert" ? { data: { id: "pend-1", ...(payload as object) }, error: null } : { data: data[0] ?? null, error: null }),
      then: (res: (v: unknown) => unknown) => res({ data, error: null }),
    };
    return q;
  };
  return { from, inserted, updated };
}

function fakeStripe(available = ["wired_blueprint", "wired_family_map", "wired_family_map_upgrade", "wired_extra_child"]) {
  return { prices: { list: (a: { lookup_keys: string[] }) => Promise.resolve({ data: a.lookup_keys.filter((k) => available.includes(k)).map((k) => ({ id: `price_${k}`, lookup_key: k })) }) } };
}

const baseRows = (): Rows => ({
  wired_families: [{ id: FAM, email: "mom@example.com", first_name: "Ann" }],
  wired_children: [
    { id: K1, family_id: FAM, nickname: "A", unlocked_via: "free", removed_at: null, created_at: "1" },
    { id: K2, family_id: FAM, nickname: "B", unlocked_via: null, removed_at: null, created_at: "2" },
  ],
  wired_buyers: [],
  wired_unlocks: [],
});

async function run(body: Record<string, unknown>, opts: { rows?: Rows; open?: boolean; stripe?: unknown } = {}) {
  const db = fakeDb(opts.rows ?? baseRows());
  let params: Record<string, unknown> | null = null;
  const res = await handleWiredCheckout(new Request("https://x/create-checkout", { method: "POST" }), body, {
    stripe: opts.stripe ?? fakeStripe(),
    db,
    cors: {},
    createSession: (p) => { params = p as unknown as Record<string, unknown>; return Promise.resolve({ id: "cs_test_1", url: "https://checkout.stripe.com/x" }); },
    extraMetadata: () => ({ attr_utm_source: "qa" }),
    env: (k) => (k === "WIRED_ENABLED" ? (opts.open === false ? undefined : "true") : undefined),
    now: () => new Date("2026-11-19T18:00:00Z"),
  });
  return { status: res.status, body: await res.json(), db, params: params as Record<string, unknown> | null };
}

const token = await signWiredToken({ familyId: FAM, purpose: "results" });

Deno.test("dark: 404 like every wired function", async () => {
  const r = await run({ token, product: "blueprint", child_ids: [K2] }, { open: false });
  assertEquals(r.status, 404);
});

Deno.test("a bad token never reaches Stripe", async () => {
  const r = await run({ token: token + "x", product: "blueprint", child_ids: [K2] });
  assertEquals([r.status, r.body.code, r.params], [401, "WIRED_TOKEN_INVALID", null]);
});

Deno.test("a child from another family is refused", async () => {
  const r = await run({ token, product: "blueprint", child_ids: [OTHER] });
  assertEquals([r.status, r.body.code, r.params], [403, "WIRED_NOT_YOUR_CHILD", null]);
});

Deno.test("Blueprint: pending row first, only its id + product in metadata, promo off, Customer always", async () => {
  const r = await run({ token, product: "blueprint", child_ids: [K2] });
  assertEquals(r.status, 200);
  const pend = r.db.inserted.wired_pending_checkouts[0] as Record<string, unknown>;
  assertEquals([pend.product, pend.child_ids, pend.quiz_year, pend.extra_children], ["blueprint", [K2], 2026, 0]);
  const p = r.params!;
  assertEquals(p.line_items, [{ price: "price_wired_blueprint", quantity: 1 }]);
  assertEquals(p.customer_creation, "always");
  assertEquals(p.allow_promotion_codes, undefined);
  assertEquals(p.discounts, undefined);
  assertEquals(p.after_expiration, undefined); // no store cart reminder on a wired cart
  const md = p.metadata as Record<string, string>;
  assertEquals([md.lookup_key, md.wired_pending_id, md.wired_product, md.wired_extra_children, md.attr_utm_source], ["wired_cart", "pend-1", "blueprint", "0", "qa"]);
  assertEquals(md.wired_child_ids, undefined);
  assertEquals((r.db.updated.wired_pending_checkouts[0] as Record<string, unknown>).stripe_session_id, "cs_test_1");
});

Deno.test("Family Map with no child_ids covers every child on the results page", async () => {
  const r = await run({ token, product: "family_map" });
  assertEquals(r.status, 200);
  assertEquals((r.db.inserted.wired_pending_checkouts[0] as Record<string, unknown>).child_ids, [K1, K2]);
});

Deno.test("the later $28 upgrade needs a same-year, unrefunded Blueprint", async () => {
  const none = await run({ token, product: "family_map_upgrade" });
  assertEquals([none.status, none.body.code], [409, "WIRED_UPGRADE_NEEDS_BLUEPRINT"]);
  const rows = baseRows();
  rows.wired_buyers = [{ family_id: FAM, quiz_year: 2025, product: "blueprint", refunded_at: null, disputed_at: null }];
  const lastYear = await run({ token, product: "family_map_upgrade" }, { rows });
  assertEquals(lastYear.status, 409);
  rows.wired_buyers = [{ family_id: FAM, quiz_year: 2026, product: "blueprint", refunded_at: null, disputed_at: "2026-11-01" }];
  assertEquals((await run({ token, product: "family_map_upgrade" }, { rows })).status, 409);
  rows.wired_buyers = [{ family_id: FAM, quiz_year: 2026, product: "blueprint", refunded_at: null, disputed_at: null }];
  const ok = await run({ token, product: "family_map_upgrade" }, { rows });
  assertEquals(ok.status, 200);
  assertEquals(ok.params!.line_items, [{ price: "price_wired_family_map_upgrade", quantity: 1 }]);
});

Deno.test("never sells what she already owns this quiz year", async () => {
  const rows = baseRows();
  rows.wired_unlocks = [{ family_id: FAM, child_id: K2, product: "blueprint", granted_at: "2026-09-01T00:00:00Z" }];
  assertEquals((await run({ token, product: "blueprint", child_ids: [K2] }, { rows })).body.code, "WIRED_ALREADY_OWNED");
  rows.wired_unlocks = [{ family_id: FAM, child_id: K2, product: "blueprint", granted_at: "2026-05-01T00:00:00Z" }]; // last quiz year
  assertEquals((await run({ token, product: "blueprint", child_ids: [K2] }, { rows })).status, 200);
  rows.wired_buyers = [{ family_id: FAM, quiz_year: 2026, product: "family_map", refunded_at: null, disputed_at: null }];
  assertEquals((await run({ token, product: "family_map" }, { rows })).body.code, "WIRED_ALREADY_OWNED");
});

Deno.test("a missing Stripe price refuses the whole cart", async () => {
  const r = await run({ token, product: "blueprint_upgrade" }, { stripe: fakeStripe(["wired_blueprint"]) });
  assertEquals([r.status, r.body.code, r.params], [503, "WIRED_NOT_CONFIGURED", null]);
});
