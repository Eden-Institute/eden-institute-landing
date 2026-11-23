// Run with: deno test --allow-env --allow-read supabase/functions/_shared/starter-credit-print.test.ts
//
// FOUNDER DECISION 2026-11-22: the Starter credit, from either band, comes off that
// band's printed set, the two-band set, and (Sprouts) the kit; one use, never
// expires; none for a scholarship- or ESA-paid Starter; the outstanding kit-only
// Sprouts credits are moved by a one-off script that sends no email.
//
// Every branch of that lives on our side of the wire is pinned here. Stripe and the
// database are FAKES: no network. The database fake REJECTS UNKNOWN COLUMNS (the
// column lists are the real ones, from supabase/migrations) and enforces the real
// unique and NOT NULL constraints, so a test cannot pass by writing a column that
// does not exist or by inserting a row production would refuse.

import { assert, assertEquals, assertRejects, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  CREDIT_EXPIRY_POLICY,
  LEGACY_KIT_CREDIT_COUPON_ENV,
  STARTER_BANDS,
  STARTER_KIT_PRODUCT_ID,
  missingStarterEnv,
  starterBandHasCredit,
  starterCreditAppliesToSkus,
  starterCreditKindForCoupon,
} from './starter-config.ts';
import {
  CREDIT_DEACTIVATED_MESSAGE,
  CREDIT_EMAIL_REQUIRED_MESSAGE,
  CREDIT_KIT_REQUIRED_MESSAGE,
  deactivateCreditForRefundedStarter,
  decidePrintPromoCredit,
  issueStarterCredit,
  issueStarterCreditForBand,
  promotionCodeIdsOnSession,
  recordStarterCreditRedemptions,
  starterCreditCartRefusal,
} from './starter-credit.ts';
import {
  applyStarterCreditMove,
  checkPrintCreditCoupon,
  describePlan,
  describeResults,
  maskCode,
  maskEmail,
  MOVE_REASON,
  planStarterCreditMove,
} from './starter-credit-move.ts';

// ---------------------------------------------------------------------------
// Env: coupon ids are placeholders, read at call time by the code under test.
// ---------------------------------------------------------------------------
// The SAME values starter-credit.test.ts sets: Deno.env is process-wide, so two
// test files setting one variable to different values would race.
const SPROUTS_COUPON = 'coupon_test';
const SEEDLINGS_COUPON = 'coupon_test_seedlings';
const LEGACY_COUPON = 'coupon_test_legacy_kit';
Deno.env.set('STRIPE_STARTER_PRINT_CREDIT_COUPON_SPROUTS', SPROUTS_COUPON);
Deno.env.set('STRIPE_STARTER_PRINT_CREDIT_COUPON_SEEDLINGS', SEEDLINGS_COUPON);
Deno.env.set(LEGACY_KIT_CREDIT_COUPON_ENV, LEGACY_COUPON);
Deno.env.delete('STRIPE_STARTER_PROMO_KEY');

async function withEnv<T>(vars: Record<string, string | null>, fn: () => Promise<T> | T): Promise<T> {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = Deno.env.get(k);
    if (v === null) Deno.env.delete(k);
    else Deno.env.set(k, v);
  }
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
  }
}

// ---------------------------------------------------------------------------
// A strict PostgREST stand-in.
// ---------------------------------------------------------------------------
type Row = Record<string, unknown>;

/** Real columns, from supabase/migrations (20260826120000 and the orders/products migrations). */
const COLUMNS: Record<string, readonly string[]> = {
  starter_credits: [
    'id', 'created_at', 'stripe_checkout_session_id', 'order_id', 'email', 'purchaser_name',
    'stripe_customer_id', 'stripe_promotion_code_id', 'code', 'amount_cents', 'issued_at',
    'redeemed_at', 'redeemed_order_id', 'redeemed_session_id', 'deactivated_at', 'deactivated_reason',
  ],
  orders: [
    'id', 'created_at', 'updated_at', 'stripe_checkout_session_id', 'stripe_payment_intent_id',
    'stripe_customer_id', 'customer_email', 'lookup_key', 'product_label', 'amount_total_cents',
    'tax_cents', 'currency', 'quantity', 'payment_status', 'status', 'is_preorder', 'raw',
  ],
  products: [
    'id', 'sku', 'name', 'product_type', 'active', 'fulfillment', 'retail_price_cents',
    'founding_price_cents', 'stripe_retail_price_id', 'stripe_founding_price_id', 'stripe_lookup_key',
    'shipping_tier_cents', 'volume_price_cents', 'volume_min_qty',
  ],
};
const UNIQUE: Record<string, readonly string[]> = {
  starter_credits: ['id', 'stripe_checkout_session_id', 'stripe_promotion_code_id', 'code'],
};
const NOT_NULL: Record<string, readonly string[]> = {
  starter_credits: ['stripe_checkout_session_id', 'email', 'stripe_customer_id', 'stripe_promotion_code_id', 'code', 'amount_cents'],
};

type Op = 'select' | 'insert' | 'update';
interface Call { table: string; op: Op; payload?: Row }

class StrictDb {
  tables = new Map<string, Row[]>();
  calls: Call[] = [];
  private failures: Array<{ table: string; op: Op; error: { message: string; code?: string } }> = [];

  rows(table: string): Row[] {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return this.tables.get(table)!;
  }
  seed(table: string, row: Row) {
    this.checkCols(table, Object.keys(row));
    this.rows(table).push({ ...row });
  }
  failNext(table: string, op: Op, error: { message: string; code?: string } = { message: 'db down' }) {
    this.failures.push({ table, op, error });
  }
  writes(): Call[] {
    return this.calls.filter((c) => c.op !== 'select');
  }
  checkCols(table: string, cols: string[]) {
    const known = COLUMNS[table];
    if (!known) throw new Error(`StrictDb: unknown table '${table}'`);
    for (const c of cols) {
      if (!known.includes(c)) throw new Error(`StrictDb: unknown column ${table}.${c}`);
    }
  }
  takeFailure(table: string, op: Op) {
    const i = this.failures.findIndex((f) => f.table === table && f.op === op);
    if (i < 0) return null;
    return this.failures.splice(i, 1)[0].error;
  }
  from(table: string) {
    if (!COLUMNS[table]) throw new Error(`StrictDb: unknown table '${table}'`);
    return new StrictQuery(this, table);
  }
  rpc() { throw new Error('rpc not used here'); }
}

class StrictQuery {
  private filters: Array<(r: Row) => boolean> = [];
  private op: Op = 'select';
  private payload: Row | null = null;
  private single = false;
  constructor(private db: StrictDb, private table: string) {}

  select(cols?: string) {
    if (cols && cols !== '*') this.db.checkCols(this.table, cols.split(',').map((c) => c.trim()).filter(Boolean));
    return this;
  }
  insert(row: Row) { this.op = 'insert'; this.payload = row; this.db.checkCols(this.table, Object.keys(row)); return this; }
  update(row: Row) { this.op = 'update'; this.payload = row; this.db.checkCols(this.table, Object.keys(row)); return this; }
  eq(col: string, val: unknown) { this.db.checkCols(this.table, [col]); this.filters.push((r) => r[col] === val); return this; }
  is(col: string, val: unknown) { this.db.checkCols(this.table, [col]); this.filters.push((r) => (r[col] ?? null) === val); return this; }
  in(col: string, vals: unknown[]) { this.db.checkCols(this.table, [col]); this.filters.push((r) => vals.includes(r[col])); return this; }
  maybeSingle() { this.single = true; return this; }

