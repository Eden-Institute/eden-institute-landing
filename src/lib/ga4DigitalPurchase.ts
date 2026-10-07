// GA4 "purchase" for digital orders (2026-10-07, founder: "every sale = purchase").
//
// Until now only printed orders sent the standard GA4 "purchase" (ga4Purchase.ts,
// for Merchant Center). The Starter Units sent their own "starter_unit_purchase",
// and the Deep-Dive Guide and the Back to Eden PDF sent nothing, so Analytics
// showed no sales at all. This reports every digital order as a standard
// "purchase" too. starter_unit_purchase keeps firing beside it, so older
// Starter reports are unchanged.
//
// The amount is the real one, read back from the order row by print-order-status
// (which serves any order by its checkout session id, not only print ones):
// amount paid after any discount code, minus tax. Nothing here is a hardcoded
// price. item_id is the order's lookup_key when the function returns it, else
// the page's own product id.
//
// Same guards as the print event: transaction_id is checkoutRef(session id), never
// the session id; once per order per browser (the SAME localStorage key as
// ga4Purchase.ts, so one order can never be reported by both); nothing after
// Decline; nothing for a Stripe test-mode (E2E) order; nothing for a refunded
// order. Merchant Center ignores item ids that are not in its feed, so these
// digital lines do not touch its conversion counts. The Meta Pixel Purchase stays
// physical-only (metaPurchase.ts), unchanged.

import { supabase } from "@/integrations/supabase/client";
import { getMarketingConsent } from "@/lib/consent";
import { centsToValue, checkoutRef } from "@/lib/pinterestTag";

export interface DigitalOrder {
  pending?: boolean;
  stage?: string;
  lookup_key?: string | null;
  product_label?: string | null;
  amount_total_cents?: number | null;
  tax_cents?: number | null;
  currency?: string | null;
}

export interface DigitalItem {
  /** Used when the order carries no lookup_key. */
  id: string;
  /** Used when the order carries no product_label. */
  name: string;
}

export interface Ga4DigitalPurchaseParams {
  transaction_id: string;
  value: number;
  currency: string;
  tax: number;
  items: { item_id: string; item_name: string; price: number; quantity: number }[];
}

/** The event parameters, or null when the order has no amount. Pure, for tests. */
export function buildGa4DigitalPurchase(
  transactionId: string,
  order: DigitalOrder,
  fallback: DigitalItem,
): Ga4DigitalPurchaseParams | null {
  if (order.amount_total_cents == null) return null;
  const tax = Math.max(0, order.tax_cents ?? 0);
  const value = centsToValue(Math.max(0, order.amount_total_cents - tax));
  return {
    transaction_id: transactionId,
    value,
    currency: (order.currency || "usd").toUpperCase(),
    tax: centsToValue(tax),
    items: [{
      item_id: order.lookup_key || fallback.id,
      item_name: order.product_label || fallback.name,
      price: value,
      quantity: 1,
    }],
  };
}

const POLL_MS = 1500;
const MAX_POLLS = 8;

/** Keys already fired on this page load, for browsers that block localStorage. */
const firedThisPage = new Set<string>();

/**
 * Report a paid digital order once. Waits for the Stripe webhook to write the
 * order row (the redirect usually beats it by a second or two). Never throws and
 * never rejects: the page must never depend on analytics.
 */
export async function reportGa4DigitalPurchaseOnce(
  sessionId: string | null | undefined,
  fallback: DigitalItem,
  pollMs: number = POLL_MS,
): Promise<void> {
  try {
    if (!sessionId || sessionId.startsWith("cs_test_")) return;
    if (getMarketingConsent() === "denied") return;
    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag !== "function") return;
    const ref = await checkoutRef(sessionId);
    if (!ref) return;
    const key = `ga4_purchase_${ref}`;
    if (firedThisPage.has(key)) return;
    try {
      if (localStorage.getItem(key)) return;
    } catch {
      // Storage unavailable: the in-memory set guards this page load.
    }

    let order: DigitalOrder | null = null;
    for (let i = 0; i < MAX_POLLS; i++) {
      try {
        const { data, error } = await supabase.functions.invoke("print-order-status", { body: { session_id: sessionId } });
        if (!error && data && !(data as DigitalOrder).pending) {
          order = data as DigitalOrder;
          break;
        }
      } catch {
        // keep polling
      }
      await new Promise((r) => setTimeout(r, pollMs));
    }
    if (!order || order.stage === "cancelled") return;

    const params = buildGa4DigitalPurchase(ref, order, fallback);
    if (!params) return;
    if (firedThisPage.has(key)) return;
    firedThisPage.add(key);
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      // Storage unavailable: the in-memory set above guards this page load.
    }
    gtag("event", "purchase", params);
  } catch {
    // Analytics never break the page.
  }
}
