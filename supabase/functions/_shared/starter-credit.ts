// supabase/functions/_shared/starter-credit.ts
//
// The Starter Unit kit credit: minting, redemption checks, and the founding-cap
// phase transition.
//
// This is the highest-risk code in the feature. A credit that is shareable,
// re-usable, or valid against the wrong product does not throw and does not show
// up in a happy-path test; it just quietly sells kits below cost. So the decision
// itself is a PURE function (evaluateRedemption) with the database and Stripe
// kept outside it, and every branch has a test in starter-credit.test.ts.
//
// THREE LAYERS OF ENFORCEMENT, on purpose. Each catches what the others cannot:
//
//   1. OUR DATABASE (evaluateRedemption, below). Produces the readable error the
//      buyer sees, and is the only layer that knows about EMAIL. Runs before
//      Stripe is called at all.
//   2. STRIPE'S CUSTOMER BINDING. Every promotion code is created bound to the
//      purchaser's Stripe Customer. A session for any other customer is rejected
//      with `promotion_code_customer_mismatch`. Verified against the live API
//      2026-08-26. This is the layer that holds if our check is ever bypassed.
//   3. STRIPE'S COUPON PRODUCT SCOPE. The coupon carries
//      applies_to[products] = [kit product]. An order without the kit in it is
//      rejected with "This coupon cannot be redeemed because it does not apply to
//      anything in this order." Also verified 2026-08-26.
//
// NO-STACKING is structural rather than enforced: Stripe refuses to create a
// session carrying both `discounts` and `allow_promotion_codes`
// ("You may only specify one of these parameters"), and Checkout accepts at most
// one discount. The preorder checkout path therefore sets `discounts` and never
// sets `allow_promotion_codes`, and that is the whole of the no-stacking story.
//
// A NOTE ON expires_at. The Stripe API does NOT allow expires_at to be updated
// after a promotion code is created (the update endpoint accepts only `active`,
// `metadata` and `restrictions`). So "expire these codes" can only ever mean
// `active: false`. That is what deactivateOutstandingCredits does, and it is why
// the founding-cap policy is expressed as deactivation rather than as an expiry
// date rewrite.

import { Db } from './order-db.ts';
import {
  CREDIT_EXPIRY_POLICY,
  CreditExpiryPolicy,
  STARTER_CREDIT_CENTS,
  generateCreditCode,
  normalizeCreditCode,
  normalizeEmail,
} from './starter-config.ts';

// deno-lint-ignore no-explicit-any
function errCode(err: any): string | undefined { return err?.code; }

export interface StarterCreditRow {
  id: string;
  code: string;
  email: string;
  stripe_customer_id: string;
  stripe_promotion_code_id: string;
  amount_cents: number;
  issued_at: string;
  redeemed_at: string | null;
  deactivated_at: string | null;
  deactivated_reason: string | null;
}

export type RedemptionRefusal =
  | 'CREDIT_NOT_FOUND'
  | 'CREDIT_ALREADY_REDEEMED'
  | 'CREDIT_EMAIL_MISMATCH'
  | 'CREDIT_DEACTIVATED';

export type RedemptionVerdict =
  | { ok: true; credit: StarterCreditRow }
  | { ok: false; code: RedemptionRefusal; message: string };

/**
 * Decide whether this code, presented by this email, may be redeemed.
 *
 * PURE. No database, no Stripe, no clock beyond what is passed in. Every
 * acceptance criterion about the credit is a call to this function.
 *
 * Order of checks matters and is deliberate:
 *   not-found  -> already-redeemed -> deactivated -> email mismatch
 * The email check is LAST so that a stranger probing codes learns nothing about
 * whether a code exists or has been used; they get the same email-mismatch
 * refusal either way once they are past the code lookup. (A stranger who has the
 * code already knows it exists, so ordering earlier checks first costs nothing.)
 */
