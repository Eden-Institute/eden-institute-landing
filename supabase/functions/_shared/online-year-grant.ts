// supabase/functions/_shared/online-year-grant.ts
//
// Eden's Table Online Year, OY3 (punch #472): the pure half of the grant. No I/O here, so
// every rule is unit tested (online-year-grant.test.ts). _shared/online-year-webhook.ts reads
// the family's licenses, plans with planOnlineYearGrant, and writes the plan in one
// transaction through the service-role RPC online_year_grant_purchase, which re-checks the
// plan under a lock on the parent row (so a plan made from a stale read is refused, never
// written).
//
// Decided (EdensTable_Digital_License_Plan.md "Decided (Nov 20)" + "Decided (Nov 23)", and the
// approved FAQ "How long does it last?" / "How do siblings work?"):
//   - one license per child, one band, 12 months from the day she buys it;
//   - "Renewing early doesn't cost you any days: the new year starts when the old one ends."
//     A child with a live (active, not yet ended) license in that band gets a new year that
//     starts at the old end date and points back at it (renews_license_id);
//   - "You can add a sibling anytime, and their year runs 12 months from the day you add
//     them": a sibling with no live license of her own starts on the purchase date, even if
//     that runs past the first child's end date (NP's OY2 QA note);
//   - a redelivered Stripe event grants nothing twice (the order's own licenses are skipped,
//     and the unique index (order_id, band, lower(child_name)) is the backstop).

import {
  ONLINE_YEAR_BAND_LABEL,
  ONLINE_YEAR_COUNTRIES,
  readOnlineYearMetadata,
  type OnlineYearBand,
  type OnlineYearCartPlan,
  type OnlineYearKind,
} from './online-year-checkout.ts';

/** "12 months from the day you buy it." */
export const ONLINE_YEAR_TERM_MONTHS = 12;

/**
 * `from` plus whole calendar months, in UTC, keeping the time of day. A day that does not
 * exist in the target month is clamped to that month's last day (Feb 29 + 12 months =
 * Feb 28; Jan 31 + 1 month = Feb 28/29), which is also what Postgres does for
 * `timestamptz + interval '12 months'` in a UTC session.
 */
