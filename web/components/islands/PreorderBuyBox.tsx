// web/components/islands/PreorderBuyBox.tsx
//
// Client island for /preorder. Owns the entire interactive buy flow:
//   - the two product cards (Sprouts Complete Kit, Student Notebook)
//   - the two-step preorder modal:
//       step 1 = founding-member disclaimer, two MANDATORY unchecked checkboxes
//       step 2 = sibling-notebook add-on (qty stepper 0..5) + live order summary
//   - SMS consent checkbox, explicitly UNCHECKED by default (TCPA: never pre-check)
//   - success / cancelled banners (?checkout= query param from Stripe redirect)
//   - the "preorder not open yet" notice while PREORDERS_LIVE=false
//
// The modal's checkboxes are a courtesy, not a control: create-checkout rejects any
// preorder request without both acceptance flags (DISCLAIMER_REQUIRED), so bypassing
// this UI buys nothing. Acceptance is persisted in sessionStorage (per tab, never
// across browser sessions) so a buyer who backs out of Stripe is not forced to
// re-read the whole disclaimer to try again.
//
// Dark-testing: /preorder?admin=<PREORDER_ADMIN_TOKEN> forwards the token as the
// x-preorder-admin header so the founder can exercise the full production path
// before launch. Without it, the EF refuses checkout until PREORDERS_LIVE=true.
//
// Founding window: on mount the island fetches the preorder-status EF
// ({ sold, cap, closed }) and (a) renders the live "N of 500 founding kits
// claimed" line while the window is open, (b) flips the whole display (prices,
// copy, order summary) to retail once `closed` is true. `closed` is the server's
// ONE-WAY latch, so this can never flip back. If the fetch fails, the island
// fails open to the founding display, mirroring create-checkout's
// customer-favorable fail-open; the checkout page always shows the final price.
//
// Prices shown here are display copy; the ONLY billing truth is the Stripe Price
// the create-checkout EF selects (founding vs retail off the 500-kit gate).
// Keep in sync with supabase/functions/_shared/order-config.ts:
//   $12 shipping     = PREORDER_FLAT_SHIPPING_CENTS
//   ship dates      = SHIP_TARGET + SHIP_GUARANTEE_TEXT
//   notebook cap 5   = maxQtyPerOrder on sprouts_notebook
//   founding/retail cents on both products
// Copy rule: no em dashes (feedback_no_em_dashes).

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import { getFbAttribution } from "@/lib/fbAttribution";
// Two dates, and the split is deliberate. SHIP_TARGET is what we are aiming for and
// what the page talks about; SHIP_GUARANTEE is the BINDING commitment the FTC delay
// clock runs on. Both must stay visible: if only the target were prominent, it could be
// treated as the stated shipping time and pull the deadline forward by two months.
// Keep in sync with supabase/functions/_shared/order-config.ts.
const SHIP_TARGET = "early November 2026";
const SHIP_GUARANTEE = "December 31, 2026";
const NOTEBOOK_MAX_QTY = 5;
const KIT_PRICE_CENTS = 24900;
const KIT_RETAIL_CENTS = 34900;
const NOTEBOOK_PRICE_CENTS = 1900;
const NOTEBOOK_RETAIL_CENTS = 2499;
const SHIPPING_CENTS = 1200;
const ACCEPT_STORAGE_KEY = "eden_preorder_disclaimer_v1";

interface FoundingStatus {
  sold: number | null;
  cap: number | null;
  closed: boolean;
}

// Launch morning must be ONE action: flip the PREORDERS_LIVE secret. This page
// reads that flag from preorder-status on every load, so the store opens with
// no merge, no deploy and no cache purge.
//
// Fails OPEN (defaults true) on purpose. create-checkout is the real gate and
// refuses regardless, so the worst case of a status outage before launch is a
// buyer clicking and being told preorder has not opened. Failing closed would
// mean a status outage ON launch morning silently shuts the store.
const PREORDERS_LIVE_DEFAULT = true;

