// supabase/functions/_shared/webhook-guards.ts
//
// Small, pure decisions the Stripe webhook makes about a completed checkout.
// Kept here (not in stripe-webhook/index.ts, which starts a server on import) so they
// can be unit tested. Added by the 2026-11-06 checkout audit (Lane 2, Camila's go).

/**
 * Has the buyer finished paying for this Checkout Session?
 *
 * "paid" obviously. "no_payment_required" too: that is a 100%-off code, Stripe takes no
 * money, and the buyer is owed the product all the same. Before this the Starter, print
 * and book branches accepted only "paid", so a free code silently delivered nothing (the
 * guide branch has always delivered it, and its comment calls it "a legitimate free
 * delivery"). Only "unpaid" is refused: an asynchronous method whose money has not
 * arrived yet.
 */
export function isSettledPaymentStatus(paymentStatus: string | null | undefined): boolean {
  return paymentStatus === 'paid' || paymentStatus === 'no_payment_required';
}

export interface MessageLogRow {
  channel: string;
  template_key: string;
  triggered_by_status: string;
  status: string;
}

/**
 * Order EMAILS that failed and were never sent since: one entry per template that has a
 * 'failed' row and no 'sent' row for the same (template, status). SMS is left out on
 * purpose: a text that cannot go (no A2P registration yet, a landline) must not hold an
 * order's webhook in a retry loop. The email is the buyer's confirmation and receipt.
 */
export function unsentOrderEmails(rows: readonly MessageLogRow[]): string[] {
  const emails = rows.filter((r) => r.channel === 'email');
  const sent = new Set(emails.filter((r) => r.status === 'sent').map((r) => `${r.template_key}|${r.triggered_by_status}`));
  const missing = new Set<string>();
  for (const r of emails) {
    if (r.status === 'failed' && !sent.has(`${r.template_key}|${r.triggered_by_status}`)) missing.add(r.template_key);
  }
  return [...missing];
}
