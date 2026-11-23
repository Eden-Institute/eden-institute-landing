// supabase/functions/_shared/starter-credit.ts
//
// The Starter Unit credit: minting, redemption checks and recording, refund
// cancellation, and the founding-cap phase transition.
//
// This is the highest-risk code in the feature. A credit that is shareable,
// re-usable, or valid against the wrong product does not throw and does not show
// up in a happy-path test; it just quietly sells books below cost. So the decision
// itself is a PURE function (evaluateRedemption) with the database and Stripe
// kept outside it, and every branch has a test in starter-credit.test.ts.
//
// 2026-11-22 (FOUNDER DECISION): the credit now comes off the PRINTED SETS too
// (that band's set, the two-band set, and for Sprouts the kit when it is back), from
// either band's Starter. Codes are minted on a NEW coupon per band
// (STARTER_BANDS[band].credit), and they are NO LONGER BOUND to a Stripe Customer.
//
// ENFORCEMENT LAYERS, and what changed:
//
//   1. OUR DATABASE (evaluateRedemption, below). Produces the readable error the
//      buyer sees, and is the only layer that knows about EMAIL. It runs wherever
//      OUR SERVER SEES THE CODE before Stripe does: the kit preorder `credit_code`
//      (or a starter code sent as the kit's `promo_code`), and a starter code
//      pre-applied on the print shop through `promo_code` (?promo=).
//   2. STRIPE'S CUSTOMER BINDING. Codes minted before 2026-11-22 are bound to the
//      purchaser's Stripe Customer (promotion_code_customer_mismatch for anyone
//      else, verified 2026-08-26). New codes are NOT bound, deliberately: the print
//      checkout creates a fresh Customer for every order (customer_creation
//      "always", or a new Customer carrying a locked address for heavy orders), so a
//      bound code could never be redeemed there.
//      THE TRADE-OFF: a new code TYPED INTO STRIPE'S OWN "Add promotion code" FIELD
//      never passes through our server, so Stripe enforces it (single use through
//      max_redemptions 1, plus the coupon's product scope) but our email lock does
//      not. Anyone holding the code can spend it once, on an eligible product. The
//      founder's rule is one use per Starter purchase, which Stripe still holds.
//   3. STRIPE'S COUPON PRODUCT SCOPE. Each coupon carries applies_to[products] for
//      exactly the products in its band's appliesToSkus. An order with none of them
//      is rejected with "This coupon cannot be redeemed because it does not apply
//      to anything in this order." (verified for the kit coupon 2026-08-26).
//   4. SINGLE USE. max_redemptions 1 on every promotion code, independent of our
//      redeemed_at column, which recordStarterCreditRedemptions fills in from the
//      discount actually on the completed session.
//
// NO-STACKING is structural rather than enforced: Stripe refuses to create a
// session carrying both `discounts` and `allow_promotion_codes`
// ("You may only specify one of these parameters"), and Checkout accepts at most
// one discount. A pre-applied code sets `discounts` and never sets
// `allow_promotion_codes`; a typed code uses the one promotion-code slot. A dated
// sale offer clears both (sale-offers.ts noPromotionCodes), and create-checkout
// does not pre-apply a credit onto an offer session.
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
  STARTER_BANDS,
  generateCreditCode,
  normalizeCreditCode,
  normalizeEmail,
  StarterBand,
  StarterCreditKind,
  starterBandForLookupKey,
  starterBandHasCredit,
  starterCreditAppliesToSkus,
  starterCreditKindForCoupon,
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
      message: CREDIT_DEACTIVATED_MESSAGE,
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

/** Verbatim since 2026-08-26; also used when Stripe has the code inactive. */
export const CREDIT_DEACTIVATED_MESSAGE =
  'That credit is no longer active. Reply to your Starter Unit email and we will sort it out.';

/** The kit-path refusals, verbatim since 2026-08-26 (create-checkout). */
export const CREDIT_KIT_REQUIRED_MESSAGE =
  'Your Starter Unit credit applies to the Sprouts Complete Kit. Add the kit to use it.';
