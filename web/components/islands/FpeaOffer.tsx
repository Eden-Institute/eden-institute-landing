// web/components/islands/FpeaOffer.tsx
//
// The offer and the buy boxes on /fpea, the unlisted page behind the QR code on the
// booth table at the FPEA Florida Homeschool Convention (founder decisions
// 2026-10-30). See supabase/functions/_shared/fpea-offer.ts for the offer itself.
//
// The window check here is COSMETIC: it decides whether to show buttons or a
// "opens on / ended on" note with a link to /books. create-checkout is the gate and
// refuses the offer outside the window whatever this page shows. Dates and the
// discount come from fpea-offer.ts, never typed here; prices come from the same
// sources the boxes use everywhere else (print_products_public, STARTER_BANDS).
//
// A test browser holding the E2E token (see PrintBuyBox) sees the boxes before the
// window opens, so the printed-set flow can be proven in Stripe TEST mode now. The
// Starter boxes have no test mode: outside the window they show the server's
// refusal, which is also worth seeing.
//
// Copy rule: no em dashes. No kits, preorders or credits. Normal-mom voice.

import { useEffect, useState } from "react";
import PrintBuyBox from "./PrintBuyBox";
import StarterBuyBox from "./StarterBuyBox";
import {
  FPEA_OFFER_ID,
  FPEA_STARTER_DISCOUNT_PERCENT,
  type FpeaWindowState,
  fpeaLastDayLabel,
  fpeaLastDayShortLabel,
  fpeaOpensLabel,
  fpeaWindowState,
} from "../../../supabase/functions/_shared/fpea-offer";

const E2E_STORAGE_KEY = "eden_e2e_token";

function hasE2eToken(): boolean {
  try {
    return !!window.localStorage.getItem(E2E_STORAGE_KEY);
  } catch {
    return false;
  }
}

const ink = { color: "hsl(var(--eden-bark))" };
const forest = { color: "hsl(var(--eden-forest))" };

function Closed({ state }: { state: Exclude<FpeaWindowState, "open"> }) {
  return (
    <div className="max-w-2xl mx-auto text-center rounded-lg p-6 bg-white border" style={{ borderColor: "hsl(var(--eden-gold) / 0.4)" }}>
      <p className="font-serif text-xl font-bold mb-3" style={forest}>
        {state === "not_open"
          ? `The FPEA convention offer opens on ${fpeaOpensLabel()}.`
          : `The FPEA convention offer ended on ${fpeaLastDayLabel()}.`}
      </p>
      <p className="font-body text-base mb-5" style={ink}>
        {state === "not_open"
          ? "Until then, everything is available at the regular price."
          : "Everything is still available at the regular price."}
      </p>
      <a
        href="/books"
        data-cta={state === "not_open" ? "fpea-not-open-books" : "fpea-ended-books"}
        className="inline-flex items-center justify-center font-accent text-sm tracking-[0.2em] uppercase font-bold px-8 py-4 rounded-md hover:opacity-90"
        style={{ backgroundColor: "hsl(var(--eden-forest))", color: "hsl(var(--eden-cream))" }}
      >
        See the printed sets
      </a>
    </div>
  );
}

export default function FpeaOffer() {
  const [state, setState] = useState<FpeaWindowState | null>(null);
  const [e2e, setE2e] = useState(false);

  useEffect(() => {
    setState(fpeaWindowState(Date.now()));
    setE2e(hasE2eToken());
  }, []);

  if (state === null) return <p className="font-body text-sm text-muted-foreground text-center">Loading...</p>;
  if (state !== "open" && !e2e) return <Closed state={state} />;

  return (
    <div className="max-w-5xl mx-auto">
      {state !== "open" && (
        <p className="font-body text-sm mb-6 rounded-md px-4 py-3 font-bold" style={{ backgroundColor: "#fde68a", color: "#78350f" }} role="status">
          E2E TEST: the offer window is closed ({state === "not_open" ? "not open yet" : "ended"}). Only the Stripe test checkout will accept it.
        </p>
      )}

      <div className="max-w-2xl mx-auto mb-10 font-body text-base md:text-lg leading-relaxed space-y-3" style={ink}>
        <h2 className="font-serif text-2xl font-bold text-center" style={forest}>Your convention offer, through {fpeaLastDayShortLabel()}</h2>
        <p>
          Order any printed set and shipping is free. You also get that year's nine-week Starter Unit download, emailed
          right after you pay, so you can start while your books are printed.
        </p>
        <p>Or get a Starter Unit download on its own for {FPEA_STARTER_DISCOUNT_PERCENT}% off.</p>
        <p className="text-sm text-muted-foreground">
          Each set is printed just for you. Printing begins 48 hours after you order, and it arrives in about two to three
          weeks, tracked, within the United States.
        </p>
      </div>

      <h2 className="font-serif text-2xl font-bold mb-6 text-center" style={forest}>Printed sets</h2>
      <div className="grid gap-6 md:grid-cols-3 items-start mb-12">
        <div id="print-sprouts" className="scroll-mt-24">
          <p className="font-accent text-xs tracking-[0.25em] uppercase mb-2" style={{ color: "hsl(var(--eden-gold-ink))" }}>Sprouts, grades K-2</p>
          <PrintBuyBox cta="fpea-buy-sprouts" band="sprouts" offer={FPEA_OFFER_ID} />
        </div>
        <div id="print-seedlings" className="scroll-mt-24">
          <p className="font-accent text-xs tracking-[0.25em] uppercase mb-2" style={{ color: "hsl(var(--eden-gold-ink))" }}>Seedlings, grades 3-5</p>
          <PrintBuyBox cta="fpea-buy-seedlings" band="seedlings" offer={FPEA_OFFER_ID} />
        </div>
        <div id="print-both" className="scroll-mt-24">
          <p className="font-accent text-xs tracking-[0.25em] uppercase mb-2" style={{ color: "hsl(var(--eden-gold-ink))" }}>Both years</p>
          <PrintBuyBox cta="fpea-buy-both" band="both" offer={FPEA_OFFER_ID} />
        </div>
      </div>

      <h2 className="font-serif text-2xl font-bold mb-6 text-center" style={forest}>
        Starter Unit downloads, {FPEA_STARTER_DISCOUNT_PERCENT}% off
      </h2>
      <div className="grid gap-6 md:grid-cols-2 items-start max-w-3xl mx-auto">
        <div id="starter-sprouts" className="scroll-mt-24 rounded-lg p-5 bg-white border text-center" style={{ borderColor: "hsl(var(--eden-gold) / 0.35)" }}>
          <p className="font-serif text-lg font-bold mb-3" style={forest}>Sprouts Starter Unit, grades K-2</p>
          <StarterBuyBox cta="fpea-starter-sprouts" band="sprouts" offer={FPEA_OFFER_ID} />
        </div>
        <div id="starter-seedlings" className="scroll-mt-24 rounded-lg p-5 bg-white border text-center" style={{ borderColor: "hsl(var(--eden-gold) / 0.35)" }}>
          <p className="font-serif text-lg font-bold mb-3" style={forest}>Seedlings Starter Unit, grades 3-5</p>
          <StarterBuyBox cta="fpea-starter-seedlings" band="seedlings" offer={FPEA_OFFER_ID} />
        </div>
      </div>
    </div>
  );
}
