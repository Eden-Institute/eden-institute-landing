// Google store widget (the Merchant Center / Customer Reviews badge), 2026-10-16.
//
// Merchant Center 5861058138. Google draws a small floating store badge (rating,
// shipping and returns) in the bottom-right corner on desktop and bottom-center
// on phones (support.google.com/merchants/answer/14428754). Until reviews come
// in it may say "no rating available", or Google may draw nothing at all for a
// store without enough data yet; both are expected.
//
// WHEN IT SHOWS (founder decisions 2026-10-16):
//   - Only after the visitor taps Accept on the cookie banner, then on every
//     visit after that. Google stacks the badge above everything on the page
//     (z-index 2147483647, measured), and on a phone it sits where the banner's
//     Accept and Decline buttons are, so it must never load while the banner is
//     up. Never after Decline, the same as the other Google tags.
//   - Marketing pages only, through SiteAnalytics, and only on public ones: not
//     on a noindex page (the thank-you pages carry the review opt-in, which
//     Google says must not be covered), and not on a private no-tags page. The
//     SPA (the app, sign-in, account) has none; its Feedback button already
//     holds that corner.
//   - Live site only (productionHost.ts), like every other third-party tag.
//
// A page with a bar pinned to the bottom marks it data-sticky-bottom-bar
// (/back-to-eden's phone buy bar). While that bar is showing, the badge is
// lifted above it instead of sitting on its button.

import { CONSENT_CHANGE_EVENT, getMarketingConsent } from "@/lib/consent";
import { GCR_MERCHANT_ID } from "@/lib/customerReviews";
import { isProductionHost } from "@/lib/productionHost";

export const MERCHANT_WIDGET_SCRIPT = "https://www.gstatic.com/shopping/merchant/merchantwidget.js";
export const STICKY_BAR_SELECTOR = "[data-sticky-bottom-bar]";

// Google's defaults, from the help page above.
const BOTTOM_MARGIN = 36;
const MOBILE_BOTTOM_MARGIN = 46;
const GAP_ABOVE_BAR = 12;

export interface MerchantWidgetOptions {
  merchant_id: number;
  position: "RIGHT_BOTTOM";
  bottomMargin?: number;
  mobileBottomMargin?: number;
}

/** start() options, given the height of a showing sticky bottom bar (0 for none). Pure, for tests. */
export function merchantWidgetOptions(stickyBarHeight: number): MerchantWidgetOptions {
  const opts: MerchantWidgetOptions = { merchant_id: GCR_MERCHANT_ID, position: "RIGHT_BOTTOM" };
  if (stickyBarHeight > 0) {
    const lifted = Math.ceil(stickyBarHeight) + GAP_ABOVE_BAR;
    opts.bottomMargin = Math.max(BOTTOM_MARGIN, lifted);
    opts.mobileBottomMargin = Math.max(MOBILE_BOTTOM_MARGIN, lifted);
  }
  return opts;
}

function stickyBarHeight(): number {
  const bar = document.querySelector<HTMLElement>(STICKY_BAR_SELECTOR);
  return bar ? bar.getBoundingClientRect().height : 0;
}

let started = false;

/** Load the badge once, if the visitor has accepted. Never throws. */
export function startMerchantWidget(): void {
  try {
    if (started || typeof window === "undefined" || !isProductionHost()) return;
    if (getMarketingConsent() !== "granted") return;
    started = true;
    const s = document.createElement("script");
    s.id = "merchantWidgetScript";
    s.src = MERCHANT_WIDGET_SCRIPT;
    s.async = true;
    s.addEventListener("load", () => {
      try {
        const w = window as unknown as { merchantwidget?: { start: (o: MerchantWidgetOptions) => void } };
        w.merchantwidget?.start(merchantWidgetOptions(stickyBarHeight()));
      } catch {
        // A badge never breaks the page.
      }
    });
    document.head.appendChild(s);
  } catch {
    // A badge never breaks the page.
  }
}

/**
 * Start now for a visitor who already accepted, or the moment they tap Accept
 * (setMarketingConsent fires CONSENT_CHANGE_EVENT). Returns the cleanup.
 */
export function startMerchantWidgetAfterAccept(): () => void {
  startMerchantWidget();
  if (typeof window === "undefined") return () => {};
  const onChange = () => startMerchantWidget();
  window.addEventListener(CONSENT_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CONSENT_CHANGE_EVENT, onChange);
}

/** Test hook: forget that the badge was started. */
export function resetMerchantWidgetForTests(): void {
  started = false;
}
