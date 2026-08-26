// Run with: deno test supabase/functions/_shared/starter-credit.test.ts
//
// Covers every acceptance criterion that lives on our side of the wire. The three
// that live on Stripe's side cannot be asserted from here, because they are
// Stripe's enforcement rather than ours. They were verified directly against the
// API on 2026-08-26:
//
//   customer binding   a session for any other Customer is refused with
//                      promotion_code_customer_mismatch
//   kit-only scope     an order without the kit is refused with "This coupon
//                      cannot be redeemed because it does not apply to anything
//                      in this order"
//   no stacking        Stripe refuses a session carrying both `discounts` and
//                      `allow_promotion_codes`
//
// To re-run those against live, use scripts/create-starter-stripe-objects.ts,
// which re-verifies the coupon's product scope (with the required
// expand[]=applies_to) on every run.
//
// The stakes: a credit that is shareable, reusable, or valid against the wrong
// product does not throw and does not fail a happy-path test. It just sells kits
// below cost, quietly, until someone reconciles the ledger.

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  applyFoundingCapPolicy,
  creditIssuanceOpen,
  evaluateRedemption,
  issueStarterCredit,
  markCreditRedeemed,
  StarterCreditRow,
} from './starter-credit.ts';
import { generateCreditCode, normalizeCreditCode, STARTER_CREDIT_CENTS } from './starter-config.ts';

// ---------------------------------------------------------------------------
// A small in-memory stand-in for the PostgREST client.
//
// Deliberately supports only the chains this module actually uses, and
// deliberately DOES enforce unique constraints, because the idempotency
// guarantees under test are constraint-backed rather than code-backed. A fake
// that let duplicate inserts through would pass tests that production fails.
// ---------------------------------------------------------------------------
type Row = Record<string, unknown>;

class UniqueViolation extends Error {
  code = '23505';
}

class FakeTable {
  rows: Row[] = [];
  constructor(public uniqueCols: string[] = []) {}
}

class Query {
  private filters: Array<(r: Row) => boolean> = [];
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: Row | null = null;
  private wantSingle = false;

  constructor(private table: FakeTable, private beforeInsert?: () => void) {}

  select(_cols?: string) {
    if (this.op === 'select') this.op = 'select';
    return this;
  }
  insert(row: Row) { this.op = 'insert'; this.payload = row; return this; }
  update(row: Row) { this.op = 'update'; this.payload = row; return this; }
  delete() { this.op = 'delete'; return this; }
  in(col: string, vals: unknown[]) { this.filters.push((r) => vals.includes(r[col])); return this; }
  eq(col: string, val: unknown) { this.filters.push((r) => r[col] === val); return this; }
  is(col: string, val: unknown) { this.filters.push((r) => (r[col] ?? null) === val); return this; }
  maybeSingle() { this.wantSingle = true; return this; }

  private matching(): Row[] {
    return this.table.rows.filter((r) => this.filters.every((f) => f(r)));
  }

  // deno-lint-ignore no-explicit-any
  then(resolve: (v: any) => void) {
    try {
      if (this.op === 'insert') {
        this.beforeInsert?.();
        const row = { ...this.payload } as Row;
        for (const col of this.table.uniqueCols) {
          if (row[col] !== undefined && this.table.rows.some((r) => r[col] === row[col])) {
            throw new UniqueViolation(`duplicate key on ${col}`);
          }
        }
        if (!row.id) row.id = crypto.randomUUID();
        this.table.rows.push(row);
        return resolve({ data: this.wantSingle ? row : [row], error: null });
      }
      if (this.op === 'update') {
        const hits = this.matching();
        for (const r of hits) Object.assign(r, this.payload);
        return resolve({ data: this.wantSingle ? (hits[0] ?? null) : hits, error: null });
      }
      if (this.op === 'delete') {
        const hits = this.matching();
        this.table.rows = this.table.rows.filter((r) => !hits.includes(r));
        return resolve({ data: hits, error: null });
      }
      const hits = this.matching();
      return resolve({ data: this.wantSingle ? (hits[0] ?? null) : hits, error: null });
    } catch (err) {
      // deno-lint-ignore no-explicit-any
      return resolve({ data: null, error: err as any });
    }
  }
}

