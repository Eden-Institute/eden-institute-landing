// web/components/islands/PrintBuyBox.tsx
//
// Client island for /books: the printed Sprouts curriculum, sold as one set
// (Teacher's Guide + Student Notebook + Read-Aloud), printed to order and
// shipped by Lulu. Founder decision 2026-09-10: the books are not sold
// separately.
//
// PRICE COMES FROM THE DATABASE, never from this file. The island reads the
// print_products_public view, which only lists products whose row is complete
// (price, Stripe Price id, shipping tier). If the set is not finished being
// configured it is simply not offered, rather than shown at a price the
// checkout would then refuse.
//
// Deliberately smaller than PreorderBuyBox: no founding counter, no ship-window
// disclaimer (these ship in days, not months), no credit codes. It keeps the
// SMS consent checkbox (default UNCHECKED, TCPA) because the shipped and
// delivered texts are worth having. Its label must name every text the order
// flow sends to a consenting buyer (order_received_sms, shipped_sms,
// delivered_sms in _shared/order-messages.ts): the A2P campaign's opt-in
// description quotes it, and a reviewer reads it against the samples.
//
// Copy rule: no em dashes.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getFbAttribution } from "@/lib/fbAttribution";
import { centsToValue, pinTrack } from "@/lib/pinterestTag";
import PayOverTime from "./PayOverTime";

interface PrintProduct {
  sku: string;
  name: string;
  retail_price_cents: number;
  shipping_tier_cents: number;
}

/** Per-order caps. Mirror _shared/lulu-config.ts; the edge function is the gate. */
const MAX_QTY: Record<string, number> = {
  sprouts_print_set: 2,
  sprouts_nb_print: 5,
};
const SET_SKU = "sprouts_print_set";
const NB_SKU = "sprouts_nb_print";

/**
 * E2E test switch (2026-09-17). When this browser holds the E2E token in
 * localStorage, checkout goes to create-checkout-e2e: Stripe TEST mode, bought as
 * hello@, no Lulu print. Set it from the console on a test browser only:
 *   localStorage.setItem("eden_e2e_token", "<E2E_TEST_TOKEN>")
 * Without the key (every real shopper) nothing here changes.
 */
const E2E_STORAGE_KEY = "eden_e2e_token";
function readE2eToken(): string | null {
  try {
    return window.localStorage.getItem(E2E_STORAGE_KEY);
  } catch {
    return null;
  }
}

function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

interface Props {
  cta: string;
}