export function addMonthsUtc(from: Date, months: number): Date {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth() + months;
  const targetYear = y + Math.floor(m / 12);
  const targetMonth = ((m % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(
    targetYear,
    targetMonth,
    Math.min(from.getUTCDate(), lastDay),
    from.getUTCHours(),
    from.getUTCMinutes(),
    from.getUTCSeconds(),
    from.getUTCMilliseconds(),
  ));
}

/** The family's existing licenses in one band, as read before planning. */
export interface OnlineYearExistingLicense {
  id: string;
  band: string;
  child_name: string;
  status: string;
  ends_at: string;
  order_id: string | null;
  /** Another license already points at this one (renews_license_id); a year is renewed at most once. */
  renewed: boolean;
}

/** One license to insert. Dates are ISO strings (UTC). */
export interface OnlineYearLicenseRow {
  child_name: string;
  kind: OnlineYearKind;
  starts_at: string;
  ends_at: string;
  renews_license_id: string | null;
}

export interface OnlineYearGrantPlan {
  band: OnlineYearBand;
  rows: OnlineYearLicenseRow[];
  /** Children this order already holds a license for (a redelivered event): nothing to insert. */
  already: string[];
}

const nameKey = (s: string) => s.replace(/\s+/gu, ' ').trim().toLowerCase();

/**
 * The licenses one paid cart grants. Pure: the caller reads `existing` (every license this
 * parent holds in the cart's band, any status) and writes `rows` atomically.
 */
export function planOnlineYearGrant(input: {
  cart: OnlineYearCartPlan;
  orderId: string;
  purchasedAt: Date;
  existing: OnlineYearExistingLicense[];
}): OnlineYearGrantPlan {
  const { cart, orderId, purchasedAt } = input;
  const inBand = input.existing.filter((l) => l.band === cart.band);
  const rows: OnlineYearLicenseRow[] = [];
  const already: string[] = [];

  for (const child of cart.children) {
    const key = nameKey(child.name);
    const sameChild = inBand.filter((l) => nameKey(l.child_name) === key);

    // Idempotency: this order already granted this child (a redelivered webhook).
    if (sameChild.some((l) => l.order_id === orderId)) {
      already.push(child.name);
      continue;
    }

    // An early renewal: her live year in this band, the one that ends last.
    const live = sameChild
      .filter((l) => l.status === 'active' && Date.parse(l.ends_at) > purchasedAt.getTime())
      .sort((a, b) => Date.parse(b.ends_at) - Date.parse(a.ends_at))[0];

    const starts = live ? new Date(Date.parse(live.ends_at)) : purchasedAt;
    rows.push({
      child_name: child.name,
      kind: child.kind,
      starts_at: starts.toISOString(),
      ends_at: addMonthsUtc(starts, ONLINE_YEAR_TERM_MONTHS).toISOString(),
      // A year already renewed once (its renewal was later refunded and closed) still loses
      // no days, but cannot be pointed at twice (online_year_licenses_one_renewal).
      renews_license_id: live && !live.renewed ? live.id : null,
    });
  }
  return { band: cart.band, rows, already };
}

// ── What the webhook reads off the paid session ──────────────────────────────

export type OnlineYearGrantInput =
  | {
    ok: true;
    cart: OnlineYearCartPlan;
    /** Lower-cased, trimmed (online_year_parents keeps it that way). */
    email: string;
    /** The card billing name, for "Licensed to [parent's name]"; null = the email alone. */
    licenseName: string | null;
    purchasedAt: Date;
  }
  | { ok: false; reason: 'unpaid' | 'bad_metadata' | 'no_email' | 'no_purchase_time' };

interface SessionLike {
  payment_status?: string | null;
  metadata?: Record<string, string> | null;
  customer_details?: { email?: string | null; name?: string | null } | null;
  customer_email?: string | null;
}

/**
 * The grant's inputs, or why there is nothing to grant. `eventCreatedSec` is the Stripe
 * event's `created` (the moment the checkout completed): the purchase time the year runs from.
 */
export function onlineYearGrantInput(session: SessionLike, eventCreatedSec: number | null | undefined): OnlineYearGrantInput {
  // Async payment methods complete the session before money moves. "no_payment_required"
  // (a 100%-off discount) is a real, free order and is granted.
  if (session.payment_status === 'unpaid') return { ok: false, reason: 'unpaid' };
  const cart = readOnlineYearMetadata(session.metadata ?? null);
  if (!cart) return { ok: false, reason: 'bad_metadata' };
  const raw = session.customer_details?.email ?? session.customer_email ?? session.metadata?.email ?? '';
  const email = raw.trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || !email.includes('@')) return { ok: false, reason: 'no_email' };
  if (typeof eventCreatedSec !== 'number' || !Number.isFinite(eventCreatedSec) || eventCreatedSec <= 0) {
    return { ok: false, reason: 'no_purchase_time' };
  }
  const name = (session.customer_details?.name ?? '').replace(/\s+/gu, ' ').trim();
  return {
    ok: true,
    cart,
    email,
    licenseName: name.length >= 1 && name.length <= 120 ? name : null,
    purchasedAt: new Date(eventCreatedSec * 1000),
  };
}

/** orders.lookup_key for an Online Year sale: one per band, so revenue splits by band. */
export function onlineYearOrderKey(band: OnlineYearBand): string {
  return `online_year_${band}`;
}

/**
 * orders.product_label, built from the approved product names (Approved copy > Checkout >
 * Product names): "Eden's Table Online Year: Sprouts (K-2), first child + 2 siblings".
 */
