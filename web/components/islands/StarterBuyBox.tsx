// web/components/islands/StarterBuyBox.tsx
//
// Client island for /starter. Deliberately small: this product has one price, no
// options, no disclaimers to accept and no stock gate, so the only interactive
// part is the button itself and the states around it.
//
// Contrast with PreorderBuyBox, which carries a two-step modal, SMS consent and a
// live founding counter. Reusing that here would have imported a large amount of
// preorder-specific machinery to render one button, and the preorder disclaimers
// would be actively wrong on a product that downloads in under a minute.
//
// Email is NOT collected here. Stripe Checkout collects it as a required field,
// and that is the address the credit code gets bound to, so asking twice would
// create two addresses that can disagree. The one that matters is Stripe's.
//
// Copy rule: no em dashes (feedback_no_em_dashes).

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { friendlyEfError } from "@/components/apothecary/friendlyEfError";
import { getFbAttribution } from "@/lib/fbAttribution";
import { getCheckoutAttribution } from "@/lib/attribution";
import { pinTrack } from "@/lib/pinterestTag";
import { trackCta } from "@/lib/trackCta";
import { partnerPromoBody, partnerPromoCode } from "../../lib/partnerPromo";
import PayOverTime from "./PayOverTime";
import CheckoutContact, { EMPTY_CHECKOUT_CONTACT, checkoutContactBody, type CheckoutContactValue } from "./CheckoutContact";
// Dated offers (supabase/functions/_shared/sale-offers.ts). The FPEA 2027 convention
// offer comes in as the `offer` prop (/fpea only). Without it, the box shows the
// site-wide sale whose window is open (Spring Planning Week 2027: 25% off), and
// outside every sale week it is exactly as before.
import {
  FPEA_OFFER_ID,
  activeSiteSale,
  offerStarterPriceCents,
  saleOfferById,
} from "../../../supabase/functions/_shared/sale-offers";

/**
 * One Starter Unit per band (2026-09-23). The lookup keys mirror STARTER_BANDS in
 * supabase/functions/_shared/starter-config.ts, which is the source of truth;
 * create-checkout accepts exactly these two.
 */
const STARTER_PRODUCTS = {
  sprouts: { lookupKey: "sprouts_starter_unit", productName: "Sprouts Starter Unit" },
  seedlings: { lookupKey: "seedlings_starter_unit", productName: "Seedlings Starter Unit" },
} as const;

export type StarterBand = keyof typeof STARTER_PRODUCTS;

/** Display copy only. The Stripe Price is the billing truth. */
const PRICE_LABEL = "$39";
/** Pre-tax LIST price for ad reporting. Mirrors STARTER_PRICE_CENTS in
 *  supabase/functions/_shared/starter-config.ts. Checkout does take a promotion
 *  code for this key (NO_PROMO_LOOKUP_KEYS in create-checkout is empty since the
 *  founder's 9/23 choice), and since 2026-11-17 a partner's ?promo= code is sent
 *  along (web/lib/partnerPromo.ts), so a coded sale is less than this. */
const PRICE_VALUE = 39;

interface Props {
  /** Which button on the page this is, for the CTA funnel beacon. */
  cta: string;
  /** Full-width on mobile regardless; this widens it on desktop too. */
  wide?: boolean;
  /** Which band's Starter Unit this button sells. Defaults to Sprouts, so every
   *  existing /starter button is unchanged. */
  band?: StarterBand;
  /**
   * FPEA 2027 convention offer (/fpea only): shows and sends the FPEA price, 25% off
   * this box's own list price (PRICE_VALUE, which fpea-offer.test.ts holds equal to
   * STARTER_BANDS in starter-config.ts; that file reads Deno.env, so the browser
   * bundle does not import it). create-checkout computes the charge itself from the
   * Stripe Price and refuses the offer outside its window. Omitted everywhere else.
   */
  offer?: typeof FPEA_OFFER_ID;
}