class FakeDb {
  tables = new Map<string, FakeTable>();
  /**
   * Fires once, immediately before the next insert lands. This is the only way to
   * reproduce a genuine lost race: the caller's pre-read must MISS, then a
   * concurrent writer must claim the row, then the caller's insert must collide.
   */
  onBeforeInsert: (() => void) | null = null;

  constructor() {
    this.tables.set(
      'starter_credits',
      new FakeTable(['stripe_checkout_session_id', 'code', 'stripe_promotion_code_id']),
    );
    this.tables.set('starter_credit_phases', new FakeTable(['phase']));
  }
  from(name: string) {
    const t = this.tables.get(name) ?? new FakeTable();
    if (!this.tables.has(name)) this.tables.set(name, t);
    return new Query(t, () => {
      const hook = this.onBeforeInsert;
      this.onBeforeInsert = null;
      hook?.();
    }) as never;
  }
  rpc() { throw new Error('rpc not used by starter-credit'); }
}

/** Stripe stand-in that records what it was asked to do. */
function fakeStripe() {
  const created: Row[] = [];
  const updated: Array<{ id: string; params: Row }> = [];
  let failNextUpdate = false;
  return {
    created,
    updated,
    failUpdates() { failNextUpdate = true; },
    promotionCodes: {
      // deno-lint-ignore no-explicit-any
      create(params: any) {
        const id = `promo_${created.length + 1}`;
        created.push({ id, ...params });
        return Promise.resolve({ id, ...params });
      },
      // deno-lint-ignore no-explicit-any
      update(id: string, params: any) {
        if (failNextUpdate) return Promise.reject(new Error('stripe down'));
        updated.push({ id, params });
        return Promise.resolve({ id, ...params });
      },
    },
  };
}

function credit(over: Partial<StarterCreditRow> = {}): StarterCreditRow {
  return {
    id: 'c1',
    code: 'EDEN-S-ABC234',
    email: 'parent@example.com',
    stripe_customer_id: 'cus_1',
    stripe_promotion_code_id: 'promo_1',
    amount_cents: STARTER_CREDIT_CENTS,
    issued_at: '2026-08-26T00:00:00Z',
    redeemed_at: null,
    deactivated_at: null,
    deactivated_reason: null,
    ...over,
  };
}

Deno.env.set('STRIPE_STARTER_CREDIT_COUPON_ID', 'coupon_test');

// ---------------------------------------------------------------------------
// evaluateRedemption: the pure decision
// ---------------------------------------------------------------------------

Deno.test('a valid code presented by its owner is accepted', () => {
  const v = evaluateRedemption(credit(), 'parent@example.com');
  assert(v.ok);
});

Deno.test('an unknown code is refused', () => {
  const v = evaluateRedemption(null, 'parent@example.com');
  assert(!v.ok);
  assertEquals(v.code, 'CREDIT_NOT_FOUND');
});

Deno.test('ACCEPTANCE: a code is rejected on a second use', () => {
  const v = evaluateRedemption(credit({ redeemed_at: '2026-09-01T12:00:00Z' }), 'parent@example.com');
  assert(!v.ok);
  assertEquals(v.code, 'CREDIT_ALREADY_REDEEMED');
});

Deno.test('ACCEPTANCE: a code is rejected from a different email', () => {
  const v = evaluateRedemption(credit(), 'someone.else@example.com');
  assert(!v.ok);
  assertEquals(v.code, 'CREDIT_EMAIL_MISMATCH');
});

Deno.test('the email lock ignores case and surrounding whitespace', () => {
  assert(evaluateRedemption(credit(), '  PARENT@Example.COM  ').ok);
});

Deno.test('the email lock does NOT fold plus-addressing or gmail dots', () => {
  // Folding these would let one buyer mint unlimited identities that all pass.
  assert(!evaluateRedemption(credit(), 'parent+kit@example.com').ok);
  assert(!evaluateRedemption(credit({ email: 'first.last@gmail.com' }), 'firstlast@gmail.com').ok);
});

