// supabase/functions/_shared/checkout-recovery.ts
//
// Abandoned-checkout recovery email (founder decision 2026-09-28).
//
// A shopper who starts Stripe Checkout, ticks Stripe's own promotional-consent
// checkbox, and leaves without paying gets ONE friendly reminder with Stripe's
// recovery link. No discount. Replies go to Camila (reply_to hello@).
//
// How it works end to end:
//   1. create-checkout calls applyCheckoutRecovery() on every payment-mode session
//      it creates for the main one-off, print and Back to Eden PDF paths (NOT the
//      closed preorder path, NOT subscriptions). That sets:
//        expires_at            = now + 3 hours (so "left" = the session expiring),
//        consent_collection    = { promotions: "auto" } (Stripe decides when to show
//                                 the checkbox; US merchants and US customers only),
//        after_expiration      = { recovery: { enabled, allow_promotion_codes } }.
//   2. When the session expires unpaid, Stripe fires checkout.session.expired with
//      after_expiration.recovery.url (valid 30 days) and consent.promotions.
//   3. stripe-webhook runs precheckExpiredSession() + decideCartRecovery() (pure,
//      tested here), sends buildCartRecoveryEmail(), and records every decision in
//      public.checkout_recoveries.
//
// Subscription sessions are deliberately left alone: the Stripe API reference and
// the abandoned-carts guide (docs.stripe.com, read 2026-09-28) document these params
// only with mode=payment examples and state no subscription support either way, so
// they stay off until verified in TEST mode.
//
// Voice rules: no em dashes. The body copy is founder-approved verbatim.

import { escapeHtml, safeHttpsUrl } from './html-escape.ts';
import { SELLER_ADDRESS, SELLER_LEGAL_NAME } from './receipt.ts';
import { isE2eMetadata } from './e2e-mode.ts';
import { captureException } from './sentry.ts';

/** Session lifetime. The reminder goes out when the session expires, ~3 hours after it started. */
export const CART_RECOVERY_EXPIRY_SECONDS = 3 * 60 * 60;

/** One reminder per address per this many days, across all sessions. */
export const CART_RECOVERY_COOLDOWN_DAYS = 30;

/** Reason recorded on the row while a send is in flight (claimed before sending). */
export const CART_RECOVERY_SENDING = 'send_in_progress';

// deno-lint-ignore no-explicit-any
type Params = Record<string, any>;

/**
 * Add the recovery params to a Checkout Session create-params object, in place.
 *
 * Call it LAST, right before stripe.checkout.sessions.create, because it reads the
 * final promo state: the recovered session offers the promotion-code field only
 * when the original did (allow_promotion_codes === true and no pre-applied
 * `discounts`). A no-op for anything that is not mode "payment".
 */
export function applyCheckoutRecovery<T extends Params>(params: T, nowMs: number = Date.now()): T {
  if (params.mode !== 'payment') return params;
  const hasDiscounts = Array.isArray(params.discounts) && params.discounts.length > 0;
  const allowPromo = params.allow_promotion_codes === true && !hasDiscounts;
  // deno-lint-ignore no-explicit-any
  const p = params as any;
  // Remember consent_collection exactly as it was, so the fallback can put it back.
  // (None of the three call sites sets one today; this keeps it right if one does.)
  ORIGINAL_CONSENT.set(params, {
    had: Object.prototype.hasOwnProperty.call(p, 'consent_collection'),
    value: p.consent_collection && typeof p.consent_collection === 'object' ? { ...p.consent_collection } : p.consent_collection,
  });
  p.expires_at = Math.floor(nowMs / 1000) + CART_RECOVERY_EXPIRY_SECONDS;
  p.consent_collection = { ...(p.consent_collection ?? {}), promotions: 'auto' };
  p.after_expiration = { recovery: { enabled: true, allow_promotion_codes: allowPromo } };
  return params;
}

// consent_collection as it was before applyCheckoutRecovery touched a params object.
const ORIGINAL_CONSENT = new WeakMap<object, { had: boolean; value: unknown }>();

