// supabase/functions/_shared/refund-amount.ts
//
// How much money ONE charge.refunded event gave back.
//
// Stripe's charge.amount_refunded is the charge's RUNNING TOTAL, not the refund that
// fired the event. stripe-webhook used to write that total on every refund row, so a
// second partial refund on the same charge (or a partial refund followed by the rest)
// recorded more money back than really went back, and the founder dashboard's net
// revenue read low. Found 2026-10-15 while building the partial-refund email (#647).
//
// Order of preference:
//   1. amount_refunded minus event.data.previous_attributes.amount_refunded. Stripe sent
//      it on every charge.refunded event in production as of 2026-10-15 (15 of 15, API
//      versions 2026-02-25.clover and 2024-12-18.acacia), so this is the normal path.
//   2. The newest refund on the charge (refunds.list is newest first). Only used when the
//      event carries no usable previous value.
// Neither works -> null. The caller records nothing rather than guessing, because a
// guessed amount is exactly the bug this file exists to fix.

export interface RefundChargeLike {
  id: string;
  amount_refunded?: number | null;
}

export interface RefundLike {
  amount?: number | null;
}

/** Step 1: the difference between the running totals after and before this event. */
export function refundDeltaFromEvent(
  amountRefunded: number | null | undefined,
  previousAttributes: unknown,
): number | null {
  if (typeof amountRefunded !== "number") return null;
  if (!previousAttributes || typeof previousAttributes !== "object") return null;
  const prev = (previousAttributes as { amount_refunded?: unknown }).amount_refunded;
  if (typeof prev !== "number") return null;
  const delta = amountRefunded - prev;
  return delta > 0 ? delta : null;
}

/**
 * The cents THIS refund event returned, or null when it cannot be worked out.
 * `newestRefund` is only called when the event itself cannot answer.
 */
export async function thisRefundCents(
  charge: RefundChargeLike,
  previousAttributes: unknown,
  newestRefund: (chargeId: string) => Promise<RefundLike | null>,
): Promise<number | null> {
  const fromEvent = refundDeltaFromEvent(charge.amount_refunded, previousAttributes);
  if (fromEvent != null) return fromEvent;

  const amount = (await newestRefund(charge.id))?.amount;
  if (typeof amount !== "number" || amount <= 0) return null;
  // One refund can never be more than the charge's running total at this event.
  if (typeof charge.amount_refunded === "number" && amount > charge.amount_refunded) return null;
  return amount;
}