  // deno-lint-ignore no-explicit-any
  then(resolve: (v: any) => void, reject?: (e: unknown) => void) {
    try {
      this.db.calls.push({ table: this.table, op: this.op, ...(this.payload ? { payload: this.payload } : {}) });
      const injected = this.db.takeFailure(this.table, this.op);
      if (injected) return resolve({ data: null, error: injected });
      const rows = this.db.rows(this.table);
      const hits = rows.filter((r) => this.filters.every((f) => f(r)));
      if (this.op === 'insert') {
        const row = { ...this.payload } as Row;
        for (const c of NOT_NULL[this.table] ?? []) {
          if (row[c] === undefined || row[c] === null || row[c] === '') {
            return resolve({ data: null, error: { code: '23502', message: `null value in column "${c}"` } });
          }
        }
        if (!row.id) row.id = crypto.randomUUID();
        for (const c of UNIQUE[this.table] ?? []) {
          if (rows.some((r) => r[c] === row[c])) return resolve({ data: null, error: { code: '23505', message: `duplicate key on ${c}` } });
        }
        rows.push(row);
        return resolve({ data: this.single ? row : [row], error: null });
      }
      if (this.op === 'update') {
        for (const r of hits) {
          for (const c of UNIQUE[this.table] ?? []) {
            if (c in this.payload! && rows.some((o) => o !== r && o[c] === this.payload![c])) {
              return resolve({ data: null, error: { code: '23505', message: `duplicate key on ${c}` } });
            }
          }
        }
        for (const r of hits) Object.assign(r, this.payload);
        return resolve({ data: this.single ? (hits[0] ?? null) : hits.map((h) => ({ ...h })), error: null });
      }
      if (this.single && hits.length > 1) return resolve({ data: null, error: { code: 'PGRST116', message: 'multiple rows' } });
      return resolve({ data: this.single ? (hits[0] ? { ...hits[0] } : null) : hits.map((h) => ({ ...h })), error: null });
    } catch (err) {
      if (reject) return reject(err);
      throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// A Stripe stand-in: promotion codes, coupons, prices, checkout sessions.
// ---------------------------------------------------------------------------
interface FakePromo { id: string; code: string; coupon: { id: string }; active: boolean; times_redeemed: number; customer?: string | null; max_redemptions?: number; metadata: Record<string, string> }

function fakeStripe() {
  const promos = new Map<string, FakePromo>();
  const created: Row[] = [];
  const updated: Array<{ id: string; params: Row }> = [];
  const retrievedSessions: Array<{ id: string; params: Row }> = [];
  let n = 0;
  const fail: Record<string, number> = {};
  // deno-lint-ignore no-explicit-any
  const couponStore = new Map<string, any>();
  // deno-lint-ignore no-explicit-any
  const priceStore = new Map<string, any>();
  // deno-lint-ignore no-explicit-any
  const sessions = new Map<string, any>();
  const maybeFail = (key: string) => {
    if ((fail[key] ?? 0) > 0) {
      fail[key] -= 1;
      throw new Error(`stripe ${key} failed`);
    }
  };
  return {
    promos, created, updated, retrievedSessions, couponStore, priceStore, sessions,
    failNext(key: 'create' | 'update' | 'retrieve' | 'session' | 'coupon', times = 1) { fail[key] = (fail[key] ?? 0) + times; },
    seedPromo(p: Omit<Partial<FakePromo>, 'coupon'> & { id: string; code: string; coupon: string }) {
      promos.set(p.id, { active: true, times_redeemed: 0, metadata: {}, ...p, coupon: { id: p.coupon } });
    },
    promotionCodes: {
      // deno-lint-ignore no-explicit-any
      create(params: any) {
        maybeFail('create');
        const id = `promo_new_${++n}`;
        created.push({ id, ...params });
        promos.set(id, { id, code: params.code, coupon: { id: params.coupon }, active: true, times_redeemed: 0, customer: params.customer ?? null, max_redemptions: params.max_redemptions, metadata: { ...(params.metadata ?? {}) } });
        return Promise.resolve({ id, ...params });
      },
      // deno-lint-ignore no-explicit-any
      update(id: string, params: any) {
        try { maybeFail('update'); } catch (e) { return Promise.reject(e); }
        updated.push({ id, params });
        const p = promos.get(id);
        if (p) {
          if (typeof params.active === 'boolean') p.active = params.active;
          if (params.metadata) p.metadata = { ...p.metadata, ...params.metadata };
        }
        return Promise.resolve({ id, ...params });
      },
      retrieve(id: string) {
        try { maybeFail('retrieve'); } catch (e) { return Promise.reject(e); }
        const p = promos.get(id);
        if (!p) return Promise.reject(new Error(`No such promotion code: ${id}`));
        return Promise.resolve(structuredClone(p));
      },
    },
    coupons: {
      // deno-lint-ignore no-explicit-any
      retrieve(id: string, _params?: any) {
        try { maybeFail('coupon'); } catch (e) { return Promise.reject(e); }
        const c = couponStore.get(id);
        return c ? Promise.resolve(structuredClone(c)) : Promise.reject(new Error(`No such coupon: ${id}`));
      },
    },
    prices: {
      retrieve(id: string) {
        const p = priceStore.get(id);
        return p ? Promise.resolve(p) : Promise.reject(new Error(`No such price: ${id}`));
      },
      // deno-lint-ignore no-explicit-any
      list(params: any) {
        const key = params.lookup_keys?.[0];
        const found = [...priceStore.values()].filter((p) => p.lookup_key === key);
        return Promise.resolve({ data: found });
      },
    },
    checkout: {
      sessions: {
        // deno-lint-ignore no-explicit-any
        retrieve(id: string, params: any) {
          try { maybeFail('session'); } catch (e) { return Promise.reject(e); }
          retrievedSessions.push({ id, params });
          const s = sessions.get(id);
          return s ? Promise.resolve(structuredClone(s)) : Promise.reject(new Error(`No such session: ${id}`));
        },
      },
    },
  };
}

/** Any property read throws, so ANY use of the object fails the test. */
function untouchable(name: string) {
  return new Proxy({}, { get(_t, prop) { throw new Error(`${name}.${String(prop)} was touched`); } });
}

const input = {
  sessionId: 'cs_live_starter_1',
  orderId: 'order-starter-1',
  email: ' Parent@Example.com ',
  purchaserName: 'Pat Parent',
  stripeCustomerId: 'cus_starter_1',
};

function creditRow(over: Row = {}): Row {
  return {
    id: crypto.randomUUID(),
    stripe_checkout_session_id: 'cs_live_starter_1',
    order_id: 'order-starter-1',
    email: 'parent@example.com',
    purchaser_name: 'Pat Parent',
    stripe_customer_id: 'cus_starter_1',
    stripe_promotion_code_id: 'promo_sp_1',
    code: 'EDEN-S-ABC234',
    amount_cents: 3900,
    issued_at: '2026-10-01T12:00:00Z',
    redeemed_at: null,
    redeemed_order_id: null,
    redeemed_session_id: null,
    deactivated_at: null,
    deactivated_reason: null,
    ...over,
  };
}

// ===========================================================================
// Rule 1 + 2: config. Both bands, $39, own coupon, the founder's products.
// ===========================================================================

Deno.test('RULE 1/2: both bands carry a $39 credit on their own new coupon env, scoped by sku', () => {
  assert(starterBandHasCredit('sprouts'));
  assert(starterBandHasCredit('seedlings'));
  assertEquals(STARTER_BANDS.sprouts.credit, {
    cents: 3900,
    couponEnv: 'STRIPE_STARTER_PRINT_CREDIT_COUPON_SPROUTS',
    appliesToSkus: ['sprouts_print_set', 'both_bands_print_set', 'sprouts_kit'],
  });
  assertEquals(STARTER_BANDS.seedlings.credit, {
    cents: 3900,
    couponEnv: 'STRIPE_STARTER_PRINT_CREDIT_COUPON_SEEDLINGS',
    appliesToSkus: ['seedlings_print_set', 'both_bands_print_set'],
  });
  // Never cross-band, and the kit is Sprouts only.
  assert(!STARTER_BANDS.sprouts.credit!.appliesToSkus.includes('seedlings_print_set'));
  assert(!STARTER_BANDS.seedlings.credit!.appliesToSkus.includes('sprouts_print_set'));
  assert(!STARTER_BANDS.seedlings.credit!.appliesToSkus.includes('sprouts_kit'));
  // The new coupons are NOT the legacy kit-only one.
  assert(STARTER_BANDS.sprouts.credit!.couponEnv !== LEGACY_KIT_CREDIT_COUPON_ENV);
  assertEquals(STARTER_KIT_PRODUCT_ID, 'prod_UbK7PJQPkKhcnE');
});

Deno.test('RULE 1: the credit never expires, so the kit-cap policy stays honour_retail', () => {
  // expire_at_cap would deactivate every outstanding credit, printed-set ones too.
  assertEquals(CREDIT_EXPIRY_POLICY, 'honour_retail');
});

Deno.test('a band Starter is not sellable while its coupon env is unset (the pre-payment guard)', async () => {
  await withEnv({ STRIPE_STARTER_PRINT_CREDIT_COUPON_SPROUTS: null }, () => {
    assertEquals(missingStarterEnv('sprouts'), ['STRIPE_STARTER_PRINT_CREDIT_COUPON_SPROUTS']);
  });
  await withEnv({ STRIPE_STARTER_PRINT_CREDIT_COUPON_SEEDLINGS: null }, () => {
    assertEquals(missingStarterEnv('seedlings'), ['STRIPE_STARTER_PRINT_CREDIT_COUPON_SEEDLINGS']);
  });
  // The legacy kit coupon no longer gates any sale.
  await withEnv({ [LEGACY_KIT_CREDIT_COUPON_ENV]: null }, () => {
    assertEquals(missingStarterEnv('sprouts'), []);
    assertEquals(missingStarterEnv('seedlings'), []);
  });
});

Deno.test('a code is named by its coupon id, read from env at call time; unknown is null', async () => {
  assertEquals(starterCreditKindForCoupon(SPROUTS_COUPON), 'sprouts');
  assertEquals(starterCreditKindForCoupon(SEEDLINGS_COUPON), 'seedlings');
  assertEquals(starterCreditKindForCoupon(LEGACY_COUPON), 'legacy_kit');
  assertEquals(starterCreditKindForCoupon('coupon_affiliate'), null);
  assertEquals(starterCreditKindForCoupon(null), null);
  await withEnv({ STRIPE_STARTER_PRINT_CREDIT_COUPON_SEEDLINGS: null }, () => {
    assertEquals(starterCreditKindForCoupon(SEEDLINGS_COUPON), null);
  });
  assertEquals(starterCreditAppliesToSkus('legacy_kit'), ['sprouts_kit']);
});

// ===========================================================================
// Minting, per band.
// ===========================================================================

Deno.test('MINT Sprouts: on the Sprouts printed-set coupon, NOT bound to a Customer, single use, no expiry', async () => {
  const db = new StrictDb();
  const stripe = fakeStripe();
  const out = await issueStarterCredit(db as never, stripe, 'sprouts', input);
  assert(out.created);
  assertEquals(stripe.created.length, 1);
  const p = stripe.created[0];
  assertEquals(p.coupon, SPROUTS_COUPON);
  assertEquals(p.customer, undefined, 'a bound code would be refused at the print checkout (fresh Customer per order)');
  assertEquals(p.max_redemptions, 1);
  assertEquals(p.expires_at, undefined);
  assertEquals(p.metadata, {
    purpose: 'starter_unit_credit',
    starter_session_id: 'cs_live_starter_1',
    starter_email: 'parent@example.com',
    starter_band: 'sprouts',
  });
  const row = db.rows('starter_credits')[0];
  assertEquals(row.amount_cents, 3900);
  assertEquals(row.email, 'parent@example.com');
  assertEquals(row.stripe_customer_id, 'cus_starter_1', 'the Customer is still recorded on the row');
  assertEquals(row.stripe_promotion_code_id, out.promotionCodeId);
});

Deno.test('MINT Seedlings (new 2026-11-22): on the Seedlings printed-set coupon, through the band gate', async () => {
  const db = new StrictDb();
  const stripe = fakeStripe();
  const out = await issueStarterCreditForBand(db as never, stripe, 'seedlings', { ...input, sessionId: 'cs_live_sd_1' });
  assert(out?.created);
  assertEquals(stripe.created[0].coupon, SEEDLINGS_COUPON);
  assertEquals(stripe.created[0].customer, undefined);
  assertEquals((stripe.created[0].metadata as Row).starter_band, 'seedlings');
  assertEquals(db.rows('starter_credits').length, 1);
  assertEquals(db.rows('starter_credits')[0].stripe_checkout_session_id, 'cs_live_sd_1');
});

Deno.test('MINT is idempotent per band: a webhook retry returns the same code and Stripe is called once', async () => {
  const db = new StrictDb();
  const stripe = fakeStripe();
  const a = await issueStarterCredit(db as never, stripe, 'seedlings', input);
  const b = await issueStarterCredit(db as never, stripe, 'seedlings', input);
  assertEquals(b.created, false);
  assertEquals(b.code, a.code);
  assertEquals(stripe.created.length, 1);
});

for (const band of ['sprouts', 'seedlings'] as const) {
  Deno.test(`MINT ${band}: a missing coupon env fails loudly, naming it, before Stripe or the database`, async () => {
    const env = STARTER_BANDS[band].credit!.couponEnv;
    await withEnv({ [env]: null }, async () => {
      const err = await assertRejects(() => issueStarterCredit(untouchable('db') as never, untouchable('stripe'), band, input));
      assert(String((err as Error).message).includes(env), (err as Error).message);
    });
  });
}

Deno.test('MINT: the legacy kit coupon is never used for a new code, even when it is the only one set', async () => {
  await withEnv({ STRIPE_STARTER_PRINT_CREDIT_COUPON_SPROUTS: null }, async () => {
    await assertRejects(() => issueStarterCredit(untouchable('db') as never, untouchable('stripe'), 'sprouts', input));
  });
});

Deno.test('MINT: no Customer on the purchase refuses before minting (no orphan live code)', async () => {
  await assertRejects(() =>
    issueStarterCredit(untouchable('db') as never, untouchable('stripe'), 'sprouts', { ...input, stripeCustomerId: '' })
  );
});

// ===========================================================================
// Rule 3: scholarship- and ESA-paid Starters earn nothing. Structural: only
// stripe-webhook's paid-Starter path mints. These read the source of every other
// path that queues a Starter and prove it cannot reach the credit machinery.
// ===========================================================================

async function codeOnly(rel: string): Promise<string> {
  const src = await Deno.readTextFile(new URL(rel, import.meta.url));
  return src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
}

Deno.test('RULE 3: the ESA, print-gift and founder-gift paths never mint, write or cancel a credit', async () => {
  for (const rel of [
    './esa-fulfil.ts',
    './esa-invoice.ts',
    './esa-payment-intake.ts',
    './fpea-gift.ts',
    './starter-gift.ts',
    '../esa-payment/index.ts',
    '../esa-payment-confirm/index.ts',
    '../esa-invoice/index.ts',
  ]) {
    const code = await codeOnly(rel);
    for (const forbidden of ['starter-credit', 'starter_credits', 'issueStarterCredit', 'promotionCodes']) {
      assert(!code.includes(forbidden), `${rel} mentions ${forbidden}`);
    }
  }
});

Deno.test('RULE 3: stripe-webhook mints in exactly one place, the paid-Starter handler, gated on payment_status paid', async () => {
  const code = await codeOnly('../stripe-webhook/index.ts');
  const calls = code.match(/issueStarterCreditForBand\(/g) ?? [];
  assertEquals(calls.length, 1, 'one mint call site');
  const handler = code.slice(code.indexOf('async function handleStarterUnitPurchase('));
  const body = handler.slice(0, handler.indexOf('\nasync function ', 10));
  assert(body.includes('issueStarterCreditForBand('), 'the mint sits inside handleStarterUnitPurchase');
  assert(body.indexOf('payment_status !== "paid"') < body.indexOf('issueStarterCreditForBand('), 'and after the paid check');
});

// ===========================================================================
// Readable refusals before Stripe: which cart a credit comes off.
// ===========================================================================

Deno.test('cart refusal: each kind is accepted on exactly the founder\'s products', () => {
  const ok = (kind: Parameters<typeof starterCreditCartRefusal>[0], skus: string[]) => starterCreditCartRefusal(kind, skus) === null;
  assert(ok('sprouts', ['sprouts_print_set']));
  assert(ok('sprouts', ['sprouts_print_set', 'sprouts_nb_print']));
  assert(ok('sprouts', ['both_bands_print_set', 'seedlings_nb_print']));
  assert(ok('sprouts', ['sprouts_kit', 'sprouts_notebook']));
  assert(!ok('sprouts', ['seedlings_print_set']));
  assert(!ok('sprouts', ['sprouts_nb_print']));
  assert(ok('seedlings', ['seedlings_print_set']));
  assert(ok('seedlings', ['both_bands_print_set']));
  assert(!ok('seedlings', ['sprouts_print_set']));
  assert(!ok('seedlings', ['sprouts_kit']));
  assert(ok('legacy_kit', ['sprouts_kit']));
  assert(!ok('legacy_kit', ['sprouts_print_set']));
  assert(ok(null, ['anything']), 'an unnamed coupon is left to Stripe');
});

Deno.test('cart refusal wording: the kit one is unchanged; the new one names the band, no em dash', () => {
  assertEquals(starterCreditCartRefusal('legacy_kit', ['sprouts_print_set']), { code: 'CREDIT_KIT_REQUIRED', message: CREDIT_KIT_REQUIRED_MESSAGE });
  assertEquals(CREDIT_KIT_REQUIRED_MESSAGE, 'Your Starter Unit credit applies to the Sprouts Complete Kit. Add the kit to use it.');
  const sd = starterCreditCartRefusal('seedlings', ['sprouts_print_set'])!;
  assertEquals(sd.code, 'CREDIT_SET_REQUIRED');
  assert(sd.message.includes('Seedlings printed set'));
  const sp = starterCreditCartRefusal('sprouts', ['seedlings_print_set'])!;
  assert(sp.message.includes('Sprouts printed set'));
  for (const m of [sd.message, sp.message]) assert(!m.includes('—'), m);
});

// ===========================================================================
// The print shop's pre-applied ?promo= code: the same database check by email.
// ===========================================================================

function printFixture(over: Row = {}, promo: { coupon?: string; active?: boolean } = {}) {
  const db = new StrictDb();
  const stripe = fakeStripe();
  const row = creditRow({ stripe_promotion_code_id: 'promo_sp_1', code: 'EDEN-S-ABC234', ...over });
  db.seed('starter_credits', row);
  stripe.seedPromo({ id: row.stripe_promotion_code_id as string, code: row.code as string, coupon: promo.coupon ?? SPROUTS_COUPON, active: promo.active ?? true });
  return { db, stripe, row };
}
const SPROUTS_CART = ['sprouts_print_set'];

Deno.test('PRINT ?promo: an affiliate code is not a credit, and Stripe is not touched by the check', async () => {
  const { db } = printFixture();
  const d = await decidePrintPromoCredit(db as never, untouchable('stripe'), { rawCode: 'KAMI10', email: null, skus: SPROUTS_CART, offerSession: false });
  assertEquals(d.kind, 'not_a_credit');
});

Deno.test('PRINT ?promo: a valid credit from its owner is pre-applied (case and spaces forgiven)', async () => {
  const { db, stripe } = printFixture();
  const d = await decidePrintPromoCredit(db as never, stripe, { rawCode: ' eden-s-abc234 ', email: 'PARENT@example.com', skus: SPROUTS_CART, offerSession: false });
  assertEquals(d, { kind: 'apply', promotionCodeId: 'promo_sp_1', code: 'EDEN-S-ABC234', creditId: d.kind === 'apply' ? d.creditId : '' });
});

Deno.test('PRINT ?promo: the two-band set takes a Sprouts or a Seedlings credit', async () => {
  const sp = printFixture();
  assertEquals((await decidePrintPromoCredit(sp.db as never, sp.stripe, { rawCode: 'EDEN-S-ABC234', email: 'parent@example.com', skus: ['both_bands_print_set'], offerSession: false })).kind, 'apply');
  const sd = printFixture({}, { coupon: SEEDLINGS_COUPON });
  assertEquals((await decidePrintPromoCredit(sd.db as never, sd.stripe, { rawCode: 'EDEN-S-ABC234', email: 'parent@example.com', skus: ['both_bands_print_set'], offerSession: false })).kind, 'apply');
});

Deno.test('PRINT ?promo: refused with the existing readable errors (email missing, mismatched, used, deactivated)', async () => {
  const cases: Array<[Row, string | null, string, string]> = [
    [{}, null, 'CREDIT_EMAIL_REQUIRED', CREDIT_EMAIL_REQUIRED_MESSAGE],
    [{}, 'someone.else@example.com', 'CREDIT_EMAIL_MISMATCH', 'That credit belongs to a different email address. Credits are not transferable.'],
    [{ redeemed_at: '2026-11-01T00:00:00Z' }, 'parent@example.com', 'CREDIT_ALREADY_REDEEMED', 'That credit has already been used. Each Starter Unit comes with one credit.'],
    [{ deactivated_at: '2026-11-01T00:00:00Z' }, 'parent@example.com', 'CREDIT_DEACTIVATED', CREDIT_DEACTIVATED_MESSAGE],
  ];
  for (const [over, email, code, message] of cases) {
    const { db, stripe } = printFixture(over);
    const d = await decidePrintPromoCredit(db as never, stripe, { rawCode: 'EDEN-S-ABC234', email, skus: SPROUTS_CART, offerSession: false });
    assertEquals(d.kind, 'refuse', `${code}`);
    if (d.kind === 'refuse') {
      assertEquals(d.code, code);
      assertEquals(d.message, message);
    }
  }
});

Deno.test('PRINT ?promo: live in our table but inactive at Stripe is refused as deactivated', async () => {
  const { db, stripe } = printFixture({}, { active: false });
  const d = await decidePrintPromoCredit(db as never, stripe, { rawCode: 'EDEN-S-ABC234', email: 'parent@example.com', skus: SPROUTS_CART, offerSession: false });
  assertEquals(d.kind === 'refuse' && d.code, 'CREDIT_DEACTIVATED');
});

Deno.test('PRINT ?promo: a credit for the other band, or a legacy kit-only code, is refused before Stripe sees it', async () => {
  const sd = printFixture({}, { coupon: SEEDLINGS_COUPON });
  const a = await decidePrintPromoCredit(sd.db as never, sd.stripe, { rawCode: 'EDEN-S-ABC234', email: 'parent@example.com', skus: SPROUTS_CART, offerSession: false });
  assertEquals(a.kind === 'refuse' && a.code, 'CREDIT_SET_REQUIRED');
  const legacy = printFixture({}, { coupon: LEGACY_COUPON });
  const b = await decidePrintPromoCredit(legacy.db as never, legacy.stripe, { rawCode: 'EDEN-S-ABC234', email: 'parent@example.com', skus: SPROUTS_CART, offerSession: false });
  assertEquals(b.kind === 'refuse' && b.code, 'CREDIT_KIT_REQUIRED');
});

Deno.test('PRINT ?promo: an offer session pre-applies no credit and reads nothing from Stripe (no stacking)', async () => {
  const { db } = printFixture();
  const d = await decidePrintPromoCredit(db as never, untouchable('stripe'), { rawCode: 'EDEN-S-ABC234', email: 'parent@example.com', skus: SPROUTS_CART, offerSession: true });
  assertEquals(d.kind, 'skip');
});

Deno.test('PRINT ?promo: database or Stripe trouble pre-applies nothing, never throws', async () => {
  const a = printFixture();
  a.db.failNext('starter_credits', 'select');
  assertEquals((await decidePrintPromoCredit(a.db as never, a.stripe, { rawCode: 'EDEN-S-ABC234', email: 'parent@example.com', skus: SPROUTS_CART, offerSession: false })).kind, 'lookup_failed');
  const b = printFixture();
  b.stripe.failNext('retrieve');
  assertEquals((await decidePrintPromoCredit(b.db as never, b.stripe, { rawCode: 'EDEN-S-ABC234', email: 'parent@example.com', skus: SPROUTS_CART, offerSession: false })).kind, 'skip');
});

// ===========================================================================
// Redemption recording: idempotent, from the discount actually on the session.
// ===========================================================================

function paidSession(over: Row = {}): Row {
  return { id: 'cs_live_print_1', metadata: {}, total_details: { amount_discount: 0 }, ...over };
}

Deno.test('REDEEM: a session with no discount costs nothing (no Stripe call, no database call)', async () => {
  const out = await recordStarterCreditRedemptions(untouchable('db') as never, untouchable('stripe'), paidSession(), 'order-print-1');
  assertEquals(out, { promotionCodeIds: [], redeemed: [], lookupError: null });
});

Deno.test('REDEEM: our pre-applied code (metadata) is marked redeemed with the order and session', async () => {
  const { db, stripe } = printFixture();
  const session = paidSession({
    metadata: { starter_credit_promo_id: 'promo_sp_1', starter_credit_code: 'EDEN-S-ABC234' },
    total_details: { amount_discount: 3900, breakdown: { discounts: [{ amount: 3900, discount: { promotion_code: 'promo_sp_1' } }] } },
  });
  const out = await recordStarterCreditRedemptions(db as never, stripe, session, 'order-print-1');
  assertEquals(out.redeemed, ['promo_sp_1']);
  const row = db.rows('starter_credits')[0];
  assert(row.redeemed_at);
  assertEquals(row.redeemed_order_id, 'order-print-1');
  assertEquals(row.redeemed_session_id, 'cs_live_print_1');
  assertEquals(stripe.retrievedSessions.length, 0, 'the breakdown was already on the session');
});

Deno.test('REDEEM: a code TYPED into Checkout (no metadata) is found through the expanded breakdown', async () => {
  const { db, stripe } = printFixture();
  stripe.sessions.set('cs_live_print_1', paidSession({
    total_details: { amount_discount: 3900, breakdown: { discounts: [{ amount: 3900, discount: { promotion_code: { id: 'promo_sp_1' } } }] } },
  }));
  const out = await recordStarterCreditRedemptions(db as never, stripe, paidSession({ total_details: { amount_discount: 3900 } }), 'order-print-1');
  assertEquals(out.redeemed, ['promo_sp_1']);
  assertEquals(stripe.retrievedSessions[0].params, { expand: ['total_details.breakdown'] });
});

Deno.test('REDEEM: idempotent, so a Stripe retry cannot move the redemption timestamp', async () => {
  const { db, stripe } = printFixture();
  const session = paidSession({ metadata: { starter_credit_promo_id: 'promo_sp_1' }, total_details: { amount_discount: 3900, breakdown: { discounts: [] } } });
  await recordStarterCreditRedemptions(db as never, stripe, session, 'order-print-1');
  const first = db.rows('starter_credits')[0].redeemed_at;
  const again = await recordStarterCreditRedemptions(db as never, stripe, session, 'order-print-1');
  assertEquals(again.redeemed, []);
  assertEquals(db.rows('starter_credits')[0].redeemed_at, first);
});

Deno.test('REDEEM: an affiliate code on the session changes no credit row', async () => {
  const { db, stripe } = printFixture();
  const session = paidSession({ discounts: [{ promotion_code: 'promo_affiliate_kami10' }], total_details: { amount_discount: 2490, breakdown: { discounts: [] } } });
  const out = await recordStarterCreditRedemptions(db as never, stripe, session, 'order-print-1');
  assertEquals(out.promotionCodeIds, ['promo_affiliate_kami10']);
  assertEquals(out.redeemed, []);
  assertEquals(db.rows('starter_credits')[0].redeemed_at, null);
});

Deno.test('REDEEM: a failed session re-read is reported, and the metadata id still counts', async () => {
  const { db, stripe } = printFixture();
  stripe.failNext('session');
  const out = await recordStarterCreditRedemptions(db as never, stripe, paidSession({ metadata: { starter_credit_promo_id: 'promo_sp_1' }, total_details: { amount_discount: 3900 } }), 'order-print-1');
  assert(out.lookupError);
  assertEquals(out.redeemed, ['promo_sp_1']);
});

Deno.test('REDEEM: a database error throws (the webhook logs it; it never fails the order)', async () => {
  const { db, stripe } = printFixture();
  db.failNext('starter_credits', 'update');
  await assertRejects(() => recordStarterCreditRedemptions(db as never, stripe, paidSession({ metadata: { starter_credit_promo_id: 'promo_sp_1' } }), 'o'));
});

Deno.test('promotionCodeIdsOnSession reads both places Stripe reports a discount, ids or objects', () => {
  assertEquals(promotionCodeIdsOnSession({
    discounts: [{ promotion_code: 'promo_a' }, { promotion_code: null, coupon: 'c' }],
    total_details: { breakdown: { discounts: [{ discount: { promotion_code: { id: 'promo_b' } } }, { discount: { promotion_code: 'promo_a' } }] } },
  }), ['promo_a', 'promo_b']);
  assertEquals(promotionCodeIdsOnSession({}), []);
});

// ===========================================================================
// Refund: a refunded Starter takes its credit with it, new codes included.
// ===========================================================================

function refundFixture(lookupKey: string, creditOver: Row = {}) {
  const db = new StrictDb();
  const stripe = fakeStripe();
  db.seed('orders', { id: 'order-starter-1', stripe_checkout_session_id: 'cs_live_starter_1', stripe_payment_intent_id: 'pi_1', lookup_key: lookupKey });
  db.seed('starter_credits', creditRow({ stripe_promotion_code_id: 'promo_new_sd', ...creditOver }));
  stripe.seedPromo({ id: (creditOver.stripe_promotion_code_id as string) ?? 'promo_new_sd', code: 'EDEN-S-ABC234', coupon: SEEDLINGS_COUPON });
  return { db, stripe };
}

Deno.test('REFUND: a refunded Seedlings Starter (new 2026-11-22) deactivates its code at Stripe, then the row', async () => {
  const { db, stripe } = refundFixture('seedlings_starter_unit');
  assertEquals(await deactivateCreditForRefundedStarter(db as never, stripe, 'pi_1'), 'deactivated');
  assertEquals(stripe.updated, [{ id: 'promo_new_sd', params: { active: false } }]);
  const row = db.rows('starter_credits')[0];
  assert(row.deactivated_at);
  assertEquals(row.deactivated_reason, 'starter_purchase_refunded');
});

Deno.test('REFUND: a MOVED Sprouts credit cancels the new code (the row it lives on), not the retired one', async () => {
  const { db, stripe } = refundFixture('sprouts_starter_unit', { stripe_promotion_code_id: 'promo_moved_1', code: 'EDEN-S-NEW234' });
  assertEquals(await deactivateCreditForRefundedStarter(db as never, stripe, 'pi_1'), 'deactivated');
  assertEquals(stripe.updated[0].id, 'promo_moved_1');
});

Deno.test('REFUND: a spent credit is left alone; a cancelled one is not touched twice', async () => {
  const spent = refundFixture('sprouts_starter_unit', { redeemed_at: '2026-11-10T00:00:00Z' });
  assertEquals(await deactivateCreditForRefundedStarter(spent.db as never, spent.stripe, 'pi_1'), 'already_redeemed');
  assertEquals(spent.stripe.updated.length, 0);
  const done = refundFixture('sprouts_starter_unit', { deactivated_at: '2026-11-10T00:00:00Z' });
  assertEquals(await deactivateCreditForRefundedStarter(done.db as never, done.stripe, 'pi_1'), 'already_deactivated');
  assertEquals(done.stripe.updated.length, 0);
});

Deno.test('REFUND: a printed-set order or an unknown payment never reads starter_credits', async () => {
  const { db, stripe } = refundFixture('sprouts_print_set');
  assertEquals(await deactivateCreditForRefundedStarter(db as never, stripe, 'pi_1'), 'not_a_starter');
  assertEquals(await deactivateCreditForRefundedStarter(db as never, stripe, 'pi_unknown'), 'no_order');
  assert(!db.calls.some((c) => c.table === 'starter_credits'));
  assertEquals(stripe.updated.length, 0);
});

Deno.test('REFUND: Stripe failing throws and leaves our row active (the safe direction)', async () => {
  const { db, stripe } = refundFixture('seedlings_starter_unit');
  stripe.failNext('update');
  await assertRejects(() => deactivateCreditForRefundedStarter(db as never, stripe, 'pi_1'));
  assertEquals(db.rows('starter_credits')[0].deactivated_at, null);
});

// ===========================================================================
// Rule 4: the one-off move script.
// ===========================================================================

const FAMILIES = [
  'ann@example.com', 'beth@example.org', 'cara@example.net', 'dana@example.com', 'erin@example.com', 'fran@example.org',
];

/** Six outstanding legacy credits, plus rows the move must never touch. */
function moveFixture() {
  const db = new StrictDb();
  const stripe = fakeStripe();
  FAMILIES.forEach((email, i) => {
    const promo = `promo_legacy_${i + 1}`;
    const code = `EDEN-S-OLD${'ABCDEF'[i]}23`;
    db.seed('starter_credits', creditRow({
      id: `credit-${i + 1}`, stripe_checkout_session_id: `cs_live_family_${i + 1}`, email, code,
      stripe_promotion_code_id: promo, stripe_customer_id: `cus_family_${i + 1}`, issued_at: `2026-09-0${i + 1}T10:00:00Z`,
    }));
    stripe.seedPromo({ id: promo, code, coupon: LEGACY_COUPON, customer: `cus_family_${i + 1}` });
  });
  // Not outstanding: spent, and cancelled on refund. Never read as move candidates.
  db.seed('starter_credits', creditRow({ id: 'credit-spent', stripe_checkout_session_id: 'cs_spent', stripe_promotion_code_id: 'promo_legacy_spent', code: 'EDEN-S-SPENT2', redeemed_at: '2026-10-01T00:00:00Z' }));
  db.seed('starter_credits', creditRow({ id: 'credit-refunded', stripe_checkout_session_id: 'cs_refunded', stripe_promotion_code_id: 'promo_legacy_refunded', code: 'EDEN-S-REFND2', deactivated_at: '2026-10-01T00:00:00Z' }));
  // Outstanding but minted after the deploy, on the new Seedlings coupon: not legacy.
  db.seed('starter_credits', creditRow({ id: 'credit-sd-new', stripe_checkout_session_id: 'cs_sd_new', stripe_promotion_code_id: 'promo_sd_new', code: 'EDEN-S-SDNEW2', email: 'gail@example.com' }));
  stripe.seedPromo({ id: 'promo_sd_new', code: 'EDEN-S-SDNEW2', coupon: SEEDLINGS_COUPON });
  const deps = { db, stripe, legacyCouponId: LEGACY_COUPON, newCouponId: SPROUTS_COUPON };
  return { db, stripe, deps };
}

Deno.test('MOVE dry run: plans exactly the 6 outstanding legacy credits and WRITES NOTHING', async () => {
  const { db, stripe, deps } = moveFixture();
  const plan = await planStarterCreditMove(deps, { skipInternal: false });
  assertEquals(plan.moves, 6);
  assertEquals(plan.actions.filter((a) => a.kind === 'move').map((a) => a.row.id), FAMILIES.map((_, i) => `credit-${i + 1}`));
  assertEquals(plan.actions.filter((a) => a.kind === 'skip').map((a) => a.kind === 'skip' && a.reason), ['not_on_legacy_coupon']);
  assertEquals(db.writes(), [], 'a dry run never writes to the database');
  assertEquals(stripe.created.length + stripe.updated.length, 0, 'a dry run never writes to Stripe');
});

Deno.test('MOVE dry run output: emails and codes are masked, nothing secret is printed', async () => {
  const { deps } = moveFixture();
  const lines = describePlan(await planStarterCreditMove(deps, { skipInternal: false }));
  const text = lines.join('\n');
  assertEquals(lines[0], 'Plan: 6 to move, 0 to finish, 1 skipped.');
  for (const email of FAMILIES) assert(!text.includes(email), `full email printed: ${email}`);
  assert(!/EDEN-S-OLD[A-F]23/.test(text), 'a full code was printed');
  assert(text.includes('a***@example.com'));
  assertEquals(maskEmail('Ann@Example.com'), 'a***@example.com');
  assertEquals(maskCode('EDEN-S-ABC234'), 'EDEN-S-AB****');
});

Deno.test('MOVE apply refuses before any write unless --expect matches the plan', async () => {
  const { db, stripe, deps } = moveFixture();
  const plan = await planStarterCreditMove(deps, { skipInternal: false });
  await assertRejects(() => applyStarterCreditMove(deps, plan, { expectCount: 5 }), Error, 'refusing to apply');
  await assertRejects(() => applyStarterCreditMove(deps, plan, { expectCount: Number.NaN }), Error, 'refusing to apply');
  assertEquals(db.writes(), []);
  assertEquals(stripe.created.length + stripe.updated.length, 0);
});

Deno.test('MOVE apply: 6 new unbound single-use codes on the Sprouts printed-set coupon, 6 old codes active:false, same rows, no email', async () => {
  const { db, stripe, deps } = moveFixture();
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('the move must not touch the network (no email, no API besides the injected clients)'); };
  try {
    const before = db.rows('starter_credits').map((r) => ({ ...r }));
    const plan = await planStarterCreditMove(deps, { skipInternal: false });
    const results = await applyStarterCreditMove(deps, plan, { expectCount: 6 });

    assertEquals(results.map((r) => r.status), Array(6).fill('moved'));
    assertEquals(stripe.created.length, 6);
    for (const [i, c] of stripe.created.entries()) {
      assertEquals(c.coupon, SPROUTS_COUPON);
      assertEquals(c.customer, undefined, 'new codes are not bound to a Customer');
      assertEquals(c.max_redemptions, 1);
      assertEquals(c.expires_at, undefined);
      assertEquals((c.metadata as Row).replaces_promotion_code_id, `promo_legacy_${i + 1}`);
      assertEquals((c.metadata as Row).move_reason, MOVE_REASON);
      assertEquals((c.metadata as Row).starter_band, 'sprouts');
    }
    // Old codes retired the only way Stripe allows: active:false (expires_at is immutable).
    const retired = stripe.updated.filter((u) => String(u.id).startsWith('promo_legacy_'));
    assertEquals(retired.length, 6);
    for (const u of retired) {
      assertEquals(u.params.active, false);
      assertEquals((u.params.metadata as Row).deactivated_reason, MOVE_REASON);
      assertEquals(stripe.promos.get(u.id)!.active, false);
    }
    // The same rows, swapped in place: no new row, issued_at kept, still live.
    const after = db.rows('starter_credits');
    assertEquals(after.length, before.length, 'no row added or removed');
    for (let i = 0; i < 6; i++) {
      const row = after.find((r) => r.id === `credit-${i + 1}`)!;
      const old = before.find((r) => r.id === `credit-${i + 1}`)!;
      assert(row.code !== old.code && /^EDEN-S-[2-9A-HJKMNP-Z]{6}$/.test(row.code as string), String(row.code));
      assertEquals(row.stripe_promotion_code_id, stripe.created[i].id);
      assertEquals(row.issued_at, old.issued_at, 'days-to-redeem still counts from the Starter purchase');
      assertEquals(row.email, old.email);
      assertEquals(row.stripe_checkout_session_id, old.stripe_checkout_session_id);
      assertEquals(row.deactivated_at, null);
      assertEquals(row.redeemed_at, null);
    }
    // The untouched rows are untouched.
    for (const id of ['credit-spent', 'credit-refunded', 'credit-sd-new']) {
      assertEquals(after.find((r) => r.id === id), before.find((r) => r.id === id));
    }
    // Only starter_credits was written, and only by UPDATE.
    assertEquals([...new Set(db.writes().map((w) => `${w.table}:${w.op}`))], ['starter_credits:update']);
    // The result lines mask the new codes too.
    const out = describeResults(results).join('\n');
    for (const r of results) assert(!out.includes(r.newCode!), 'a new live code was printed in full');
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test('MOVE never emails: the module and the script import nothing that can', async () => {
  const mod = await codeOnly('./starter-credit-move.ts');
  const script = await codeOnly('../../../scripts/move-starter-credits-to-print.ts');
  for (const [name, code] of [['starter-credit-move.ts', mod], ['move-starter-credits-to-print.ts', script]]) {
    for (const forbidden of ['resend', 'Resend', 'RESEND', 'sendEmail', 'send-email', 'gmail', 'notifyFounder', 'fetch(']) {
      assert(!code.includes(forbidden), `${name} mentions ${forbidden}`);
    }
  }
  const imports = (s: string) => (s.match(/^import [\s\S]*? from ["'](.*)["'];?$/gm) ?? []).map((l) => l.replace(/[\s\S]* from ["'](.*)["'];?$/, '$1'));
  assertEquals(imports(mod), ['./starter-config.ts']);
  assertEquals(imports(script).sort(), [
    '../supabase/functions/_shared/starter-config.ts',
    '../supabase/functions/_shared/starter-credit-move.ts',
    'https://esm.sh/@supabase/supabase-js@2',
    'https://esm.sh/stripe@14.21.0?target=denonext',
  ]);
});

Deno.test('MOVE is re-runnable: after a full apply the plan is empty', async () => {
  const { deps } = moveFixture();
  await applyStarterCreditMove(deps, await planStarterCreditMove(deps, { skipInternal: false }), { expectCount: 6 });
  const again = await planStarterCreditMove(deps, { skipInternal: false });
  assertEquals(again.moves, 0);
  assertEquals(again.finishes, 0);
  assertEquals(again.actions.filter((a) => a.kind === 'skip' && a.reason === 'already_on_print_coupon').length, 6);
});

Deno.test('MOVE: an old code that could not be retired is finished by the next run', async () => {
  const { stripe, deps } = moveFixture();
  const plan = await planStarterCreditMove(deps, { skipInternal: false });
  // create ok, row swap ok, then the FIRST old-code deactivation fails.
  stripe.failNext('update');
  const results = await applyStarterCreditMove(deps, plan, { expectCount: 6 });
  assertEquals(results[0].status, 'moved_old_still_active');
  assertEquals(results.slice(1).map((r) => r.status), Array(5).fill('moved'));
  assert(stripe.promos.get('promo_legacy_1')!.active, 'still live after the failure');

  const again = await planStarterCreditMove(deps, { skipInternal: false });
  assertEquals(again.moves, 0);
  assertEquals(again.finishes, 1);
  const finish = await applyStarterCreditMove(deps, again, { expectCount: 0 });
  assertEquals(finish.map((r) => r.status), ['finished_old_deactivation']);
  assertEquals(stripe.promos.get('promo_legacy_1')!.active, false);
  assertEquals(stripe.created.length, 6, 'finishing mints nothing new');
});

Deno.test('MOVE: a row that changed after the plan keeps its old code; the new one is deactivated again', async () => {
  const { db, stripe, deps } = moveFixture();
  const plan = await planStarterCreditMove(deps, { skipInternal: false });
  // Family 3 spends the old code on a kit between the dry run and the apply.
  db.rows('starter_credits').find((r) => r.id === 'credit-3')!.redeemed_at = '2026-11-23T09:00:00Z';
  const results = await applyStarterCreditMove(deps, plan, { expectCount: 6 });
  const r3 = results.find((r) => r.creditId === 'credit-3')!;
  assertEquals(r3.status, 'not_moved_row_changed');
  assertEquals(stripe.promos.get(r3.newPromotionCodeId!)!.active, false, 'no orphan live code');
  const row = db.rows('starter_credits').find((r) => r.id === 'credit-3')!;
  assertEquals(row.stripe_promotion_code_id, 'promo_legacy_3');
  assertEquals(results.filter((r) => r.status === 'moved').length, 5);
});

Deno.test('MOVE: a failed mint changes nothing for that family', async () => {
  const { db, stripe, deps } = moveFixture();
  const plan = await planStarterCreditMove(deps, { skipInternal: false });
  stripe.failNext('create');
  const results = await applyStarterCreditMove(deps, plan, { expectCount: 6 });
  assertEquals(results[0].status, 'not_moved_create_failed');
  assertEquals(db.rows('starter_credits').find((r) => r.id === 'credit-1')!.stripe_promotion_code_id, 'promo_legacy_1');
  assert(stripe.promos.get('promo_legacy_1')!.active);
});

Deno.test('MOVE: Stripe disagreeing with our table skips the row for a human; internal rows can be skipped', async () => {
  const { db, stripe, deps } = moveFixture();
  stripe.promos.get('promo_legacy_1')!.active = false;
  stripe.promos.get('promo_legacy_2')!.times_redeemed = 1;
  db.seed('starter_credits', creditRow({ id: 'credit-internal', stripe_checkout_session_id: 'cs_internal', stripe_promotion_code_id: 'promo_legacy_int', code: 'EDEN-S-INTRN2', email: 'hello@edeninstitute.health' }));
  stripe.seedPromo({ id: 'promo_legacy_int', code: 'EDEN-S-INTRN2', coupon: LEGACY_COUPON });
  const reasons = (p: Awaited<ReturnType<typeof planStarterCreditMove>>) =>
    Object.fromEntries(p.actions.filter((a) => a.kind === 'skip').map((a) => [a.row.id, a.kind === 'skip' ? a.reason : '']));

  const withInternal = await planStarterCreditMove(deps, { skipInternal: false });
  assertEquals(withInternal.moves, 5, '4 families + the internal row');
  assertEquals(reasons(withInternal)['credit-1'], 'stripe_promo_inactive');
  assertEquals(reasons(withInternal)['credit-2'], 'stripe_promo_already_used');
  assert(describePlan(withInternal).some((l) => l.includes('h***@edeninstitute.health (internal)')));

  const skipping = await planStarterCreditMove(deps, { skipInternal: true });
  assertEquals(skipping.moves, 4);
  assertEquals(reasons(skipping)['credit-internal'], 'internal_address');
});

Deno.test('MOVE refuses a missing or identical coupon id (it would retire every code for nothing)', async () => {
  const { deps } = moveFixture();
  await assertRejects(() => planStarterCreditMove({ ...deps, newCouponId: '' }, { skipInternal: false }));
  await assertRejects(() => planStarterCreditMove({ ...deps, legacyCouponId: '' }, { skipInternal: false }));
  await assertRejects(() => planStarterCreditMove({ ...deps, newCouponId: LEGACY_COUPON }, { skipInternal: false }));
});

// ---------------------------------------------------------------------------
// The coupon check the script runs (read-only) before anything is moved.
// ---------------------------------------------------------------------------

function couponFixture(couponOver: Row = {}) {
  const db = new StrictDb();
  const stripe = fakeStripe();
  db.seed('products', { sku: 'sprouts_print_set', stripe_retail_price_id: 'price_sp_set', stripe_lookup_key: null });
  db.seed('products', { sku: 'both_bands_print_set', stripe_retail_price_id: null, stripe_lookup_key: 'both_bands_print_set' });
  db.seed('products', { sku: 'seedlings_print_set', stripe_retail_price_id: 'price_sd_set', stripe_lookup_key: null });
  stripe.priceStore.set('price_sp_set', { id: 'price_sp_set', product: 'prod_sp_set' });
  stripe.priceStore.set('price_sd_set', { id: 'price_sd_set', product: { id: 'prod_sd_set' } });
  stripe.priceStore.set('price_both', { id: 'price_both', product: 'prod_both', lookup_key: 'both_bands_print_set' });
  stripe.couponStore.set(SPROUTS_COUPON, {
    id: SPROUTS_COUPON, valid: true, amount_off: 3900, currency: 'usd', percent_off: null, duration: 'forever',
    redeem_by: null, max_redemptions: null, applies_to: { products: ['prod_sp_set', 'prod_both', STARTER_KIT_PRODUCT_ID] }, ...couponOver,
  });
  stripe.couponStore.set(SEEDLINGS_COUPON, {
    id: SEEDLINGS_COUPON, valid: true, amount_off: 3900, currency: 'usd', percent_off: null, duration: 'forever',
    redeem_by: null, max_redemptions: null, applies_to: { products: ['prod_sd_set', 'prod_both'] },
  });
  return { db, stripe };
}

Deno.test('COUPON check: correctly scoped coupons pass, resolving each sku to its product (price id or lookup key)', async () => {
  const { db, stripe } = couponFixture();
  const sp = await checkPrintCreditCoupon({ db, stripe }, 'sprouts', SPROUTS_COUPON);
  assertEquals(sp.problems, []);
  assert(sp.ok);
  assertEquals(sp.expected, [
    { sku: 'sprouts_print_set', productId: 'prod_sp_set' },
    { sku: 'both_bands_print_set', productId: 'prod_both' },
    { sku: 'sprouts_kit', productId: STARTER_KIT_PRODUCT_ID },
  ]);
  const sd = await checkPrintCreditCoupon({ db, stripe }, 'seedlings', SEEDLINGS_COUPON);
  assert(sd.ok, sd.problems.join('; '));
  assertEquals(db.writes(), []);
});

Deno.test('COUPON check: every way a coupon can be wrong is reported', async () => {
  const bad: Array<[Row, RegExp]> = [
    [{ applies_to: undefined }, /UNRESTRICTED/],
    [{ applies_to: { products: ['prod_sp_set', 'prod_both'] } }, /does not cover sprouts_kit/],
    [{ applies_to: { products: ['prod_sp_set', 'prod_both', STARTER_KIT_PRODUCT_ID, 'prod_sd_set'] } }, /also covers prod_sd_set/],
    [{ amount_off: 21000 }, /amount_off/],
    [{ duration: 'once' }, /duration/],
    [{ redeem_by: 1790000000 }, /never expires/],
    [{ max_redemptions: 6 }, /ALL families/],
    [{ percent_off: 100, amount_off: null }, /percent_off/],
    [{ valid: false }, /not valid/],
  ];
  for (const [over, pattern] of bad) {
    const { db, stripe } = couponFixture(over);
    const c = await checkPrintCreditCoupon({ db, stripe }, 'sprouts', SPROUTS_COUPON);
    assert(!c.ok, JSON.stringify(over));
    assert(c.problems.some((p) => pattern.test(p)), `${JSON.stringify(over)}: ${c.problems.join('; ')}`);
  }
  const { db, stripe } = couponFixture();
  assertEquals((await checkPrintCreditCoupon({ db, stripe }, 'sprouts', '')).ok, false);
  assertEquals((await checkPrintCreditCoupon({ db, stripe }, 'sprouts', 'coupon_missing')).ok, false);
});

Deno.test('the strict fake really rejects unknown columns (so the tests above mean something)', () => {
  const db = new StrictDb();
  assertThrows(() => db.from('starter_credits').insert({ band: 'sprouts' }));
  assertThrows(() => db.from('starter_credits').select('id, band'));
  assertThrows(() => db.from('starter_credits').update({ code: 'X' }).eq('starter_band', 'sprouts'));
  assertThrows(() => db.from('no_such_table'));
});
