// web/components/islands/StarterDownloads.tsx
//
// Fetches and renders a buyer's Starter Unit downloads plus their credit code.
// Serves BOTH surfaces, because they differ only in which credential they hold:
//
//   /starter/thank-you  -> ?session_id= from Stripe's redirect (the email has not
//                          arrived yet, so there is no token to use)
//   /starter/downloads  -> ?t= the durable re-request token from the email
//
// POLLING, and why it is here. The webhook queues the delivery and a separate
// function does the stamping, so for the first few seconds after payment the
// files genuinely do not exist yet and the endpoint answers 409 NOT_READY. A
// buyer landing on a confirmation page that says "not found" would reasonably
// conclude they paid for nothing. So NOT_READY is a distinct state that polls,
// with a bounded number of tries and an honest fallback that points at the email.
//
// Copy rule: no em dashes (feedback_no_em_dashes).

import { useEffect, useRef, useState } from "react";

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/starter-download`;

/** ~45 seconds of patience. Stamping two PDFs measured about 300ms, so anything
 *  slower than this is a real fault, not a slow queue. */
const MAX_POLLS = 15;
const POLL_MS = 3000;

interface FileLink {
  slug: string;
  label: string;
  url: string;
}

interface Payload {
  expires_at: string;
  download_token?: string;
  credit_code?: string | null;
  credit_redeemed?: boolean;
  files: FileLink[];
}

type State =
  | { kind: "loading" }
  | { kind: "preparing"; polls: number }
  | { kind: "ready"; data: Payload }
  | { kind: "error"; message: string };

interface Props {
  /** "session" on the confirmation page, "token" on the re-request page. */
  mode: "session" | "token";
  /** Show the credit code block. Off on the re-request page, where the buyer
   *  already has the code in the email they clicked from. */
  showCredit?: boolean;
}

export default function StarterDownloads({ mode, showCredit = false }: Props) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const credential =
      mode === "session"
        ? params.get("session_id") ?? ""
        : params.get("t") ?? "";

    if (!credential) {
      setState({
        kind: "error",
        message:
          mode === "session"
            ? "We could not read your order reference. Your files are on their way by email regardless."
            : "That link is incomplete. Use the full link from your Starter Unit email, including everything after the equals sign.",
      });
      return;
    }

    let polls = 0;
    let cancelled = false;

    async function attempt() {
      if (cancelled) return;
      try {
        const qs = mode === "session" ? `s=${encodeURIComponent(credential)}` : `t=${encodeURIComponent(credential)}`;
        const res = await fetch(`${FUNCTIONS_BASE}?${qs}`, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string },
        });

        if (res.status === 409) {
          polls += 1;
          if (polls >= MAX_POLLS) {
            setState({
              kind: "error",
              message:
                "Your files are taking longer than usual to prepare. They will arrive by email shortly. If nothing lands within the hour, email hello@edeninstitute.health and we will send them by hand.",
            });
            return;
          }
          setState({ kind: "preparing", polls });
          timer.current = window.setTimeout(attempt, POLL_MS);
          return;
        }

        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setState({
            kind: "error",
            message: (body as { error?: string }).error ??
              "We could not fetch your downloads just now. Please try the link in your email.",
          });
          return;
        }
        setState({ kind: "ready", data: body as Payload });
      } catch (err) {
        // A THROW here is not an HTTP error, it is the request never leaving the
        // browser: CORS preflight refused, offline, or a blocked request. The
        // first real purchase hit exactly this (a missing `apikey` in the
        // function's Access-Control-Allow-Headers) and the old copy said "we
        // could not reach the server. Check your connection", which blamed the
        // buyer's wifi for our bug and, worse, implied the purchase had failed.
        //
        // It had not. Fulfilment runs server-side off the Stripe webhook and had
        // already finished. So the copy now leads with the thing that is both
        // true and the thing a person who has just paid actually needs to hear.
        console.error("starter downloads fetch failed:", err);
        setState({
          kind: "error",
          message:
            "Your purchase went through and your files are on their way by email, we just could not show them on this page. Check your inbox in a minute or two. If nothing arrives, email hello@edeninstitute.health and we will send them straight to you.",
        });
      }
    }

    void attempt();
    return () => {
      cancelled = true;
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [mode]);

  if (state.kind === "loading" || state.kind === "preparing") {
    return (
      <div
        className="rounded-lg p-6 text-center"
        style={{ backgroundColor: "hsl(var(--eden-cream))" }}
      >
        <p className="font-body text-base" style={{ color: "hsl(var(--eden-bark))" }}>
          {state.kind === "preparing"
            ? "Preparing your files. This usually takes under a minute."
            : "Fetching your downloads..."}
        </p>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div
        className="rounded-lg p-6 text-center"
        style={{ backgroundColor: "hsl(var(--eden-cream))", border: "1px solid hsl(var(--eden-gold))" }}
      >
        <p className="font-body text-base" style={{ color: "hsl(var(--eden-bark))" }} role="alert">
          {state.message}
        </p>
      </div>
    );
  }

  const { data } = state;
  const expires = new Date(data.expires_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div>
      <div className="space-y-3">
        {data.files.map((f) => (
          <a
            key={f.slug}
            href={f.url}
            data-cta={`starter-download-${f.slug}`}
            className="flex items-center justify-center w-full font-accent text-sm tracking-[0.2em] uppercase font-bold px-6 py-4 rounded-md border-2"
            style={{ borderColor: "hsl(var(--eden-forest))", color: "hsl(var(--eden-forest))" }}
          >
            {f.label}
          </a>
        ))}
      </div>

      <p className="font-body text-xs mt-4 text-muted-foreground text-center">
        These links work until {expires}. Save the files to your device and they are yours
        to keep.
        {data.download_token && (
          <>
            {" "}
            If they lapse,{" "}
            <a
              href={`/starter/downloads?t=${encodeURIComponent(data.download_token)}`}
              className="underline"
              style={{ color: "hsl(var(--eden-forest))" }}
            >
              get fresh ones here
            </a>
            .
          </>
        )}
      </p>

      {showCredit && data.credit_code && (
        <div
          className="mt-8 rounded-lg p-6 text-center"
          style={{ border: "2px dashed hsl(var(--eden-gold))", backgroundColor: "hsl(var(--background))" }}
        >
          <p
            className="font-accent text-xs tracking-[0.25em] uppercase mb-3"
            style={{ color: "hsl(var(--eden-gold))" }}
          >
            Your credit toward the full kit
          </p>
          <p
            className="font-serif text-2xl md:text-3xl font-bold tracking-[0.15em] mb-3"
            style={{ color: "hsl(var(--eden-bark))" }}
          >
            {data.credit_code}
          </p>
          <p className="font-body text-sm text-muted-foreground leading-relaxed">
            {data.credit_redeemed
              ? "This credit has been used. Thank you."
              : "That is $39 off the Sprouts Complete Kit. It is tied to the email you bought with and can be used once. It does not expire when the founding 500 sell out. It is in your email too, so you do not need to write it down."}
          </p>
        </div>
      )}
    </div>
  );
}