export function evaluateRedemption(
  credit: StarterCreditRow | null,
  presentedEmail: string,
): RedemptionVerdict {
  if (!credit) {
    return {
      ok: false,
      code: 'CREDIT_NOT_FOUND',
      message: 'We could not find that credit code. Check it against your Starter Unit email.',
    };
  }

  if (credit.redeemed_at) {
    return {
      ok: false,
      code: 'CREDIT_ALREADY_REDEEMED',
      message: 'That credit has already been used. Each Starter Unit comes with one credit.',
    };
  }

  if (credit.deactivated_at) {
    return {
      ok: false,
      code: 'CREDIT_DEACTIVATED',
      message: 'That credit is no longer active. Reply to your Starter Unit email and we will sort it out.',
    };
  }

  // The email lock. Case and surrounding whitespace are noise; anything else is a
  // different person. Deliberately NOT doing gmail dot-stripping or plus-address
  // folding: those would let one buyer mint themselves infinite distinct-looking
  // identities that all pass, which is the exact thing this check exists to stop.
  if (normalizeEmail(credit.email) !== normalizeEmail(presentedEmail)) {
    return {
      ok: false,
      code: 'CREDIT_EMAIL_MISMATCH',
      message: 'That credit belongs to a different email address. Credits are not transferable.',
    };
  }

  return { ok: true, credit };
}

/** Look a credit up by code. Case-insensitive, matching how it is printed. */
export async function findCreditByCode(db: Db, rawCode: string): Promise<StarterCreditRow | null> {
  const code = normalizeCreditCode(rawCode);
  if (!code) return null;
  const { data, error } = await db.from('starter_credits')
    .select('id, code, email, stripe_customer_id, stripe_promotion_code_id, amount_cents, issued_at, redeemed_at, deactivated_at, deactivated_reason')
    .eq('code', code)
    .maybeSingle();
  if (error) throw new Error(`starter credit lookup failed: ${error.message}`);
  return (data as StarterCreditRow) ?? null;
}

// deno-lint-ignore no-explicit-any
type StripeLike = any;

/**
 * Which Stripe client mints and deactivates promotion codes.
 *
 * Creating a promotion code needs `promotion_code_write`, which is a SEPARATE
 * permission from the `checkout_session_write` the rest of this project relies
 * on. A STRIPE_SECRET_KEY that happily creates Checkout Sessions can still be
 * unable to create a promotion code, and that failure would land AFTER payment:
 * $39 taken, no credit issued, one buyer at a time.
 *
 * Supabase returns secret values as hashes, so the main key's scopes cannot be
 * inspected. Rather than assume, STRIPE_STARTER_PROMO_KEY holds a restricted key
 * whose promotion-code write was verified directly against the live API
 * (2026-08-26). It is scoped to products, prices, coupons and promotion codes
 * only: it cannot charge, refund, or read a customer.
 *
 * Falls back to the passed-in client when the secret is absent, so nothing breaks
 * if it is ever removed.
 */
function promoClient(fallback: StripeLike): StripeLike {
  const key = Deno.env.get('STRIPE_STARTER_PROMO_KEY');
  if (!key) return fallback;
  // deno-lint-ignore no-explicit-any
  const ctor = (fallback as any)?.constructor;
  // `createFetchHttpClient` is a Stripe-specific static, so it identifies a real
  // Stripe constructor. Checking only `typeof ctor === 'function'` would match
  // plain Object, and `new Object(key, ...)` returns an empty object with no
  // promotionCodes on it, which would crash at the call site instead of falling
  // back here. That matters for the test doubles, which are object literals.
  if (typeof ctor !== 'function' || typeof ctor.createFetchHttpClient !== 'function') {
    return fallback;
  }
  try {
    return new ctor(key, {
      apiVersion: '2024-12-18.acacia',
      httpClient: ctor.createFetchHttpClient(),
    });
  } catch (err) {
    console.error(
      'STRIPE_STARTER_PROMO_KEY is set but a client could not be built; ' +
        'falling back to the main Stripe client: ' +
        (err instanceof Error ? err.message : String(err)),
    );
    return fallback;
  }
}

