// supabase/functions/_shared/starter-gift.ts
//
// Founder gift (punch #5, 2026-11-03): a Starter Unit Camila gives to someone, with
// no payment. Until now the Starter rail only ever delivered a row that a Stripe
// purchase (or an ESA invoice, or the FPEA offer) had written, so on 2026-08-27 two
// families were told a gifted Starter was on its way that could not exist.
//
// A gift is ONE pending starter_deliveries row whose key starts with `gift_`. The
// existing rail (starter-fulfill: stamp, store, sign, email; cron drain every 10
// minutes) delivers it exactly as it delivers a bought Starter, and the email
// switches to its gift wording on the key. The row is written by the founder's ops
// script (Biblical Herbalism/scripts/gift_starter.py), only on her word for each
// person. Like the FPEA gift it never touches starter_credits, Stripe or orders,
// and notify-founder-digest counts only `esa_` keys as sales, so a gift is never
// reported as one.

export const STARTER_GIFT_ID = 'gift';
export const STARTER_GIFT_KEY_PREFIX = 'gift_';

export function isStarterGiftDeliveryKey(key: string | null | undefined): boolean {
  return typeof key === 'string' && key.startsWith(STARTER_GIFT_KEY_PREFIX);
}
