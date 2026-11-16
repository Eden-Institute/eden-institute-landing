// supabase/functions/_shared/drip-idempotency.ts
//
// One Resend Idempotency-Key per drip attempt (2026-11-16, Lane 2 area 6 N1,
// founder tap "Yes, build + ship").
//
// The problem: nurture-emails sends a queued row, THEN marks it sent. If the mark
// is lost (a gateway 504 on the PATCH did this on 2026-09-11, constitution_5 five
// times to one subscriber, and again 2026-09-13), or the worker dies between the
// two, or two drain runs overlap, the next run sends the same email again.
//
// The fix: every drip send carries Idempotency-Key = nurture-emails/<table>/<row
// id>/<retry_count>. Resend keeps a key for 24 hours and answers a repeat with the
// ORIGINAL response instead of sending again (same payload), or 409
// invalid_idempotent_request (different payload), or 409
// concurrent_idempotent_requests (the first request with that key is still in
// flight). https://resend.com/docs/dashboard/emails/idempotency-keys
//
// Why retry_count is part of the key: retry_count goes up only when a failure is
// RECORDED (recordSendFailure), and a recorded failure means Resend did not take
// the email (or no answer arrived). Resend's docs do not say whether a key is kept
// after a FAILED request; if it were, a fixed key would replay that failure (a
// daily-quota 429, say) for 24 hours and the row would give up unsent. A new key
// after every recorded failure keeps today's retry behaviour exactly. The cases
// that cause double sends never record a failure, so they reuse the same key:
//   - Resend accepted, the "mark sent" PATCH failed      -> same key, refused
//   - the worker stopped between the send and the mark   -> same key, refused
//   - two runs picked up the same pending row            -> same key, refused
// Not covered (left as it was): Resend accepted but its reply never arrived, so
// the send threw and the failure was recorded; the retry uses a new key.
// Accepted risk: a 409 invalid_idempotent_request is read as "already sent". It
// could only be wrong if an earlier attempt with this key FAILED, recording that
// failure ALSO failed, and the email's content changed before the next run.
//
// Pure: no network, no clock.

/** Resend's limit is 1-256 characters. */
export const IDEMPOTENCY_KEY_MAX = 256;

export function dripIdempotencyKey(
  table: string,
  rowId: string | number,
  retryCount: number | null | undefined,
): string {
  const n = Number.isFinite(retryCount) && (retryCount as number) > 0 ? Math.floor(retryCount as number) : 0;
  const key = `nurture-emails/${table}/${rowId}/${n}`;
  if (!table || rowId === '' || rowId === null || rowId === undefined) {
    throw new Error(`dripIdempotencyKey: table and row id are required (got ${key})`);
  }
  if (key.length > IDEMPOTENCY_KEY_MAX) {
    throw new Error(`dripIdempotencyKey: key longer than ${IDEMPOTENCY_KEY_MAX} characters`);
  }
  return key;
}

/**
 * What a Resend 409 means for a drip row.
 *  - 'already_sent': this key was already used on an earlier request with a different
 *    payload. With the key scheme above, an earlier request with this key and no
 *    recorded failure is an email Resend took (its "mark sent" was lost). Mark sent.
 *  - 'in_flight': another run is sending this row right now. Leave the row alone;
 *    that run marks it sent, or records its own failure.
 *  - null: not an idempotency answer; handle as any other failed send.
 */
export type IdempotencyOutcome = 'already_sent' | 'in_flight' | null;

export function readIdempotencyConflict(
  status: number | null | undefined,
  name: string | null | undefined,
): IdempotencyOutcome {
  if (status !== 409) return null;
  if (name === 'invalid_idempotent_request') return 'already_sent';
  if (name === 'concurrent_idempotent_requests') return 'in_flight';
  return null;
}
