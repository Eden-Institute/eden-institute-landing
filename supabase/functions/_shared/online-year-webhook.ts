// supabase/functions/_shared/online-year-webhook.ts
//
// Eden's Table Online Year, OY3 (punch #472): what stripe-webhook does for an Online Year
// sale, a refund and a dispute. The I/O is injected (deps), so the dispatch is unit tested in
// CI (online-year-webhook.test.ts) with a fake database; stripe-webhook/index.ts only wires it.
//
// A paid cart (metadata lookup_key = online_year_cart, written by create-checkout OY2):
//   1. RECORD THE SALE first (orders, idempotent on the session), as every digital branch does.
//   2. Read the family's licenses in that band, plan the new years (online-year-grant.ts), and
//      write them in ONE transaction with online_year_grant_purchase (service role only). The
//      RPC re-checks every planned start under a lock on the parent row and refuses a stale
//      plan; that, any read error, or a missing order THROWS, so Stripe redelivers. A
//      redelivery grants nothing twice (the plan skips the order's own licenses and the unique
//      index (order_id, band, lower(child_name)) is the backstop).
//   3. COUNTRY FLAG (her tap 2026-11-25, "Our page asks"): a billing address or a card from
//      outside the U.S., Canada and Australia emails her once, after the grant. Never a refund,
//      never a block.
// Refund (full) / dispute: the order's active licenses close (status closed, closed_reason
// refunded / disputed). No refund is ever issued by code. A partial refund closes nothing.
// NOT here: emails to the family (OY8), sign-in (OY4), the thank-you page (OY4).

import { escapeLikePattern } from './like-escape.ts';
import { ONLINE_YEAR_CART_KEY } from './online-year-checkout.ts';
import {
  onlineYearCountryFlags,
  onlineYearGrantInput,
  onlineYearOrderKey,
  onlineYearOrderLabel,
  onlineYearOutOfAreaAlert,
  planOnlineYearGrant,
  type OnlineYearCloseReason,
  type OnlineYearExistingLicense,
} from './online-year-grant.ts';

// deno-lint-ignore no-explicit-any
type Db = any;

export interface OnlineYearSession {
  id: string;
  payment_status?: string | null;
  metadata?: Record<string, string> | null;
  customer_details?: { email?: string | null; name?: string | null; address?: { country?: string | null } | null } | null;
  customer_email?: string | null;
}

export interface OnlineYearGrantDeps {
  db: Db;
  /** Record the sale in orders (idempotent on the session id). Throws on a real DB error. */
  recordOrder: (lookupKey: string, label: string) => Promise<void>;
  /** The paying card's issuing country, or null (not a card, or the lookup failed). Never throws. */
  cardCountry: () => Promise<string | null>;
  /** Email the founder. Never throws. */
  notifyFounder: (subject: string, text: string) => Promise<void>;
  /** After the order exists (a Starter credit redemption, the Resend contact sync). Never throws. */
  afterOrder?: (orderId: string) => Promise<void>;
  /** The stripe-webhook-e2e twin: alerts say TEST. */
  test?: boolean;
  log?: (line: string) => void;
}

export type OnlineYearGrantOutcome =
  | { status: 'unpaid' }
  | { status: 'needs_a_look'; reason: string; orderId: string }
  | { status: 'already'; orderId: string; already: number }
  | { status: 'granted'; orderId: string; inserted: number; already: number; flagged: number };

const ALERT_SUBJECT = 'Online Year purchase needs a look';