export function onlineYearOrderLabel(cart: OnlineYearCartPlan): string {
  const base = `Eden's Table Online Year: ${ONLINE_YEAR_BAND_LABEL[cart.band]}`;
  const first = cart.children.some((c) => c.kind === 'first_child');
  const siblings = cart.children.filter((c) => c.kind === 'sibling').length;
  const parts: string[] = [];
  if (first) parts.push('first child');
  if (siblings === 1) parts.push(first ? '1 sibling' : 'sibling');
  else if (siblings > 1) parts.push(`${siblings} siblings`);
  return `${base}, ${parts.join(' + ')}`;
}

// ── Closing licenses ─────────────────────────────────────────────────────────

export type OnlineYearCloseReason = 'refunded' | 'disputed' | 'cancelled';

/**
 * Which Stripe event closes an order's licenses, and with what reason. A partial refund
 * closes nothing (it cannot say which child it was for; the founder is told instead).
 * Stripe has no cancel event for a paid one-time card payment, so 'cancelled' is never
 * produced here; it stays a valid closed_reason for a by-hand cancel.
 */
export function onlineYearCloseReasonFor(
  eventType: string,
  charge?: { refunded?: boolean | null } | null,
): OnlineYearCloseReason | null {
  if (eventType === 'charge.refunded') return charge?.refunded === true ? 'refunded' : null;
  if (eventType === 'charge.dispute.created') return 'disputed';
  return null;
}

// ── Out-of-area card flag (her tap 2026-11-25: "Our page asks") ──────────────

export interface OnlineYearCountryFlag {
  which: 'billing' | 'card';
  country: string;
}

/**
 * The billing country and the card's issuing country, each checked against the launch list
 * (U.S., Canada, Australia). Anything else is flagged to her AFTER the sale: never refunded,
 * never blocked. An unknown value (a non-card payment has no card country) is not a flag.
 */
export function onlineYearCountryFlags(input: { billingCountry?: string | null; cardCountry?: string | null }): OnlineYearCountryFlag[] {
  const allowed = ONLINE_YEAR_COUNTRIES as readonly string[];
  const out: OnlineYearCountryFlag[] = [];
  const check = (which: OnlineYearCountryFlag['which'], v: string | null | undefined) => {
    const c = (v ?? '').trim().toUpperCase();
    if (c && !allowed.includes(c)) out.push({ which, country: c });
  };
  check('billing', input.billingCountry);
  check('card', input.cardCountry);
  return out;
}

/** The founder alert for an out-of-area order (plain words; she reads it on her phone). */
export function onlineYearOutOfAreaAlert(input: {
  orderLabel: string;
  orderNumber: string | null;
  sessionId: string;
  email: string;
  typedCountry: string | null;
  billingCountry: string | null;
  cardCountry: string | null;
  flags: OnlineYearCountryFlag[];
  test: boolean;
}): { subject: string; text: string } {
  const ref = input.orderNumber ?? input.sessionId;
  const what = input.flags.map((f) => (f.which === 'card' ? `the card is from ${f.country}` : `the billing address is in ${f.country}`));
  return {
    subject: `${input.test ? 'TEST (E2E): ' : ''}Online Year order ${ref} paid from outside the U.S., Canada and Australia`,
    text: [
      `An Online Year order came in where ${what.join(' and ')}.`,
      '',
      `Order: ${ref} (${input.orderLabel})`,
      `Buyer: ${input.email}`,
      `Country she picked on our page: ${input.typedCountry ?? '(none)'}`,
      `Billing country: ${input.billingCountry ?? '(unknown)'}`,
      `Card country: ${input.cardCountry ?? '(unknown)'}`,
      `Stripe session: ${input.sessionId}`,
      '',
      'Nothing was refunded or blocked: her licenses are granted. Your rule (Nov 25) is to flag these after the sale, no refund.',
      'If you want anything done about it, tell Claude (Lane 2).',
    ].join('\n'),
  };
}
