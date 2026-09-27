// supabase/functions/_shared/ship-address.ts
//
// Street-address check for HEAVY print orders (founder decision 2026-09-26).
//
// A heavy parcel (likelyNeedsGround in print-pricing.ts) is too big for Lulu's
// MAIL level and ships GROUND_HD, FedEx home delivery, which cannot deliver to a
// PO box or an APO / FPO / DPO address. Stripe Checkout cannot refuse an address,
// so for heavy carts only:
//   1. the buy box asks for the shipping address first (ShipToForm),
//   2. create-checkout re-checks it here and refuses a PO box or military
//      address BEFORE any payment (PRINT_ADDRESS_NEEDS_STREET),
//   3. the accepted address goes on a Stripe Customer and the Checkout Session is
//      created WITHOUT shipping_address_collection, so Checkout shows no address
//      form and the buyer cannot change it (verified in Stripe TEST mode
//      2026-09-26: session accepted, automatic tax "complete" from the Customer's
//      shipping address, shipping rate kept),
//   4. stripe-webhook reads the address back from session metadata (Checkout
//      leaves shipping_details empty when it did not collect one) and, as a
//      backstop, alerts the founder if a heavy order ever carries a PO box or
//      military address anyway.
// Normal (MAIL) orders never see any of this: Stripe collects their address as
// before, and PO boxes and APOs are fine by mail.
//
// PMB ("private mailbox", e.g. a UPS Store box) is a street address and is
// allowed. "Unit" is allowed (our own business address is "Unit 3262").
//
// PURE AND DEPENDENCY-FREE: imported by create-checkout, stripe-webhook, the
// buy boxes and the tests. Voice rule: no em dashes.

export interface ShipTo {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  phone?: string;
  email?: string;
}

/** The 50 states and DC. Heavy orders ship FedEx ground, so no territories. */
export const SHIP_TO_STATES: readonly string[] = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA',
  'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR',
  'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

const MILITARY_STATES = ['AA', 'AE', 'AP'];

const PO_BOX_PATTERNS: RegExp[] = [
  /\bp\s*\.?\s*o\s*\.?\s*(box|b\b|b\.|drawer)/i, // PO Box, P.O. Box, P O Box, PO B, PO Drawer
  /\bpost\s*office\b/i, // Post Office Box, Post Office Drawer
  /\bpob\b/i, // POB 12
  /\bp\s*\.?\s*o\s*\.?\s*#?\s*\d/i, // PO 123, P.O. #123
  /^\s*box\s*#?\s*\d/i, // Box 123 at the start of a line
  /\b(caller|lock|postal)\s*box\b/i,
];

/** True when a street line reads as a PO box. PMB and "Unit" lines do not. */
export function isPoBoxLine(line: string | null | undefined): boolean {
  const s = (line ?? '').trim();
  if (!s) return false;
  return PO_BOX_PATTERNS.some((re) => re.test(s));
}

/** True for an APO / FPO / DPO address (military or diplomatic mail). */
export function isMilitaryAddress(a: { city?: string | null; state?: string | null; line1?: string | null; line2?: string | null }): boolean {
  const state = (a.state ?? '').trim().toUpperCase();
  if (MILITARY_STATES.includes(state)) return true;
  if (/^\s*(apo|fpo|dpo)\s*$/i.test(a.city ?? '')) return true;
  return [a.line1, a.line2].some((l) => /\b(psc|cmr)\s*\d/i.test(l ?? '') || /\b(apo|fpo|dpo)\b/i.test(l ?? ''));
}

export type ShipToCheck =
  | { ok: true; value: ShipTo }
  | { ok: false; problem: 'missing' | 'po_box' | 'military' | 'state' | 'zip' | 'email'; message: string };

const MESSAGES = {
  missing: 'Please fill in your name, email, street address, city, state and ZIP code.',
  po_box:
    "Larger orders ship by ground, and the ground carrier can't deliver to a PO box. Please use a street address, like your home or work.",
  military:
    "I'm so sorry, larger orders ship by ground and can't go to APO, FPO or DPO addresses. Please use a street address in the United States, or place a smaller order, which ships by mail.",
  state: 'Please choose a state. Larger orders ship by ground within the 50 states and DC.',
  zip: 'Please check the ZIP code. It should be 5 digits, or 5 plus 4.',
  email: 'Please check the email address, so your confirmation and tracking reach you.',
};

function clean(v: unknown, max = 100): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/** Validate a heavy order's shipping address. Returns a cleaned copy or the first problem. */
export function checkShipTo(raw: unknown): ShipToCheck {
  // deno-lint-ignore no-explicit-any
  const r = (raw ?? {}) as any;
  const v: ShipTo = {
    name: clean(r.name),
    line1: clean(r.line1),
    line2: clean(r.line2) || undefined,
    city: clean(r.city, 60),
    state: clean(r.state, 2).toUpperCase(),
    postal_code: clean(r.postal_code, 10),
    phone: clean(r.phone, 30) || undefined,
    email: clean(r.email, 200).toLowerCase() || undefined,
  };
  if (!v.name || !v.line1 || !v.city || !v.state || !v.postal_code || !v.email) {
    return { ok: false, problem: 'missing', message: MESSAGES.missing };
  }
  if (isMilitaryAddress(v)) return { ok: false, problem: 'military', message: MESSAGES.military };
  if (isPoBoxLine(v.line1) || isPoBoxLine(v.line2)) return { ok: false, problem: 'po_box', message: MESSAGES.po_box };
  if (!SHIP_TO_STATES.includes(v.state)) return { ok: false, problem: 'state', message: MESSAGES.state };
  if (!/^\d{5}(-\d{4})?$/.test(v.postal_code)) return { ok: false, problem: 'zip', message: MESSAGES.zip };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) return { ok: false, problem: 'email', message: MESSAGES.email };
  return { ok: true, value: v };
}

/** True when a recorded order address is one ground shipping cannot reach (webhook backstop). */
export function isGroundUndeliverable(addr: { line1?: string | null; line2?: string | null; city?: string | null; state?: string | null } | null | undefined): boolean {
  if (!addr) return false;
  return isMilitaryAddress(addr) || isPoBoxLine(addr.line1) || isPoBoxLine(addr.line2);
}

/** Session metadata key carrying the locked address (a Stripe metadata value holds up to 500 characters). */
export const SHIP_TO_METADATA_KEY = 'print_ship_to';

/** Compact JSON for session metadata. Never longer than Stripe's 500-character value cap. */
export function shipToMetadata(v: ShipTo): string {
  const out = JSON.stringify({ n: v.name, l1: v.line1, l2: v.line2 ?? '', c: v.city, s: v.state, z: v.postal_code });
  return out.slice(0, 500);
}

/**
 * Stripe-shaped shipping details from the locked address in session metadata, or
 * null. The webhook uses it when Checkout did not collect an address itself.
 */
export function shippingDetailsFromMetadata(meta: Record<string, unknown> | null | undefined):
  { name: string; address: { line1: string; line2: string | null; city: string; state: string; postal_code: string; country: string } } | null {
  const raw = meta?.[SHIP_TO_METADATA_KEY];
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const p = JSON.parse(raw);
    if (!p?.n || !p?.l1 || !p?.c || !p?.s || !p?.z) return null;
    return { name: p.n, address: { line1: p.l1, line2: p.l2 || null, city: p.c, state: p.s, postal_code: p.z, country: 'US' } };
  } catch {
    return null;
  }
}
