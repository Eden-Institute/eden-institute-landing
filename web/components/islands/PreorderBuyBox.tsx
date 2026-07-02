// web/components/islands/PreorderBuyBox.tsx
//
// Client island for /preorder. Owns the entire interactive buy flow:
//   - SMS consent checkbox, explicitly UNCHECKED by default (TCPA: never pre-check)
//   - the two checkout buttons (Sprouts Complete Kit, Student Notebook)
//   - success / cancelled banners (?checkout= query param from Stripe redirect)
//   - the \"preorder not open yet\" notice while PREORDERS_LIVE=false
//
// Dark-testing: /preorder?admin=<PREORDER_ADMIN_TOKEN> forwards the token as the
// x-preorder-admin header so the founder can exercise the full production path
// before launch. Without it, the EF refuses checkout until PREORDERS_LIVE=true.
//
// Prices shown here are display copy; the ONLY billing truth is the Stripe Price
// the create-checkout EF selects (founding vs retail off the 500-kit gate).
// Shipping display copy ($12 flat) must stay in sync with
// PREORDER_FLAT_SHIPPING_CENTS in supabase/functions/_shared/order-config.ts.

import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

export default function PreorderBuyBox() {
  const [smsConsent, setSmsConsent] = useState(false); // MUST default unchecked
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notLive, setNotLive] = useState(false);

  const qs = useMemo(
    () => new URLSearchParams(typeof window !== "undefined" ? window.location.search : ""),
    [],
  );
  const checkoutState = qs.get("checkout"); // success | cancelled | null
  const adminToken = qs.get("admin");

  async function buy(sku: string) {
    setBusy(sku);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("create-checkout", {
        body: { preorder_sku: sku, sms_consent: smsConsent },
        headers: adminToken ? { "x-preorder-admin": adminToken } : undefined,
      });
      if (fnError) {
        // FunctionsHttpError carries the EF's JSON body on .context
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
        <div
          className="rounded-lg p-5 mb-8 text-center"
          style={{ backgroundColor: "hsl(var(--eden-forest))" }}
        >
          <p className="font-serif text-lg font-bold text-white mb-1">
            Thank you. Your founding preorder is confirmed.
          </p>
          <p className="font-body text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
            A confirmation email is on its way to your inbox with your order details and the
            estimated ship window.
          </p>
        </div>
      )}
      {checkoutState === "cancelled" && (
        <div
          className="rounded-lg p-4 mb-8 text-center border"
          style={{ borderColor: "hsl(var(--eden-gold) / 0.4)", backgroundColor: "hsl(var(--eden-cream))" }}
        >
          <p className="font-body text-sm" style={{ color: "hsl(var(--eden-bark))" }}>
            Checkout was cancelled and your card was not charged. Your spot is still open whenever
            you are ready.
          </p>
        </div>
      )}

      {notLive && (
        <div
          className="rounded-lg p-5 mb-8 text-center border-2"
          style={{ borderColor: "hsl(var(--eden-gold))", backgroundColor: "hsl(var(--eden-cream))" }}
        >
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
        {PRODUCTS.map((p) => (
          <div
            key={p.sku}
            className="rounded-lg border-2 bg-white flex flex-col p-6"
            style={{ borderColor: p.highlight ? "hsl(var(--eden-gold))" : "hsl(var(--border))" }}
          >
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
              {busy === p.sku ? "Opening secure checkout…" : `Preorder ${p.name}`}
            </button>
          </div>
        ))}
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

      {/* SMS consent: explicit opt-in, NEVER pre-checked. Stored on the order; the
          preorder-received text sends only when this was checked. */}
      <div
        className="max-w-2xl mx-auto rounded-lg border p-4 flex items-start gap-3"
        style={{ borderColor: "hsl(var(--eden-gold) / 0.3)", backgroundColor: "hsl(var(--eden-cream) / 0.6)" }}
      >
        <input
          id="preorder-sms-consent"
          type="checkbox"
          checked={smsConsent}
          onChange={(e) => setSmsConsent(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0"
        />
        <label htmlFor="preorder-sms-consent" className="font-body text-sm leading-relaxed cursor-pointer" style={{ color: "hsl(var(--eden-bark))" }}>
          Optional: yes, text me updates about my preorder at the phone number I provide at
          checkout. Message and data rates may apply. Reply STOP at any time to opt out.
        </label>
      </div>
    </div>
  );
}
