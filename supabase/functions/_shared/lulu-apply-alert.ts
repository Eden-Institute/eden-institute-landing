// supabase/functions/_shared/lulu-apply-alert.ts
//
// lulu-webhook, when applying a Lulu status update fails on OUR side (founder
// decision 2026-09-15): answer Lulu 200 so it never deactivates the webhook
// (it does after 5 failed deliveries), and email the founder ONCE per
// order + event to press Refresh on that order. Pure pieces live here so they
// can be tested without a database: the once-only decision and the email copy.
//
// "Once" is lulu_events.founder_alerted_at, claimed with a conditional UPDATE
// (founder_alerted_at IS NULL) before the email goes out, and released again if
// the email fails, so a later delivery of the same event can try again.

export interface AlertClaimOutcome {
  /** The conditional UPDATE itself errored (e.g. the column is missing). */
  claimError: boolean;
  /** Rows the conditional UPDATE matched: 1 means this delivery owns the alert. */
  claimedRows: number;
  /**
   * The ledger row as re-read after a claim that matched nothing: null when no
   * row exists (the ledger insert failed earlier and the webhook failed open),
   * undefined when it could not be read.
   */
  existing?: { founder_alerted_at: string | null } | null;
}

export type AlertDecision = 'send' | 'skip_already_alerted';

/**
 * Fails toward sending. A second copy of an alert is a nuisance; a lost alert
 * is an order whose shipping status silently never updates.
 */
export function decideFailureAlert(o: AlertClaimOutcome): AlertDecision {
  if (o.claimError) return 'send';
  if (o.claimedRows > 0) return 'send';
  if (o.existing && o.existing.founder_alerted_at) return 'skip_already_alerted';
  return 'send';
}

export function buildApplyFailureAlert(input: {
  orderRef: string | null;
  printJobId: number;
  statusName: string;
  eventKey: string;
  error: string;
}): { subject: string; text: string } {
  const ref = input.orderRef ?? `Lulu print job ${input.printJobId}`;
  const status = input.statusName || '(no status name)';
  return {
    subject: `Lulu update did not save for order ${ref}`,
    text:
      `Lulu told us print job ${input.printJobId} for order ${ref} is now ${status}, ` +
      `but saving that update on our side failed:\n\n` +
      `${input.error.slice(0, 1000)}\n\n` +
      `We told Lulu we received it, so Lulu will not send this update again and the webhook stays switched on.\n\n` +
      `What to do: open the Orders tab on /founder and press Refresh on order ${ref}. ` +
      `That pulls the current status straight from Lulu and applies it. ` +
      `If Refresh fails too, forward this email to Claude.\n\n` +
      `Event: ${input.eventKey}`,
  };
}
