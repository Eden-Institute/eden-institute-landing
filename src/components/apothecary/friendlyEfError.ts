import { FunctionsHttpError } from "@supabase/supabase-js";

/**
 * One place to translate an edge-function failure into words a paying
 * customer may read.
 *
 * The commerce EFs (create-checkout, customer-portal) mark user-actionable
 * failures with a `code` field (e.g. BUNDLE_REQUIRED, no_stripe_customer) and
 * a deliberately-authored `error` message; everything else is a raw/technical
 * string like "Edge Function returned a non-2xx status code" that should never
 * reach the UI. This was previously copy-pasted per button and the checkout
 * auto-resume path missed it entirely, showing the raw string.
 */
export async function friendlyEfError(
  err: unknown,
  fallback: string,
): Promise<string> {
  if (err instanceof FunctionsHttpError) {
    try {
      const body = await err.context.json();
      if (body?.code && typeof body.error === "string") return body.error;
    } catch {
      // Response body was not JSON; fall through to the friendly line.
    }
  }
  return fallback;
}

export const CHECKOUT_ERROR_FALLBACK =
  "Could not start checkout. Please try again or contact hello@edeninstitute.health.";

export const PORTAL_ERROR_FALLBACK =
  "Could not open the billing portal. Please try again or contact hello@edeninstitute.health.";
