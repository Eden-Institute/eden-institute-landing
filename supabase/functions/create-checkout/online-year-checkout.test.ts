// Handler tests for the Online Year cart branch (OY2), with a fake PostgREST client and a fake Stripe.
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleOnlineYearCheckout, liveFirstChildName } from "./online-year-checkout.ts";

type Rows = Record<string, Record<string, unknown>[]>;
const TOKEN = "t".repeat(32);
const NOW = new Date("2026-12-01T15:00:00Z");

function fakeDb(rows: Rows, failTable?: string) {
  const from = (table: string) => {
    let data = [...(rows[table] ?? [])];
    const done = () => (table === failTable ? { data: null, error: { message: "boom" } } : { data, error: null });
    const q = {
      select: () => q,
      eq: (c: string, v: unknown) => { data = data.filter((r) => r[c] === v); return q; },
      ilike: (c: string, v: string) => { const want = v.replace(/\\(.)/g, "$1").toLowerCase(); data = data.filter((r) => String(r[c]).toLowerCase() === want); return q; },
      gt: (c: string, v: string) => { data = data.filter((r) => String(r[c]) > v); return q; },
      order: () => q,
      limit: (n: number) => { data = data.slice(0, n); return q; },
      maybeSingle: () => Promise.resolve(table === failTable ? done() : { data: data[0] ?? null, error: null }),
      then: (res: (v: unknown) => unknown) => Promise.resolve(done()).then(res),
    };
    return q;
  };
  return { from };
}

function fakeStripe(opts: { prices?: string[]; promo?: Record<string, unknown> } = {}) {
  const created: Record<string, unknown>[] = [];
  const keys = opts.prices ?? ["online_year_sprouts_first_child", "online_year_sprouts_sibling", "online_year_seedlings_first_child", "online_year_seedlings_sibling"];
  return {
    created,
    stripe: {
      prices: {
        list: (p: { lookup_keys: string[] }) =>
          Promise.resolve({ data: p.lookup_keys.filter((k) => keys.includes(k)).map((k) => ({ id: `price_${k}`, lookup_key: k })) }),
      },
      promotionCodes: { retrieve: (id: string) => Promise.resolve(opts.promo ?? { id, active: true, coupon: { id: "coupon_print_only" } }) },
    },
    createSession: (params: Record<string, unknown>) => { created.push(params); return Promise.resolve({ id: "cs_test_1", url: "https://checkout.stripe.com/c/x" }); },
  };
}

const req = (preview = true) => new Request("https://x/", { method: "POST", headers: preview ? { "x-online-year-preview": TOKEN } : {} });
const env = (m: Record<string, string> = {}) => (k: string) => ({ ONLINE_YEAR_PREVIEW_TOKEN: TOKEN, ...m })[k];
const body = (over: Record<string, unknown> = {}) => ({
  lookup_key: "online_year_cart", band: "sprouts", email: "Mom@Example.com", country: "us", child_names: ["Ava", "Ben"], agree: true, ...over,
});

async function run(over: Record<string, unknown> = {}, rows: Rows = {}, opts: { preview?: boolean; env?: Record<string, string>; prices?: string[]; e2e?: boolean } = {}) {
  const s = fakeStripe({ prices: opts.prices });
  const res = await handleOnlineYearCheckout(req(opts.preview ?? true), body(over), {
    stripe: s.stripe, db: fakeDb(rows), cors: {}, createSession: s.createSession as never, env: env(opts.env), now: () => NOW,
    ...(opts.e2e ? { e2e: { buyerEmail: "hello@edeninstitute.health", metadataKey: "e2e_test" } } : {}),
  });
  return { status: res.status, json: await res.json(), created: s.created };
}

const LIVE: Rows = {
  online_year_parents: [{ id: "p1", email: "mom@example.com" }],
  online_year_licenses: [
    { parent_id: "p1", band: "sprouts", kind: "first_child", status: "active", child_name: "Ava", ends_at: "2027-06-01T00:00:00Z" },
    { parent_id: "p1", band: "seedlings", kind: "first_child", status: "active", child_name: "Dee", ends_at: "2026-11-01T00:00:00Z" },
  ],
};

Deno.test("dark: 404 without the preview header, as if the path did not exist", async () => {
  const r = await run({}, {}, { preview: false });
  assertEquals(r.status, 404);
  assertEquals(r.created.length, 0);
});

Deno.test("launch switch opens it without the header", async () => {
  const r = await run({}, {}, { preview: false, env: { ONLINE_YEAR_ENABLED: "true" } });
  assertEquals(r.status, 200);
});

