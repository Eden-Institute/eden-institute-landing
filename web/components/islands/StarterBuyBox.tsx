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
import { getFbAttribution } from "@/lib/fbAttribution";

const STARTER_LOOKUP_KEY = "sprouts_starter_unit";

/** Display copy only. The Stripe Price is the billing truth. */
const PRICE_LABEL = "$39";

interface Props {
  /** Which button on the page this is, for the CTA funnel beacon. */
  cta: string;
  /** Full-width on mobile regardless; this widens it on desktop too. */
  wide?: boolean;
}

export default function StarterBuyBox({ cta, wide = false }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    // Stripe sends the buyer back here with ?checkout=cancelled if they back out.
    // Saying nothing makes the page look like the click did nothing, which is the
    // exact failure mode that cost reservations on the preorder Reserve CTA in
    // July: a silent non-response reads as a broken button.
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "cancelled") setCancelled(true);
  }, []);

  async function startCheckout() {
    setLoading(true);
    setError(null);
    setCancelled(false);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("create-checkout", {
        body: {
          ...getFbAttribution(),
          lookup_key: STARTER_LOOKUP_KEY,
        },
      });
      if (fnError) throw new Error(fnError.message);
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
        {loading ? "Opening checkout..." : `Get the Starter Unit, ${PRICE_LABEL}`}
      </button>

      {error && (
        <p className="font-body text-sm mt-3" style={{ color: "hsl(var(--destructive))" }} role="alert">
          {error}
        </p>
      )}

      <p className="font-body text-xs mt-3 text-muted-foreground">
        Instant download. Because this is a digital product, it is not refundable once
        the files have been downloaded.{" "}
        <a href="/returns" className="underline" style={{ color: "hsl(var(--eden-forest))" }}>
          Read the policy
        </a>{" "}
        before you buy.
      </p>
    </div>
  );
}
