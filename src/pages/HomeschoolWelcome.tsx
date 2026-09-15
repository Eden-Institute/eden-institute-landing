import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Footer from "@/components/landing/Footer";
import Navbar from "@/components/landing/Navbar";
import { useDocumentMeta } from "@/lib/useDocumentMeta";
import { ROUTES } from "@/lib/routes";
import { readCheckoutSessionId } from "@/lib/checkoutSession";
import { checkoutRef } from "@/lib/pinterestTag";

/**
 * /homeschool/welcome — generic order confirmation fallback (noindex).
 * 2026-09-12: the Founders Edition products are retired and the kit is off
 * sale, so every Founders Edition, 2027 and bundle string was removed.
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
    title: "Order Confirmed | The Eden Institute",
    description:
      "Thank you for your order. Your receipt from Stripe is on its way to your inbox.",
    canonical: "https://edeninstitute.health/homeschool/welcome",
  });

  // This page is only a fallback now. Keep it out of search results.
  useEffect(() => {
    const tag = document.createElement("meta");
    tag.name = "robots";
    tag.content = "noindex";
    document.head.appendChild(tag);
    return () => {
      tag.remove();
    };
  }, []);

  const [searchParams] = useSearchParams();
  // index.html's first script has already moved session_id out of the URL.
  const sessionId = readCheckoutSessionId();
  const lookupKey = searchParams.get("lookup_key");

  // The Founders Edition products this page once named (sprouts_complete,
  // seedlings_complete, two_band_bundle, nb_addon) are retired and blocked in
  // create-checkout since 2026-09-12. Copy stays generic on purpose.
  const purchase = useMemo(
    () => ({
      productName: "Your Eden's Table order",
      nextStep:
        "Watch your inbox for your order email. It has everything you need, and you can reply to it with any question.",
    }),
    [],
  );

  // Tiny client-side analytics ping for conversion tracking. Idempotent;
  // the page doesn't re-fire on re-mount unless the user refreshes.
  // transaction_id is checkoutRef(session id), never the raw Stripe id, which
  // unlocks the order; if hashing is unavailable it is left out.
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    void checkoutRef(sessionId).then((ref) => {
      if (cancelled) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).gtag?.("event", "purchase_confirmed", {
        event_category: "homeschool",
        event_label: lookupKey ?? "unknown",
        ...(ref ? { transaction_id: ref } : {}),
      });
    });
    return () => {
      cancelled = true;
    };
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
            style={{ color: "hsl(var(--eden-gold-ink))" }}
          >
            Order Confirmed
          </p>
          <h1
            className="font-serif text-3xl md:text-4xl font-bold mb-4"
            style={{ color: "hsl(var(--eden-bark))" }}
          >
            Thank you for your order.
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
              style={{ color: "hsl(var(--eden-gold-ink))" }}
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
              style={{ color: "hsl(var(--eden-gold-ink))" }}
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
            {/* A plain anchor, NOT a router Link, and that is load-bearing.
                /homeschool is served only by the Astro build (web/pages/homeschool.astro);
                the SPA has no /homeschool route any more (the stale src/pages/Homeschool.tsx
                twin was deleted), so a client-side Link would render NotFound. A full page
                load serves the real Astro page. */}
            <a href="/homeschool">
              <Button variant="eden" size="xl">
                Back to Eden's Table
              </Button>
            </a>
            <a href={ROUTES.HOME}>
              <span
                className="font-accent text-sm tracking-wider uppercase underline-offset-4 hover:underline cursor-pointer"
                style={{ color: "hsl(var(--eden-gold-ink))" }}
              >
                Explore the rest of Eden Institute →
              </span>
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default HomeschoolWelcome;