Deno.test('a deactivated code is refused even for the right owner', () => {
  const v = evaluateRedemption(credit({ deactivated_at: '2026-10-01T00:00:00Z' }), 'parent@example.com');
  assert(!v.ok);
  assertEquals(v.code, 'CREDIT_DEACTIVATED');
});

Deno.test('a used code refuses on use before it refuses on email', () => {
  // Ordering check: a stranger presenting a spent code should not be able to tell
  // "spent" from "not yours" by which message comes back first.
  const v = evaluateRedemption(
    credit({ redeemed_at: '2026-09-01T00:00:00Z' }),
    'someone.else@example.com',
  );
  assert(!v.ok);
  assertEquals(v.code, 'CREDIT_ALREADY_REDEEMED');
});

// ---------------------------------------------------------------------------
// Code shape
// ---------------------------------------------------------------------------

Deno.test('generated codes avoid glyphs that are ambiguous when retyped', () => {
  for (let i = 0; i < 400; i++) {
    const body = generateCreditCode().replace('EDEN-S-', '');
    assertEquals(body.length, 6);
    assert(!/[01OIL]/.test(body), `ambiguous glyph in ${body}`);
  }
});

Deno.test('code normalisation matches how a buyer retypes it', () => {
  assertEquals(normalizeCreditCode('  eden-s-abc234 '), 'EDEN-S-ABC234');
});

// ---------------------------------------------------------------------------
// Issuance idempotency
// ---------------------------------------------------------------------------

const issueInput = {
  sessionId: 'cs_test_1',
  orderId: 'o1',
  email: 'Parent@Example.com',
  purchaserName: 'A Parent',
  stripeCustomerId: 'cus_1',
};

Deno.test('ACCEPTANCE: a duplicate webhook does not issue a second code', async () => {
  const db = new FakeDb();
  const stripe = fakeStripe();

  const first = await issueStarterCredit(db as never, stripe, issueInput);
  const second = await issueStarterCredit(db as never, stripe, issueInput);

  assertEquals(first.created, true);
  assertEquals(second.created, false, 'the retry must not create a new credit');
  assertEquals(second.code, first.code, 'the retry must return the original code');
  assertEquals(stripe.created.length, 1, 'Stripe must be called exactly once');
  assertEquals(db.tables.get('starter_credits')!.rows.length, 1);
});

Deno.test('the stored email is normalised at write time', async () => {
  const db = new FakeDb();
  await issueStarterCredit(db as never, fakeStripe(), issueInput);
  assertEquals(db.tables.get('starter_credits')!.rows[0].email, 'parent@example.com');
});

Deno.test('the minted Stripe code is bound to the customer and single-use', async () => {
  const stripe = fakeStripe();
  await issueStarterCredit(new FakeDb() as never, stripe, issueInput);
  const params = stripe.created[0];
  assertEquals(params.customer, 'cus_1');
  assertEquals(params.max_redemptions, 1);
  assertEquals(params.coupon, 'coupon_test');
  // expires_at must NOT be set: it cannot be changed later, and under the shipped
  // honour_retail policy the credit deliberately outlives the founding window.
  assertEquals(params.expires_at, undefined);
});

Deno.test('a known session never reaches Stripe at all', async () => {
  const db = new FakeDb();
  const stripe = fakeStripe();
  db.tables.get('starter_credits')!.rows.push({
    id: 'winner',
    stripe_checkout_session_id: 'cs_test_known',
    code: 'EDEN-S-WINNER',
    stripe_promotion_code_id: 'promo_winner',
    amount_cents: STARTER_CREDIT_CENTS,
    email: 'parent@example.com',
  });

  const out = await issueStarterCredit(db as never, stripe, {
    ...issueInput, sessionId: 'cs_test_known',
  });
  assertEquals(out.created, false);
  assertEquals(out.code, 'EDEN-S-WINNER');
  assertEquals(stripe.created.length, 0);
});

