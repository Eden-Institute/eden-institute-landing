// Fearfully & Wonderfully Wired, W6: the checkout words the results copy did not already have.
// APPROVED by Camila 2026-11-19 ~5:50 PM CT (W6 tap "Approve all"), word for word. The Stripe
// screen line is WIRED_CHECKOUT_SUBMIT_MESSAGE in supabase/functions/_shared/wired-checkout.ts
// (same approval). The upsell line is DECIDED copy (spec 9.1). Do not edit without her OK.
export const CHECKOUT = {
  upsellLine: "Teaching more than one? Upgrade to the Family Map for $28 more.",
  upsellYes: "Upgrade to the Family Map for $28 more",
  upsellNo: "Just {name}'s Blueprint ($19)",
  allSalesFinal: "Because it's digital, all sales are final.",
  paidThanks: "Thank you! {name}'s full results are open below, and your PDF lands in your inbox in a few minutes.",
  paidThanksFamily: "Thank you! Your Family Map is on its way to your inbox, and every child's full results are open below.",
  starting: "Opening checkout...",
  failed: "Checkout didn't open. Please try again, or email hello@edeninstitute.health.",
} as const;
