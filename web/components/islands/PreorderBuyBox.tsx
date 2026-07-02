// web/components/islands/PreorderBuyBox.tsx
//
// Client island for /preorder. Owns the entire interactive buy flow AND the terms copy:
//   - storefront language is KEYED OFF products_public.is_preorder (read live from the
//     DB), never hardcoded to a mode: flipping the flag changes button text and swaps
//     preorder terms for in-stock language with NO code edit
//   - SMS consent checkbox, explicitly UNCHECKED by default (TCPA: never pre-check)
//   - checkout buttons, success/cancel banners, PREORDERS_NOT_LIVE notice
//
// Terms live in this island (not static Astro) so the compliance copy and the buy
// buttons always render together: no JS -> no buttons -> no redirect without terms.
//
// Dark-testing: /preorder?admin=<PREORDER_ADMIN_TOKEN> forwards the token as the
// x-preorder-admin header.
//
// Prices shown here are display copy; the ONLY billing truth is the Stripe Price the
// create-checkout EF selects. Shipping display copy ($12 flat) must stay in sync with
// PREORDER_FLAT_SHIPPING_CENTS in supabase/functions/_shared/order-config.ts, and
// SHIP_WINDOW below with the same file.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const SHIP_WINDOW = "Winter 2026"; // sync with _shared/order-config.ts

interface DisplayProduct {
  sku: string;
  eyebrow: string;
  name: string;
  founding: string;
  retail: string;
  discountLine: string;
  blurb: string;
  bullets: string[];
  highlight: boolean;
}

const PRODUCTS: DisplayProduct[] = [
  {
    sku: "sprouts_kit",
    eyebrow: "Sprouts Complete Kit · K-2",
    name: "Sprouts Complete Kit",
    founding: "$249",
    retail: "$349",
    discountLine: "Founding price · $100 below retail",
    blurb: "The full 36-week Sprouts year: every component, one box.",
    bullets: [
      "36 weekly lessons",
      "Teacher Guide + Student Notebook",
      "36 Herb Field Cards",
      "36 Recipe Cards",
      "Around the Table deck (144 cards)",
    ],
    highlight: true,
  },
  {
    sku: "sprouts_notebook",
    eyebrow: "Add-on · for siblings",
    name: "Extra Student Notebook",
    founding: "$19.99",
    retail: "$24.99",
    discountLine: "Founding price",
    blurb: "A second consumable notebook so another child can work the same year.",
    bullets: ["The full 36-week Student Notebook", "One per additional student"],
    highlight: false,
  },
];

interface PublicProduct {
  sku: string;
  is_preorder: boolean;
  ships_on: string | null;
  active: boolean;
}

