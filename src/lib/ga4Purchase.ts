// GA4 "purchase" for physical orders (2026-10-01).
//
// Google Merchant Center counts conversions only from the standard GA4
// "purchase" event, with items[].item_id matching the product feed. The feed ids
// are products.sku (sprouts_print_set, bte_paperback_print, ...), and
// print-order-status returns them per line, with the real unit prices, shipping
// and discount from the Stripe session. Nothing here is a hardcoded price.
//
// Physical lines only. A digital line is left out of items and value; the $39
// digital Starter Unit keeps its own starter_unit_purchase event and never
// reaches this file.
//
// value is what was paid for the physical goods: list price minus the Stripe
// discount, before shipping and tax. A discount is shared across lines by their
// list totals, and each item carries its share as GA4's per-unit `discount`.
//
// transaction_id is checkoutRef(session id), never the session id itself, which
// is a bearer credential for the order page. Same reference Pinterest gets.
//
// Once per order on this browser: a localStorage key (in-memory where storage is
// blocked), so a reload, or reopening the page days later, sends nothing. GA4
// also dedupes on transaction_id. A visitor who clicked Decline sends nothing;
// the layout's ga-disable switch would stop gtag anyway.

import { getMarketingConsent } from "@/lib/consent";
import { centsToValue, checkoutRef } from "@/lib/pinterestTag";

export interface AnalyticsLine {
  sku: string | null;
  name: string;
  unit_price_cents: number | null;
  quantity: number;
  physical: boolean;
}

export interface OrderAnalytics {
  shipping_cents: number | null;
  discount_cents: number | null;
  items: AnalyticsLine[];
}

export interface Ga4PurchaseItem {
  item_id: string;
  item_name: string;
  price: number;
  quantity: number;
  discount?: number;
}

export interface Ga4PurchaseParams {
  transaction_id: string;
  value: number;
  currency: string;
  shipping: number;
  tax: number;
  items: Ga4PurchaseItem[];
}

/**
 * The event parameters, or null when there is nothing physical to report.
 * Pure, so the arithmetic is pinned by tests.
 */
export function buildGa4Purchase(
  transactionId: string,
  a: OrderAnalytics,
  taxCents: number | null | undefined,
  currency: string | null | undefined,
): Ga4PurchaseParams | null {
  const lineTotal = (l: AnalyticsLine) => (l.unit_price_cents ?? 0) * (l.quantity || 0);
  const allGross = a.items.reduce((n, l) => n + lineTotal(l), 0);
  const physical = a.items.filter((l) => l.physical && l.sku && l.quantity > 0 && l.unit_price_cents != null);
  if (physical.length === 0) return null;

  const discount = Math.max(0, a.discount_cents ?? 0);
  let valueCents = 0;
  const items = physical.map((l) => {
    const gross = lineTotal(l);
    const share = allGross > 0 ? Math.round((discount * gross) / allGross) : 0;
    valueCents += gross - share;
    const perUnit = Math.round(share / l.quantity);
    return {
      item_id: l.sku as string,
      item_name: l.name,
      price: centsToValue(l.unit_price_cents as number),
      quantity: l.quantity,
      ...(perUnit > 0 ? { discount: centsToValue(perUnit) } : {}),
    };
  });

  return {
    transaction_id: transactionId,
    value: centsToValue(Math.max(0, valueCents)),
    currency: (currency || "usd").toUpperCase(),
    shipping: centsToValue(a.shipping_cents ?? 0),
    tax: centsToValue(taxCents ?? 0),
    items,
  };
}

/** Keys already fired on this page load, for browsers that block localStorage. */
const firedThisPage = new Set<string>();

/**
 * Report a confirmed, paid order once. Call only with a non-pending status from
 * print-order-status that is not cancelled. Never throws and never rejects:
 * the order display must never depend on analytics.
 */
export async function reportGa4PurchaseOnce(
  sessionId: string,
  order: { analytics?: OrderAnalytics | null; tax_cents?: number | null; currency?: string | null },
): Promise<void> {
  try {
    if (!sessionId || !order.analytics || getMarketingConsent() === "denied") return;
    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag !== "function") return;
    const ref = await checkoutRef(sessionId);
    if (!ref) return;
    const params = buildGa4Purchase(ref, order.analytics, order.tax_cents, order.currency);
    if (!params) return;

    const key = `ga4_purchase_${ref}`;
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
