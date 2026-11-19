// Fearfully & Wonderfully Wired, W6: the few checkout words the approved results copy does not
// already have. ⚠️ PENDING CAMILA'S OK (W6 go tap, 2026-11-19). No buyer can see them while the
// quiz is dark. Once approved they move into docs/wired-copy/ and web/lib/wiredCopy.ts, where
// src/test/wiredCopy.test.ts checks them word for word. The upsell line itself is DECIDED copy
// (spec 9.1: "Upgrade to the Family Map for $28 more").
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