export default function PreorderBuyBox() {
  const [smsConsent, setSmsConsent] = useState(false); // MUST default unchecked
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notLive, setNotLive] = useState(false);
  const [meta, setMeta] = useState<Record<string, PublicProduct>>({});

  const qs = useMemo(
    () => new URLSearchParams(typeof window !== "undefined" ? window.location.search : ""),
    [],
  );
  const checkoutState = qs.get("checkout"); // success | cancelled | null
  const adminToken = qs.get("admin");

  // Live product flags: this is what keys the copy. Defaults to preorder language
  // until the row arrives (the conservative direction for compliance copy).
  useEffect(() => {
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any).from("products_public")
          .select("sku, is_preorder, ships_on, active");
        if (Array.isArray(data)) {
          const m: Record<string, PublicProduct> = {};
          for (const row of data as PublicProduct[]) m[row.sku] = row;
          setMeta(m);
        }
      } catch {
        // keep defaults (preorder copy) on any failure
      }
    })();
  }, []);

  const isPre = (sku: string): boolean => meta[sku]?.is_preorder ?? true;
  const anyPreorder = PRODUCTS.some((p) => isPre(p.sku));

  async function buy(sku: string) {
    setBusy(sku);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("create-checkout", {
        body: { preorder_sku: sku, sms_consent: smsConsent },
        headers: adminToken ? { "x-preorder-admin": adminToken } : undefined,
      });
      if (fnError) {
        let code: string | null = null;
        let message: string | null = null;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const body = await (fnError as any).context?.json?.();
          code = body?.code ?? null;
          message = body?.error ?? null;
        } catch {
          // fall through to generic message
        }
        if (code === "PREORDERS_NOT_LIVE") {
          setNotLive(true);
          return;
        }
        throw new Error(message ?? fnError.message ?? "Checkout could not be started.");
      }
      if (data?.url) {
        window.location.href = data.url as string;
        return;
      }
      throw new Error("Checkout could not be started. Please try again.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout could not be started. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      {checkoutState === "success" && (
        <div className="rounded-lg p-5 mb-8 text-center" style={{ backgroundColor: "hsl(var(--eden-forest))" }}>
          <p className="font-serif text-lg font-bold text-white mb-1">
            Thank you. Your order is confirmed.
          </p>
          <p className="font-body text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
            A confirmation email is on its way to your inbox with your order details.
          </p>
        </div>
      )}
      {checkoutState === "cancelled" && (
        <div className="rounded-lg p-4 mb-8 text-center border" style={{ borderColor: "hsl(var(--eden-gold) / 0.4)", backgroundColor: "hsl(var(--eden-cream))" }}>
          <p className="font-body text-sm" style={{ color: "hsl(var(--eden-bark))" }}>
            Checkout was cancelled and your card was not charged. Your spot is still open whenever
            you are ready.
          </p>
        </div>
      )}

      {notLive && (
        <div className="rounded-lg p-5 mb-8 text-center border-2" style={{ borderColor: "hsl(var(--eden-gold))", backgroundColor: "hsl(var(--eden-cream))" }}>
          <p className="font-serif text-lg font-bold mb-1" style={{ color: "hsl(var(--eden-bark))" }}>
            Preorder has not opened yet.
          </p>
          <p className="font-body text-sm text-muted-foreground">
            We are finishing production samples. Grab the free two-week sample on the homeschool
            page and we will email you the moment preorder opens.
          </p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6 mb-4 max-w-4xl mx-auto">
        {PRODUCTS.map((p) => {
          const pre = isPre(p.sku);
          const shipsOn = meta[p.sku]?.ships_on ?? null;
          return (
            <div key={p.sku} className="rounded-lg border-2 bg-white flex flex-col p-6" style={{ borderColor: p.highlight ? "hsl(var(--eden-gold))" : "hsl(var(--border))" }}>
              <p className="font-accent text-xs tracking-widest uppercase mb-2" style={{ color: "hsl(var(--eden-gold))" }}>
                {p.eyebrow}
              </p>
              <h3 className="font-serif text-xl font-bold mb-2" style={{ color: "hsl(var(--eden-bark))" }}>
                {p.name}
              </h3>
              <div className="mb-3">
                <p className="font-serif text-3xl font-bold mb-1" style={{ color: "hsl(var(--eden-bark))" }}>
                  {p.founding}{" "}
                  <span className="font-body text-base font-normal text-muted-foreground line-through ml-2">
                    {p.retail}
                  </span>
                </p>
                <p className="font-accent text-xs uppercase tracking-wider" style={{ color: "hsl(var(--eden-sage))" }}>
                  {p.discountLine}
                </p>
                <p className="font-body text-xs mt-1" style={{ color: "hsl(var(--eden-sage))" }}>
                  {pre
                    ? (shipsOn ? `Preorder · ships on or after ${shipsOn}` : `Preorder · estimated ship window ${SHIP_WINDOW}`)
                    : "In stock and shipping now"}
                </p>
              </div>
              <p className="font-body text-sm text-muted-foreground mb-3 leading-relaxed">{p.blurb}</p>
              <ul className="font-body text-sm text-muted-foreground space-y-1.5 mb-6 flex-1">
                {p.bullets.map((b) => (
                  <li key={b}>· {b}</li>
                ))}
              </ul>
              <button
                onClick={() => buy(p.sku)}
                disabled={busy !== null || notLive}
                className="font-body text-sm font-semibold px-8 py-4 rounded-sm w-full transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "hsl(var(--eden-forest))", color: "hsl(var(--eden-parchment))" }}
              >
                {busy === p.sku ? "Opening secure checkout…" : `${pre ? "Preorder" : "Buy"} ${p.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Shipping + tax disclosure BEFORE redirect. $12 mirrors PREORDER_FLAT_SHIPPING_CENTS. */}
      <p className="font-body text-sm text-muted-foreground text-center mb-8">
        Shipping is a flat $12 per order, and any sales tax is calculated at checkout.
      </p>

      {error && (
        <div className="max-w-2xl mx-auto mb-6 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="font-body text-sm text-destructive text-center">{error}</p>
        </div>
      )}

      {/* SMS consent: explicit opt-in, NEVER pre-checked. Stored on the order; state-transition
          texts (order updates, tracking, delivery) send only when this was checked. */}
      <div className="max-w-2xl mx-auto rounded-lg border p-4 flex items-start gap-3 mb-10" style={{ borderColor: "hsl(var(--eden-gold) / 0.3)", backgroundColor: "hsl(var(--eden-cream) / 0.6)" }}>
        <input
          id="preorder-sms-consent"
          type="checkbox"
          checked={smsConsent}
          onChange={(e) => setSmsConsent(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0"
        />
        <label htmlFor="preorder-sms-consent" className="font-body text-sm leading-relaxed cursor-pointer" style={{ color: "hsl(var(--eden-bark))" }}>
          Optional: yes, text me updates about my order at the phone number I provide at
          checkout. Message and data rates may apply. Reply STOP at any time to opt out.
        </label>
      </div>

      {/* TERMS — keyed off is_preorder, shown BEFORE any redirect to Stripe. */}
      <div className="max-w-2xl mx-auto">
        <h2 className="font-serif text-2xl font-bold mb-6 text-center" style={{ color: "hsl(var(--eden-bark))" }}>
          {anyPreorder ? "Preorder terms, in plain language" : "Ordering, in plain language"}
        </h2>
        <div className="space-y-4">
          {anyPreorder ? (
            <>
              <TermCard title="This is a founding preorder.">
                Your patience helps fund the founding of this curriculum. In exchange you receive the
                founding price ($100 off the complete kit) and founding-member status.
              </TermCard>
              <TermCard title={`Estimated ship window: ${SHIP_WINDOW}.`}>
                That is an estimate, not a promise of a specific date. We will email you updates as
                production progresses and as the window firms up.
              </TermCard>
              <TermCard title="Your card is charged today.">
                Your checkout total includes a flat $12 shipping charge and any sales tax. If we
                cannot ship within the estimated window, we will notify you, and you may request a
                full refund at any point before your order ships.
              </TermCard>
            </>
          ) : (
            <>
              <TermCard title="In stock and shipping now.">
                Your order ships from our Tennessee workshop within 5 business days, and you will
                receive tracking by email (and text if you opted in) the moment it is on its way.
              </TermCard>
              <TermCard title="Your card is charged today.">
                Your checkout total includes a flat $12 shipping charge and any sales tax.
              </TermCard>
            </>
          )}
        </div>
        <p className="font-body text-xs text-muted-foreground text-center mt-6">
          Questions? Email <a href="mailto:hello@edeninstitute.health" className="underline">hello@edeninstitute.health</a> and a real person (Camila) answers.
        </p>
      </div>
    </div>
  );
}

function TermCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg p-5 bg-white border" style={{ borderColor: "hsl(var(--eden-gold) / 0.3)" }}>
      <p className="font-serif text-base font-bold mb-1" style={{ color: "hsl(var(--eden-forest))" }}>{title}</p>
      <p className="font-body text-sm text-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
}
