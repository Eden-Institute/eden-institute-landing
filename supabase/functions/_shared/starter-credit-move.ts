// supabase/functions/_shared/starter-credit-move.ts
//
// ONE-OFF, founder decision 2026-11-22, rule 4: the families who already hold an
// outstanding Sprouts Starter credit (minted before 2026-11-22 on the kit-only
// coupon, and BOUND to their Stripe Customer) are MOVED. Each gets a new code on the
// Sprouts printed-set coupon (STRIPE_STARTER_PRINT_CREDIT_COUPON_SPROUTS), good per
// rule 2, and the old code is retired.
//
// Used ONLY by scripts/move-starter-credits-to-print.ts. No edge function imports
// this file. It lives in _shared so its tests run in CI with the rest of the suite.
//
// IT NEVER SENDS EMAIL. It imports nothing that can, and every effect goes through
// the two clients handed to it (a database and a Stripe client). The families are
// told by a separate, founder-approved email.
//
// DRY RUN BY DEFAULT. planStarterCreditMove only READS (starter_credits, products,
// Stripe promotion codes, coupons and prices). applyStarterCreditMove refuses to
// write anything unless the caller passes the exact number of moves the plan shows,
// so a set that changed between the dry run and the apply stops the run.
//
// WHY THE SAME ROW IS UPDATED, NOT A NEW ROW INSERTED. starter_credits is
// UNIQUE NOT NULL on stripe_checkout_session_id (migration 20260826120000): one row
// per Starter purchase. That key is what makes minting idempotent, and three readers
// look the credit up by it with maybeSingle (starter-fulfill, starter-download, the
// refund cancellation). A second row for the same purchase would need a migration
// and would break all three. So each move is ONE compare-and-set UPDATE of the
// existing row (code and stripe_promotion_code_id swapped, guarded on the old
// promotion code id and on the row still being unredeemed and active). issued_at is
// untouched, so days-from-Starter-to-redemption still counts from the purchase.
//
// The old code is not lost: its Stripe promotion code stays on file, deactivated
// (`active: false`, the only way to retire one: expires_at cannot be edited), and
// the two are linked both ways in Stripe metadata (replaces_promotion_code_id on the
// new one, replaced_by_promotion_code_id on the old one).
//
// ORDER PER FAMILY, chosen so that no failure leaves a family with nothing:
//   1. create the new promotion code (unbound, max_redemptions 1, no expiry)
//   2. swap it onto the row (compare-and-set). If that fails, the new code is
//      deactivated again and the family keeps the old one, untouched.
//   3. deactivate the old promotion code. If that fails, the family holds the new
//      code and the old one is still live at Stripe; a re-run finds it (through the
//      new code's replaces_promotion_code_id) and finishes the job.

import {
  STARTER_BANDS,
  STARTER_CREDIT_KIT_SKU,
  STARTER_KIT_PRODUCT_ID,
  StarterBand,
  generateCreditCode,
  normalizeEmail,
} from './starter-config.ts';

export const MOVE_REASON = 'moved_to_print_credit_2026_11_22';
export const INTERNAL_EMAIL_DOMAIN = '@edeninstitute.health';

// deno-lint-ignore no-explicit-any
type StripeLike = any;
// deno-lint-ignore no-explicit-any
type DbLike = { from(table: string): any };

export interface MoveDeps {
  db: DbLike;
  stripe: StripeLike;
  /** The legacy kit-only coupon id (env STRIPE_STARTER_CREDIT_COUPON_ID). */
  legacyCouponId: string;
  /** The Sprouts printed-set coupon id (env STRIPE_STARTER_PRINT_CREDIT_COUPON_SPROUTS). */
  newCouponId: string;
}

export interface OutstandingCreditRow {
  id: string;
  stripe_checkout_session_id: string;
  email: string;
  code: string;
  stripe_promotion_code_id: string;
  amount_cents: number;
}

export type MoveSkipReason =
  | 'internal_address'
  | 'stripe_promo_unreadable'
  | 'stripe_promo_inactive'
  | 'stripe_promo_already_used'
  | 'already_on_print_coupon'
  | 'not_on_legacy_coupon';