/** checkout.session.completed for an Online Year cart. Throws when Stripe should redeliver. */
export async function handleOnlineYearPurchase(
  session: OnlineYearSession,
  eventCreatedSec: number | null | undefined,
  deps: OnlineYearGrantDeps,
): Promise<OnlineYearGrantOutcome> {
  const log = deps.log ?? ((l: string) => console.log(l));
  const sid = session.id;
  const input = onlineYearGrantInput(session, eventCreatedSec);
  if (!input.ok && input.reason === 'unpaid') {
    log(`[${sid}] online year cart completed with payment_status=unpaid; not recorded, not granted`);
    return { status: 'unpaid' };
  }

  // 1. The sale, always, before anything that can bail out.
  const cart = input.ok ? input.cart : null;
  await deps.recordOrder(
    cart ? onlineYearOrderKey(cart.band) : ONLINE_YEAR_CART_KEY,
    cart ? onlineYearOrderLabel(cart) : "Eden's Table Online Year",
  );
  const { data: order, error: orderErr } = await deps.db
    .from('orders').select('id, order_number').eq('stripe_checkout_session_id', sid).maybeSingle();
  if (orderErr || !order?.id) {
    throw new Error(`[${sid}] online year order recorded but could not be re-read: ${orderErr?.message ?? 'no row'}`);
  }
  const orderId = String(order.id);
  const orderNumber = order.order_number ? String(order.order_number) : null;
  if (deps.afterOrder) await deps.afterOrder(orderId);

  if (!input.ok) {
    // Paid, recorded, but nothing safe to grant from (create-checkout always writes these).
    log(`[${sid}] online year purchase cannot be granted: ${input.reason}`);
    await deps.notifyFounder(
      `${deps.test ? 'TEST (E2E): ' : ''}${ALERT_SUBJECT}`,
      [
        'An Online Year purchase went through, but its licenses could not be set up from the order.',
        '',
        `Order: ${orderNumber ?? sid}`,
        `Stripe session: ${sid}`,
        `What happened: ${input.reason}`,
        '',
        'The payment and order are recorded. Ask Claude (Lane 2) to check this purchase.',
      ].join('\n'),
    );
    return { status: 'needs_a_look', reason: input.reason, orderId };
  }

  // 2. The family's licenses in this band, then the plan.
  const { data: parent, error: pErr } = await deps.db
    .from('online_year_parents').select('id').ilike('email', escapeLikePattern(input.email)).maybeSingle();
  if (pErr) throw new Error(`[${sid}] online year parent read failed: ${pErr.message}`);
  let existing: OnlineYearExistingLicense[] = [];
  if (parent?.id) {
    const { data: lic, error: lErr } = await deps.db
      .from('online_year_licenses')
      .select('id, band, child_name, status, ends_at, order_id, renews_license_id')
      .eq('parent_id', parent.id).eq('band', input.cart.band);
    if (lErr) throw new Error(`[${sid}] online year license read failed: ${lErr.message}`);
    const rows = (lic ?? []) as Record<string, unknown>[];
    const renewed = new Set(rows.map((r) => r.renews_license_id).filter(Boolean).map(String));
    existing = rows.map((r) => ({
      id: String(r.id),
      band: String(r.band),
      child_name: String(r.child_name),
      status: String(r.status),
      ends_at: String(r.ends_at),
      order_id: r.order_id ? String(r.order_id) : null,
      renewed: renewed.has(String(r.id)),
    }));
  }
  const plan = planOnlineYearGrant({ cart: input.cart, orderId, purchasedAt: input.purchasedAt, existing });
  if (plan.rows.length === 0) {
    log(`[${sid}] online year: order ${orderNumber ?? orderId} already granted (${plan.already.length} license(s)); nothing new`);
    return { status: 'already', orderId, already: plan.already.length };
  }

  const { data, error } = await deps.db.rpc('online_year_grant_purchase', {
    p_order_id: orderId,
    p_email: input.email,
    p_license_name: input.licenseName,
    p_band: input.cart.band,
    p_purchased_at: input.purchasedAt.toISOString(),
    p_licenses: plan.rows,
  });
  if (error) throw new Error(`[${sid}] online_year_grant_purchase failed: ${error.message}`);
  const out = (data ?? {}) as Record<string, unknown>;
  if (out.status !== 'ok') throw new Error(`[${sid}] online_year_grant_purchase returned ${JSON.stringify(out)}`);
  const inserted = Number(out.inserted ?? 0);
  const already = Number(out.already ?? 0);
  log(`[${sid}] online year granted: order ${orderNumber ?? orderId} band=${input.cart.band} inserted=${inserted} already=${already}`);

  // 3. The country flag, once: only on the delivery that actually granted.
  let flagged = 0;
  if (inserted > 0) {
    const billingCountry = session.customer_details?.address?.country ?? null;
    const cardCountry = await deps.cardCountry();
    const flags = onlineYearCountryFlags({ billingCountry, cardCountry });
    if (flags.length > 0) {
      flagged = flags.length;
      log(`[${sid}] online year order ${orderNumber ?? orderId} flagged out of area: ${flags.map((f) => `${f.which}=${f.country}`).join(', ')}`);
      const alert = onlineYearOutOfAreaAlert({
        orderLabel: onlineYearOrderLabel(input.cart),
        orderNumber,
        sessionId: sid,
        email: input.email,
        typedCountry: session.metadata?.oy_country ?? null,
        billingCountry,
        cardCountry,
        flags,
        test: deps.test === true,
      });
      await deps.notifyFounder(alert.subject, alert.text);
    }
  }
  return { status: 'granted', orderId, inserted, already, flagged };
}

