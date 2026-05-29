import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Footer from "@/components/landing/Footer";
import Navbar from "@/components/landing/Navbar";
import { useDocumentMeta } from "@/lib/useDocumentMeta";
import { ROUTES } from "@/lib/routes";

/**
 * /homeschool/welcome — order confirmation page for Eden's Table Founders Edition.
 *
 * Reached via Stripe Checkout success_url redirect after a homeschool product
 * purchase. The URL carries two query params:
 *   - session_id: Stripe Checkout Session ID (for receipt lookup if needed)
 *   - lookup_key: which homeschool product was purchased (used for personalized copy)
 *
 * This page is purely visual confirmation. The actual fulfillment work
 * (Supabase user provisioning + profiles.homeschool_bundle_buyer flag for
 * Two-Band Bundle buyers) happens server-side in the stripe-webhook EF,
 * which fires independently. The customer doesn't need to wait for it.
 *
 * No verify-session call here — Stripe only redirects on confirmed payment,
 * so the redirect itself is the verification. The receipt email Stripe sends
 * is the authoritative confirmation document.
 *
 * Phase 2 (PR #143) removed Stripe checkout from /homeschool entirely, so this
 * page is currently unreachable through any visitor CTA. Retained for the
 * future Founders Code redemption checkout flow (Phase 4+); copy kept in sync
 * with the 2027 launch framing so re-wiring is a wiring change, not a copy edit.
 */
const HomeschoolWelcome = () => {
  useDocumentMeta({
    title: "Order Confirmed — Eden's Table Founders Edition | The Eden Institute",
    description:
      "Your Founders Edition seat is reserved. Check your email for the receipt; your box ships in 2027.",
    canonical: "https://edeninstitute.health/homeschool/welcome",
  });

  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const lookupKey = searchParams.get("lookup_key");

  // Friendly product name + ship-window copy based on what was bought.
  const purchase = useMemo(() => {
    switch (lookupKey) {
      case "sprouts_complete":
        return {
          productName: "Sprouts Complete · Founders Edition",
          shipWindow: "Your box ships in 2027.",
          nextStep:
            "Watch your inbox for your Founders welcome email — it carries the first two weeks of Sprouts as a PDF preview so you can start before the box arrives.",
        };
      case "seedlings_complete":
        return {
          productName: "Seedlings Complete · Founders Edition",
          shipWindow: "Your box ships in 2027.",
          nextStep:
            "Watch your inbox for your Founders welcome email — it carries the first two weeks of Seedlings as a PDF preview so you can start before the box arrives.",
        };
      case "two_band_bundle":
        return {
          productName: "Two-Band Family Bundle · Founders Edition",
          shipWindow:
            "Both bands ship together in 2027. Free shipping is included.",
          nextStep:
            "Watch your inbox for your Founders welcome email — and for an account setup link so you can manage your bundle, add extra Student Notebooks for additional children, and view your shipment status.",
        };
      case "nb_addon":
        return {
          productName: "Additional Student Notebook",
          shipWindow: "Your extra notebook ships inside your Two-Band Bundle box.",
          nextStep:
            "You'll see this add-on listed on the same receipt as your bundle order.",
        };
      default:
        return {
          productName: "Eden's Table Founders Edition",
          shipWindow: "Your box ships in 2027.",
          nextStep: "Watch your inbox for your Founders welcome email with all the details.",
        };
    }
  }, [lookupKey]);

  // Tiny client-side analytics ping for conversion tracking. Idempotent;
  // the page doesn't re-fire on re-mount unless the user refreshes.
  useEffect(() => {
    if (sessionId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).gtag?.("event", "purchase_confirmed", {
        event_category: "homeschool",
        event_label: lookupKey ?? "unknown",
        transaction_id: sessionId,
      });
    }
  }, [sessionId, lookupKey]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section
        className="py-20 md:py-28 px-6"
        style={{ backgroundColor: "hsl(var(--eden-cream))" }}
      >
        <div className="max-w-2xl mx-auto text-center">
          <p
            className="font-accent text-sm tracking-[0.3em] uppercase mb-6"
            style={{ color: "hsl(var(--eden-gold))" }}
          >
            Order Confirmed
          </p>
          <h1
            className="font-serif text-3xl md:text-4xl font-bold mb-4"
            style={{ color: "hsl(var(--eden-bark))" }}
          >
            Your seat at the table is reserved.
          </h1>
          <div
            className="w-16 h-px mx-auto my-8"
            style={{ backgroundColor: "hsl(var(--eden-gold))" }}
          />

          <div
            className="rounded-lg p-8 mb-8 text-left"
            style={{
              backgroundColor: "white",
              border: "1px solid hsl(var(--border))",
            }}
          >
            <p
              className="font-accent text-xs tracking-widest uppercase mb-2"
              style={{ color: "hsl(var(--eden-gold))" }}
            >
              You ordered
            </p>
            <p
              className="font-serif text-xl font-bold mb-4"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              {purchase.productName}
            </p>

            <p
              className="font-accent text-xs tracking-widest uppercase mb-2"
              style={{ color: "hsl(var(--eden-gold))" }}
            >
              Ship window
            </p>
            <p className="font-body text-base mb-4 text-foreground">
              {purchase.shipWindow}
            </p>

            <p
              className="font-accent text-xs tracking-widest uppercase mb-2"
              style={{ color: "hsl(var(--eden-gold))" }}
            >
              What happens next
            </p>
            <p className="font-body text-base text-foreground leading-relaxed">
              {purchase.nextStep}
            </p>
          </div>

          <p className="font-body text-sm text-muted-foreground mb-8 leading-relaxed">
            A receipt from Stripe is on its way to the email address you used at
            checkout. If you don't see it within a few minutes, please check
            your Promotions or Spam folder and move it to Primary so future
            updates from Eden Institute reach you reliably.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
            <Link to={ROUTES.HOMESCHOOL}>
              <Button variant="eden" size="xl">
                Back to Eden's Table
              </Button>
            </Link>
            <Link to={ROUTES.HOME}>
              <span
                className="font-accent text-sm tracking-wider uppercase underline-offset-4 hover:underline cursor-pointer"
                style={{ color: "hsl(var(--eden-gold))" }}
              >
                Explore the rest of Eden Institute →
              </span>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default HomeschoolWelcome;
