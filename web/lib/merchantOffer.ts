// Shipping and return policy for Product offers (2026-10-01; delivery time and the
// shared return policy for the Starter and /esa offers added 2026-11-03).
//
// Google's merchant listings read `shippingDetails` and `hasMerchantReturnPolicy`
// off each Offer. Both pages that sell print (/books, /back-to-eden) spread this
// into their Product offers, so the two can never drift apart.
//
// Shipping: the flat per-SKU charge from print-pricing.ts, the same number the
// page shows and checkout charges, US only. Delivery time (founder 2026-11-02,
// replacing the 2026-10-01 choice to leave it out) is the Merchant Center feed's
// own value, `US:<price> USD:0:0:10:15` since 2026-10-21: no handling days and 10
// to 15 business days in transit, so the page and the feed say the same thing.
//
// Returns, matching /returns: printed to order, so no returns once printing has
// started (cancel within 48 hours for a full refund); a damaged or misprinted
// book reported the day it is delivered (founder 2026-11-03; was 14 days) is replaced. Digital downloads are not refundable
// once downloaded. schema.org has no "defects only" category, so this is
// MerchantReturnNotPermitted with the policy page linked, which is what Merchant
// Center's own return policy says in its own terms.

import { printShippingCents } from "../../supabase/functions/_shared/print-pricing";

export const RETURN_POLICY = {
  "@type": "MerchantReturnPolicy",
  applicableCountry: "US",
  returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
  merchantReturnLink: "https://edeninstitute.health/returns",
};

const days = (minValue: number, maxValue: number) => ({
  "@type": "QuantitativeValue",
  minValue,
  maxValue,
  unitCode: "DAY",
});

export function printOfferPolicies(sku: string) {
  const cents = printShippingCents([{ sku, qty: 1 }]);
  if (cents == null) throw new Error(`No shipping tier for ${sku}`);
  return {
    shippingDetails: {
      "@type": "OfferShippingDetails",
      shippingRate: { "@type": "MonetaryAmount", value: (cents / 100).toFixed(2), currency: "USD" },
      shippingDestination: { "@type": "DefinedRegion", addressCountry: "US" },
      deliveryTime: {
        "@type": "ShippingDeliveryTime",
        handlingTime: days(0, 0),
        transitTime: days(10, 15),
        businessDays: {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((d) => `https://schema.org/${d}`),
        },
      },
    },
    hasMerchantReturnPolicy: RETURN_POLICY,
  };
}