export type MoveAction =
  | { kind: 'move'; row: OutstandingCreditRow }
  | { kind: 'finish_old_deactivation'; row: OutstandingCreditRow; oldPromotionCodeId: string }
  | { kind: 'skip'; row: OutstandingCreditRow; reason: MoveSkipReason; detail: string };

export interface MovePlan {
  actions: MoveAction[];
  moves: number;
  finishes: number;
  skips: number;
}

export function isInternalEmail(email: string): boolean {
  return normalizeEmail(email).endsWith(INTERNAL_EMAIL_DOMAIN);
}

/** "parent@example.com" -> "p***@example.com". Nothing personal goes to stdout. */
export function maskEmail(email: string): string {
  const e = normalizeEmail(email);
  const at = e.indexOf('@');
  if (at <= 0) return '***';
  return `${e[0]}***${e.slice(at)}`;
}

/** "EDEN-S-ABC234" -> "EDEN-S-AB****". A live code is a bearer credential. */
export function maskCode(code: string): string {
  const prefix = code.startsWith('EDEN-S-') ? 'EDEN-S-' : '';
  const body = code.slice(prefix.length);
  return `${prefix}${body.slice(0, 2)}${'*'.repeat(Math.max(body.length - 2, 0))}`;
}

function couponIdOf(promo: { coupon?: unknown }): string | null {
  const c = promo?.coupon as { id?: string } | string | undefined;
  if (typeof c === 'string') return c;
  return c?.id ?? null;
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function requireCoupons(deps: MoveDeps): void {
  if (!deps.legacyCouponId) throw new Error('legacy kit coupon id is empty; refusing to guess which codes are old');
  if (!deps.newCouponId) throw new Error('Sprouts printed-set coupon id is empty; refusing to guess');
  if (deps.legacyCouponId === deps.newCouponId) {
    throw new Error('the legacy and the new coupon ids are the same; refusing (the move would be a no-op that retires every code)');
  }
}

/**
 * Work out what the move would do. READ-ONLY: starter_credits (outstanding rows
 * only) and one Stripe promotion-code read per row, plus one more for a row that
 * was moved before but whose old code may still be live.
 */
export async function planStarterCreditMove(
  deps: MoveDeps,
  opts: { skipInternal: boolean },
): Promise<MovePlan> {
  requireCoupons(deps);
  const { data, error } = await deps.db.from('starter_credits')
    .select('id, stripe_checkout_session_id, email, code, stripe_promotion_code_id, amount_cents')
    .is('redeemed_at', null)
    .is('deactivated_at', null);
  if (error) throw new Error(`outstanding credit read failed: ${error.message ?? String(error)}`);
  const rows = (data ?? []) as OutstandingCreditRow[];

  const actions: MoveAction[] = [];
  for (const row of rows) {
    // deno-lint-ignore no-explicit-any
    let promo: any;
    try {
      promo = await deps.stripe.promotionCodes.retrieve(row.stripe_promotion_code_id);
    } catch (err) {
      actions.push({ kind: 'skip', row, reason: 'stripe_promo_unreadable', detail: errText(err) });
      continue;
    }
    const couponId = couponIdOf(promo);

    if (couponId === deps.newCouponId) {
      const replaced = promo?.metadata?.replaces_promotion_code_id;
      if (typeof replaced === 'string' && replaced) {
        try {
          const old = await deps.stripe.promotionCodes.retrieve(replaced);
          if (old?.active) {
            actions.push({ kind: 'finish_old_deactivation', row, oldPromotionCodeId: replaced });
            continue;
          }
        } catch (err) {
          actions.push({ kind: 'skip', row, reason: 'stripe_promo_unreadable', detail: `old code ${replaced}: ${errText(err)}` });
          continue;
        }
      }
      actions.push({ kind: 'skip', row, reason: 'already_on_print_coupon', detail: 'nothing to do' });
      continue;
    }
    if (couponId !== deps.legacyCouponId) {
      actions.push({ kind: 'skip', row, reason: 'not_on_legacy_coupon', detail: `coupon ${couponId ?? '(none)'}` });
      continue;
    }
    if (opts.skipInternal && isInternalEmail(row.email)) {
      actions.push({ kind: 'skip', row, reason: 'internal_address', detail: '--skip-internal' });
      continue;
    }
    // Our row says live; Stripe must agree, or a human looks first.
    if (!promo?.active) {
      actions.push({ kind: 'skip', row, reason: 'stripe_promo_inactive', detail: 'live in starter_credits, inactive at Stripe' });
      continue;
    }
    if (Number(promo?.times_redeemed ?? 0) > 0) {
      actions.push({ kind: 'skip', row, reason: 'stripe_promo_already_used', detail: `times_redeemed ${promo.times_redeemed}` });
      continue;
    }
    actions.push({ kind: 'move', row });
  }

  return {
    actions,
    moves: actions.filter((a) => a.kind === 'move').length,
    finishes: actions.filter((a) => a.kind === 'finish_old_deactivation').length,
    skips: actions.filter((a) => a.kind === 'skip').length,
  };
}

export type MoveResultStatus =
  | 'moved'
  | 'moved_old_still_active'
  | 'not_moved_create_failed'
  | 'not_moved_row_changed'
  | 'not_moved_orphan_code_live'
  | 'finished_old_deactivation'
  | 'finish_failed';

export interface MoveResult {
  creditId: string;
  email: string;
  status: MoveResultStatus;
  oldPromotionCodeId: string;
  newPromotionCodeId: string | null;
  newCode: string | null;
  detail: string | null;
}

/**
 * Carry out a plan. Writes: one Stripe promotion code created and one deactivated
 * per family, and one compare-and-set UPDATE of that family's starter_credits row.
 * Nothing else, and never an email.
 *
 * Refuses before the first write unless `expectCount` equals the plan's number of
 * moves (the operator passes the number the dry run printed).
 */
export async function applyStarterCreditMove(
  deps: MoveDeps,
  plan: MovePlan,
  opts: { expectCount: number; newCode?: () => string },
): Promise<MoveResult[]> {
  requireCoupons(deps);
  if (!Number.isInteger(opts.expectCount) || opts.expectCount !== plan.moves) {
    throw new Error(
      `refusing to apply: the plan has ${plan.moves} move(s) but --expect=${opts.expectCount}. ` +
        `Re-run the dry run and pass the count it prints.`,
    );
  }
  const mint = opts.newCode ?? generateCreditCode;
  const results: MoveResult[] = [];

  for (const action of plan.actions) {
    if (action.kind === 'finish_old_deactivation') {
      try {
        await deps.stripe.promotionCodes.update(action.oldPromotionCodeId, {
          active: false,
          metadata: { deactivated_reason: MOVE_REASON, replaced_by_promotion_code_id: action.row.stripe_promotion_code_id },
        });
        results.push(result(action.row, 'finished_old_deactivation', action.oldPromotionCodeId, action.row.stripe_promotion_code_id, null, null));
      } catch (err) {
        results.push(result(action.row, 'finish_failed', action.oldPromotionCodeId, action.row.stripe_promotion_code_id, null, errText(err)));
      }
      continue;
    }
    if (action.kind !== 'move') continue;

    const row = action.row;
    const oldId = row.stripe_promotion_code_id;
    const newCode = mint();

    // 1. The new code. Not bound to a Customer, single use, no expiry.
    // deno-lint-ignore no-explicit-any
    let created: any;
    try {
      created = await deps.stripe.promotionCodes.create({
        coupon: deps.newCouponId,
        code: newCode,
        max_redemptions: 1,
        metadata: {
          purpose: 'starter_unit_credit',
          starter_session_id: row.stripe_checkout_session_id,
          starter_email: normalizeEmail(row.email),
          starter_band: 'sprouts',
          replaces_promotion_code_id: oldId,
          move_reason: MOVE_REASON,
        },
      });
    } catch (err) {
      results.push(result(row, 'not_moved_create_failed', oldId, null, null, errText(err)));
      continue;
    }

    // 2. Swap it onto the row, only if the row is still exactly what was planned.
    let swapped = false;
    let swapDetail: string | null = null;
    try {
      const { data, error } = await deps.db.from('starter_credits')
        .update({ code: newCode, stripe_promotion_code_id: created.id })
        .eq('id', row.id)
        .eq('stripe_promotion_code_id', oldId)
        .is('redeemed_at', null)
        .is('deactivated_at', null)
        .select('id');
      if (error) swapDetail = `database: ${error.message ?? String(error)}`;
      else if ((data ?? []).length !== 1) swapDetail = 'the row changed since the plan (redeemed, deactivated or already moved)';
      else swapped = true;
    } catch (err) {
      swapDetail = `database: ${errText(err)}`;
    }
    if (!swapped) {
      // The family keeps the old code; the new one must not stay live.
      try {
        await deps.stripe.promotionCodes.update(created.id, { active: false, metadata: { move_aborted: 'true' } });
        results.push(result(row, 'not_moved_row_changed', oldId, created.id, null, swapDetail));
      } catch (err) {
        results.push(result(row, 'not_moved_orphan_code_live', oldId, created.id, newCode,
          `${swapDetail}; AND the new code could not be deactivated, deactivate ${created.id} by hand: ${errText(err)}`));
      }
      continue;
    }

    // 3. Retire the old code.
    try {
      await deps.stripe.promotionCodes.update(oldId, {
        active: false,
        metadata: { deactivated_reason: MOVE_REASON, replaced_by_promotion_code_id: created.id },
      });
      results.push(result(row, 'moved', oldId, created.id, newCode, null));
    } catch (err) {
      results.push(result(row, 'moved_old_still_active', oldId, created.id, newCode,
        `the old code is still live at Stripe; re-run the script to finish: ${errText(err)}`));
    }
  }
  return results;
}

function result(
  row: OutstandingCreditRow,
  status: MoveResultStatus,
  oldPromotionCodeId: string,
  newPromotionCodeId: string | null,
  newCode: string | null,
  detail: string | null,
): MoveResult {
  return { creditId: row.id, email: row.email, status, oldPromotionCodeId, newPromotionCodeId, newCode, detail };
}

/** Lines for stdout. Emails and codes masked; Stripe object ids are not secrets. */
export function describePlan(plan: MovePlan): string[] {
  const lines = [`Plan: ${plan.moves} to move, ${plan.finishes} to finish, ${plan.skips} skipped.`];
  for (const a of plan.actions) {
    const who = `${maskEmail(a.row.email)}${isInternalEmail(a.row.email) ? ' (internal)' : ''}`;
    const code = `${maskCode(a.row.code)} ${a.row.stripe_promotion_code_id}`;
    if (a.kind === 'move') lines.push(`  MOVE    ${who}  old ${code}  -> new code on the Sprouts printed-set coupon; old code set active:false`);
    else if (a.kind === 'finish_old_deactivation') lines.push(`  FINISH  ${who}  already moved; old code ${a.oldPromotionCodeId} still live, set active:false`);
    else lines.push(`  SKIP    ${who}  ${code}  ${a.reason}: ${a.detail}`);
  }
  return lines;
}

export function describeResults(results: MoveResult[]): string[] {
  return results.map((r) =>
    `  ${r.status.padEnd(28)} ${maskEmail(r.email)}  old ${r.oldPromotionCodeId}` +
    (r.newPromotionCodeId ? `  new ${r.newPromotionCodeId}${r.newCode ? ` (${maskCode(r.newCode)})` : ''}` : '') +
    (r.detail ? `  ${r.detail}` : '')
  );
}

// ---------------------------------------------------------------------------
// Coupon check (read-only). The coupon is the Stripe-side enforcement of the
// founder's rule 2, so before any code is moved onto it, its scope is compared with
// the Stripe products actually behind the skus in STARTER_BANDS[band].credit.
// ---------------------------------------------------------------------------

export interface CouponCheck {
  band: StarterBand;
  couponId: string;
  ok: boolean;
  problems: string[];
  couponProducts: string[];
  expected: Array<{ sku: string; productId: string | null }>;
}

async function productForSku(deps: { db: DbLike; stripe: StripeLike }, sku: string): Promise<string> {
  if (sku === STARTER_CREDIT_KIT_SKU) return STARTER_KIT_PRODUCT_ID;
  const { data, error } = await deps.db.from('products')
    .select('sku, stripe_retail_price_id, stripe_lookup_key')
    .eq('sku', sku)
    .maybeSingle();
  if (error) throw new Error(`products row for ${sku} unreadable: ${error.message ?? String(error)}`);
  if (!data) throw new Error(`no products row for ${sku}`);
  // deno-lint-ignore no-explicit-any
  let price: any = null;
  if (data.stripe_retail_price_id) {
    price = await deps.stripe.prices.retrieve(data.stripe_retail_price_id);
  } else if (data.stripe_lookup_key) {
    const list = await deps.stripe.prices.list({ lookup_keys: [data.stripe_lookup_key], active: true, limit: 1 });
    price = list?.data?.[0] ?? null;
  }
  if (!price) throw new Error(`no Stripe Price resolves for ${sku}`);
  const product = typeof price.product === 'string' ? price.product : price.product?.id;
  if (!product) throw new Error(`the Stripe Price for ${sku} has no product`);
  return product;
}

export async function checkPrintCreditCoupon(
  deps: { db: DbLike; stripe: StripeLike },
  band: StarterBand,
  couponId: string,
): Promise<CouponCheck> {
  const credit = STARTER_BANDS[band].credit;
  const problems: string[] = [];
  const expected: Array<{ sku: string; productId: string | null }> = [];
  let couponProducts: string[] = [];
  if (!credit) {
    return { band, couponId, ok: false, problems: [`${band} carries no credit`], couponProducts, expected };
  }
  if (!couponId) {
    return { band, couponId, ok: false, problems: [`${credit.couponEnv} is not set`], couponProducts, expected };
  }

  // deno-lint-ignore no-explicit-any
  let coupon: any = null;
  try {
    // applies_to is NOT returned unless expanded, and a coupon without it reads
    // exactly like an unrestricted one (scripts/create-starter-stripe-objects.ts).
    coupon = await deps.stripe.coupons.retrieve(couponId, { expand: ['applies_to'] });
  } catch (err) {
    problems.push(`coupon ${couponId} unreadable: ${errText(err)}`);
  }
  if (coupon) {
    if (coupon.valid !== true) problems.push('coupon is not valid');
    if (coupon.amount_off !== credit.cents) problems.push(`amount_off is ${coupon.amount_off}, expected ${credit.cents}`);
    if (coupon.currency !== 'usd') problems.push(`currency is ${coupon.currency}, expected usd`);
    if (coupon.percent_off != null) problems.push('percent_off is set; the credit is a fixed $39');
    if (coupon.duration !== 'forever') problems.push(`duration is ${coupon.duration}, expected forever`);
    if (coupon.redeem_by != null) problems.push('redeem_by is set; the credit never expires (founder rule 1)');
    if (coupon.max_redemptions != null) problems.push('coupon-level max_redemptions is set; it would cap ALL families together');
    couponProducts = Array.isArray(coupon.applies_to?.products) ? [...coupon.applies_to.products] : [];
    if (couponProducts.length === 0) problems.push('applies_to.products is empty: an UNRESTRICTED coupon would discount anything');
  }

  for (const sku of credit.appliesToSkus) {
    try {
      expected.push({ sku, productId: await productForSku(deps, sku) });
    } catch (err) {
      expected.push({ sku, productId: null });
      problems.push(`cannot resolve the product for ${sku}: ${errText(err)}`);
    }
  }
  if (coupon && couponProducts.length) {
    for (const e of expected) {
      if (e.productId && !couponProducts.includes(e.productId)) problems.push(`coupon does not cover ${e.sku} (${e.productId})`);
    }
    const known = new Set(expected.map((e) => e.productId).filter(Boolean) as string[]);
    for (const p of couponProducts) {
      if (!known.has(p)) problems.push(`coupon also covers ${p}, which is not one of ${credit.appliesToSkus.join(', ')}`);
    }
  }
  return { band, couponId, ok: problems.length === 0, problems, couponProducts, expected };
}
