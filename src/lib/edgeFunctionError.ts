import { FunctionsHttpError } from "@supabase/supabase-js";

/**
 * The words a visitor should see when a public form's edge function refuses a
 * submission.
 *
 * supabase.functions.invoke() never puts a non-2xx body in `data`. It returns
 * a FunctionsHttpError whose message is always "Edge Function returned a
 * non-2xx status code", so forms that did `setError(err.message)` showed that
 * sentence for every refusal, including the authored ones ("That email
 * address looks misspelled. Did you mean ...?", the rate-limit message).
 *
 * The public form functions (resend-waitlist, submit-partner-inquiry,
 * submit-feedback) write their 400 / 409 / 422 / 429 `error` strings for the
 * visitor, so those are shown. A 5xx, a body that is not JSON, or any other
 * failure gets the caller's fallback instead.
 */
const VISITOR_FACING_STATUSES = new Set([400, 409, 422, 429]);

export async function visitorFacingError(err: unknown, fallback: string): Promise<string> {
  if (err instanceof FunctionsHttpError) {
    const res = err.context as Response | undefined;
    if (res && VISITOR_FACING_STATUSES.has(res.status)) {
      try {
        const body = await res.clone().json();
        if (body && typeof body.error === "string" && body.error.trim()) return body.error;
      } catch {
        // Not JSON: fall through to the fallback.
      }
    }
    return fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export const FORM_ERROR_FALLBACK = "Something went wrong. Please try again.";