Deno.test('ACCEPTANCE: losing the insert race deactivates the duplicate Stripe code', async () => {
  // The genuine race: our pre-read MISSES, a concurrent delivery claims the row,
  // and only then does our insert collide. Without the cleanup this leaves two
  // live $39 codes on one purchase, which is a second free credit for anyone who
  // sees both. The hook below is what makes the collision real rather than
  // simulated.
  const db = new FakeDb();
  const stripe = fakeStripe();

  db.onBeforeInsert = () => {
    db.tables.get('starter_credits')!.rows.push({
      id: 'winner',
      stripe_checkout_session_id: 'cs_test_race',
      code: 'EDEN-S-WINNER',
      stripe_promotion_code_id: 'promo_winner',
      amount_cents: STARTER_CREDIT_CENTS,
      email: 'parent@example.com',
    });
  };

  const out = await issueStarterCredit(db as never, stripe, {
    ...issueInput, sessionId: 'cs_test_race',
  });

  assertEquals(stripe.created.length, 1, 'we did mint a code before discovering the race');
  assertEquals(out.created, false, 'but we must report the winner, not our own');
  assertEquals(out.code, 'EDEN-S-WINNER');
  assertEquals(stripe.updated.length, 1, 'our duplicate must be deactivated');
  assertEquals(stripe.updated[0].id, 'promo_1');
  assertEquals(stripe.updated[0].params.active, false);
  assertEquals(db.tables.get('starter_credits')!.rows.length, 1, 'one credit per purchase');
});

Deno.test('a failed duplicate cleanup is reported, not swallowed', async () => {
  // If Stripe refuses the deactivation there is a live orphan code worth $39.
  // The function must still return the winner (the buyer is fine) but the orphan
  // has to be recoverable, which means it must be named in the log.
  const db = new FakeDb();
  const stripe = fakeStripe();
  const errors: string[] = [];
  const realError = console.error;
  console.error = (...a: unknown[]) => { errors.push(a.map(String).join(' ')); };

  db.onBeforeInsert = () => {
    stripe.failUpdates();
    db.tables.get('starter_credits')!.rows.push({
      id: 'winner',
      stripe_checkout_session_id: 'cs_test_race2',
      code: 'EDEN-S-WINNER',
      stripe_promotion_code_id: 'promo_winner',
      amount_cents: STARTER_CREDIT_CENTS,
      email: 'parent@example.com',
    });
  };

  try {
    const out = await issueStarterCredit(db as never, stripe, {
      ...issueInput, sessionId: 'cs_test_race2',
    });
    assertEquals(out.code, 'EDEN-S-WINNER', 'the buyer still gets a working credit');
  } finally {
    console.error = realError;
  }

  assert(errors.some((e) => e.includes('promo_1')),
    'the orphaned promotion code id must appear in the log so it can be killed by hand');
});

Deno.test('issuance refuses rather than guesses when the coupon id is missing', async () => {
  const saved = Deno.env.get('STRIPE_STARTER_CREDIT_COUPON_ID')!;
  Deno.env.delete('STRIPE_STARTER_CREDIT_COUPON_ID');
  let threw = false;
  try {
    await issueStarterCredit(new FakeDb() as never, fakeStripe(), issueInput);
  } catch {
    threw = true;
  } finally {
    Deno.env.set('STRIPE_STARTER_CREDIT_COUPON_ID', saved);
  }
  assert(threw, 'a missing coupon id must throw, never fall back to a guess');
});

// ---------------------------------------------------------------------------
// Redemption write
// ---------------------------------------------------------------------------