/** 2925 -> "$29.25". Used only for an offer price. */
function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function StarterBuyBox({ cta, wide = false, band = "sprouts", offer: pageOffer }: Props) {
  const product = STARTER_PRODUCTS[band];
  // Site-wide sale (founder 2026-11-20, whole site): read once when the box mounts
  // (every page loads it client:only, so there is no server render to disagree
  // with). Only a sale with a Starter discount changes this box. No code, nothing
  // to share. create-checkout checks the window again and is the authority.
  const [siteSale] = useState(() => (pageOffer ? null : activeSiteSale(Date.now())));
  const sale = pageOffer ? saleOfferById(pageOffer) : siteSale && siteSale.starterDiscountPercent != null ? siteSale : null;
  /** The offer id this box sends, or undefined for the regular price. */
  const offer = sale?.id;
  // Display price only; the server charges the offer's percent off the real Stripe Price.
  const listCents = PRICE_VALUE * 100;
  const offerCents = sale ? offerStarterPriceCents(sale, listCents) : null;
  const priceLabel = offerCents != null ? money(offerCents) : PRICE_LABEL;
  const priceValue = offerCents != null ? offerCents / 100 : PRICE_VALUE;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [contact, setContact] = useState<CheckoutContactValue>(EMPTY_CHECKOUT_CONTACT);

  useEffect(() => {
    // Stripe sends the buyer back here with ?checkout=cancelled if they back out.
    // Saying nothing makes the page look like the click did nothing, which is the
    // exact failure mode that cost reservations on the preorder Reserve CTA in
    // July: a silent non-response reads as a broken button.
    const params = new URLSearchParams(window.location.search);
    // On /fpea every box names itself in ?item=, so a return reaches only its own box.
    if (params.get("checkout") === "cancelled" && (!pageOffer || params.get("item") === `starter-${band}`)) setCancelled(true);
  }, []);

  async function startCheckout() {
    // Pinterest addtocart, on the click and BEFORE the await, because the
    // redirect to Stripe below can cut off anything queued after it.
    pinTrack("addtocart", {
      value: priceValue,
      currency: "USD",
      order_quantity: 1,
      line_items: [{ product_id: product.lookupKey, product_name: product.productName, product_price: priceValue, product_quantity: 1 }],
    });
    // Funnel moment: one checkout-start per create-checkout invoke (the founder
    // dashboard's "Checkout starts" counts only this event, not the button's data-cta).
    trackCta("checkout-start", { lookupKey: product.lookupKey });
    setLoading(true);
    setError(null);
    setCancelled(false);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("create-checkout", {
        body: {
          ...getFbAttribution(), attribution: getCheckoutAttribution(),
          lookup_key: product.lookupKey,
          // Optional email + one-reminder consent (CheckoutContact). Empty unless typed.
          ...checkoutContactBody(contact),
          ...(offer ? { offer } : {}),
          // Only /fpea returns to its own page; a site-wide sale returns where it always did.
          ...(pageOffer
            ? { cancel_url: `https://edeninstitute.health/fpea?checkout=cancelled&item=starter-${band}#starter-${band}` }
            : {}),
          // A partner's ?promo= code (this visit), never with an offer (no stacking).
          ...partnerPromoBody(partnerPromoCode(), offer),
        },
      });
      // A coded EF failure (RATE_LIMITED, STARTER_NOT_CONFIGURED) carries a
      // message written for buyers; anything else keeps supabase-js's text.
      if (fnError) throw new Error((await friendlyEfError(fnError, "")) || fnError.message);
      if (!data?.url) throw new Error("Checkout did not return a link.");
      window.location.href = data.url as string;
    } catch (err) {
      // Never leave the button spinning with no explanation.
      setError(
        err instanceof Error && err.message
          ? `We could not open checkout: ${err.message}`
          : "We could not open checkout. Please try again, or email hello@edeninstitute.health.",
      );
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      {cancelled && (
        <p
          className="font-body text-sm mb-3 rounded-md px-4 py-3"
          style={{ backgroundColor: "hsl(var(--eden-cream))", color: "hsl(var(--eden-bark))" }}
        >
          No payment was taken. Your Starter Unit is still here whenever you are ready.
        </p>
      )}

      <CheckoutContact value={contact} onChange={setContact} className={`mb-4 ${wide ? "md:max-w-[420px] md:mx-auto" : ""}`} />

      <button
        type="button"
        data-cta={cta}
        onClick={startCheckout}
        disabled={loading}
        // Disabled ONLY while a request is genuinely in flight, and there are no
        // `required` fields anywhere near it. Native HTML5 validation blocks a
        // submit BEFORE any JS runs and its tooltip often does not render, which
        // is how the preorder Reserve button silently swallowed clicks for days.
        className={`inline-flex items-center justify-center font-accent text-sm tracking-[0.2em] uppercase font-bold px-8 py-4 rounded-md transition-opacity ${
          wide ? "w-full md:w-auto md:min-w-[320px]" : "w-full"
        } ${loading ? "opacity-60 cursor-wait" : "hover:opacity-90"}`}
        style={{ backgroundColor: "hsl(var(--eden-forest))", color: "hsl(var(--eden-cream))" }}
      >
        {loading ? "Opening checkout..." : `Get the Starter Unit, ${priceLabel}`}
      </button>

      {error && (
        <p className="font-body text-sm mt-3" style={{ color: "hsl(var(--destructive))" }} role="alert">
          {error}
        </p>
      )}

      {sale && offerCents != null && (
        <p className="font-body text-sm mt-3" style={{ color: "hsl(var(--eden-forest))" }}>
          {sale.copy.starterPriceLabel}: {sale.starterDiscountPercent}% off the regular {money(listCents)}.
        </p>
      )}

      <PayOverTime amountCents={offerCents ?? PRICE_VALUE * 100} align="center" className="mt-3" />

      {/* Founder 2026-09-12: sits under every buy button so nobody pays thinking
          this is the whole year. "9-week starter", never "partial" or "quarter". */}
      <p className="font-body text-sm mt-3 font-semibold" style={{ color: "hsl(var(--eden-bark))" }}>
        The 9-week starter: weeks 1 to 9 of the 36-week year.
      </p>
      <p className="font-body text-xs mt-2 text-muted-foreground">
        Instant download. Because this is a digital product, it is not refundable.{" "}
        <a href="/returns" className="underline" style={{ color: "hsl(var(--eden-forest))" }}>
          Read the policy
        </a>{" "}
        before you buy.
      </p>
    </div>
  );
}
