// web/components/islands/PayOverTime.tsx
//
// Stripe's Payment Method Messaging Element: the "4 interest-free payments of
// $X with Klarna" line under a price. Founder request 2026-09-17.
//
// Stripe writes the wording, not us. Which lenders appear, their plans and the
// legal fine print all come from Stripe, driven by the Dashboard payment method
// settings (Default configuration) and the amount passed here. That is the
// point: Klarna and Affirm require compliant BNPL marketing copy, and a
// hand-written "4 payments of $62.25" line is a lending ad we would own.
//
// Needs VITE_STRIPE_PUBLISHABLE_KEY (pk_live_..., public by design) set in
// Vercel. Without it, or if Stripe.js fails to load, this renders NOTHING, so
// a missing key can never break a buy box.
//
// The checkout itself does not depend on this: create-checkout sends no
// payment_method_types, so Stripe Checkout already offers every enabled method.

import { useEffect, useRef } from "react";

const STRIPE_JS_URL = "https://js.stripe.com/dahlia/stripe.js";
const PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    Stripe?: (key: string) => any;
  }
}

let stripePromise: Promise<any | null> | null = null;

/** One Stripe.js load and one Stripe instance per page, however many boxes mount. */
function loadStripe(): Promise<any | null> {
  if (!PUBLISHABLE_KEY || !PUBLISHABLE_KEY.startsWith("pk_")) return Promise.resolve(null);
  if (stripePromise) return stripePromise;
  stripePromise = new Promise((resolve) => {
    const ready = () => resolve(window.Stripe ? window.Stripe(PUBLISHABLE_KEY) : null);
    if (window.Stripe) return ready();
    let script = document.querySelector<HTMLScriptElement>(`script[src="${STRIPE_JS_URL}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = STRIPE_JS_URL;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", ready);
    script.addEventListener("error", () => resolve(null));
  });
  return stripePromise;
}

interface Props {
  /** The amount the buyer would pay, in cents (USD). */
  amountCents: number;
  /** Match the text alignment of the block it sits under. */
  align?: "left" | "center";
  className?: string;
}

export default function PayOverTime({ amountCents, align = "left", className }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<any>(null);
  // Latest amount, so a box whose total changed while Stripe.js loaded mounts right.
  const amountRef = useRef(amountCents);
  amountRef.current = amountCents;

  useEffect(() => {
    let cancelled = false;
    loadStripe()
      .then((stripe) => {
        if (cancelled || !stripe || !mountRef.current || elementRef.current) return;
        const elements = stripe.elements({
          appearance: {
            variables: {
              // --eden-bark (30 25% 12%). The element is an iframe, so page CSS and
              // "inherit" do not reach it; the colour has to be passed in.
              colorText: "#261f17",
              fontSizeBase: "14px",
            },
            rules: { ".PaymentMethodMessaging": { textAlign: align } },
          },
        });
        const el = elements.create("paymentMethodMessaging", {
          amount: amountRef.current,
          currency: "USD",
          countryCode: "US",
        });
        el.mount(mountRef.current);
        elementRef.current = el;
      })
      .catch(() => {
        // Messaging is a nicety. Never surface an error next to a buy button.
      });
    return () => {
      cancelled = true;
      elementRef.current?.destroy?.();
      elementRef.current = null;
    };
    // Mount once; amount changes go through update() below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    elementRef.current?.update?.({ amount: amountCents });
  }, [amountCents]);

  if (!PUBLISHABLE_KEY || amountCents <= 0) return null;
  return <div ref={mountRef} className={className} />;
}