Deno.test('redemption is a compare-and-set, so a retry cannot rewrite the timestamp', async () => {
  const db = new FakeDb();
  await issueStarterCredit(db as never, fakeStripe(), issueInput);
  const promoId = db.tables.get('starter_credits')!.rows[0].stripe_promotion_code_id as string;

  const first = await markCreditRedeemed(db as never, {
    promotionCodeId: promoId, orderId: 'kit1', sessionId: 'cs_kit_1',
  });
  const originalAt = db.tables.get('starter_credits')!.rows[0].redeemed_at;

  const retry = await markCreditRedeemed(db as never, {
    promotionCodeId: promoId, orderId: 'kit1', sessionId: 'cs_kit_1',
  });

  assertEquals(first.redeemed, true);
  assertEquals(retry.redeemed, false, 'a retry must report no-op');
  assertEquals(
    db.tables.get('starter_credits')!.rows[0].redeemed_at,
    originalAt,
    'days-to-redeem must not be destroyed by a retry',
  );
});

// ---------------------------------------------------------------------------
// The founding-500 trigger
// ---------------------------------------------------------------------------

Deno.test('ACCEPTANCE: the founding-cap trigger executes exactly once', async () => {
  const db = new FakeDb();
  const stripe = fakeStripe();

  const results = await Promise.all(
    Array.from({ length: 8 }, () =>
      applyFoundingCapPolicy(db as never, stripe, { soldAtTrigger: 500 })),
  );

  const winners = results.filter((r) => r.transitioned);
  assertEquals(winners.length, 1, 'exactly one caller may win the phase claim');
  assertEquals(db.tables.get('starter_credit_phases')!.rows.length, 1);
  assertEquals(db.tables.get('starter_credit_phases')!.rows[0].founding_units_at_trigger, 500);
});

Deno.test('a later kit sale does not re-trigger the transition', async () => {
  const db = new FakeDb();
  const stripe = fakeStripe();
  await applyFoundingCapPolicy(db as never, stripe, { soldAtTrigger: 500 });
  const again = await applyFoundingCapPolicy(db as never, stripe, { soldAtTrigger: 512 });
  assertEquals(again.transitioned, false);
  assertEquals(db.tables.get('starter_credit_phases')!.rows.length, 1);
});

Deno.test('SHIPPED POLICY: at the cap, outstanding credits stay live for retail', async () => {
  const db = new FakeDb();
  const stripe = fakeStripe();
  await issueStarterCredit(db as never, stripe, issueInput);

  const out = await applyFoundingCapPolicy(db as never, stripe, {
    soldAtTrigger: 500, policy: 'honour_retail',
  });

  assertEquals(out.transitioned, true);
  assertEquals(out.codesAffected, 0);
  assertEquals(stripe.updated.length, 0, 'honour_retail must not touch Stripe');

  const row = db.tables.get('starter_credits')!.rows[0] as unknown as StarterCreditRow;
  assertEquals(row.deactivated_at ?? null, null);
  assert(evaluateRedemption(row, 'parent@example.com').ok, 'the credit must still redeem after the cap');
});

Deno.test('ORIGINAL BRIEF: under expire_at_cap, a pre-cap code is refused after the cap', async () => {
  const db = new FakeDb();
  const stripe = fakeStripe();
  await issueStarterCredit(db as never, stripe, issueInput);

  const before = db.tables.get('starter_credits')!.rows[0] as unknown as StarterCreditRow;
  assert(evaluateRedemption(before, 'parent@example.com').ok, 'valid before the cap');

  const out = await applyFoundingCapPolicy(db as never, stripe, {
    soldAtTrigger: 500, policy: 'expire_at_cap',
  });

  assertEquals(out.codesAffected, 1);
  assertEquals(stripe.updated.length, 1);
  assertEquals(stripe.updated[0].params.active, false, 'expiry is active:false, since expires_at is immutable');

  const after = db.tables.get('starter_credits')!.rows[0] as unknown as StarterCreditRow;
  const verdict = evaluateRedemption(after, 'parent@example.com');
  assert(!verdict.ok);
  assertEquals(verdict.code, 'CREDIT_DEACTIVATED');
});