/**
 * Undo applyCheckoutRecovery in place: no recovery, no promotional-consent box, and
 * Stripe's default 24-hour session lifetime again. Any consent_collection keys the
 * params carried BEFORE applyCheckoutRecovery (e.g. terms_of_service) are restored
 * exactly.
 */
export function stripCheckoutRecovery<T extends Params>(params: T): T {
  // deno-lint-ignore no-explicit-any
  const p = params as any;
  delete p.after_expiration;
  delete p.expires_at;
  const orig = ORIGINAL_CONSENT.get(params);
  if (orig) {
    if (orig.had) p.consent_collection = orig.value;
    else delete p.consent_collection;
  } else if (p.consent_collection && typeof p.consent_collection === 'object') {
    const { promotions: _drop, ...rest } = p.consent_collection;
    if (Object.keys(rest).length) p.consent_collection = rest;
    else delete p.consent_collection;
  }
  return params;
}

/**
 * True when Stripe refused the session because of the recovery params, e.g. in
 * TEST mode 2026-09-28: "To set `consent_collection.promotions`, please visit
 * https://dashboard.stripe.com/settings/checkout to agree to the Terms of Service."
 */
export function isRecoveryParamRejection(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  // deno-lint-ignore no-explicit-any
  const e = err as any;
  const invalid = e.type === 'StripeInvalidRequestError' || e.rawType === 'invalid_request_error' ||
    e.raw?.type === 'invalid_request_error';
  if (!invalid) return false;
  const text = `${e.param ?? ''} ${e.raw?.param ?? ''} ${e.message ?? ''}`;
  return /consent_collection|after_expiration/.test(text);
}

// Structural, so tests can pass a fake. The session type is read off the client's
// own create() (for stripe-node, Stripe.Response<Stripe.Checkout.Session>).
// deno-lint-ignore no-explicit-any
type CreateFn = (...args: any[]) => Promise<unknown>;
interface CheckoutSessionCreator {
  checkout: { sessions: { create: CreateFn } };
}
type CreatedSession<C extends CheckoutSessionCreator> = Awaited<ReturnType<C['checkout']['sessions']['create']>>;

/**
 * stripe.checkout.sessions.create with a fail-safe for the recovery params.
 *
 * Stripe refuses consent_collection.promotions until the account has accepted the
 * promotional-emails terms in Dashboard > Settings > Checkout (test and live may
 * each need it). Without this, every checkout on the three recovery paths would
 * fail. So: if Stripe rejects the session because of consent_collection or
 * after_expiration, strip ALL the recovery params (restoring the normal 24-hour
 * lifetime), report it loudly, and retry exactly once. Any other error, or a
 * failure on the retry, propagates unchanged.
 */
export async function createCheckoutSessionWithRecovery<C extends CheckoutSessionCreator, T extends Params>(
  stripe: C,
  params: T,
  report: (err: unknown, context: Record<string, unknown>) => Promise<void> = captureException,
): Promise<CreatedSession<C>> {
  const create = (x: T) => stripe.checkout.sessions.create(x) as Promise<CreatedSession<C>>;
  try {
    return await create(params);
  } catch (err) {
    if (!isRecoveryParamRejection(err)) throw err;
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `create-checkout: CART RECOVERY DISABLED for this session because Stripe rejected the ` +
        `recovery params (${message}). Retrying once without them. Accept the promotional-emails ` +
        `terms at https://dashboard.stripe.com/settings/checkout to turn cart recovery back on.`,
    );
    try {
      await report(err, { function: 'create-checkout', step: 'cart_recovery_params_rejected' });
    } catch {
      // reporting must never block a checkout
    }
    stripCheckoutRecovery(params);
    return await create(params);
  }
}

// ── Webhook decision logic (pure) ──

