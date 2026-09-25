/**
 * BookThankYou (2026-09-25). What a Back to Eden buyer sees after paying, and
 * where the delivery email's download link lands.
 *
 *   mode="session"  /back-to-eden/thank-you?kind=print|digital&session_id=...
 *                   print   -> order status from print-order-status (polls until
 *                              stripe-webhook has written the order)
 *                   digital -> the download, from book-download?s= (polls on 409)
 *   mode="token"    /back-to-eden/download?t=...  -> the download, from book-download?t=
 *
 * The session id is read with readCheckoutSessionId (the layout has already taken
 * it out of the address bar). The download page loads no third-party tags, and
 * clicks on the signed file link never bubble to page listeners.
 *
 * Copy rule: no em dashes.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { readCheckoutSessionId } from "@/lib/checkoutSession";

const DOWNLOAD_FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/book-download`;
const POLL_MS = 1500;
const MAX_POLLS = 12;
const BARK = { color: "hsl(var(--eden-bark))" };
const FOREST = "hsl(var(--eden-forest))";

type Download = { title: string; filename: string; pages: number; url: string };
type PrintStatus = {
  order_number: string | null;
  stage: "received" | "printing" | "shipped" | "delivered" | "cancelled";
  items: { name: string; quantity: number }[];
  email: string | null;
  ship_to: { name: string | null; city: string | null; state: string | null };
  cancel_until: string;
  tracking: { carrier: string | null; number: string | null; url: string | null } | null;
};
type State =
  | { kind: "loading" }
  | { kind: "download"; data: Download }
  | { kind: "print"; data: PrintStatus }
  | { kind: "error"; message: string };

function Header({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  return (
    <div className="text-center mb-8">
      <p className="font-accent text-sm tracking-[0.3em] uppercase mb-4" style={{ color: "hsl(var(--eden-gold-ink))" }}>{eyebrow}</p>
      <h1 className="font-serif text-4xl md:text-5xl font-bold leading-tight mb-5" style={BARK}>{title}</h1>
      <div className="w-16 h-px mx-auto my-5" style={{ backgroundColor: "hsl(var(--eden-gold))" }}></div>
      <p className="font-body text-lg text-muted-foreground leading-relaxed">{sub}</p>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg bg-white p-6 border" style={{ borderColor: "hsl(var(--eden-gold) / 0.35)" }}>{children}</div>;
}

function longDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });
}

export default function BookThankYou({ mode }: { mode: "session" | "token" }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [kind, setKind] = useState<"print" | "digital">("digital");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const k = mode === "token" ? "digital" : params.get("kind") === "print" ? "print" : "digital";
    setKind(k);
    const credential = mode === "token" ? params.get("t") : readCheckoutSessionId();
    if (!credential) {
      setState({
        kind: "error",
        message: mode === "token"
          ? "This download link is not complete. Please use the button in your email, or email hello@edeninstitute.health."
          : "We could not find your order on this page. Your confirmation email has everything you need.",
      });
      return;
    }
    let cancelled = false;
    let polls = 0;

    async function pollDownload() {
      const qs = mode === "token" ? `t=${encodeURIComponent(credential!)}` : `s=${encodeURIComponent(credential!)}`;
      try {
        const res = await fetch(`${DOWNLOAD_FN}?${qs}`, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string },
          referrerPolicy: "no-referrer",
        });
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) return setState({ kind: "download", data: body as Download });
        if (res.status === 409 && polls < MAX_POLLS) {
          polls += 1;
          window.setTimeout(pollDownload, POLL_MS);
          return;
        }
        setState({
          kind: "error",
          message: res.status === 409
            ? "Your book is taking a little longer than usual. The download link is on its way to your email. If nothing arrives within the hour, email hello@edeninstitute.health."
            : (body as { error?: string }).error ?? "Something went wrong. Please email hello@edeninstitute.health.",
        });
      } catch {
        if (!cancelled) setState({ kind: "error", message: "We could not reach the server. Please check your connection and try again." });
      }
    }

    async function pollPrint() {
      for (let i = 0; i < 8 && !cancelled; i++) {
        try {
          const { data, error } = await supabase.functions.invoke("print-order-status", { body: { session_id: credential } });
          if (!error && data && !data.pending) {
            if (!cancelled) setState({ kind: "print", data: data as PrintStatus });
            return;
          }
        } catch {
          // keep polling
        }
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
      if (!cancelled) {
        setState({
          kind: "error",
          message: "Thank you! Your payment went through and your order is being recorded. Your confirmation email, with your order number, will arrive in the next few minutes.",
        });
      }
    }

    if (k === "print" && mode === "session") void pollPrint();
    else void pollDownload();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  if (state.kind === "loading") {
    return (
      <>
        <Header eyebrow="Back to Eden" title="Thank you!" sub={kind === "print" ? "Finding your order..." : "Getting your book ready..."} />
        <p className="text-center font-body text-muted-foreground" role="status">One moment.</p>
      </>
    );
  }

  if (state.kind === "error") {
    return (
      <>
        <Header eyebrow="Back to Eden" title={mode === "token" ? "Your download" : "Thank you!"} sub="" />
        <Card><p className="font-body" style={BARK} role="alert">{state.message}</p></Card>
      </>
    );
  }

  if (state.kind === "download") {
    const d = state.data;
    return (
      <>
        <Header eyebrow="Back to Eden" title={mode === "token" ? "Your download" : "Thank you!"} sub={`${d.title}. ${d.pages} pages, yours to keep.`} />
        <Card>
          <a
            href={d.url}
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            onAuxClick={(e) => e.stopPropagation()}
            data-cta="bte-download"
            className="flex items-center justify-center w-full font-accent text-sm tracking-[0.2em] uppercase font-bold px-6 py-4 rounded-md border-2"
            style={{ borderColor: FOREST, color: FOREST }}
          >
            Download your book (PDF)
          </a>
          <p className="mt-4 font-body text-sm text-muted-foreground">
            {mode === "session"
              ? "We also emailed you this download link, so you can come back to it any time, on any device."
              : "This link keeps working. Come back to it any time, on any device."}
          </p>
          <p className="mt-3 font-body text-sm text-muted-foreground">
            If the file opens as a blank white screen, nothing is wrong with it. Open this page in Safari or Chrome, or on a computer, and it will download properly.
          </p>
        </Card>
      </>
    );
  }

  const o = state.data;
  const cancelled = o.stage === "cancelled";
  return (
    <>
      <Header
        eyebrow="Back to Eden"
        title={cancelled ? "This order was cancelled" : "Thank you, your order is in!"}
        sub={cancelled ? "If that is a surprise, email hello@edeninstitute.health and I will sort it out." : "Your copy is printed just for you and mailed with tracking."}
      />
      <Card>
        {o.order_number && <p className="font-body" style={BARK}>Order number: <strong>{o.order_number}</strong></p>}
        <ul className="mt-3 space-y-1 font-body" style={BARK}>
          {o.items.map((it) => <li key={it.name}>{it.quantity > 1 ? `${it.quantity} x ` : ""}{it.name}</li>)}
        </ul>
        {(o.ship_to.city || o.ship_to.state) && (
          <p className="mt-3 font-body text-sm text-muted-foreground">Shipping to {o.ship_to.name ? `${o.ship_to.name}, ` : ""}{[o.ship_to.city, o.ship_to.state].filter(Boolean).join(", ")}</p>
        )}
        {!cancelled && (
          <>
            <h2 className="mt-6 font-serif text-xl font-bold" style={BARK}>What happens now</h2>
            {o.stage === "received" && (
              <p className="mt-2 font-body" style={BARK}>
                Printing starts after {longDate(o.cancel_until)} Central. Until then you can change the address or cancel for a full refund: just reply to your confirmation email.
              </p>
            )}
            <p className="mt-2 font-body" style={BARK}>
              You will get an email with tracking the day it ships. Plan on about two to three weeks from today to your door.
            </p>
            {o.tracking?.url && (
              <p className="mt-3"><a href={o.tracking.url} rel="noreferrer" className="font-body underline" style={{ color: FOREST }}>Track your package</a></p>
            )}
          </>
        )}
        {o.email && <p className="mt-4 font-body text-sm text-muted-foreground">Your confirmation is on its way to {o.email}.</p>}
      </Card>
    </>
  );
}
