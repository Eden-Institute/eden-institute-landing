// Google Ads "Purchase" conversion (2026-10-15).
//
// Google Ads account 279-616-7270 had no conversion action, so the Shopping test
// spent with no sale ever reported back to it. The "Purchase" action was created
// in Ads on 2026-10-15 (Website, set up manually with code; category Purchase;
// a different value for each conversion; count every; data-driven attribution).
// Its id and label below were read off that action's event snippet in the Ads UI.
// The tag itself is configured in web/layouts/MarketingLayout.astro and
// index.html, next to the GA4 config, on the live site only.
//
// Sent from inside reportGa4PurchaseOnce (printed orders) and
// reportGa4DigitalPurchaseOnce (digital orders). Since 2026-10-28 GA4's "purchase"
// comes from stripe-webhook instead of the browser, and this conversion is all
// those two still send. It keeps every guard they always had: paid orders
// only, nothing after Decline, nothing for a Stripe test-mode (E2E) order,
// once per order per browser on the SAME localStorage key, and transaction_id =
// checkoutRef(session id), never the session id. value and currency are the
// GA4 event's own numbers, so Ads and GA4 always agree on what a sale was worth.
//
// Enhanced conversions: the buyer's email from print-order-status goes to
// gtag('set', 'user_data'), which Google normalizes and hashes (SHA-256) in the
// browser before anything leaves it. It is set AFTER the GA4 purchase is sent,
// so the GA4 event never carries it, and it never appears in a URL. The
// account-level switch for enhanced conversions, and Google's customer data
// terms, are in the Ads UI (Goals > Settings), which Camila accepts herself.

export const GOOGLE_ADS_ID = "AW-18494002476";
export const GOOGLE_ADS_PURCHASE_LABEL = "L_oFCOO-gZ4dEKyq0PJE";
export const GOOGLE_ADS_PURCHASE_SEND_TO = `${GOOGLE_ADS_ID}/${GOOGLE_ADS_PURCHASE_LABEL}`;

type Gtag = (...args: unknown[]) => void;

export interface AdsPurchase {
  transaction_id: string;
  value: number;
  currency: string;
}

/** A plausible email, trimmed and lowercased, or null. Pure, for tests. */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (typeof email !== "string") return null;
  const e = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

/**
 * Send the Purchase conversion. Call only from the GA4 purchase reporters, after
 * their own guards passed and their "purchase" event was sent. Never throws.
 */
export function sendGoogleAdsPurchase(gtag: Gtag, p: AdsPurchase, email?: string | null): void {
  try {
    const em = normalizeEmail(email);
    if (em) gtag("set", "user_data", { email: em });
    gtag("event", "conversion", {
      send_to: GOOGLE_ADS_PURCHASE_SEND_TO,
      value: p.value,
      currency: p.currency,
      transaction_id: p.transaction_id,
    });
  } catch {
    // Analytics never break the page.
  }
}
