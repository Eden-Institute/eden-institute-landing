// supabase/functions/_shared/resend-idempotency.ts
//
// Resend Idempotency-Key for the delivery emails (Starter Unit and Back to Eden),
// added 2026-11-10 (Lane 2 deep audit, area 2 finding D2; founder go "Yes, build +
// ship all 5").
//
// THE DUPLICATE IT STOPS. A delivery email can be sent successfully and then the
// write that records "sent" fails, or the worker is killed between the two. The row
// still reads unsent, so the drain (Starter) or a Stripe redelivery (book) sends it
// again and the buyer gets two copies.
//
// WHAT RESEND DOES WITH THE HEADER (docs, read 2026-11-10:
// resend.com/docs/dashboard/emails/idempotency-keys): keys are kept 24 hours, up to
// 256 characters. A repeat with the same key and payload returns the original
// response and sends nothing. The same key with a different payload is 409
// `invalid_idempotent_request`; a repeat while the first is still running is 409
// `concurrent_idempotent_requests` ("safe to retry later").
//
// WHAT THE DOCS DO NOT SAY: whether a FAILED first request (a 5xx, a 429) is kept
// under its key. If it were, reusing the key would replay the failure for 24 hours
// and hold the buyer's files back. So the key carries a GENERATION: the caller bumps
// it after every definite refusal it has recorded, and keeps it only when the outcome
// was unclear (a timeout, a crash, a concurrent 409). An unclear outcome is exactly
// when a second send could duplicate, and exactly when the key is reused.

export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

export type DeliveryKind = 'starter-delivery' | 'book-delivery';

/** `<kind>/<row id>/<generation>`, never longer than Resend's 256-character limit. */
export function deliveryIdempotencyKey(kind: DeliveryKind, rowId: string, generation: number): string {
  const g = Number.isFinite(generation) && generation > 0 ? Math.floor(generation) : 0;
  return `${kind}/${rowId}/${g}`.slice(0, 256);
}

/**
 * What a Resend /emails response means for a delivery.
 *   sent          2xx: accepted now.
 *   already_sent  409 invalid_idempotent_request: an email under this key was already
 *                 accepted in the last 24 hours (the payload differs, e.g. a receipt
 *                 that loaded this time and not last time). The buyer has it.
 *   in_flight     409 concurrent_idempotent_requests: another worker is sending it
 *                 right now. Not a refusal; try again later WITH THE SAME KEY.
 *   refused       anything else. A definite "not sent": bump the generation.
 */
export type ResendOutcome = 'sent' | 'already_sent' | 'in_flight' | 'refused';

export function classifyResendResponse(status: number, bodyText: string): ResendOutcome {
  if (status >= 200 && status < 300) return 'sent';
  if (status === 409) {
    let name = '';
    try {
      const parsed = JSON.parse(bodyText) as { name?: unknown };
      name = typeof parsed?.name === 'string' ? parsed.name : '';
    } catch {
      name = '';
    }
    const text = name || bodyText;
    if (text.includes('invalid_idempotent_request')) return 'already_sent';
    if (text.includes('concurrent_idempotent_requests')) return 'in_flight';
  }
  return 'refused';
}
