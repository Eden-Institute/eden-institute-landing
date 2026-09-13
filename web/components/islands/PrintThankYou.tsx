// web/components/islands/PrintThankYou.tsx
//
// The order confirmation on /books/thank-you. Reads the Stripe session id from
// the redirect (readCheckoutSessionId: the layout's first head script has already
// moved ?session_id= out of the URL into sessionStorage, so a reload in the same
// tab still works), asks print-order-status for the buyer's own order, and shows:
//   1. the order number (the handle /returns tells them to quote),
//   2. exactly what happens next, with the two dates that matter
//      (the cancellation deadline and the arrival window),
//   3. what they bought, where it ships, what they paid.
//
// The Stripe webhook usually lands a second or two AFTER the redirect, so the
// first request can come back { pending: true }; the island polls a few times
// before falling back to a still-reassuring message. Nothing here is fatal: a
// buyer who paid must never see a page that looks like the purchase failed.
//
// Copy rule: no em dashes.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { centsToValue, pinCheckoutOnce } from "@/lib/pinterestTag";
import { readCheckoutSessionId } from "@/lib/checkoutSession";

interface Status {
  pending: boolean;
  order_number?: string;
  stage?: "received" | "printing" | "shipped" | "delivered" | "cancelled";
  product_label?: string;
  items?: { name: string; quantity: number }[];
  amount_total_cents?: number | null;
  tax_cents?: number | null;
  /** Lowercase ISO code from print-order-status, e.g. "usd". */
  currency?: string;
  email?: string;
  ship_to?: { name: string | null; city: string | null; state: string | null };
  placed_at?: string;
  cancel_until?: string;
  tracking?: { carrier: string | null; number: string | null; url: string | null } | null;
}

/** Lulu's MAIL level, door to door, including printing. Read off Lulu's shipping-options API 2026-09-11. */
const TRANSIT_DAYS_MIN = 13;
const TRANSIT_DAYS_MAX = 16;
/** The hold before printing, in days. Mirrors LULU_PRODUCTION_DELAY_MINUTES. */
const HOLD_DAYS = 2;

