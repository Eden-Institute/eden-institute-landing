// Stripe error classification that survives the esm.sh bundle.
//
// esm.sh minifies stripe-node's class names, so a thrown error's `type` is a
// short mangled string (observed "Ie" on 2026-09-15), never
// "StripeInvalidRequestError". Match on the fields Stripe itself sends
// instead: `code` (copied from the API response) and `raw.code`, plus the
// HTTP status.

export function isStripeResourceMissing(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { code?: unknown; statusCode?: unknown; raw?: { code?: unknown } };
  return e.code === "resource_missing" || e.raw?.code === "resource_missing" || e.statusCode === 404;
}