// SMS consent is gated on the server flag `sms_enabled` from preorder-status
// (secret SMS_CONSENT_ENABLED). It fails CLOSED, the opposite of the founding
// display: showing "yes, text me" while A2P 10DLC registration is still pending
// means the buyer opts in and then hears nothing, and every send throws. Better
// to not ask until we can actually deliver.
const SMS_DEFAULT_ENABLED = false;

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

// Kit ONLY. The standalone Student Notebook card was removed (founder decision
// 2026-07-25): the notebook is now offered exclusively as the step-2 add-on
// inside the kit flow, so there is one product, one decision, one session.
const PRODUCTS: DisplayProduct[] = [
  {
    sku: "sprouts_kit",
    eyebrow: "Sprouts Complete Kit · Grades K-2",
    name: "Sprouts Complete Kit",
    founding: "$249",
    retail: "$349",
    discountLine: "Founding price · $100 below retail",
    blurb: "The full 36-week year. Every component, one box.",
    bullets: [
      "36 weekly lessons, 180 daily lessons",
      "240-page Teacher's Guide, no prep required",
      "224-page Student Notebook",
      "Read-Aloud Storybook",
      "36 Herb Field Cards",
      "36 Recipe Cards",
      "Around the Table deck (144 cards)",
    ],
    highlight: true,
  },
];

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// Kit is the only flow now. Kept as a named type so `flow !== null` still reads
// as "modal open" and the dialog wiring below is unchanged.
type Flow = "kit";