export default function PrintBuyBox({ cta }: Props) {
  const [product, setProduct] = useState<PrintProduct | null | undefined>(undefined);
  /** The extra-notebook product, when its row is complete; null hides the option. */
  const [notebook, setNotebook] = useState<PrintProduct | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [nbQty, setNbQty] = useState(0);
  const [smsConsent, setSmsConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [e2eToken, setE2eToken] = useState<string | null>(null);

  useEffect(() => {
    setE2eToken(readE2eToken());
    const params = new URLSearchParams(window.location.search);
    const state = params.get("checkout");
    if (state === "cancelled") setNotice("No payment was taken. The set is still here whenever you are ready.");
    // ?checkout=success is the OLD return address (before /books/thank-you). Kept
    // so a stale tab or bookmark still reads as a success, not a blank page.
    if (state === "success") setNotice("Thank you. Your order is confirmed and your confirmation email is on its way.");

    (async () => {
      // The view is newer than the generated Supabase types, hence the cast.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: e } = await (supabase as any)
        .from("print_products_public")
        .select("sku, name, retail_price_cents, shipping_tier_cents")
        .in("sku", [SET_SKU, NB_SKU]);
      if (e) {
        setLoadError("We could not load the set right now. Please refresh, or email hello@edeninstitute.health.");
        setProduct(null);
        return;
      }
      const rows = (data ?? []) as PrintProduct[];
      setProduct(rows.find((r) => r.sku === SET_SKU) ?? null);
      setNotebook(rows.find((r) => r.sku === NB_SKU) ?? null);
    })();
  }, []);

  const max = product ? MAX_QTY[product.sku] ?? 2 : 2;
  const nbMax = notebook ? MAX_QTY[notebook.sku] ?? 5 : 0;
  const subtotal = (product ? product.retail_price_cents * qty : 0) + (notebook ? notebook.retail_price_cents * nbQty : 0);
  // One parcel, one shipping charge, whatever the quantity.
  const shipping = product ? Math.max(product.shipping_tier_cents, nbQty > 0 && notebook ? notebook.shipping_tier_cents : 0) : 0;

  async function startCheckout() {
    if (!product) return;
    // Pinterest addtocart, on the click and BEFORE the await: the redirect to
    // Stripe below can cut off anything queued after it. Value is the "Total
    // before tax" this box shows, the same basis the checkout event reports.
    const nbCount = notebook && nbQty > 0 ? nbQty : 0;
    pinTrack("addtocart", {
      value: centsToValue(subtotal + shipping),
      currency: "USD",
      order_quantity: qty + nbCount,
      line_items: [
        { product_id: product.sku, product_name: product.name, product_price: centsToValue(product.retail_price_cents), product_quantity: qty },
        ...(notebook && nbCount > 0
          ? [{ product_id: notebook.sku, product_name: notebook.name, product_price: centsToValue(notebook.retail_price_cents), product_quantity: nbCount }]
          : []),
      ],
    });
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(e2eToken ? "create-checkout-e2e" : "create-checkout", {
        ...(e2eToken ? { headers: { "x-eden-e2e": e2eToken } } : {}),
        body: {
          ...getFbAttribution(),
          print_shop: true,
          items: [
            { sku: product.sku, qty },
            ...(notebook && nbQty > 0 ? [{ sku: notebook.sku, qty: nbQty }] : []),
          ],
          sms_consent: smsConsent,
          success_url: "https://edeninstitute.health/books/thank-you?session_id={CHECKOUT_SESSION_ID}",
          cancel_url: "https://edeninstitute.health/books?checkout=cancelled",
        },
      });
      if (fnError) {
        // supabase-js wraps non-2xx in FunctionsHttpError with the body on context.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ctx = (fnError as any)?.context;
        let detail: { error?: string; code?: string } | null = null;
        try {
          detail = ctx && typeof ctx.json === "function" ? await ctx.json() : null;
        } catch {
          detail = null;
        }
        if (detail?.code === "PRINT_SHOP_NOT_LIVE") {
          throw new Error("Checkout for the printed set is paused for a moment. Please email hello@edeninstitute.health and I will get your order in.");
        }
        throw new Error(detail?.error ?? fnError.message);
      }
      if (!data?.url) throw new Error("Checkout did not return a link.");
      window.location.href = data.url as string;
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? `We could not open checkout: ${err.message}`
          : "We could not open checkout. Please try again, or email hello@edeninstitute.health.",
      );
      setLoading(false);
    }
  }

  return (
    <div className="w-full rounded-lg p-5 md:p-6 bg-white border" style={{ borderColor: "hsl(var(--eden-gold) / 0.35)" }}>
      {e2eToken && (
        <p className="font-body text-sm mb-4 rounded-md px-4 py-3 font-bold" style={{ backgroundColor: "#fde68a", color: "#78350f" }} role="status">
          E2E TEST MODE: Stripe test checkout, fake cards only, nothing is printed.
        </p>
      )}
      {notice && (
        <p className="font-body text-sm mb-4 rounded-md px-4 py-3" style={{ backgroundColor: "hsl(var(--eden-cream))", color: "hsl(var(--eden-bark))" }}>
          {notice}
        </p>
      )}

      {product === undefined && <p className="font-body text-sm text-muted-foreground">Loading...</p>}
      {loadError && <p className="font-body text-sm" style={{ color: "hsl(var(--destructive))" }} role="alert">{loadError}</p>}
      {product === null && !loadError && (
        <p className="font-body text-sm text-muted-foreground">The printed set is not on sale yet.</p>
      )}

      {product && (
        <>
          <p className="font-serif text-lg font-bold" style={{ color: "hsl(var(--eden-forest))" }}>{product.name}</p>
          <p className="font-body text-sm text-muted-foreground mb-4">
            Teacher's Guide, Student Notebook and Read-Aloud Storybook, together.
          </p>
          <p className="font-serif text-3xl font-bold" style={{ color: "hsl(var(--eden-bark))" }}>{money(product.retail_price_cents)}</p>

          <label className="mt-4 flex items-center gap-3 font-body text-sm" style={{ color: "hsl(var(--eden-bark))" }}>
            <span>Sets</span>
            <select
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              className="rounded-md border px-2 py-1 bg-background"
              style={{ borderColor: "hsl(var(--eden-gold) / 0.5)" }}
            >
              {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>

          {notebook && (
            <label className="mt-3 flex items-center gap-3 font-body text-sm" style={{ color: "hsl(var(--eden-bark))" }}>
              <span>Extra Student Notebooks for siblings, {money(notebook.retail_price_cents)} each</span>
              <select
                value={nbQty}
                onChange={(e) => setNbQty(Number(e.target.value))}
                className="rounded-md border px-2 py-1 bg-background"
                style={{ borderColor: "hsl(var(--eden-gold) / 0.5)" }}
              >
                {Array.from({ length: nbMax + 1 }, (_, i) => i).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          )}

          <div className="mt-4 font-body text-sm" style={{ color: "hsl(var(--eden-bark))" }}>
            <div className="flex justify-between"><span>{qty} × set</span><span>{money(product.retail_price_cents * qty)}</span></div>
            {notebook && nbQty > 0 && (
              <div className="flex justify-between"><span>{nbQty} × extra notebook</span><span>{money(notebook.retail_price_cents * nbQty)}</span></div>
            )}
            <div className="flex justify-between"><span>Shipping (one parcel)</span><span>{money(shipping)}</span></div>
            <div className="flex justify-between font-bold mt-1"><span>Total before tax</span><span>{money(subtotal + shipping)}</span></div>
          </div>

          <PayOverTime amountCents={subtotal + shipping} className="mt-3" />

          <label className="mt-4 flex items-start gap-2 font-body text-sm text-muted-foreground">
            <input type="checkbox" checked={smsConsent} onChange={(e) => setSmsConsent(e.target.checked)} className="mt-1" />
            <span>
              Text me order updates from The Eden Institute: an order confirmation, when it ships and when it is delivered (up to 3 messages per order). Message and data rates may apply. Reply STOP to opt out, HELP for help. See our{" "}
              <a href="/terms" className="underline">Terms</a> and <a href="/privacy" className="underline">Privacy Policy</a>.
            </span>
          </label>

          <button
            type="button"
            data-cta={cta}
            onClick={startCheckout}
            disabled={loading}
            className={`mt-5 inline-flex w-full items-center justify-center font-accent text-sm tracking-[0.2em] uppercase font-bold px-8 py-4 rounded-md transition-opacity ${
              loading ? "opacity-60 cursor-wait" : "hover:opacity-90"
            }`}
            style={{ backgroundColor: "hsl(var(--eden-forest))", color: "hsl(var(--eden-cream))" }}
          >
            {loading ? "Opening checkout..." : `Order the set, ${money(product.retail_price_cents)}`}
          </button>

          {error && (
            <p className="font-body text-sm mt-3" style={{ color: "hsl(var(--destructive))" }} role="alert">{error}</p>
          )}

          <ul className="font-body text-xs mt-4 space-y-1 text-muted-foreground">
            <li>Secure checkout by Stripe. Card, Apple Pay, or pay over time.</li>
            <li>Printed to order for you and shipped tracked within the United States, usually at your door in about two to three weeks.</li>
            <li>Change your mind or fix your address within 48 hours for a full refund, before printing begins.</li>
          </ul>
          <p className="font-body text-xs mt-3 text-muted-foreground">
            <a href="/returns" className="underline" style={{ color: "hsl(var(--eden-forest))" }}>Read the full policy</a>{" "}
            before you buy.
          </p>
        </>
      )}
    </div>
  );
}
