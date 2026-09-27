/**
 * BookCheckoutController (2026-09-25; copies selector 2026-09-26). One island for every Back to Eden buy
 * button on /back-to-eden. The buttons are plain HTML in the page, marked
 * data-book-buy="<edition>-<format>" (or "both-print"); this wires their clicks to
 * create-checkout and sends the buyer to Stripe.
 *
 *   print    -> { print_shop: true, items: [...] }   Lulu print rail, band 'bte'
 *   digital  -> { book_digital: true, sku }          PDF, emailed download link
 *
 * Launch switch: the page renders the buttons hidden (and "Coming soon" shown)
 * until BUY_LIVE is true. With the E2E token in localStorage ('eden_e2e_token')
 * this reveals them anyway, shows a yellow banner, and routes to
 * create-checkout-e2e (Stripe test mode, fake cards, nothing printed), the same
 * switch the /books buy box uses.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getFbAttribution } from "@/lib/fbAttribution";
import { pinTrack } from "@/lib/pinterestTag";
import { likelyNeedsGround, printShippingCents } from "../../../supabase/functions/_shared/print-pricing";
import { checkShipTo, type ShipTo } from "../../../supabase/functions/_shared/ship-address";
import ShipToForm, { type ShipToDraft } from "./ShipToForm";

type Req =
  | { kind: "print"; items: { sku: string; qty: number }[]; value: number }
  | { kind: "digital"; sku: string; value: number };

// Dollar values are only for the ad-pixel "add to cart" event (price + one-copy
// shipping, 2026-09-26 rules); Stripe charges the real price.
const ACTIONS: Record<string, Req> = {
  "paperback-print": { kind: "print", items: [{ sku: "bte_paperback_print", qty: 1 }], value: 32.99 },
  "study-journal-print": { kind: "print", items: [{ sku: "bte_study_journal_print", qty: 1 }], value: 74 },
  "study-guide-print": { kind: "print", items: [{ sku: "bte_study_guide_print", qty: 1 }], value: 54 },
  "both-print": {
    kind: "print",
    items: [{ sku: "bte_paperback_print", qty: 1 }, { sku: "bte_study_guide_print", qty: 1 }],
    value: 79.99,
  },
  "paperback-digital": { kind: "digital", sku: "bte_paperback_digital", value: 14.99 },
  "study-journal-digital": { kind: "digital", sku: "bte_study_journal_digital", value: 29 },
  "study-guide-digital": { kind: "digital", sku: "bte_study_guide_digital", value: 19 },
};

const FRIENDLY: Record<string, string> = {
  BOOK_SHOP_NOT_LIVE: "Back to Eden is not quite open for orders yet. Please check back very soon.",
  PRINT_SHOP_NOT_LIVE: "Printed orders are paused for a moment. Please email hello@edeninstitute.health and I will get your order in.",
  PRINT_SHOP_NOT_CONFIGURED: "This edition is not quite ready to order. Please check back soon, or choose another format.",
  BOOK_NOT_CONFIGURED: "This edition is not quite ready to order. Please check back soon, or choose another format.",
  RATE_LIMITED: "Too many tries in a row. Please wait a few minutes and try again.",
};

function showError(btn: HTMLElement, message: string) {
  const host = btn.closest("[data-book-buy-row]") ?? btn.parentElement;
  if (!host) return;
  let p = host.parentElement?.querySelector<HTMLElement>("[data-book-error]") ?? null;
  if (!p) {
    p = document.createElement("p");
    p.setAttribute("data-book-error", "");
    p.setAttribute("role", "alert");
    p.className = "mt-2 font-body text-sm";
    p.style.color = "#9b2c2c";
    host.insertAdjacentElement("afterend", p);
  }
  p.textContent = message;
}

type Item = { sku: string; qty: number };

/**
 * Open Stripe Checkout for one buy button. `shipTo` is only sent for a heavy
 * order (it ships by ground and needs a checked street address; the server
 * re-checks it and refuses a PO box or APO before any payment).
 */
async function startCheckout(btn: HTMLButtonElement, action: Req, items: Item[], token: string | null, shipTo?: ShipTo) {
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Opening checkout...";
  try {
    const body =
      action.kind === "print"
        ? { ...getFbAttribution(), print_shop: true, items, sms_consent: false, ...(shipTo ? { ship_to: shipTo } : {}) }
        : { ...getFbAttribution(), book_digital: true, sku: action.sku };
    const { data, error } = await supabase.functions.invoke(token ? "create-checkout-e2e" : "create-checkout", {
      ...(token ? { headers: { "x-eden-e2e": token } } : {}),
      body,
    });
    if (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ctx = (error as any)?.context;
      let detail: { error?: string; code?: string } | null = null;
      try {
        detail = ctx && typeof ctx.json === "function" ? await ctx.json() : null;
      } catch {
        detail = null;
      }
      throw new Error((detail?.code && FRIENDLY[detail.code]) || detail?.error || error.message);
    }
    if (!data?.url) throw new Error("Checkout did not return a link.");
    window.location.href = data.url as string;
  } catch (err) {
    showError(
      btn,
      err instanceof Error && err.message
        ? err.message
        : "We could not open checkout. Please try again, or email hello@edeninstitute.health.",
    );
    btn.disabled = false;
    btn.textContent = label;
  }
}

