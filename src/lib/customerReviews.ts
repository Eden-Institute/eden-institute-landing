// Google Customer Reviews opt-in on the printed-order thank-you pages (2026-10-02).
//
// Merchant Center account 5861058138 is enrolled in Google Customer Reviews.
// After a PHYSICAL order Google shows the buyer a small "would you like to
// review your purchase?" dialog. If they opt in, Google emails a survey after
// the estimated delivery date. Called only from the print paths of
// PrintThankYou (/books/thank-you) and BookThankYou (/back-to-eden/thank-you),
// which exist only for printed orders, so a digital order never shows it.
//
// estimated_delivery_date = order date + 21 days (founder decision 2026-10-02).
// The brief said +15, but printing waits 48 hours for the cancellation window
// and Merchant Center lists 10 to 15 business days of shipping; the pages tell
// buyers "about two to three weeks". +21 keeps the survey from arriving before
// the books do.
//
// order_id is the customer-facing order number (the one on the page and in the
// confirmation email), not the Stripe session id, which is a bearer credential.
//
// Shown at most once per order per browser, only on the live site (see
// productionHost.ts), never after Decline, and never for a cancelled order.
// Google's requirements: the page is on our own domain and starts with
// <!doctype html> (MarketingLayout.astro emits it first on every page).

import { getMarketingConsent } from "@/lib/consent";
import { isProductionHost } from "@/lib/productionHost";

export const GCR_MERCHANT_ID = 5861058138;
export const GCR_DELIVERY_DAYS = 21;
const GCR_SCRIPT = "https://apis.google.com/js/platform.js?onload=renderOptIn";

export interface GcrOptInParams {
  merchant_id: number;
  order_id: string;
  email: string;
  delivery_country: "US";
  estimated_delivery_date: string;
}

/** YYYY-MM-DD of `placedAt` + GCR_DELIVERY_DAYS, in UTC. Null for a bad date. */
export function estimatedDeliveryDate(placedAt: string): string | null {
  const t = Date.parse(placedAt);
  if (Number.isNaN(t)) return null;
  return new Date(t + GCR_DELIVERY_DAYS * 86_400_000).toISOString().slice(0, 10);
}

/** The render parameters, or null when the order lacks what Google needs. Pure, for tests. */
export function buildGcrOptIn(order: {
  order_number?: string | null;
  email?: string | null;
  placed_at?: string | null;
}): GcrOptInParams | null {
  const orderId = order.order_number?.trim();
  const email = order.email?.trim();
  const date = order.placed_at ? estimatedDeliveryDate(order.placed_at) : null;
  if (!orderId || !email || !email.includes("@") || !date) return null;
  return {
    merchant_id: GCR_MERCHANT_ID,
    order_id: orderId,
    email,
    delivery_country: "US",
    estimated_delivery_date: date,
  };
}

const shownThisPage = new Set<string>();

/**
 * Show the opt-in once for a confirmed printed order. Never throws: the order
 * display must never depend on it.
 */
export function showCustomerReviewsOptIn(order: {
  order_number?: string | null;
  email?: string | null;
  placed_at?: string | null;
  stage?: string | null;
}): void {
  try {
    if (typeof window === "undefined" || !isProductionHost()) return;
    if (order.stage === "cancelled" || getMarketingConsent() === "denied") return;
    const params = buildGcrOptIn(order);
    if (!params) return;

    const key = `gcr_optin_${params.order_id}`;
    if (shownThisPage.has(key)) return;
    shownThisPage.add(key);
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      // Storage blocked: the in-memory set guards this page load.
    }

    const w = window as unknown as {
      renderOptIn?: () => void;
      gapi?: { load: (m: string, cb: () => void) => void; surveyoptin: { render: (p: GcrOptInParams) => void } };
    };
    w.renderOptIn = () => {
      try {
        w.gapi?.load("surveyoptin", () => w.gapi?.surveyoptin.render(params));
      } catch {
        // ignore
      }
    };
    const s = document.createElement("script");
    s.src = GCR_SCRIPT;
    s.async = true;
    s.defer = true;
    document.body.appendChild(s);
  } catch {
    // Never break the thank-you page.
  }
}