Deno.test("a new family: $149 + $29, email locked, billing address required, approved submit line, metadata for OY3", async () => {
  const r = await run();
  assertEquals(r.status, 200);
  const p = r.created[0] as Record<string, any>;
  assertEquals(p.line_items, [{ price: "price_online_year_sprouts_first_child", quantity: 1 }, { price: "price_online_year_sprouts_sibling", quantity: 1 }]);
  assertEquals(p.customer_email, "Mom@Example.com");
  assertEquals(p.billing_address_collection, "required");
  assertEquals(p.automatic_tax, { enabled: true });
  assertEquals(p.custom_text.submit.message, "All sales final on digital products. No automatic renewal: we'll email you before your year ends.");
  assertEquals(p.allow_promotion_codes, undefined);
  assertEquals(p.metadata.lookup_key, "online_year_cart");
  assertEquals(p.metadata.oy_band, "sprouts");
  assertEquals(p.metadata.oy_country, "US");
  assertEquals([p.metadata.oy_child_1, p.metadata.oy_kind_1, p.metadata.oy_child_2, p.metadata.oy_kind_2], ["Ava", "first_child", "Ben", "sibling"]);
  assertEquals(p.payment_intent_data.metadata, p.metadata);
  assert(String(p.success_url).startsWith("https://edeninstitute.health/online-year/thank-you"));
});

Deno.test("a family with a live Sprouts year (email in any case): siblings only, $29 each", async () => {
  const r = await run({ child_names: ["Ben", "Cal"] }, LIVE);
  const p = r.created[0] as Record<string, any>;
  assertEquals(p.line_items, [{ price: "price_online_year_sprouts_sibling", quantity: 2 }]);
});

Deno.test("an ENDED first-child year does not count: Seedlings is $149 again", async () => {
  const r = await run({ band: "seedlings", child_names: ["Eve"] }, LIVE);
  const p = r.created[0] as Record<string, any>;
  assertEquals(p.line_items, [{ price: "price_online_year_seedlings_first_child", quantity: 1 }]);
  assertEquals(await liveFirstChildName(fakeDb(LIVE), "MOM@example.com", "sprouts", NOW), "Ava");
});

Deno.test("refusals before any Stripe session: agreement, country, email, band, names", async () => {
  for (const [over, code] of [
    [{ agree: false }, "OY_AGREEMENT_REQUIRED"],
    [{ agree: "true" }, "OY_AGREEMENT_REQUIRED"],
    [{ country: "GB" }, "OY_COUNTRY"],
    [{ country: undefined }, "OY_COUNTRY"],
    [{ email: "not-an-email" }, "OY_EMAIL"],
    [{ band: "kit" }, "OY_UNKNOWN_BAND"],
    [{ child_names: ["Ava", "ava"] }, "OY_DUPLICATE_CHILD_NAME"],
    [{ child_names: [] }, "OY_NO_CHILDREN"],
  ] as [Record<string, unknown>, string][]) {
    const r = await run(over);
    assertEquals([r.status, r.json.code], [400, code], JSON.stringify(over));
    assertEquals(r.created.length, 0);
  }
});

Deno.test("a missing live price refuses the whole cart (503), never sells part of it", async () => {
  const r = await run({}, {}, { prices: ["online_year_sprouts_first_child"] });
  assertEquals([r.status, r.json.code], [503, "OY_NOT_CONFIGURED"]);
  assertEquals(r.created.length, 0);
});

Deno.test("E2E twin: inline test prices, buyer forced to hello@, stamped e2e_test", async () => {
  const r = await run({}, {}, { e2e: true });
  const p = r.created[0] as Record<string, any>;
  assertEquals(p.customer_email, "hello@edeninstitute.health");
  assertEquals(p.metadata.e2e_test, "true");
  assertEquals(p.line_items[0].price_data.unit_amount, 14900);
  assertEquals(p.line_items[1].price_data.unit_amount, 2900);
  assertEquals(p.line_items[0].price_data.product_data.name, "E2E TEST: Eden's Table Online Year: Sprouts (K-2), first child");
});

Deno.test("a read error fails closed (no session)", async () => {
  const s = fakeStripe();
  let threw = false;
  try {
    await handleOnlineYearCheckout(req(), body(), { stripe: s.stripe, db: fakeDb({}, "online_year_parents"), cors: {}, createSession: s.createSession as never, env: env(), now: () => NOW });
  } catch { threw = true; }
  assert(threw);
  assertEquals(s.created.length, 0);
});

Deno.test("a promo code that is not a Starter credit is not applied (no promo field on this checkout)", async () => {
  const r = await run({ promo_code: "EDENGIFT10" }, { starter_credits: [] });
  const p = r.created[0] as Record<string, any>;
  assertEquals(p.discounts, undefined);
});

Deno.test("a Starter credit on today's print-only coupon is refused with the existing printed-set sentence", async () => {
  Deno.env.set("STRIPE_STARTER_PRINT_CREDIT_COUPON_SPROUTS", "coupon_print_only");
  try {
    const rows: Rows = { starter_credits: [{ id: "c1", code: "EDEN-S-ABC123", email: "mom@example.com", stripe_customer_id: null, stripe_promotion_code_id: "promo_1", amount_cents: 3900, issued_at: "2026-11-01", redeemed_at: null, deactivated_at: null, deactivated_reason: null }] };
    const r = await run({ promo_code: "EDEN-S-ABC123" }, rows);
    assertEquals([r.status, r.json.code], [400, "CREDIT_SET_REQUIRED"]);
    assertEquals(r.created.length, 0);
  } finally {
    Deno.env.delete("STRIPE_STARTER_PRINT_CREDIT_COUPON_SPROUTS");
  }
});