export const CREDIT_EMAIL_REQUIRED_MESSAGE =
  'Please enter the email address you used for your Starter Unit so we can check your credit.';

/**
 * Whether a credit of this kind comes off anything in this cart, and if not, the
 * readable refusal. PURE.
 *
 * Only ever an EARLIER, kinder "no": Stripe's coupon scope refuses the same thing
 * at session creation, but in words that read like a broken code ("does not apply
 * to anything in this order") and as a 500 from create-checkout. A null kind (a
 * coupon we cannot name, e.g. an env var unset) is NOT refused here: Stripe decides.
 *
 * CREDIT_SET_REQUIRED is the one new buyer-facing sentence in the 2026-11-22
 * change; its wording was approved by the founder on her review page that day.
 */
export function starterCreditCartRefusal(
  kind: StarterCreditKind | null,
  skus: readonly string[],
): { code: 'CREDIT_KIT_REQUIRED' | 'CREDIT_SET_REQUIRED'; message: string } | null {
  if (kind === null) return null;
  const eligible = starterCreditAppliesToSkus(kind);
  if (skus.some((s) => eligible.includes(s))) return null;
  if (kind === 'legacy_kit') return { code: 'CREDIT_KIT_REQUIRED', message: CREDIT_KIT_REQUIRED_MESSAGE };
  return {
    code: 'CREDIT_SET_REQUIRED',
    message: `Your Starter Unit credit comes off the ${STARTER_BANDS[kind].bandName} printed set, or the Sprouts and Seedlings printed sets together. Add one to your cart to use it.`,
  };
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

// deno-lint-ignore no-explicit-any
function couponIdOf(promo: any): string | null {
  const c = promo?.coupon;
  if (typeof c === 'string') return c;
  return typeof c?.id === 'string' ? c.id : null;
}

export type PrintPromoCreditDecision =
  /** Not a Starter credit: the caller's ordinary affiliate pre-apply runs. */
  | { kind: 'not_a_credit' }
  /** Could not tell (database error): pre-apply nothing, leave Stripe's field. */
  | { kind: 'lookup_failed'; detail: string }
  /** A Starter credit that must not go through: a readable 400. */
  | { kind: 'refuse'; code: string; message: string; creditId: string }
  /** A Starter credit, checked: pre-apply this promotion code. */
  | { kind: 'apply'; promotionCodeId: string; code: string; creditId: string }
  /** A Starter credit we will not pre-apply (offer session, or Stripe unreadable). */
  | { kind: 'skip'; reason: string; creditId: string };

/**
 * The print shop's `promo_code` (?promo=) when it might be a Starter credit
 * (2026-11-22). Our server sees this code BEFORE Stripe, so it gets the same check
 * the kit path gives a credit: found, unspent, active, and the email given at
 * checkout (the heavy-order address form's email, else the optional contact email)
 * must be the email it was bought with. Then: still active at Stripe, and the cart
 * holds something its coupon comes off (starterCreditCartRefusal).
 *
 * A code typed into Stripe's own field never reaches this function; see the
 * trade-off at the top of this file.
 *
 * Never throws. Database trouble is 'lookup_failed' (pre-apply nothing); Stripe
 * trouble on a checked credit is 'skip' (pre-apply nothing; Stripe still enforces
 * single use and scope if the buyer types it).
 */
export async function decidePrintPromoCredit(
  db: Db,
  stripe: StripeLike,
  args: { rawCode: string; email: string | null; skus: readonly string[]; offerSession: boolean },
): Promise<PrintPromoCreditDecision> {
  let credit: StarterCreditRow | null;
  try {
    credit = await findCreditByCode(db, args.rawCode);
  } catch (err) {
    return { kind: 'lookup_failed', detail: err instanceof Error ? err.message : String(err) };
  }
  if (!credit) return { kind: 'not_a_credit' };

  // A dated sale offer takes no promotion code at all (sale-offers.ts
  // noPromotionCodes): no stacking. Nothing is stamped, so nothing is recorded.
  if (args.offerSession) return { kind: 'skip', reason: 'offer session: no promotion codes', creditId: credit.id };

  const email = (args.email ?? '').trim();
  if (!email) return { kind: 'refuse', code: 'CREDIT_EMAIL_REQUIRED', message: CREDIT_EMAIL_REQUIRED_MESSAGE, creditId: credit.id };
  const verdict = evaluateRedemption(credit, email);
  if (!verdict.ok) return { kind: 'refuse', code: verdict.code, message: verdict.message, creditId: credit.id };

  // deno-lint-ignore no-explicit-any
  let promo: any;
  try {
    promo = await stripe.promotionCodes.retrieve(credit.stripe_promotion_code_id);
  } catch (err) {
    return { kind: 'skip', reason: `Stripe read failed: ${err instanceof Error ? err.message : String(err)}`, creditId: credit.id };
  }
  // Live with us, dead at Stripe (refunded, moved, or spent): say so plainly.
  if (!promo?.active) return { kind: 'refuse', code: 'CREDIT_DEACTIVATED', message: CREDIT_DEACTIVATED_MESSAGE, creditId: credit.id };

  const refusal = starterCreditCartRefusal(starterCreditKindForCoupon(couponIdOf(promo)), args.skus);
  if (refusal) return { kind: 'refuse', code: refusal.code, message: refusal.message, creditId: credit.id };

  return { kind: 'apply', promotionCodeId: promo.id ?? credit.stripe_promotion_code_id, code: credit.code, creditId: credit.id };
}

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
  /**
   * The Starter purchase's Stripe Customer. RECORDED on the row
   * (starter_credits.stripe_customer_id is NOT NULL), but since 2026-11-22 it is
   * NOT bound to the promotion code: see the header of this file.
   */
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
 * Mint the single-use credit for one family-paid Starter Unit purchase of `band`,
 * on that band's printed-set coupon (STARTER_BANDS[band].credit.couponEnv).
 *
 * REFUSES, before touching Stripe, when the band has no credit, when its coupon env
 * var is unset (no guessed fallback: a wrong coupon silently discounts the wrong
 * thing), or when there is no Stripe Customer to record (the column is NOT NULL, and
 * failing at the insert would leave a live orphan code behind).
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
  band: StarterBand,
  input: IssueCreditInput,
): Promise<IssuedCredit> {
  const credit = STARTER_BANDS[band].credit;
  if (!credit) throw new Error(`the ${band} Starter Unit carries no credit; refusing to issue one`);
  const couponId = Deno.env.get(credit.couponEnv);
  if (!couponId) {
    // No guessed fallback. A wrong coupon id silently discounts the wrong thing.
    throw new Error(`${credit.couponEnv} is not set; cannot issue a ${band} starter credit`);
  }
  if (!input.stripeCustomerId) {
    throw new Error('no Stripe Customer for this purchase; starter_credits.stripe_customer_id is NOT NULL, refusing before minting');
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
  // redeemed_at column. expires_at is deliberately NOT set: the founder ruled on
  // 2026-11-22 that the credit never expires, and expires_at cannot be changed
  // later anyway.
  //
  // `customer` is deliberately NOT set (2026-11-22). The printed sets sell through
  // a checkout that creates a new Customer per order, where a bound code is refused
  // with promotion_code_customer_mismatch. The trade-off is in the file header.
  const promo = await promoClient(stripe).promotionCodes.create({
    coupon: couponId,
    code,
    max_redemptions: 1,
    metadata: {
      purpose: 'starter_unit_credit',
      starter_session_id: input.sessionId,
      starter_email: email,
      starter_band: band,
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
    amount_cents: credit.cents,
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
            `promotion code ${promo.id} (${code}). It is live and worth $${credit.cents / 100}; ` +
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
    `starter credit issued: ${code} (promo=${promo.id}, band=${band}) for session=${input.sessionId} email=${email}`,
  );
  return {
    code,
    promotionCodeId: promo.id,
    amountCents: credit.cents,
    created: true,
  };
}

/**
 * The webhook's entry point for a Starter Unit credit, per band.
 *
 * A band with no credit returns null WITHOUT touching the database or Stripe: no
 * promotion code, no coupon, no starter_credits row. Since 2026-11-22 both bands
 * have one, so both go to issueStarterCredit on their own coupon; the gate stays so
 * a future band can be added without one.
 *
 * Called ONLY from stripe-webhook's paid-Starter path. That is the founder's rule 3
 * (no credit for a scholarship- or ESA-paid Starter) made structural: the ESA,
 * print-gift and founder-gift paths never call it (starter-credit.test.ts checks
 * their source).
 */
export async function issueStarterCreditForBand(
  db: Db,
  stripe: StripeLike,
  band: StarterBand,
  input: IssueCreditInput,
): Promise<IssuedCredit | null> {
  if (!starterBandHasCredit(band)) return null;
  return await issueStarterCredit(db, stripe, band, input);
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
  console.log(`starter credit ${rows[0].code} redeemed on session ${args.sessionId}`);
  return { redeemed: true, code: rows[0].code };
}

// deno-lint-ignore no-explicit-any
function promoIdOf(ref: any): string | null {
  if (typeof ref === 'string' && ref) return ref;
  if (ref && typeof ref === 'object' && typeof ref.id === 'string' && ref.id) return ref.id;
  return null;
}

/**
 * Every promotion code id actually applied to a Checkout Session. PURE.
 *
 * Reads both places Stripe reports a discount: session.discounts (codes attached at
 * creation, the pre-applied path) and total_details.breakdown.discounts (every
 * discount, including a code the buyer TYPED into Checkout's own field). The
 * breakdown is only present when the session was retrieved with
 * expand: ['total_details.breakdown']; the webhook payload does not carry it.
 */
// deno-lint-ignore no-explicit-any
export function promotionCodeIdsOnSession(session: any): string[] {
  const out = new Set<string>();
  for (const d of Array.isArray(session?.discounts) ? session.discounts : []) {
    const id = promoIdOf(d?.promotion_code);
    if (id) out.add(id);
  }
  for (const d of Array.isArray(session?.total_details?.breakdown?.discounts) ? session.total_details.breakdown.discounts : []) {
    const id = promoIdOf(d?.discount?.promotion_code);
    if (id) out.add(id);
  }
  return [...out];
}

export interface RedemptionRecordOutcome {
  /** Every promotion code id found on the session (ours or not). */
  promotionCodeIds: string[];
  /** The ids that were starter credits AND were marked redeemed by this call. */
  redeemed: string[];
  /** Set when the expanded session could not be read; the metadata id still counted. */
  lookupError: string | null;
}

/**
 * Record the redemption of any Starter credit used on a completed paid session (a
 * printed-set order or a kit preorder), idempotently. 2026-11-22.
 *
 * Which code was used comes from the DISCOUNT ACTUALLY ON THE SESSION, not only
 * from our metadata, because since 2026-11-22 a credit can arrive three ways: our
 * `credit_code` path (metadata.starter_credit_promo_id), our `?promo=` pre-apply
 * (same metadata), or typed into Stripe's own field (no metadata at all). Every id
 * found is passed to markCreditRedeemed, whose compare-and-set on redeemed_at makes
 * a Stripe retry a no-op and an affiliate code (no starter_credits row) a no-op.
 *
 * COST, on purpose: a session with no discount at all (amount_discount 0 and no
 * metadata id) returns at once, with no Stripe call and no database call. Only a
 * discounted session is re-read with the breakdown expanded.
 *
 * Throws only on a database error; the webhook treats that as a reporting gap and
 * logs it, never as a reason to fail a recorded order. A Stripe read failure is
 * returned in lookupError, so a typed code can go unrecorded (its single use is
 * still enforced by Stripe's max_redemptions: 1).
 */
export async function recordStarterCreditRedemptions(
  db: Db,
  stripe: StripeLike,
  // deno-lint-ignore no-explicit-any
  session: any,
  orderId: string | null,
): Promise<RedemptionRecordOutcome> {
  const ids = new Set<string>();
  const metaId = session?.metadata?.starter_credit_promo_id;
  if (typeof metaId === 'string' && metaId) ids.add(metaId);
  for (const id of promotionCodeIdsOnSession(session)) ids.add(id);

  let lookupError: string | null = null;
  const discounted = Number(session?.total_details?.amount_discount ?? 0) > 0;
  const hasBreakdown = Array.isArray(session?.total_details?.breakdown?.discounts);
  if (discounted && !hasBreakdown) {
    try {
      const full = await stripe.checkout.sessions.retrieve(session.id, { expand: ['total_details.breakdown'] });
      for (const id of promotionCodeIdsOnSession(full)) ids.add(id);
    } catch (err) {
      lookupError = err instanceof Error ? err.message : String(err);
    }
  }

  const redeemed: string[] = [];
  for (const id of ids) {
    const out = await markCreditRedeemed(db, { promotionCodeId: id, orderId, sessionId: session.id });
    if (out.redeemed) redeemed.push(id);
  }
  return { promotionCodeIds: [...ids], redeemed, lookupError };
}

export type RefundCancelOutcome =
  | 'no_order'
  | 'not_a_starter'
  | 'band_has_no_credit'
  | 'no_credit'
  | 'already_redeemed'
  | 'already_deactivated'
  | 'deactivated';

/**
 * Cancel the credit attached to a refunded Starter Unit purchase. Moved here from
 * stripe-webhook (2026-11-22) so it is unit-tested; the behaviour is unchanged and
 * now covers both bands, since both carry a credit.
 *
 * Published policy (/returns, 2026-08-26): "If a Starter Unit purchase is
 * refunded, its credit is cancelled with it." Without this, a $39 purchase could
 * be refunded and still leave a live $39 credit.
 *
 * The credit is found by the Starter's checkout session id, which is the row's
 * idempotency key, so a code that was MOVED onto the printed-set coupon (the move
 * rewrites code and promotion code id on that same row) is the one cancelled.
 *
 * An ALREADY-REDEEMED credit is deliberately left alone. If the buyer has already
 * spent it, revoking it retroactively would not claw anything back (the sale is
 * done) and the row is the evidence of what happened.
 *
 * Stripe first, with the client passed in (the webhook's main client, as before).
 * If Stripe fails this throws, our row stays active, and the mismatch is in the
 * safe direction: a code live with us but dead at Stripe would refuse at checkout
 * with an opaque error, whereas the reverse would still spend.
 */
export async function deactivateCreditForRefundedStarter(
  db: Db,
  stripe: StripeLike,
  paymentIntentId: string,
): Promise<RefundCancelOutcome> {
  const { data: order } = await db
    .from('orders').select('stripe_checkout_session_id, lookup_key')
    .eq('stripe_payment_intent_id', paymentIntentId).maybeSingle();
  if (!order) return 'no_order';
  const band = starterBandForLookupKey(order.lookup_key);
  if (!band) return 'not_a_starter';
  if (!starterBandHasCredit(band)) return 'band_has_no_credit';

  const { data: credit } = await db
    .from('starter_credits').select('id, code, stripe_promotion_code_id, redeemed_at, deactivated_at')
    .eq('stripe_checkout_session_id', order.stripe_checkout_session_id).maybeSingle();
  if (!credit) return 'no_credit';

  if (credit.redeemed_at) {
    console.log(
      `[${order.stripe_checkout_session_id}] starter refunded but credit ${credit.code} was already ` +
        `redeemed; leaving the redemption record intact`,
    );
    return 'already_redeemed';
  }
  if (credit.deactivated_at) return 'already_deactivated';

  await stripe.promotionCodes.update(credit.stripe_promotion_code_id, { active: false });
  const { error } = await db.from('starter_credits')
    .update({ deactivated_at: new Date().toISOString(), deactivated_reason: 'starter_purchase_refunded' })
    .eq('id', credit.id);
  if (error) throw new Error(`local credit deactivation write failed: ${error.message}`);
  console.log(`[${order.stripe_checkout_session_id}] starter refunded; credit ${credit.code} cancelled`);
  return 'deactivated';
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
    // Printed-set credits (2026-11-22) are untouched here too, as the founder's
    // never-expires ruling requires.
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
