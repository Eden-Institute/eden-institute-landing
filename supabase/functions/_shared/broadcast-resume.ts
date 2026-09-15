// supabase/functions/_shared/broadcast-resume.ts
//
// Resumable cohort sends for founder-broadcast (founder decision 2026-09-15).
//
// Before: sent_count was written only after the whole loop, and a second press
// of Send with the same idempotency key answered "sent: 0" without mailing
// anyone, so a send interrupted partway (a timeout, the edge worker killed at
// its wall clock) could never be finished from the dashboard.
//
// Now every recipient has a row in broadcast_recipient_sends, keyed on
// (idempotency_key, recipient_email, order_id). The row is CLAIMED ('sending')
// before the Resend call and marked 'sent' with the Resend message id straight
// after it, so pressing Send again with the same message mails only the orders
// that have no row yet. The pure parts live here:
//
//   planResume        who still needs this message, who already has it, and
//                     who another request is sending to right now
//   isStaleClaim      a 'sending' row old enough that its request must have died
//   broadcastMatches  the key is being reused for the SAME message, not an edit
//   summarizeSend     the HTTP status and counts the dashboard sees
//
// A 'sending' row whose request died is sent again under the same Resend
// Idempotency-Key (`<broadcast id>:<order id>`), which Resend honours for 24
// hours, so a resume within a day cannot deliver it twice even if the first
// attempt did reach Resend.

/** A claim older than this belongs to a request that died. A send takes seconds; a whole run under 2 minutes. */
export const STALE_CLAIM_MS = 5 * 60 * 1000;

export interface ResumeRecipient {
  order_id: string;
  customer_email: string;
}

export interface SendLogRow {
  order_id: string;
  recipient_email: string;
  status: 'sending' | 'sent';
  claimed_at: string;
}

export function isStaleClaim(claimedAt: string, now: Date): boolean {
  const t = Date.parse(claimedAt);
  // An unreadable timestamp cannot prove a request is still alive.
  if (!Number.isFinite(t)) return true;
  return now.getTime() - t >= STALE_CLAIM_MS;
}

export interface ResumePlan<R extends ResumeRecipient> {
  /** No row, or a claim whose request died. */
  toSend: R[];
  /** Orders already marked sent for this message. */
  alreadySent: number;
  /** Orders another request claimed moments ago and may be sending right now. */
  inFlight: number;
}

/**
 * Diff the live cohort against the send log for one message. Matched on
 * order_id: every order gets the message once, and a buyer who changed their
 * email after the first attempt is not mailed again at the new address. An
 * order sent to earlier that has since left the cohort (refunded) is not
 * counted and not mailed.
 */
export function planResume<R extends ResumeRecipient>(list: R[], log: SendLogRow[], now: Date): ResumePlan<R> {
  const byOrder = new Map<string, SendLogRow>();
  for (const row of log) {
    const prev = byOrder.get(row.order_id);
    // 'sent' wins over any 'sending' row for the same order.
    if (!prev || (prev.status !== 'sent' && row.status === 'sent')) byOrder.set(row.order_id, row);
  }
  const plan: ResumePlan<R> = { toSend: [], alreadySent: 0, inFlight: 0 };
  const seen = new Set<string>();
  for (const r of list) {
    if (seen.has(r.order_id)) continue;
    seen.add(r.order_id);
    const row = byOrder.get(r.order_id);
    if (!row) plan.toSend.push(r);
    else if (row.status === 'sent') plan.alreadySent++;
    else if (isStaleClaim(row.claimed_at, now)) plan.toSend.push(r);
    else plan.inFlight++;
  }
  return plan;
}

export interface StoredBroadcast {
  kind: string;
  subject: string;
  body_markdown: string;
  revised_ship_date: string | null;
}

/**
 * True when a request carrying an existing idempotency key is the same message
 * that key was first used for. The dashboard keeps the key after a failed
 * attempt, and the form stays editable, so an edited message must not be
 * mailed to "the rest" under the old key. `resolvedSubject` is the subject the
 * function would send (a delay notice always sends its pre-approved subject).
 */
export function broadcastMatches(
  stored: StoredBroadcast,
  incoming: { kind: string; resolvedSubject: string; bodyMarkdown: string; revisedShipDate: string | null },
): boolean {
  return stored.kind === incoming.kind &&
    stored.subject === incoming.resolvedSubject &&
    stored.body_markdown === incoming.bodyMarkdown &&
    (stored.revised_ship_date ?? null) === (incoming.revisedShipDate ?? null);
}

export interface SendCounts {
  /** Orders in the live cohort for this message. */
  total: number;
  alreadySent: number;
  sentNow: number;
  failed: number;
  inFlight: number;
  /** Orders still to send that this request did not reach before its time budget ran out. */
  notReached: number;
}

export interface SendSummary {
  status: 200 | 409;
  body: Record<string, unknown>;
}

/**
 * 200 only when every order in the cohort has the message. Anything left over
 * answers 409 with a plain explanation in `error`: the dashboard shows that
 * text, and, because the call did not succeed, KEEPS the same idempotency key
 * and form, so pressing Send again resumes instead of starting a new message.
 *
 * `sent` stays the dashboard's headline number: how many orders now have this
 * message in total. `sent_now` and `already_sent` split it.
 */
export function summarizeSend(broadcastId: string, c: SendCounts): SendSummary {
  const delivered = c.alreadySent + c.sentNow;
  const counts = {
    broadcast_id: broadcastId,
    sent: delivered,
    sent_now: c.sentNow,
    already_sent: c.alreadySent,
    failed: c.failed,
    in_flight: c.inFlight,
    not_reached: c.notReached,
    total: c.total,
  };
  const left = c.failed + c.inFlight + c.notReached;
  if (left === 0) {
    const duplicate = c.sentNow === 0 && c.alreadySent > 0;
    return { status: 200, body: { ...counts, duplicate, complete: true } };
  }
  const parts: string[] = [];
  parts.push(`Sent to ${c.sentNow} now${c.alreadySent ? ` (${c.alreadySent} already had it)` : ''}, ${delivered} of ${c.total} in total.`);
  if (c.failed) parts.push(`${c.failed} could not be sent this time.`);
  if (c.notReached) parts.push(`${c.notReached} not reached yet (this run hit its time limit).`);
  if (c.inFlight) parts.push(`${c.inFlight} are being sent by another request right now; wait a minute first.`);
  parts.push('Press Send again with the same message to finish. Nobody who already has it will get it twice.');
  return { status: 409, body: { ...counts, duplicate: false, complete: false, error: parts.join(' ') } };
}
