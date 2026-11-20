// supabase/functions/_shared/fpea-gift.ts
//
// FPEA 2027 offer, after payment: queue the gifted Starter Unit(s) for a printed
// set bought under the offer (see fpea-offer.ts for the offer itself). Called by
// stripe-webhook's print branch once the print order is recorded.
//
// 2026-11-20: the same rail serves every print-gift offer in sale-offers.ts (FPEA
// and Back-to-School Week). queueOfferGiftStarters takes the offer; each offer has
// its own key prefix. queueFpeaGiftStarters is the FPEA call, unchanged.
//
// It writes ONE thing: a pending starter_deliveries row per gifted band, which the
// existing Starter rail (starter-fulfill: stamp, store, sign, email) then delivers
// exactly as it delivers a bought Starter. The caller kicks starter-fulfill for
// each queued key; the cron drain is the backstop.
//
// It NEVER touches starter_credits, never calls Stripe and never mints a promotion
// code: founder law, no credit is given or shown until the kits are live, and a
// gifted Starter was not a Starter purchase. This function has no Stripe client to
// call even by mistake, and fpea-offer.test.ts asserts it writes to no other table.
//
// Idempotent: each gift's key is derived from the print session id and the band
// (offerGiftDeliveryKey), and starter_deliveries is unique on that column, so a
// redelivered webhook gets 23505 and queues nothing new.

import { FPEA_OFFER, type GiftBand, giftBandsForSkus, offerGiftDeliveryKey, type SaleOffer } from './sale-offers.ts';

// deno-lint-ignore no-explicit-any
export type GiftDb = { from(table: string): any };

export interface GiftInput {
  /** The PRINT order's Stripe Checkout Session id. */
  sessionId: string;
  /** The print order's id, for traceability. The gift email shows no receipt either way. */
  orderId: string | null;
  email: string | null;
  purchaserName: string | null;
  /** The order's SKUs (resolved print lines). Only printed SETS bring a Starter. */
  skus: readonly string[];
}

export interface GiftResult {
  bands: GiftBand[];
  /** Keys newly queued; the caller kicks starter-fulfill for each. */
  queued: string[];
  /** Keys that already existed (a redelivered webhook). */
  alreadyQueued: string[];
  /** One message per band that could not be queued. Empty means everything is in. */
  errors: string[];
}

/** 32 hex chars of CSPRNG twice, the same shape stripe-webhook writes for a bought Starter. */
export function newGiftDownloadToken(): string {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}

/** The FPEA call: exactly queueOfferGiftStarters with the FPEA offer. */
export function queueFpeaGiftStarters(
  db: GiftDb,
  input: GiftInput,
  newToken: () => string = newGiftDownloadToken,
): Promise<GiftResult> {
  return queueOfferGiftStarters(db, FPEA_OFFER, input, newToken);
}

/** Queue the Starter(s) a print-gift offer brings. An offer without the gift queues nothing. */
export async function queueOfferGiftStarters(
  db: GiftDb,
  offer: SaleOffer,
  input: GiftInput,
  newToken: () => string = newGiftDownloadToken,
): Promise<GiftResult> {
  const bands = offer.printGift && offer.giftKeyPrefix ? giftBandsForSkus(input.skus) : [];
  const result: GiftResult = { bands, queued: [], alreadyQueued: [], errors: [] };
  if (bands.length === 0) return result;
  const email = (input.email ?? '').trim().toLowerCase();
  if (!email) {
    result.errors.push('no email on the session; the gifted Starter cannot be delivered');
    return result;
  }
  for (const band of bands) {
    const key = offerGiftDeliveryKey(offer, input.sessionId, band);
    try {
      const { error } = await db.from('starter_deliveries').insert({
        stripe_checkout_session_id: key,
        order_id: input.orderId,
        email,
        purchaser_name: input.purchaserName,
        status: 'pending',
        download_token: newToken(),
        // Same rule as stripe-webhook and esa-fulfil: Sprouts leaves `band` to the
        // column default, any other band writes it.
        ...(band === 'sprouts' ? {} : { band }),
      });
      // deno-lint-ignore no-explicit-any
      const code = (error as any)?.code;
      if (error && code === '23505') result.alreadyQueued.push(key);
      else if (error) result.errors.push(`${band}: ${error.message ?? String(error)}`);
      else result.queued.push(key);
    } catch (err) {
      result.errors.push(`${band}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return result;
}