/** The fields of an expired Checkout Session this feature reads. */
export interface ExpiredSessionLike {
  id: string;
  created?: number | null;
  metadata?: Record<string, unknown> | null;
  consent?: { promotions?: string | null } | null;
  customer_details?: { email?: string | null; name?: string | null } | null;
  customer_email?: string | null;
  after_expiration?: { recovery?: { url?: string | null } | null } | null;
}

export type Precheck =
  | { ok: false; reason: string; email: string | null; recoveryUrl: string | null }
  | { ok: true; email: string; recoveryUrl: string; firstName: string | null };

export function normalizeRecoveryEmail(raw: string | null | undefined): string | null {
  const e = (raw ?? '').trim().toLowerCase();
  return e && e.includes('@') ? e : null;
}

/** First word of the Stripe billing name, or null. */
export function firstNameFrom(name: string | null | undefined): string | null {
  const first = (name ?? '').trim().split(/\s+/)[0];
  return first ? first : null;
}

/**
 * Rules that need only the session itself, in order:
 *   1. not a preorder session (preorders are closed permanently),
 *      and not an E2E test session;
 *   2. consent.promotions === "opt_in", an email, and an https recovery URL.
 */
export function precheckExpiredSession(session: ExpiredSessionLike): Precheck {
  const meta = session.metadata ?? {};
  const email = normalizeRecoveryEmail(session.customer_details?.email ?? session.customer_email ?? null);
  const rawUrl = session.after_expiration?.recovery?.url ?? null;
  const recoveryUrl = safeHttpsUrl(rawUrl);
  const fail = (reason: string): Precheck => ({ ok: false, reason, email, recoveryUrl: rawUrl });

  if (typeof meta.preorder_sku === 'string' && meta.preorder_sku) return fail('preorder_session');
  if (isE2eMetadata(meta)) return fail('e2e_session');
  if (session.consent?.promotions !== 'opt_in') return fail('no_promotional_consent');
  if (!email) return fail('no_email');
  if (!rawUrl) return fail('no_recovery_url');
  if (!recoveryUrl) return fail('recovery_url_not_https');
  return { ok: true, email, recoveryUrl, firstName: firstNameFrom(session.customer_details?.name) };
}

/** What the webhook looked up about the address. */
export interface RecoveryFacts {
  /** An order or paid payment for this email since the expired session was created. */
  alreadyPurchased: boolean;
  /** A recovery email went (or is going) to this email in the last 30 days. */
  recentlySent: boolean;
  /** waitlist_signups.unsubscribed_at set on any row: global unsubscribe, hard bounce or complaint. */
  globallySuppressed: boolean;
  /** email_list_unsubscribes row for list 'cart'. */
  listUnsubscribed: boolean;
}

/** Rules 3-5. Returns the skip reason, or null to send. */
export function decideCartRecovery(facts: RecoveryFacts): string | null {
  if (facts.alreadyPurchased) return 'already_purchased';
  if (facts.recentlySent) return 'recently_sent';
  if (facts.globallySuppressed) return 'globally_suppressed';
  if (facts.listUnsubscribed) return 'unsubscribed_cart';
  return null;
}

/** Stripe line-item descriptions, trimmed, de-blanked, at most 10. */
export function recoveryItemNames(lines: Array<{ description?: string | null }> | null | undefined): string[] {
  return (lines ?? [])
    .map((l) => (l?.description ?? '').trim())
    .filter((d) => d.length > 0)
    .slice(0, 10);
}

// ── The email ──

export const CART_RECOVERY_SUBJECT = 'You left something in your cart';

const BRAND = {
  bgOuter: '#F5F0E8',
  bgBody: '#FFFFFF',
  forest: '#2C3E2D',
  text: '#3D3832',
  gold: '#C5A44E',
  footerText: '#6B6560',
};

function para(inner: string, extra = ''): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${BRAND.text};margin:0 0 16px 0;${extra}">${inner}</p>`;
}

