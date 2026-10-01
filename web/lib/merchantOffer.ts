// Shipping and return policy for printed-to-order Product offers (2026-10-01).
//
// Google's merchant listings read `shippingDetails` and `hasMerchantReturnPolicy`
// off each Offer. Both pages that sell print (/books, /back-to-eden) spread this
// into their Product offers, so the two can never drift apart.
//
// Shipping: the flat per-SKU charge from print-pricing.ts, the same number the
// page shows and checkout charges, US only. Delivery time is left out on purpose
// (founder 2026-10-01): nothing records the handling/transit split, and Merchant
// Center already carries the 10-15 business day policy.
//
// Returns, matching /returns: printed to order, so no returns once printing has
// started (cancel within 48 hours for a full refund); a damaged or misprinted
// book reported within 14 days is replaced. schema.org has no "defects only"
// category, so this is MerchantReturnNotPermitted with the policy page linked,
// which is what Merchant Center's own return policy says in its own terms.

import { printShippingCents } from "../../supabase/functions/_shared/print-pricing";

export function printOfferPolicies(sku: string) {
  const cents = printShippingCents([{ sku, qty: 1 }]);
  if (cents == null) throw new Error(`No shipping tier for ${sku}`);
  return {
    shippingDetails: {
      "@type": "OfferShippingDetails",
      shippingRate: { "@type": "MonetaryAmount", value: (cents / 100).toFixed(2), currency: "USD" },
      shippingDestination: { "@type": "DefinedRegion", addressCountry: "US" },
    },
    hasMerchantReturnPolicy: {
      "@type": "MerchantReturnPolicy",
      applicableCountry: "US",
      returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
      merchantReturnLink: "https://edeninstitute.health/returns",
    },
  };
}