export interface IssueCreditInput {
  sessionId: string;
  orderId: string | null;
  email: string;
  purchaserName: string | null;
  stripeCustomerId: string;
}

export interface IssuedCredit {
  code: string;
  promotionCodeId: string;
  amountCents: number;
  /** False when an existing row was returned, i.e. this was a webhook retry. */
  created: boolean;
}

/**
 * Mint the single-use kit credit for one Starter Unit purchase.
 *
 * IDEMPOTENT, and that is the whole point. Stripe retries
 * checkout.session.completed, and a retry must not produce a second code. The
 * guarantee comes from the UNIQUE on starter_credits.stripe_checkout_session_id,
 * not from the caller running once:
 *
 *   1. Read first. On a retry this returns the existing row and we are done
 *      without touching Stripe at all.
 *   2. Create the Stripe promotion code.
 *   3. Insert. If the insert loses a race (23505), the concurrent winner already
 *      has a valid code, so DEACTIVATE the one we just minted and return theirs.
 *      Leaving it active would put two live codes on one purchase, which is a
 *      second free $39 for anyone who sees both.
 *
 * Step 3's cleanup is best-effort but loud: a leaked active code is a real money
 * leak, and it is recoverable by hand from the log line.
 */
export async function issueStarterCredit(
  db: Db,
  stripe: StripeLike,
  input: IssueCreditInput,
): Promise<IssuedCredit> {
  const couponId = Deno.env.get('STRIPE_STARTER_CREDIT_COUPON_ID');
  if (!couponId) {
    // No guessed fallback. A wrong coupon id silently discounts the wrong thing.
    throw new Error('STRIPE_STARTER_CREDIT_COUPON_ID is not set; cannot issue a starter credit');
  }

  const existing = await db.from('starter_credits')
    .select('code, stripe_promotion_code_id, amount_cents')
    .eq('stripe_checkout_session_id', input.sessionId)
    .maybeSingle();
  if (existing.data) {
    console.log(`starter credit already issued for session ${input.sessionId}: ${existing.data.code}`);
    return {
      code: existing.data.code,
      promotionCodeId: existing.data.stripe_promotion_code_id,
      amountCents: existing.data.amount_cents,
      created: false,
    };
  }

  const email = normalizeEmail(input.email);
  const code = generateCreditCode();

  // max_redemptions: 1 is Stripe's own single-use guard, independent of our
  // redeemed_at column. expires_at is deliberately NOT set: under the shipped
  // 'honour_retail' policy the credit outlives the founding window, and expires_at
  // cannot be changed later even if we wanted to move it.
  const promo = await promoClient(stripe).promotionCodes.create({
    coupon: couponId,
    code,
    customer: input.stripeCustomerId,
    max_redemptions: 1,
    metadata: {
      purpose: 'starter_unit_credit',
      starter_session_id: input.sessionId,
      starter_email: email,
    },
  });

  const insert = await db.from('starter_credits').insert({
    stripe_checkout_session_id: input.sessionId,
    order_id: input.orderId,
    email,
    purchaser_name: input.purchaserName,
    stripe_customer_id: input.stripeCustomerId,
    stripe_promotion_code_id: promo.id,
    code,
    amount_cents: STARTER_CREDIT_CENTS,
  }).select('code, stripe_promotion_code_id, amount_cents').maybeSingle();

  if (insert.error) {
    if (errCode(insert.error) === '23505') {
      // Lost a race. Their code stands; ours must not stay live.
      try {
        await promoClient(stripe).promotionCodes.update(promo.id, { active: false });
        console.warn(
          `starter credit race on session ${input.sessionId}: deactivated duplicate ${promo.id} (${code})`,
        );
      } catch (err) {
        console.error(
          `starter credit race on session ${input.sessionId}: FAILED to deactivate duplicate ` +
            `promotion code ${promo.id} (${code}). It is live and worth $${STARTER_CREDIT_CENTS / 100}; ` +
            `deactivate it by hand. ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      const winner = await db.from('starter_credits')
        .select('code, stripe_promotion_code_id, amount_cents')
        .eq('stripe_checkout_session_id', input.sessionId)
        .maybeSingle();
      if (winner.data) {
        return {
          code: winner.data.code,
          promotionCodeId: winner.data.stripe_promotion_code_id,
          amountCents: winner.data.amount_cents,
          created: false,
        };
      }
    }
    throw new Error(`starter credit insert failed for session ${input.sessionId}: ${insert.error.message}`);
  }

  console.log(
    `starter credit issued: ${code} (promo=${promo.id}) for session=${input.sessionId} email=${email}`,
  );
  return {
    code,
    promotionCodeId: promo.id,
    amountCents: STARTER_CREDIT_CENTS,
    created: true,
  };
}

/**
 * Mark a credit redeemed, once.
 *
 * The `is('redeemed_at', null)` guard makes this a compare-and-set: a webhook
 * retry for the same kit order updates zero rows and reports redeemed=false,
 * rather than overwriting the original redemption timestamp and destroying the
 * one number this whole product is measured on (days from starter to kit).
 */
export async function markCreditRedeemed(
  db: Db,
  args: { promotionCodeId: string; orderId: string | null; sessionId: string },
): Promise<{ redeemed: boolean; code: string | null }> {
  const { data, error } = await db.from('starter_credits')
    .update({
      redeemed_at: new Date().toISOString(),
      redeemed_order_id: args.orderId,
      redeemed_session_id: args.sessionId,
    })
    .eq('stripe_promotion_code_id', args.promotionCodeId)
    .is('redeemed_at', null)
    .select('code');
  if (error) throw new Error(`starter credit redemption write failed: ${error.message}`);
  const rows = (data ?? []) as Array<{ code: string }>;
  if (rows.length === 0) return { redeemed: false, code: null };
  console.log(`starter credit ${rows[0].code} redeemed on kit session ${args.sessionId}`);
  return { redeemed: true, code: rows[0].code };
}

export interface FoundingCapOutcome {
  /** True only for the single caller that won the phase claim. */
  transitioned: boolean;
  policy: CreditExpiryPolicy;
  codesAffected: number;
}

/**
 * Run the founding-cap policy exactly once, at the moment the 500th kit sells.
 *
 * EXACTLY-ONCE is the requirement, and the primary key on starter_credit_phases
 * is what delivers it: the first caller to insert 'retail' wins, every concurrent
 * or subsequent caller gets 23505 and returns transitioned=false. Unlike
 * founding_milestones, this claim is NEVER released on failure, because the
 * transition is a fact rather than a notification. Re-running it would
 * double-count codes_affected and, under the expire policy, would deactivate
 * codes issued legitimately after the cap.
 *
 * Called from notifyFoundingMilestones, which already runs on the kit-recording
 * path and already consults the latched founding gate, so this needs no separate
 * monitor, no cron, and no polling. The founding latch
 * (products.founding_closed_at, set once by the founding_gate RPC) is the trigger.
 */
export async function applyFoundingCapPolicy(
  db: Db,
  stripe: StripeLike,
  args: { soldAtTrigger: number; policy?: CreditExpiryPolicy },
): Promise<FoundingCapOutcome> {
  const policy = args.policy ?? CREDIT_EXPIRY_POLICY;

  const claim = await db.from('starter_credit_phases').insert({
    phase: 'retail',
    founding_units_at_trigger: args.soldAtTrigger,
    policy,
    codes_affected: 0,
  });
  if (claim.error) {
    if (errCode(claim.error) === '23505') {
      return { transitioned: false, policy, codesAffected: 0 };
    }
    throw new Error(`founding cap phase claim failed: ${claim.error.message}`);
  }

  if (policy === 'honour_retail') {
    // Nothing to do to the codes. The coupon is scoped to the kit PRODUCT, and
    // both the founding and retail prices hang off that one product, so every
    // outstanding code keeps working and simply comes off $349 instead of $249.
    console.log(
      `founding cap reached at ${args.soldAtTrigger} units; policy=honour_retail, ` +
        `outstanding starter credits stay live against retail pricing`,
    );
    return { transitioned: true, policy, codesAffected: 0 };
  }

  if (!stripe) {
    // Only reachable under 'expire_at_cap'. Deactivation is a Stripe write, and
    // claiming the phase without performing it would mark the transition done
    // while leaving every code live. Release the claim so a caller that HAS a
    // Stripe client can run it properly.
    await db.from('starter_credit_phases').delete().eq('phase', 'retail');
    throw new Error('expire_at_cap policy requires a Stripe client; phase claim released');
  }

  const affected = await deactivateOutstandingCredits(db, stripe, 'founding_cap_reached');
  const { error } = await db.from('starter_credit_phases')
    .update({ codes_affected: affected }).eq('phase', 'retail');
  if (error) console.error(`founding cap: codes_affected writeback failed: ${error.message}`);
  console.log(`founding cap reached at ${args.soldAtTrigger} units; deactivated ${affected} starter credits`);
  return { transitioned: true, policy, codesAffected: affected };
}

/**
 * Deactivate every outstanding (issued, unredeemed, still-active) credit.
 *
 * Only reachable under the 'expire_at_cap' policy. Kept fully implemented and
 * tested so the founder decision stays a one-constant reversal.
 *
 * Stripe is updated FIRST for each code, then our row. If Stripe fails, our row
 * stays active and the code is retried on a later pass, which is the safe
 * direction: a code that is live in our DB but dead in Stripe would refuse at
 * checkout with an opaque error, whereas the reverse simply gets picked up again.
 */
export async function deactivateOutstandingCredits(
  db: Db,
  stripe: StripeLike,
  reason: string,
): Promise<number> {
  const { data, error } = await db.from('starter_credits')
    .select('id, code, stripe_promotion_code_id')
    .is('redeemed_at', null)
    .is('deactivated_at', null);
  if (error) throw new Error(`outstanding credit scan failed: ${error.message}`);

  const rows = (data ?? []) as Array<{ id: string; code: string; stripe_promotion_code_id: string }>;
  let affected = 0;
  for (const row of rows) {
    try {
      await promoClient(stripe).promotionCodes.update(row.stripe_promotion_code_id, { active: false });
    } catch (err) {
      console.error(
        `credit ${row.code}: Stripe deactivation failed, leaving it active for retry: ` +
          (err instanceof Error ? err.message : String(err)),
      );
      continue;
    }
    const upd = await db.from('starter_credits')
      .update({ deactivated_at: new Date().toISOString(), deactivated_reason: reason })
      .eq('id', row.id);
    if (upd.error) {
      console.error(`credit ${row.code}: local deactivation write failed: ${upd.error.message}`);
      continue;
    }
    affected += 1;
  }
  return affected;
}

/**
 * Whether a NEW credit may still be issued.
 *
 * Under 'honour_retail' this is always true: a starter unit bought after the
 * founding window still earns its $39 off retail, which is the whole reason the
 * founder chose that policy. Under 'expire_at_cap' it goes false once the phase
 * row exists, satisfying the original brief's "no new codes can be generated
 * after that threshold is crossed".
 */
export async function creditIssuanceOpen(
  db: Db,
  policy: CreditExpiryPolicy = CREDIT_EXPIRY_POLICY,
): Promise<boolean> {
  if (policy === 'honour_retail') return true;
  const { data } = await db.from('starter_credit_phases').select('phase').eq('phase', 'retail').maybeSingle();
  return !data;
}