function money(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}
function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}
function shortDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}
function addDays(iso: string, days: number): Date {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Pinterest checkout. Called only with a non-pending status, and
 * print-order-status only returns one once stripe-webhook has recorded the
 * order, which it does only for payment_status "paid". A refunded order
 * (stage "cancelled") is not reported. Value is the amount before tax (total
 * minus tax, shipping included), matching the buy box's addtocart value.
 * order_id is the order number the buyer sees; event_id is a one-way reference
 * derived from the session id (pinCheckoutOnce), never the session id itself.
 * Nothing here can throw into the caller: the order display must never depend
 * on ad reporting.
 */
function reportPinterestCheckout(sessionId: string, s: Status): void {
  try {
    if (s.pending || s.stage === "cancelled") return;
    const quantity = (s.items ?? []).reduce((n, it) => n + (it.quantity || 0), 0) || 1;
    const value = s.amount_total_cents != null ? centsToValue(s.amount_total_cents - (s.tax_cents ?? 0)) : undefined;
    void pinCheckoutOnce(
      sessionId,
      {
        ...(value != null ? { value } : {}),
        currency: (s.currency ?? "usd").toUpperCase(),
        order_quantity: quantity,
        ...(s.order_number ? { order_id: s.order_number } : {}),
        line_items: (s.items ?? []).map((it) => ({ product_name: it.name, product_quantity: it.quantity })),
      },
      s.email,
    );
  } catch {
    // Analytics never break the page.
  }
}

export default function PrintThankYou() {
  const [status, setStatus] = useState<Status | null>(null);
  const [tries, setTries] = useState(0);
  const [noSession, setNoSession] = useState(false);

  useEffect(() => {
    const sessionId = readCheckoutSessionId();
    if (!sessionId) {
      setNoSession(true);
      return;
    }
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 8 && !cancelled; i++) {
        let found: Status | null = null;
        try {
          const { data, error } = await supabase.functions.invoke("print-order-status", { body: { session_id: sessionId } });
          if (!error && data && !data.pending) found = data as Status;
        } catch {
          // keep polling
        }
        if (found) {
          setStatus(found);
          // Outside the polling try on purpose: ad reporting can never turn a
          // shown order back into the pending fallback.
          reportPinterestCheckout(sessionId, found);
          return;
        }
        setTries(i + 1);
        await new Promise((r) => setTimeout(r, 1500));
      }
      if (!cancelled) setStatus({ pending: true });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const card = "rounded-lg p-5 md:p-6 bg-white border shadow-sm";
  const cardStyle = { borderColor: "hsl(var(--eden-gold) / 0.35)" };
  const forest = { color: "hsl(var(--eden-forest))" };
  const bark = { color: "hsl(var(--eden-bark))" };

  const Hero = ({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) => (
    <div className="text-center mb-8">
      <p className="font-accent text-sm tracking-[0.3em] uppercase mb-4" style={{ color: "hsl(var(--eden-gold-ink))" }}>{eyebrow}</p>
      <h1 className="font-serif text-4xl md:text-5xl font-bold leading-tight mb-5" style={bark}>{title}</h1>
      <div className="w-16 h-px mx-auto my-5" style={{ backgroundColor: "hsl(var(--eden-gold))" }}></div>
      <p className="font-body text-lg text-muted-foreground leading-relaxed">{sub}</p>
    </div>
  );

  if (noSession) {
    return (
      <div>
      <Hero eyebrow="Eden's Table" title="Your order" sub="This page shows an order right after checkout." />
      <div className={card} style={cardStyle}>
        <p className="font-body text-base" style={bark}>
          This page shows an order right after checkout. If you have just paid and landed here without your
          order details, check your inbox: your confirmation email has everything, including your order number.
          Questions: <a href="mailto:hello@edeninstitute.health" className="underline" style={forest}>hello@edeninstitute.health</a>.
        </p>
      </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div>
      <Hero eyebrow="Thank you" title="One moment." sub="Confirming your order with our payment provider." />
      <div className={card} style={cardStyle}>
        <p className="font-body text-base" style={bark}>
          {tries > 2 ? "Almost there. This usually takes a few seconds." : "Checking your payment..."}
        </p>
      </div>
      </div>
    );
  }

  if (status.pending) {
    return (
      <div>
      <Hero eyebrow="Thank you" title="Your payment went through." sub="Your order is being recorded now." />
      <div className={card} style={cardStyle}>
        <p className="font-body text-base leading-relaxed" style={bark}>
          Your payment went through and your order is being recorded now. Your confirmation email, with your
          order number, will be in your inbox within a few minutes. If it has not arrived in ten minutes, email{" "}
          <a href="mailto:hello@edeninstitute.health" className="underline" style={forest}>hello@edeninstitute.health</a>{" "}
          and we will sort it out.
        </p>
      </div>
      </div>
    );
  }

  const placed = status.placed_at ?? new Date().toISOString();
  const cancelUntil = status.cancel_until ?? addDays(placed, HOLD_DAYS).toISOString();
  const arriveMin = addDays(placed, HOLD_DAYS + TRANSIT_DAYS_MIN);
  const arriveMax = addDays(placed, HOLD_DAYS + TRANSIT_DAYS_MAX);
  const shipTo = [status.ship_to?.name, [status.ship_to?.city, status.ship_to?.state].filter(Boolean).join(", ")].filter(Boolean).join(", ");

  if (status.stage === "cancelled") {
    return (
      <div>
      <Hero eyebrow="Eden's Table" title={`Order ${status.order_number} was cancelled.`} sub="It has been refunded in full and nothing will print or ship." />
      <div className={card} style={cardStyle}>
        <p className="font-body text-base" style={bark}>
          Refunds take 5 to 10 days to show on your statement. If you did not ask for this, or you would like
          to order again, email <a href="mailto:hello@edeninstitute.health" className="underline" style={forest}>hello@edeninstitute.health</a>.
        </p>
      </div>
      </div>
    );
  }

  const heroTitle = status.stage === "delivered"
    ? "Your books have arrived."
    : status.stage === "shipped"
    ? "Your books are on their way."
    : "Your order is confirmed.";
  const heroSub = status.stage === "delivered"
    ? "We hope they bless your table."
    : status.stage === "shipped"
    ? "Tracking is below and in your inbox."
    : "Your books will be printed just for you and shipped to your door. Here is your order and exactly what happens next.";

  return (
    <div className="space-y-5">
      <Hero eyebrow="Thank you" title={heroTitle} sub={heroSub} />
      {status.tracking && (status.tracking.url || status.tracking.number) && (
        <div className={card} style={cardStyle}>
          <h2 className="font-serif text-xl font-bold mb-2" style={forest}>Tracking</h2>
          <p className="font-body text-sm" style={bark}>
            {status.tracking.carrier ? `${status.tracking.carrier}: ` : ""}
            {status.tracking.url
              ? <a href={status.tracking.url} target="_blank" rel="noreferrer" className="underline" style={forest}>{status.tracking.number ?? "Track your package"}</a>
              : status.tracking.number}
          </p>
        </div>
      )}
      {/* 1. The number. */}
      <div className={card} style={cardStyle}>
        <p className="font-accent text-xs tracking-[0.25em] uppercase mb-2" style={{ color: "hsl(var(--eden-gold-ink))" }}>
          Your order number
        </p>
        <p className="font-serif text-4xl font-bold" style={forest}>{status.order_number}</p>
        <p className="font-body text-sm text-muted-foreground mt-2">
          Keep this. It is in your confirmation email too, sent to <strong>{status.email}</strong>. Quote it in any email to us.
        </p>
      </div>

      {/* 2. What happens next. */}
      <div className={card} style={cardStyle}>
        <h2 className="font-serif text-xl font-bold mb-4" style={forest}>What happens next</h2>
        <ol className="space-y-4">
          <li className="flex gap-3">
            <span className="font-accent text-sm font-bold shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: "hsl(var(--eden-forest))", color: "hsl(var(--eden-cream))" }}>1</span>
            <div>
              <p className="font-body text-base font-bold" style={bark}>A two-day pause before printing.</p>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">
                Your books are printed to order, one set for you. Printing begins on{" "}
                <strong>{longDate(cancelUntil)}</strong>. Until then you can change your mind or correct the address
                for a full refund: reply to your confirmation email. Once printing starts the order cannot be changed.
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="font-accent text-sm font-bold shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: "hsl(var(--eden-forest))", color: "hsl(var(--eden-cream))" }}>2</span>
            <div>
              <p className="font-body text-base font-bold" style={bark}>Printed and shipped.</p>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">
                Our print partner prints, binds and packs the three books and ships them to you. You will get an
                email with a tracking link the moment they are on their way.
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="font-accent text-sm font-bold shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: "hsl(var(--eden-forest))", color: "hsl(var(--eden-cream))" }}>3</span>
            <div>
              <p className="font-body text-base font-bold" style={bark}>At your door around {shortDate(arriveMin)} to {shortDate(arriveMax)}.</p>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">
                That is the usual window for printing plus tracked mail within the United States. We will email you again when it is delivered.
              </p>
            </div>
          </li>
        </ol>
      </div>

      {/* 3. The receipt. */}
      <div className={card} style={cardStyle}>
        <h2 className="font-serif text-xl font-bold mb-3" style={forest}>Your order</h2>
        <ul className="font-body text-sm space-y-1" style={bark}>
          {(status.items && status.items.length ? status.items : [{ name: status.product_label ?? "Sprouts Printed Curriculum Set", quantity: 1 }]).map((it, i) => (
            <li key={i} className="flex justify-between gap-4">
              <span>{it.quantity > 1 ? `${it.quantity} × ` : ""}{it.name}</span>
            </li>
          ))}
          <li className="text-muted-foreground">Teacher's Guide, Student Notebook and Read-Aloud Storybook, printed.</li>
        </ul>
        <div className="mt-4 pt-3 border-t font-body text-sm" style={{ borderColor: "hsl(var(--eden-gold) / 0.25)", color: "hsl(var(--eden-bark))" }}>
          {shipTo && <div className="flex justify-between gap-4"><span>Ships to</span><span className="text-right">{shipTo}</span></div>}
          {status.tax_cents != null && status.tax_cents > 0 && (
            <div className="flex justify-between gap-4"><span>Sales tax</span><span>{money(status.tax_cents)}</span></div>
          )}
          <div className="flex justify-between gap-4 font-bold mt-1"><span>Charged today</span><span>{money(status.amount_total_cents)}</span></div>
        </div>
      </div>

      {status.stage === "received" && (
        <div className={card} style={cardStyle}>
          <h2 className="font-serif text-xl font-bold mb-2" style={forest}>While you wait</h2>
          <p className="font-body text-sm text-muted-foreground leading-relaxed mb-4">
            The first nine weeks of Sprouts are a $39 download, so you can read ahead and plan your first
            lessons tonight instead of waiting for the mail. Or just wait for the books. Either is fine.
          </p>
          <a
            href="/starter"
            data-cta="books-thankyou-to-starter"
            className="inline-block font-accent text-xs tracking-[0.2em] uppercase font-bold px-6 py-3 rounded-md"
            style={{ backgroundColor: "hsl(var(--eden-forest))", color: "hsl(var(--eden-cream))" }}
          >
            See the Starter Unit
          </a>
        </div>
      )}
    </div>
  );
}
