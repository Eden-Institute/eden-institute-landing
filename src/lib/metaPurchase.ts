// Meta Pixel "Purchase" for physical orders (2026-10-03).
//
// The browser twin of the server-side Conversions API Purchase that
// stripe-webhook already sends (_shared/meta-capi.ts). That server event uses the
// Stripe checkout session id as its event_id, so this one passes the SAME id as
// eventID and Meta merges the two into one sale. Any other id would count every
// order twice. The session id already reaches Meta from the server, so sending it
// here gives Meta nothing new; GA4 and Pinterest still get only checkoutRef().
//
// Same numbers as the GA4 purchase (buildGa4Purchase): physical lines only, value
// after discount and before shipping and tax, content_ids = the feed skus. A
// digital line never appears. The server event (amount_total, every product)
// is unchanged.
//
// Only once the Pixel is loaded, which happens only after Accept (metaPixel.ts):
// no Pixel, no event, and no "sent" mark either, so the server event stands
// alone. Once per order per browser, like the GA4 event.

import { checkoutRef } from "@/lib/pinterestTag";
import { buildGa4Purchase, type OrderAnalytics } from "@/lib/ga4Purchase";
import { metaTrack } from "@/lib/metaPixel";
import { getMarketingConsent } from "@/lib/consent";

/** Keys already fired on this page load, for browsers that block localStorage. */
const firedThisPage = new Set<string>();

/**
 * Report a confirmed, paid physical order to the Meta Pixel once. Call with the
 * same arguments as reportGa4PurchaseOnce. Never throws and never rejects.
 */
export async function reportMetaPurchaseOnce(
  sessionId: string,
  order: { analytics?: OrderAnalytics | null; tax_cents?: number | null; currency?: string | null },
): Promise<void> {
  try {
    if (!sessionId || !order.analytics || getMarketingConsent() !== "granted") return;
    if (typeof window.fbq !== "function") return;
    const ref = await checkoutRef(sessionId);
    if (!ref) return;
    const p = buildGa4Purchase(ref, order.analytics, order.tax_cents, order.currency);
    if (!p) return;

    const key = `meta_purchase_${ref}`;
    if (firedThisPage.has(key)) return;
    firedThisPage.add(key);
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      // Storage unavailable: the in-memory set above guards this page load.
    }
    metaTrack(
      "Purchase",
      {
        value: p.value,
        currency: p.currency,
        content_ids: p.items.map((i) => i.item_id),
        contents: p.items.map((i) => ({ id: i.item_id, quantity: i.quantity, item_price: i.price })),
        content_type: "product",
        num_items: p.items.reduce((n, i) => n + i.quantity, 0),
      },
      sessionId,
    );
  } catch {
    // Analytics never break the page.
  }
}
