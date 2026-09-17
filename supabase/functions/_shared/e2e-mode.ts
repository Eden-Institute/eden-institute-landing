// supabase/functions/_shared/e2e-mode.ts
//
// End-to-end TEST switch for the print-shop purchase path (founder request
// 2026-09-17: "a full e2e test with a fake card", no real money, no real print).
//
// How it works: two thin entry points, create-checkout-e2e and stripe-webhook-e2e,
// set globalThis.__EDEN_E2E__ and then load the REAL create-checkout and
// stripe-webhook modules. Each Edge Function runs in its own isolate, so the flag
// only ever exists inside those two test functions. The production functions never
// set it, and for them every value below is exactly what it was before.
//
// In E2E mode:
//   - Stripe runs on STRIPE_TEST_SECRET_KEY (must start sk_test_, or we refuse to
//     start), and webhooks verify against STRIPE_TEST_WEBHOOK_SECRET.
//   - create-checkout demands the E2E_TEST_TOKEN header on every request and only
//     serves the print shop. The buyer email is forced to hello@, which the founder
//     dashboards already classify as internal (is_internal_email).
//   - stripe-webhook refuses live-mode events, ignores sessions not stamped
//     e2e_test, and SKIPS: the Lulu job (no real print), Meta CAPI, and the Resend
//     contact sync. It still records the order and sends the confirmation email,
//     because those are the things being tested.

import { timingSafeEqual } from "./timing-safe-equal.ts"

export const E2E_MODE: boolean = (globalThis as { __EDEN_E2E__?: boolean }).__EDEN_E2E__ === true

/** Every E2E order is bought as this address, so dashboards file it as internal. */
export const E2E_BUYER_EMAIL = "hello@edeninstitute.health"

/** Stamped into Checkout Session + PaymentIntent metadata. */
export const E2E_METADATA_KEY = "e2e_test"

export const E2E_HEADER = "x-eden-e2e"

function required(name: string): string {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`E2E mode: secret ${name} is not set; refusing to start`)
  return v
}

/** The Stripe secret key for this isolate. Never a live key in E2E mode. */
export function stripeSecretKey(): string {
  if (!E2E_MODE) return Deno.env.get("STRIPE_SECRET_KEY")!
  const key = required("STRIPE_TEST_SECRET_KEY")
  if (!key.startsWith("sk_test_")) throw new Error("E2E mode: STRIPE_TEST_SECRET_KEY is not a test key; refusing to start")
  return key
}

/** The webhook signing secret for this isolate. */
export function stripeWebhookSecret(): string {
  return E2E_MODE ? required("STRIPE_TEST_WEBHOOK_SECRET") : Deno.env.get("STRIPE_WEBHOOK_SECRET")!
}

/** True when the request carries the E2E token. Always false outside E2E mode. */
export function e2eRequestAllowed(req: Request): boolean {
  if (!E2E_MODE) return false
  const token = Deno.env.get("E2E_TEST_TOKEN")
  const given = req.headers.get(E2E_HEADER)
  return !!token && !!given && timingSafeEqual(given, token)
}

/** True when a Stripe object's metadata marks it as an E2E purchase. */
export function isE2eMetadata(metadata: Record<string, unknown> | null | undefined): boolean {
  return metadata?.[E2E_METADATA_KEY] === "true"
}
