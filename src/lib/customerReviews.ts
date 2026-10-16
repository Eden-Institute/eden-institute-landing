// Google Customer Reviews opt-in on the order thank-you pages (2026-10-02,
// digital orders added 2026-10-16).
//
// Merchant Center account 5861058138 is enrolled in Google Customer Reviews.
// After an order Google shows the buyer a small "would you like to review your
// purchase?" dialog. If they opt in, Google emails a survey after the estimated
// delivery date. Called from every page Stripe Checkout returns a buyer to:
//   printed:  PrintThankYou (/books/thank-you), BookThankYou print
//             (/back-to-eden/thank-you?kind=print)
//   digital:  /starter/thank-you, /starter/seedlings/thank-you, BookThankYou
//             digital (/back-to-eden/thank-you?kind=digital), GuideLanding
//             (the Deep-Dive Guide), via showCustomerReviewsOptInForSession
//
// estimated_delivery_date, as a Central-time calendar date:
//   an order that ships = order date + 21 days (founder decision 2026-10-02).
//     Printing waits 48 hours for the cancellation window and Merchant Center
//     lists 10 to 15 business days of shipping; the pages tell buyers "about two
//     to three weeks". +21 keeps the survey from arriving before the books do.
//   a digital-only order = the order date (founder decision 2026-10-16): the
//     files are delivered on the spot.
// An order with any physical line counts as shipping, wherever it was bought.
//
// delivery_country comes from print-order-status: the ship-to country for a
// printed order, the billing country for a digital one, "US" when neither is
// known (the print shop ships to the US only).
//
// order_id is the customer-facing order number (the one on the page and in the
// confirmation email), not the Stripe session id, which is a bearer credential.
// The parameters go to Google as a JavaScript object, never written into the
// page's HTML, so the buyer's email cannot break out into markup.
//
// Shown at most once per order per browser, only on the live site (see
// productionHost.ts), never after Decline, and never for a cancelled order.
// Google's requirements: the page is on our own domain and starts with
// <!doctype html> (MarketingLayout.astro and index.html both emit it first).

import { supabase } from "@/integrations/supabase/client";
import { getMarketingConsent } from "@/lib/consent";
import { isProductionHost } from "@/lib/productionHost";

export const GCR_MERCHANT_ID = 5861058138;
export const GCR_DELIVERY_DAYS = 21;
const GCR_SCRIPT = "https://apis.google.com/js/platform.js?onload=renderOptIn";
const GCR_TIME_ZONE = "America/Chicago";

export interface GcrOptInParams {
  merchant_id: number;
  order_id: string;
  email: string;
  delivery_country: string;
  estimated_delivery_date: string;
}

/** The fields of a print-order-status answer that the opt-in reads. */
export interface GcrOrder {
  pending?: boolean;
  order_number?: string | null;
  email?: string | null;
  placed_at?: string | null;
  stage?: string | null;
  delivery_country?: string | null;
  analytics?: { items?: { physical?: boolean | null }[] | null } | null;
}

/** "printed" for the print thank-you pages, "digital" for the download ones. */
export type GcrOrderKind = "printed" | "digital";

/**
 * YYYY-MM-DD: the Central-time calendar date of `placedAt`, plus `days`
 * calendar days (counted on the date, so a daylight-saving change in between
 * cannot move it). Null for a bad date.
 */
export function estimatedDeliveryDate(placedAt: string, days: number = GCR_DELIVERY_DAYS): string | null {
  const t = Date.parse(placedAt);
  if (Number.isNaN(t)) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: GCR_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date(t));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const y = get("year");
  const m = get("month");
  const d = get("day");
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** True when the order will be shipped: a print page, or any physical line. */
export function orderShips(order: GcrOrder, kind: GcrOrderKind): boolean {
  return kind === "printed" || (order.analytics?.items ?? []).some((i) => i?.physical === true);
}

/** The render parameters, or null when the order lacks what Google needs. Pure, for tests. */
export function buildGcrOptIn(order: GcrOrder, kind: GcrOrderKind): GcrOptInParams | null {
  const orderId = order.order_number?.trim();
  const email = order.email?.trim();
  const days = orderShips(order, kind) ? GCR_DELIVERY_DAYS : 0;
  const date = order.placed_at ? estimatedDeliveryDate(order.placed_at, days) : null;
  if (!orderId || !email || !email.includes("@") || !date) return null;
  const country = order.delivery_country?.trim().toUpperCase() ?? "";
  return {
    merchant_id: GCR_MERCHANT_ID,
    order_id: orderId,
    email,
    delivery_country: /^[A-Z]{2}$/.test(country) && country !== "ZZ" ? country : "US",
    estimated_delivery_date: date,
  };
}

const shownThisPage = new Set<string>();

/**
 * Show the opt-in once for a confirmed order. Never throws: the order display
 * must never depend on it.
 */
export function showCustomerReviewsOptIn(order: GcrOrder, kind: GcrOrderKind): void {
  try {
    if (typeof window === "undefined" || !isProductionHost()) return;
    if (order.stage === "cancelled" || getMarketingConsent() === "denied") return;
    const params = buildGcrOptIn(order, kind);
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

const POLL_MS = 1500;
const MAX_POLLS = 8;

/**
 * Digital thank-you pages, which do not load the order themselves: read it from
 * print-order-status by the checkout session id (it serves any order, printed
 * or not), waiting for the Stripe webhook to write the row, then show the
 * opt-in. Only on the post-payment redirect, never on a return visit from an
 * emailed link. Never throws and never rejects.
 */
export async function showCustomerReviewsOptInForSession(
  sessionId: string | null | undefined,
  pollMs: number = POLL_MS,
): Promise<void> {
  try {
    if (!sessionId || typeof window === "undefined" || !isProductionHost()) return;
    if (getMarketingConsent() === "denied") return;
    for (let i = 0; i < MAX_POLLS; i++) {
      try {
        const { data, error } = await supabase.functions.invoke("print-order-status", { body: { session_id: sessionId } });
        if (!error && data && !(data as GcrOrder).pending) {
          showCustomerReviewsOptIn(data as GcrOrder, "digital");
          return;
        }
      } catch {
        // keep polling
      }
      await new Promise((r) => setTimeout(r, pollMs));
    }
  } catch {
    // Never break the thank-you page.
  }
}
