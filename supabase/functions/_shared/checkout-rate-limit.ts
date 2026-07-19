// Per-IP rate limiting for the PUBLIC create-checkout endpoint.
//
// create-checkout is unauthenticated by necessity (anonymous buyers) and mints a real
// Stripe Checkout Session on every request. The threat is card testing: bots use open
// checkout endpoints to validate stolen card numbers in bulk, which spikes dispute and
// fraud metrics. That is precisely the profile that gets a Stripe account reserved or
// frozen, and this one will be holding preorder money.
//
// FAILS OPEN by design, same reasoning as the studio limiter. If the counter cannot be
// read or written, the request is allowed. A rate-limit outage that blocked checkout on
// launch morning would cost far more than the abuse it prevents, and failing open only
// returns us to the pre-existing behaviour.
//
// The caller IP is SALTED AND HASHED here; the raw address never reaches the database.

import { captureException } from './sentry.ts';

/** Requests allowed per IP per window. A real buyer makes one to three. */
export const CHECKOUT_RATE_LIMIT = Number(
  Deno.env.get('CHECKOUT_RATE_LIMIT') ?? '10',
);

/** Window length in seconds. */
export const CHECKOUT_RATE_WINDOW_SECONDS = Number(
  Deno.env.get('CHECKOUT_RATE_WINDOW_SECONDS') ?? '600',
);

/**
 * Best-effort client IP. Supabase sits behind a proxy, so x-forwarded-for is the real
 * source; the left-most entry is the original client. Returns null when no header is
 * present, which callers treat as "cannot rate limit" and allow.
 */
export function clientIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip');
}

/**
 * Salted SHA-256 of the IP. The salt keeps the table from being a reversible list of
 * visitor addresses (the IPv4 space is small enough to brute-force unsalted hashes).
 * Falls back to a fixed salt so a missing secret degrades privacy, not availability.
 */
async function hashIp(ip: string): Promise<string> {
  const salt = Deno.env.get('CHECKOUT_RATE_SALT') ?? 'eden-checkout-rate-limit';
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface CheckoutRateResult {
  allowed: boolean;
  /** Post-increment count for this window, or null when the check failed open. */
  count: number | null;
  limit: number;
}

/** Just the slice of the supabase-js client this module needs, so it does not couple
 *  to a specific import specifier (same approach as order-db.ts's Db). */
type Db = {
  rpc(
    fn: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

/**
 * Count this request against the caller's window and report whether to proceed.
 * Never throws.
 */
export async function enforceCheckoutRateLimit(
  db: Db,
  req: Request,
  limit = CHECKOUT_RATE_LIMIT,
): Promise<CheckoutRateResult> {
  try {
    const ip = clientIp(req);
    // No usable IP means no key to count against. Allow rather than block everyone
    // behind a proxy configuration we did not anticipate.
    if (!ip) return { allowed: true, count: null, limit };

    const { data, error } = await db.rpc('checkout_rate_bump', {
      p_ip_hash: await hashIp(ip),
      p_window_seconds: CHECKOUT_RATE_WINDOW_SECONDS,
    });
    if (error || typeof data !== 'number') {
      console.warn('checkout rate-limit failed open:', error?.message ?? 'no count');
      return { allowed: true, count: null, limit };
    }
    return { allowed: data <= limit, count: data, limit };
  } catch (e) {
    console.warn('checkout rate-limit threw (failing open):', e);
    // Surfaced to Sentry: failing open is correct, but it must not be silent, or a
    // permanently broken limiter would look exactly like a quiet endpoint.
    await captureException(e, { function: 'checkout-rate-limit' });
    return { allowed: true, count: null, limit };
  }
}
