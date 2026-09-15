// supabase/functions/_shared/checkout-session-binding.ts
//
// Pure rules for binding a verified Stripe Checkout session to the caller.
// No I/O. The session id is still the bearer credential for an anonymous
// one-off purchase (see src/lib/checkoutSession.ts); these rules only refuse a
// caller whose identity contradicts the identity create-checkout stamped on
// the session.

export const CHECKOUT_SESSION_ID_RE = /^cs_(test|live)_[A-Za-z0-9]+$/;

/**
 * The Supabase user id create-checkout stamped on the session:
 * session.metadata for one-offs, subscription.metadata for subscriptions
 * (only visible when the session was retrieved with expand: ['subscription']).
 */
export function sessionBoundUserId(session: {
  metadata?: Record<string, string> | null;
  subscription?: unknown;
}): string | null {
  const direct = session.metadata?.supabase_user_id;
  if (typeof direct === "string" && direct) return direct;
  const sub = session.subscription;
  if (sub && typeof sub === "object") {
    const m = (sub as { metadata?: Record<string, string> | null }).metadata?.supabase_user_id;
    if (typeof m === "string" && m) return m;
  }
  return null;
}

export function isCallerAllowed(i: {
  mode: string | null;
  boundUserId: string | null;
  callerUserId: string | null;
}): boolean {
  // Someone else's session.
  if (i.boundUserId && i.callerUserId && i.boundUserId !== i.callerUserId) return false;
  // create-checkout 401s a subscription checkout without a user JWT, so no
  // legitimate subscription verify is anonymous.
  if (i.mode === "subscription" && !i.callerUserId) return false;
  // Anonymous one-off (Deep-Dive Guide): the session id stays the credential.
  return true;
}