export interface OnlineYearCloseDeps {
  db: Db;
  notifyFounder: (subject: string, text: string) => Promise<void>;
  test?: boolean;
  now?: () => Date;
  log?: (line: string) => void;
}

/** The Online Year orders paid by this PaymentIntent (normally one, or none). Throws on a read error. */
async function onlineYearOrdersFor(db: Db, paymentIntentId: string): Promise<{ id: string; order_number: string | null; customer_email: string | null }[]> {
  const { data, error } = await db
    .from('orders').select('id, order_number, lookup_key, customer_email').eq('stripe_payment_intent_id', paymentIntentId);
  if (error) throw new Error(`online year: orders read failed for ${paymentIntentId}: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[])
    .filter((o) => typeof o.lookup_key === 'string' && o.lookup_key.startsWith('online_year_'))
    .map((o) => ({ id: String(o.id), order_number: o.order_number ? String(o.order_number) : null, customer_email: o.customer_email ? String(o.customer_email) : null }));
}

/**
 * A full refund or a dispute on an Online Year payment: close its active licenses. Returns how
 * many closed (0 for any other product). A dispute also emails the founder. Throws on a DB error.
 */
export async function closeOnlineYearLicenses(
  paymentIntentId: string,
  reason: OnlineYearCloseReason,
  deps: OnlineYearCloseDeps,
): Promise<{ closed: number; orders: number }> {
  const log = deps.log ?? ((l: string) => console.log(l));
  const orders = await onlineYearOrdersFor(deps.db, paymentIntentId);
  if (orders.length === 0) return { closed: 0, orders: 0 };
  const at = (deps.now ? deps.now() : new Date()).toISOString();
  let closed = 0;
  for (const o of orders) {
    const { data, error } = await deps.db
      .from('online_year_licenses')
      .update({ status: 'closed', closed_at: at, closed_reason: reason, updated_at: at })
      .eq('order_id', o.id).eq('status', 'active')
      .select('id, child_name');
    if (error) throw new Error(`online year: closing licenses for order ${o.order_number ?? o.id} failed: ${error.message}`);
    const n = (data ?? []).length;
    closed += n;
    log(`online year: ${n} license(s) closed (${reason}) for order ${o.order_number ?? o.id} (pi=${paymentIntentId})`);
    if (reason === 'disputed' && n > 0) {
      await deps.notifyFounder(
        `${deps.test ? 'TEST (E2E): ' : ''}Online Year order ${o.order_number ?? o.id} was disputed: access closed`,
        [
          `The payment for Online Year order ${o.order_number ?? o.id} was disputed (a chargeback), so its ${n} license(s) are now closed and the family can no longer open it.`,
          '',
          `Buyer: ${o.customer_email ?? '(no email)'}`,
          `Stripe payment: ${paymentIntentId}`,
          '',
          "Stripe will email you about answering the dispute. If you win it and want the family's access back, tell Claude (Lane 2).",
        ].join('\n'),
      );
    }
  }
  return { closed, orders: orders.length };
}

/** A partial refund on an Online Year payment closes nothing; tell the founder which order. Throws on a read error. */
export async function noteOnlineYearPartialRefund(paymentIntentId: string, deps: OnlineYearCloseDeps): Promise<boolean> {
  const orders = await onlineYearOrdersFor(deps.db, paymentIntentId);
  if (orders.length === 0) return false;
  const ref = orders.map((o) => o.order_number ?? o.id).join(', ');
  await deps.notifyFounder(
    `${deps.test ? 'TEST (E2E): ' : ''}Online Year order ${ref}: partial refund, licenses left open`,
    [
      `Part of the payment for Online Year order ${ref} was refunded. A partial refund can't say which child it was for, so every license on the order is still open.`,
      '',
      `Stripe payment: ${paymentIntentId}`,
      '',
      "If one child's year should close, tell Claude (Lane 2) which one.",
    ].join('\n'),
  );
  return true;
}