Deno.test('under expire_at_cap, an already-redeemed code is left alone', async () => {
  const db = new FakeDb();
  const stripe = fakeStripe();
  await issueStarterCredit(db as never, stripe, issueInput);
  const promoId = db.tables.get('starter_credits')!.rows[0].stripe_promotion_code_id as string;
  await markCreditRedeemed(db as never, { promotionCodeId: promoId, orderId: 'k', sessionId: 's' });

  const out = await applyFoundingCapPolicy(db as never, stripe, {
    soldAtTrigger: 500, policy: 'expire_at_cap',
  });
  assertEquals(out.codesAffected, 0, 'a spent code needs no deactivation');
  assertEquals(stripe.updated.length, 0);
});

Deno.test('a Stripe failure during expiry leaves the credit live for retry', async () => {
  const db = new FakeDb();
  const stripe = fakeStripe();
  await issueStarterCredit(db as never, stripe, issueInput);
  stripe.failUpdates();

  const out = await applyFoundingCapPolicy(db as never, stripe, {
    soldAtTrigger: 500, policy: 'expire_at_cap',
  });

  assertEquals(out.codesAffected, 0);
  const row = db.tables.get('starter_credits')!.rows[0] as unknown as StarterCreditRow;
  assertEquals(row.deactivated_at ?? null, null,
    'local state must not claim deactivated when Stripe still has it live');
});

Deno.test('expire_at_cap without a Stripe client releases the claim rather than faking success', async () => {
  // Claiming the phase but not performing the deactivation would mark the
  // transition done while leaving every code live: the worst of both policies.
  const db = new FakeDb();
  await issueStarterCredit(db as never, fakeStripe(), issueInput);

  let threw = false;
  try {
    await applyFoundingCapPolicy(db as never, undefined, {
      soldAtTrigger: 500, policy: 'expire_at_cap',
    });
  } catch {
    threw = true;
  }

  assert(threw, 'it must refuse rather than silently no-op');
  assertEquals(
    db.tables.get('starter_credit_phases')!.rows.length, 0,
    'the claim must be released so a properly-equipped caller can retry',
  );
});

// ---------------------------------------------------------------------------
// Issuance gate after the cap
// ---------------------------------------------------------------------------

Deno.test('SHIPPED POLICY: new credits keep being issued after the cap', async () => {
  const db = new FakeDb();
  await applyFoundingCapPolicy(db as never, fakeStripe(), {
    soldAtTrigger: 500, policy: 'honour_retail',
  });
  assertEquals(await creditIssuanceOpen(db as never, 'honour_retail'), true);
});

Deno.test('ORIGINAL BRIEF: no new credits may be issued after the cap', async () => {
  const db = new FakeDb();
  assertEquals(await creditIssuanceOpen(db as never, 'expire_at_cap'), true);
  await applyFoundingCapPolicy(db as never, fakeStripe(), {
    soldAtTrigger: 500, policy: 'expire_at_cap',
  });
  assertEquals(await creditIssuanceOpen(db as never, 'expire_at_cap'), false);
});

// ---------------------------------------------------------------------------
// The dedicated promotion-code client
// ---------------------------------------------------------------------------

Deno.test('promotion codes still mint when STRIPE_STARTER_PROMO_KEY is absent', async () => {
  Deno.env.delete('STRIPE_STARTER_PROMO_KEY');
  const db = new FakeDb();
  const stripe = fakeStripe();
  const out = await issueStarterCredit(db as never, stripe, issueInput);
  assertEquals(out.created, true);
  assertEquals(stripe.created.length, 1, 'the passed-in client must be used');
});

Deno.test('a non-Stripe client is never swapped out, even with the key set', async () => {
  // The test doubles are object literals, so their constructor is Object.
  // `new Object(key, ...)` returns {} with no promotionCodes on it, which would
  // crash at the call site rather than fall back. The guard must reject it.
  Deno.env.set('STRIPE_STARTER_PROMO_KEY', 'rk_live_not_a_real_key');
  try {
    const db = new FakeDb();
    const stripe = fakeStripe();
    const out = await issueStarterCredit(db as never, stripe, issueInput);
    assertEquals(out.created, true);
    assertEquals(stripe.created.length, 1, 'must fall back to the passed-in client');
  } finally {
    Deno.env.delete('STRIPE_STARTER_PROMO_KEY');
  }
});