export default function PreorderBuyBox() {
  const [smsConsent, setSmsConsent] = useState(false); // MUST default unchecked
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notLive, setNotLive] = useState(false);
  // Set when the EF refuses on stock. Latched for the page view rather than polled:
  // once we know the run is gone, do not invite another attempt that will also fail.
  const [soldOut, setSoldOut] = useState(false);
  const [founding, setFounding] = useState<FoundingStatus>({ sold: null, cap: null, closed: false });
  const [smsEnabled, setSmsEnabled] = useState(SMS_DEFAULT_ENABLED);
  const [preordersLive, setPreordersLive] = useState(PREORDERS_LIVE_DEFAULT);

  // Founding-window status, fetched once on mount. Any failure keeps the default
  // (founding display, no counter): fail open exactly like the server gate.
  // The SMS flag rides the same response but fails CLOSED, see SMS_DEFAULT_ENABLED.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke("preorder-status");
        if (cancelled || fnError || !data || typeof data.closed !== "boolean") return;
        setFounding({
          sold: typeof data.sold === "number" ? data.sold : null,
          cap: typeof data.cap === "number" ? data.cap : null,
          closed: data.closed,
        });
        setSmsEnabled(data.sms_enabled === true);
        // Only honour an explicit boolean. An older deployment of
        // preorder-status omits this field entirely, and `undefined` must not
        // be read as "closed" or the store would appear shut.
        if (typeof data.preorders_live === "boolean") setPreordersLive(data.preorders_live);
      } catch {
        // status unavailable; founding display stands and SMS stays hidden
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Modal state
  const [flow, setFlow] = useState<Flow | null>(null); // null = modal closed
  const [step, setStep] = useState<1 | 2>(1);
  const [ackShipWindow, setAckShipWindow] = useState(false);
  const [ackFounding, setAckFounding] = useState(false);
  const [notebookQty, setNotebookQty] = useState(0); // kit flow add-on qty; notebook flow floors at 1
  const dialogRef = useRef<HTMLDivElement>(null);

  const qs = useMemo(
    () => new URLSearchParams(typeof window !== "undefined" ? window.location.search : ""),
    [],
  );
  const checkoutState = qs.get("checkout"); // success | cancelled | null
  const adminToken = qs.get("admin");

  const modalOpen = flow !== null;
  const bothAccepted = ackShipWindow && ackFounding;

  function openModal(f: Flow) {
    setError(null);
    setFlow(f);
    setStep(1);
    // Always 0. The add-on is an offer, not a pre-loaded quantity.
    setNotebookQty(0);
    // A buyer who already accepted in this tab (e.g. backed out of Stripe) gets the
    // boxes pre-checked; the disclaimer itself is still shown.
    let prior = false;
    try {
      prior = sessionStorage.getItem(ACCEPT_STORAGE_KEY) === "1";
    } catch {
      // storage unavailable (private mode); they just re-check
    }
    setAckShipWindow(prior);
    setAckFounding(prior);
  }

  function closeModal() {
    setFlow(null);
    setStep(1);
  }

  function continueToStep2() {
    if (!bothAccepted) return;
    try {
      sessionStorage.setItem(ACCEPT_STORAGE_KEY, "1");
    } catch {
      // best-effort only
    }
    setStep(2);
  }

  // Esc closes; simple focus trap while open. Re-runs on step change: the step swap
  // replaces the dialog's children, so focus must move back inside or Tab escapes.
  useEffect(() => {
    if (!modalOpen) return;
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialog?.querySelector<HTMLElement>("input, button")?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setFlow(null);
        setStep(1);
        return;
      }
      if (e.key !== "Tab" || !dialog) return;
      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, input, [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      // Focus fell outside the dialog (e.g. its element was replaced): pull it back.
      if (!dialog.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
        return;
      }
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [modalOpen, step]);

  async function checkout(items: { sku: string; qty: number }[]) {
    setBusy(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("create-checkout", {
        body: {
          ...getFbAttribution(),
          items,
          // Belt and braces: never record consent we never asked for, even if the
          // flag flipped off between mount and checkout.
          sms_consent: smsEnabled && smsConsent,
          accepted_ship_window: true,
          accepted_founding_member: true,
          // Which wording checkbox 2 actually showed (the founding-member line, or the
          // post-sellout supporter line). The acceptance boolean above stays the gate;
          // this stamps the shown variant into session metadata as evidence.
          member_ack_variant: closed ? "preorder_supporter" : "founding_member",
        },
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
          closeModal();
          // Must clear busy. Without it the CTA stays disabled reading
          // "Opening secure checkout…" forever and the buyer has to reload the
          // page. Found by dark-test 2026-07-25; every other early-return in
          // this handler already clears it.
          setBusy(false);
          return;
        }
        // The print run is finite. The EF refuses before creating a Stripe session,
        // so the buyer is never charged for a unit we cannot ship. Its message names
        // the product and the remaining count, so surface it rather than a generic line.
        if (code === "OUT_OF_STOCK") {
          setSoldOut(true);
          setError(message ?? "That item is sold out.");
          closeModal();
          setBusy(false);
          return;
        }
        if (code === "RATE_LIMITED") {
          setError(message ?? "Too many attempts. Please wait a few minutes and try again.");
          closeModal();
          setBusy(false);
          return;
        }
        throw new Error(message ?? fnError.message ?? "Checkout could not be started.");
      }
      if (data?.url) {
        // Leave busy=true: the browser is navigating to Stripe, and re-enabling the
        // buttons for the last visible frames invites a double checkout.
        window.location.href = data.url as string;
        return;
      }
      throw new Error("Checkout could not be started. Please try again.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout could not be started. Please try again.");
      closeModal();
      setBusy(false);
    }
  }

  function cartFor(qty: number): { sku: string; qty: number }[] {
    const items: { sku: string; qty: number }[] = [{ sku: "sprouts_kit", qty: 1 }];
    if (qty > 0) items.push({ sku: "sprouts_notebook", qty });
    return items;
  }

  // Founding window closed = display retail everywhere. Billing truth stays with
  // create-checkout; these cents only drive the display copy and order summary.
  const closed = founding.closed;
  // The store is open only if the secret says so AND we have not been refused
  // mid-session. `notLive` is the backstop for the window between a flip and
  // the cached status response catching up.
  const storeOpen = preordersLive && !notLive;
  const kitCents = closed ? KIT_RETAIL_CENTS : KIT_PRICE_CENTS;
  const nbCents = closed ? NOTEBOOK_RETAIL_CENTS : NOTEBOOK_PRICE_CENTS;

  const nbCount = notebookQty;
  // Shipping stays a flat $12 regardless of notebook quantity. That row is the
  // on-screen PROOF of the "ships together, no extra shipping" claim, so it
  // renders even when qty is 0. Do not hide it.
  const summary: { label: string; cents: number }[] = [
    { label: closed ? "Sprouts Complete Kit" : "Sprouts Complete Kit (founding)", cents: kitCents },
    ...(nbCount > 0
      ? [{ label: `Extra Student Notebook × ${nbCount}`, cents: nbCents * nbCount }]
      : []),
    { label: "Shipping (flat)", cents: SHIPPING_CENTS },
  ];
  const summaryTotal = summary.reduce((t, l) => t + l.cents, 0);

  return (
    <div>
      {checkoutState === "success" && (
        <div
          className="rounded-lg p-5 mb-8 text-center"
          style={{ backgroundColor: "hsl(var(--eden-forest))" }}
        >
          <p className="font-serif text-lg font-bold text-white mb-1">
            {closed ? "Thank you. Your preorder is confirmed." : "Thank you. Your founding preorder is confirmed."}
          </p>
          <p className="font-body text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
            A confirmation email is on its way to your inbox with your order number, your order
            details, and your guaranteed ship date.
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

      {soldOut && (
        <div
          className="rounded-lg p-5 mb-8 text-center border-2"
          style={{ borderColor: "hsl(var(--eden-gold))", backgroundColor: "hsl(var(--eden-cream))" }}
        >
          <p className="font-serif text-lg font-bold mb-1" style={{ color: "hsl(var(--eden-bark))" }}>
            This print run is spoken for.
          </p>
          <p className="font-body text-sm text-muted-foreground">
            Every kit from this run has been claimed, so we have closed orders rather than take
            money for a box we cannot ship. Write to us at{" "}
            <a href="mailto:hello@edeninstitute.health" className="underline">hello@edeninstitute.health</a>{" "}
            and we will tell you the moment the next run opens.
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
            We are finishing production samples. Preorder opens July 29, and this page will be
            live the moment it does.
          </p>
        </div>
      )}

      {/* NO COUNTER. Founder decision 2026-07-25, and it is deliberate: the
          Founding Families tier (50) is positioned as prestige, not as a race.
          A standing number reads as an honour; a ticking one reads as a sales
          tactic and invites arithmetic we do not want a prospect doing here.
          Do NOT reinstate a "N of M claimed" line.

          The preorder-status fetch above STAYS. It still drives the one-way
          `closed` latch that flips the $249 price to $349 after 500 kits. Only
          the visible counter is gone. */}
      {/* Pre-launch banner. Rendered only while PREORDERS_LIVE is false, and it
          disappears on the next page load after the secret is flipped. */}
      {!storeOpen && !soldOut && (
        <div
          className="max-w-2xl mx-auto rounded-lg border-2 p-5 mb-8 text-center"
          style={{ borderColor: "hsl(var(--eden-gold))", backgroundColor: "hsl(var(--eden-cream))" }}
        >
          <p className="font-accent text-xs tracking-[0.3em] uppercase mb-2" style={{ color: "hsl(var(--eden-gold))" }}>
            Opens Wednesday
          </p>
          <p className="font-serif text-2xl font-bold mb-2" style={{ color: "hsl(var(--eden-bark))" }}>
            Preorder opens July 29.
          </p>
          <p className="font-body text-sm" style={{ color: "hsl(var(--eden-bark))" }}>
            Everything below is the kit, the terms, and the price exactly as they will be. The
            only thing not open yet is the button.
          </p>
        </div>
      )}

      <div className="max-w-2xl mx-auto text-center mb-8">
        <p className="font-serif text-xl italic mb-2" style={{ color: "hsl(var(--eden-bark))" }}>
          {closed
            ? "The fifty Founding Families are in."
            : "Fifty Founding Families. That is the whole round."}
        </p>
        <p className="font-body text-sm" style={{ color: "hsl(var(--eden-bark))" }}>
          {closed
            ? `Preorder is still open at ${PRODUCTS[0].retail} and every kit still ships in the first print run.`
            : `${PRODUCTS[0].founding} while the founding price lasts. It rises to ${PRODUCTS[0].retail} after the first 500 kits.`}
        </p>
      </div>

      {/* Single product, so it is centred on a comfortable reading width rather
          than sitting in the left cell of the old two-up grid. */}
      <div className="mb-4 max-w-md mx-auto">
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
                {closed ? (
                  p.retail
                ) : (
                  <>
                    {p.founding}{" "}
                    <span className="font-body text-base font-normal text-muted-foreground line-through ml-2">
                      {p.retail}
                    </span>
                  </>
                )}
              </p>
              <p className="font-accent text-xs uppercase tracking-wider" style={{ color: "hsl(var(--eden-sage))" }}>
                {closed ? "Standard retail price" : p.discountLine}
              </p>
            </div>
            <p className="font-body text-sm text-muted-foreground mb-3 leading-relaxed">{p.blurb}</p>
            <ul className="font-body text-sm text-muted-foreground space-y-1.5 mb-6 flex-1">
              {p.bullets.map((b) => (
                <li key={b}>· {b}</li>
              ))}
            </ul>
            <button
              onClick={() => openModal("kit")}
              disabled={busy || !storeOpen || soldOut}
              className="font-body text-sm font-semibold px-8 py-4 rounded-sm w-full transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "hsl(var(--eden-forest))", color: "hsl(var(--eden-parchment))" }}
            >
              {busy
                ? "Opening secure checkout…"
                : soldOut
                  ? "Sold out"
                  : !storeOpen
                    ? "Preorder opens July 29"
                    : `Preorder ${p.name}`}
            </button>
          </div>
        ))}
      </div>

      {/* Shipping + tax disclosure BEFORE redirect. $12 mirrors PREORDER_FLAT_SHIPPING_CENTS. */}
      <p className="font-body text-sm text-muted-foreground text-center mb-8">
        Shipping is a flat $12 per order, and any sales tax is calculated at checkout.
      </p>

      {error && (
        <div role="alert" className="max-w-2xl mx-auto mb-6 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="font-body text-sm text-destructive text-center">{error}</p>
        </div>
      )}

      {/* SMS consent: explicit opt-in, NEVER pre-checked. Stored on the order; the
          preorder-received text sends only when this was checked. Hidden entirely
          until the server says SMS can actually be delivered (sms_enabled). */}
      {smsEnabled && (
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
      )}

      {/* ── Preorder modal: step 1 disclaimer, step 2 notebook add-on ─────────── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(44, 62, 45, 0.55)" }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="preorder-modal-title"
            className="rounded-lg bg-white w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 md:p-8 shadow-xl"
          >
            {step === 1 ? (
              <>
                <h2
                  id="preorder-modal-title"
                  className="font-serif text-2xl font-bold mb-4"
                  style={{ color: "hsl(var(--eden-bark))" }}
                >
                  {closed ? "Before you preorder" : "Before you join us"}
                </h2>
                <div className="font-body text-sm leading-relaxed space-y-3 mb-5" style={{ color: "hsl(var(--eden-bark))" }}>
                  <p>Eden's Table is not sitting in a warehouse yet.</p>
                  <p>
                    Right now it is finished manuscripts, finished art, and a printer waiting on a
                    go-ahead. What it does not have is a first print run. That is what your preorder
                    pays for. You are not buying from our inventory. You are the reason there will
                    be one.
                  </p>
                  <p>So here is exactly where things stand, honestly.</p>
                  <p>
                    <strong>We are printing, not shipping.</strong> Every kit is still in
                    production. Nothing goes out from a shelf today, because there is no shelf yet.
                  </p>
                  <p>
                    <strong>We are aiming for {SHIP_TARGET}.</strong> The books, the card decks,
                    and the binding each move on their own timeline, and we will know more as each
                    one locks in. So that our target is never the only thing you have to go on,
                    your kit is <strong>guaranteed to ship on or before {SHIP_GUARANTEE}</strong>.
                    If we cannot make that date, we will write to you before it passes, and you can
                    cancel for a full refund.
                  </p>
                  <p>
                    <strong>You will hear from us the whole way through.</strong> As manufacturing
                    details firm up, we email you. Proofs, print dates, ship dates, and delays if
                    they come. You will never be left wondering. And if you would rather just ask a
                    person, write to{" "}
                    <a href="mailto:hello@edeninstitute.health" className="underline">
                      hello@edeninstitute.health
                    </a>{" "}
                    any time and Camila answers. Genuinely, not a support queue.
                  </p>
                  {closed ? (
                    <p>
                      <strong>The founding price is gone.</strong> Your preorder
                      joins the same first print run at the standard retail price, and you get the
                      same updates the whole way through.
                    </p>
                  ) : (
                    /* Rank is not known until payment clears, so this must NOT
                       tell every buyer they are a Founding Family. Founding
                       Family status = first 50 PAID orders (founder decision
                       2026-07-25). The founding PRICE is separate and runs to
                       500 kits. Keep these two claims distinct. */
                    <p>
                      <strong>You are funding the first round.</strong> Every preorder at the
                      founding price saves $100 and helps pay for the print run. The first fifty
                      families to order also become our Founding Families, with the private group,
                      Coffee and Curriculum, and a vote on what we build next. If you are one of
                      the fifty, we will tell you in your confirmation email.
                    </p>
                  )}
                  <p>
                    Good things are worth the wait. We would rather build this well than rush a box
                    out the door with your family's name on it. Thank you for being the kind of
                    person who can wait for something worth waiting for.
                  </p>
                </div>

                <div
                  className="rounded-lg border p-4 space-y-3 mb-4"
                  style={{ borderColor: "hsl(var(--eden-gold) / 0.4)", backgroundColor: "hsl(var(--eden-cream) / 0.5)" }}
                >
                  <div className="flex items-start gap-3">
                    <input
                      id="ack-ship-window"
                      type="checkbox"
                      checked={ackShipWindow}
                      onChange={(e) => setAckShipWindow(e.target.checked)}
                      className="mt-1 h-4 w-4 shrink-0"
                    />
                    <label htmlFor="ack-ship-window" className="font-body text-sm leading-relaxed cursor-pointer" style={{ color: "hsl(var(--eden-bark))" }}>
                      I understand this is a preorder for products still being manufactured. We
                      are aiming to ship {SHIP_TARGET}, and my kit is guaranteed to ship on or
                      before {SHIP_GUARANTEE}.
                    </label>
                  </div>
                  <div className="flex items-start gap-3">
                    <input
                      id="ack-founding"
                      type="checkbox"
                      checked={ackFounding}
                      onChange={(e) => setAckFounding(e.target.checked)}
                      className="mt-1 h-4 w-4 shrink-0"
                    />
                    <label htmlFor="ack-founding" className="font-body text-sm leading-relaxed cursor-pointer" style={{ color: "hsl(var(--eden-bark))" }}>
                      {/* Must be true for EVERY buyer regardless of rank. Do not
                          reintroduce a "I am a founding member" claim here. */}
                      I understand that my preorder helps build Eden's Table, and I am ready to be
                      part of this journey.
                    </label>
                  </div>
                </div>

                <button
                  onClick={continueToStep2}
                  disabled={!bothAccepted}
                  aria-disabled={!bothAccepted}
                  aria-describedby={!bothAccepted ? "ack-helper" : undefined}
                  className="font-body text-sm font-semibold px-8 py-4 rounded-sm w-full transition-opacity hover:opacity-90 disabled:opacity-50 mb-2"
                  style={{ backgroundColor: "hsl(var(--eden-forest))", color: "hsl(var(--eden-parchment))" }}
                >
                  Continue to my preorder
                </button>
                {!bothAccepted && (
                  <p id="ack-helper" className="font-body text-xs text-muted-foreground text-center mb-2">
                    Please check both boxes above so we know we are on the same page.
                  </p>
                )}
                <button
                  onClick={closeModal}
                  className="font-body text-sm px-8 py-3 rounded-sm w-full border transition-opacity hover:opacity-80"
                  style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--eden-bark))", backgroundColor: "transparent" }}
                >
                  Not yet
                </button>
                <p className="font-body text-xs text-muted-foreground text-center mt-4">
                  Your card is charged today. If we cannot ship within the window above, we will
                  tell you, and you can ask for a full refund any time before your kit ships.
                </p>
              </>
            ) : (
              <>
                <h2
                  id="preorder-modal-title"
                  className="font-serif text-2xl font-bold mb-3"
                  style={{ color: "hsl(var(--eden-bark))" }}
                >
                  Teaching more than one child?
                </h2>
                <div className="font-body text-sm leading-relaxed space-y-3 mb-5" style={{ color: "hsl(var(--eden-bark))" }}>
                  <p>
                    Your kit already includes one Student Notebook. If another child is working
                    through the year alongside them, add a notebook now so each of them has their
                    own to draw in, press leaves into, and keep at the end of the year.
                  </p>
                  <p>
                    Add student notebooks now. Shipping is included, because everything ships
                    together in the same box. {closed ? "" : "Founding price, "}
                    {money(nbCents)} each.
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4 mb-2" style={{ borderColor: "hsl(var(--eden-gold) / 0.4)" }}>
                  <span className="font-body text-sm font-semibold" style={{ color: "hsl(var(--eden-bark))" }}>
                    Extra Student Notebook
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setNotebookQty((q) => Math.max(0, q - 1))}
                      aria-label="One fewer notebook"
                      className="h-9 w-9 rounded-sm border font-body text-lg leading-none"
                      style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--eden-bark))" }}
                    >
                      −
                    </button>
                    <span className="font-body text-base w-6 text-center" aria-live="polite" style={{ color: "hsl(var(--eden-bark))" }}>
                      {notebookQty}
                    </span>
                    <button
                      onClick={() => setNotebookQty((q) => Math.min(NOTEBOOK_MAX_QTY, q + 1))}
                      aria-label="One more notebook"
                      className="h-9 w-9 rounded-sm border font-body text-lg leading-none"
                      style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--eden-bark))" }}
                    >
                      +
                    </button>
                  </div>
                </div>
                {notebookQty >= NOTEBOOK_MAX_QTY && (
                  <p className="font-body text-xs text-muted-foreground mb-4">
                    Need more than five? Email{" "}
                    <a href="mailto:hello@edeninstitute.health" className="underline">
                      hello@edeninstitute.health
                    </a>{" "}
                    and we will take care of you.
                  </p>
                )}

                <div className="rounded-lg p-4 mb-5 mt-3" style={{ backgroundColor: "hsl(var(--eden-cream) / 0.6)" }}>
                  {summary.map((l) => (
                    <div key={l.label} className="flex justify-between font-body text-sm mb-1" style={{ color: "hsl(var(--eden-bark))" }}>
                      <span>{l.label}</span>
                      <span>{money(l.cents)}</span>
                    </div>
                  ))}
                  <div
                    className="flex justify-between font-body text-sm font-bold pt-2 mt-2 border-t"
                    style={{ color: "hsl(var(--eden-bark))", borderColor: "hsl(var(--eden-gold) / 0.4)" }}
                  >
                    <span>Total before tax</span>
                    <span>{money(summaryTotal)}</span>
                  </div>
                  <p className="font-body text-xs text-muted-foreground mt-2">
                    {closed
                      ? "Sales tax calculated at checkout. The checkout page always shows your final price."
                      : "Sales tax calculated at checkout. Founding prices shown while the founding price lasts. The checkout page always shows your final price."}
                  </p>
                </div>

                <button
                  onClick={() => checkout(cartFor(notebookQty))}
                  disabled={busy}
                  className="font-body text-sm font-semibold px-8 py-4 rounded-sm w-full transition-opacity hover:opacity-90 disabled:opacity-50 mb-2"
                  style={{ backgroundColor: "hsl(var(--eden-forest))", color: "hsl(var(--eden-parchment))" }}
                >
                  {busy ? "Opening secure checkout…" : "Continue to checkout"}
                </button>
                {/* "Just the kit, thanks" must stay equally easy to press. This is
                    the line between an offer and a dark pattern, and with this
                    audience the difference is the whole relationship. */}
                <button
                  onClick={() => checkout(cartFor(0))}
                  disabled={busy}
                  className="font-body text-sm font-semibold px-8 py-3 rounded-sm w-full border transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ borderColor: "hsl(var(--eden-forest))", color: "hsl(var(--eden-forest))", backgroundColor: "transparent" }}
                >
                  Just the kit, thanks
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
