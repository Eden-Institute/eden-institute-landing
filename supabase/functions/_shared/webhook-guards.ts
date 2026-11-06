// supabase/functions/_shared/webhook-guards.ts
//
// Small, pure decisions the Stripe webhook makes about a completed checkout.
// Kept here (not in stripe-webhook/index.ts, which starts a server on import) so they
// can be unit tested. Added by the 2026-11-06 checkout audit (Lane 2, Camila's go).
//
// VERIFIED 2026-11-06 (sandbox order ET-1045): a 100%-off promotion code in a
// mode:"payment" Checkout Session completes with payment_status "paid", NOT
// "no_payment_required" (Stripe reserves that for sessions that collect no payment now,
// e.g. setup mode). So the webhook's `payment_status !== "paid"` guards already deliver
// free-code orders; do not "fix" them on the assumption that a $0 order is refused.

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