export default function BookCheckoutController({ live }: { live: boolean }) {
  const [e2eToken, setE2eToken] = useState<string | null>(null);
  /** A heavy print order waiting for its street address (see ShipToForm). */
  const [pending, setPending] = useState<{ btn: HTMLButtonElement; action: Req; items: Item[]; token: string | null } | null>(null);
  const [shipTo, setShipTo] = useState<ShipToDraft>({});
  const [shipError, setShipError] = useState<string | null>(null);

  useEffect(() => {
    let token: string | null = null;
    try {
      token = localStorage.getItem("eden_e2e_token");
    } catch {
      token = null;
    }
    setE2eToken(token);
    if (token && !live) {
      document.querySelectorAll<HTMLElement>("[data-book-buy]").forEach((b) => b.classList.remove("hidden"));
      document.querySelectorAll<HTMLElement>("[data-book-buy-qty-label]").forEach((b) => b.classList.remove("hidden"));
      document.querySelectorAll<HTMLElement>("[data-book-soon]").forEach((s) => s.classList.add("hidden"));
    }

    // Copies change the shipping (founder 2026-09-26: shipping covers Lulu's cost),
    // so the amount next to each print price follows the selector, using the same
    // formula create-checkout charges.
    function onChange(ev: Event) {
      const sel = (ev.target as HTMLElement | null)?.closest<HTMLSelectElement>("[data-book-qty]");
      if (!sel) return;
      const action = ACTIONS[sel.dataset.bookQty ?? ""];
      const out = document.querySelector<HTMLElement>(`[data-book-ship="${sel.dataset.bookQty ?? ""}"]`);
      if (!action || action.kind !== "print" || action.items.length !== 1 || !out) return;
      const copies = Math.min(10, Math.max(1, Math.floor(Number(sel.value)) || 1));
      const cents = printShippingCents([{ sku: action.items[0].sku, qty: copies }]);
      if (cents == null) return;
      out.textContent = `+ ${(cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })} shipping${copies > 1 ? ` for ${copies}` : ""}`;
    }

    function onClick(ev: Event) {
      const btn = (ev.target as HTMLElement | null)?.closest<HTMLButtonElement>("[data-book-buy]");
      if (!btn) return;
      const action = ACTIONS[btn.dataset.bookBuy ?? ""];
      if (!action) return;
      ev.preventDefault();
      if (btn.disabled) return;

      // Copies (2026-09-26, groups ordering together): a single-title print
      // button may have a 1-10 selector next to it (data-book-qty). The server
      // re-checks the cap (10, lulu-config.ts); anything unreadable is 1.
      const qtyEl = document.querySelector<HTMLSelectElement>(`[data-book-qty="${btn.dataset.bookBuy ?? ""}"]`);
      const copies = qtyEl ? Math.min(10, Math.max(1, Math.floor(Number(qtyEl.value)) || 1)) : 1;
      const items = action.kind === "print"
        ? action.items.length === 1 ? [{ ...action.items[0], qty: copies }] : action.items
        : [];

      pinTrack("addtocart", {
        value: action.kind === "print" && action.items.length === 1 ? Math.round(action.value * copies * 100) / 100 : action.value,
        currency: "USD",
        order_quantity: action.kind === "print" ? items.reduce((n, i) => n + i.qty, 0) : 1,
      });

      // Heavy print orders ship by ground: ask for the street address first.
      if (action.kind === "print" && likelyNeedsGround(items)) {
        setShipError(null);
        setPending({ btn, action, items, token });
        return;
      }
      void startCheckout(btn, action, items, token);
    }

    document.addEventListener("click", onClick);
    document.addEventListener("change", onChange);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("change", onChange);
    };
  }, [live]);

  function continueWithAddress() {
    if (!pending) return;
    const check = checkShipTo(shipTo);
    if (!check.ok) {
      setShipError((check as { message: string }).message);
      return;
    }
    const p = pending;
    setPending(null);
    void startCheckout(p.btn, p.action, p.items, p.token, check.value);
  }

  return (
    <>
      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true" aria-label="Shipping address">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <ShipToForm value={shipTo} onChange={setShipTo} idPrefix="bte-shipto" />
            {shipError && <p className="mt-2 font-body text-sm" style={{ color: "#9b2c2c" }} role="alert">{shipError}</p>}
            <div className="mt-4 flex flex-wrap justify-end gap-3">
              <button type="button" className="font-body text-sm underline underline-offset-4" style={{ color: "hsl(var(--eden-forest))" }} onClick={() => setPending(null)}>
                Cancel
              </button>
              <button type="button" className="rounded-md px-5 py-2 font-body text-sm font-bold" style={{ backgroundColor: "hsl(var(--eden-forest))", color: "hsl(var(--eden-cream))" }} onClick={continueWithAddress}>
                Continue to checkout
              </button>
            </div>
          </div>
        </div>
      )}
      {e2eToken && (
        <div
          className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-md px-4 py-3 font-body text-sm font-bold shadow-lg md:bottom-6"
          style={{ backgroundColor: "#fde68a", color: "#78350f" }}
          role="status"
        >
          E2E TEST MODE: Stripe test checkout, fake cards only, nothing is printed.
        </div>
      )}
    </>
  );
}