function button(label: string, href: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
<tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
<tr><td align="center" style="background-color:${BRAND.forest};border-radius:8px;">
<a href="${href}" target="_blank" style="display:inline-block;background-color:${BRAND.forest};color:${BRAND.gold};font-family:Georgia,serif;font-size:16px;font-weight:bold;text-decoration:none;text-align:center;padding:14px 40px;border-radius:8px;line-height:24px;mso-line-height-rule:exactly;">${label}</a>
</td></tr></table>
</td></tr></table>`;
}

/**
 * Build the reminder. `{{UNSUB_URL}}` appears exactly once in the HTML and once in
 * the text; the sender swaps it with applyUnsub(..., 'cart').
 */
export function buildCartRecoveryEmail(input: {
  firstName: string | null;
  items: string[];
  recoveryUrl: string;
}): { subject: string; html: string; text: string } {
  const greeting = input.firstName ? `Hi ${input.firstName},` : 'Hi there,';
  const href = escapeHtml(input.recoveryUrl);
  const items = input.items.filter((i) => i.trim().length > 0);
  const postal = `${SELLER_LEGAL_NAME} &middot; ${SELLER_ADDRESS}`;

  const intro = "It looks like you started an order and didn't get to finish. No pressure at all. Here's a link to pick up right where you left off:";
  const after = 'This link works for 30 days. If something went wrong at checkout or you have a question first, just reply to this email and it comes straight to me.';

  const itemBlock = items.length
    ? para(items.map((i) => `<em>${escapeHtml(i)}</em>`).join('<br>'))
    : '';

  const body =
    para(escapeHtml(greeting)) +
    para(escapeHtml(intro)) +
    itemBlock +
    button('Finish my order', href) +
    para(escapeHtml(after)) +
    `<p style="font-family:Georgia,serif;font-size:16px;color:${BRAND.text};font-weight:bold;margin:24px 0 0 0;">Camila</p>
<p style="font-family:Georgia,serif;font-size:14px;color:${BRAND.text};margin:4px 0 0 0;">The Eden Institute</p>`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:${BRAND.bgOuter};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.bgOuter};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:${BRAND.bgBody};border-radius:8px;overflow:hidden;">
<tr><td style="background-color:${BRAND.forest};padding:24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="text-align:center;font-family:Georgia,serif;font-size:13px;font-weight:bold;letter-spacing:4px;color:${BRAND.gold};text-transform:uppercase;">THE EDEN INSTITUTE</td></tr>
<tr><td style="height:8px;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="text-align:center;font-family:Georgia,serif;font-size:14px;color:#FFFFFF;font-style:italic;">Back to Eden. Back to Truth.</td></tr>
</table>
</td></tr>
<tr><td style="padding:32px 28px;">${body}</td></tr>
<tr><td style="background-color:${BRAND.bgOuter};padding:20px 28px;">
<p style="font-family:Georgia,serif;font-size:11px;color:${BRAND.footerText};text-align:center;margin:0 0 8px 0;">You are receiving this because you started a checkout with us and said yes to emails.</p>
<p style="font-family:Georgia,serif;font-size:11px;color:${BRAND.footerText};text-align:center;margin:0 0 8px 0;">Prefer not to get checkout reminders? <a href="{{UNSUB_URL}}" style="color:${BRAND.footerText};text-decoration:underline;">Unsubscribe</a>.</p>
<p style="font-family:Georgia,serif;font-size:11px;color:${BRAND.footerText};text-align:center;margin:0;">${postal}</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = [
    greeting,
    '',
    intro,
    '',
    ...(items.length ? [...items, ''] : []),
    `Finish my order: ${input.recoveryUrl}`,
    '',
    after,
    '',
    'Camila',
    'The Eden Institute',
    '',
    '--',
    'You are receiving this because you started a checkout with us and said yes to emails.',
    'Unsubscribe from checkout reminders: {{UNSUB_URL}}',
    `${SELLER_LEGAL_NAME}, ${SELLER_ADDRESS}`,
  ].join('\n');

  return { subject: CART_RECOVERY_SUBJECT, html, text };
}
