// web/components/islands/OnlineYearThankYou.tsx
//
// /online-year/thank-you (punch #472): where Stripe sends an Online Year buyer after paying
// (ONLINE_YEAR_SUCCESS_URL). Reads the Stripe session id the way PrintThankYou does
// (readCheckoutSessionId: the layout's first head script has already moved ?session_id= out of the
// URL into sessionStorage, so a reload in the same tab still works), asks online-year-order-status,
// and shows one of two approved sets of words (web/lib/onlineYearCopy.ts OY_APPROVED_THANK_YOU):
//   - READY: the band heading, each child's end date (in the buyer's own time zone), the
//     "Open Sprouts" / "Open Seedlings" button to the sign-in page, and the remaining lines;
//   - STILL BEING SET UP: only when the page opens before the webhook has recorded the order. The
//     island polls every few seconds for about a minute, then keeps those words (they carry the
//     help line). Nothing here is fatal: a buyer who paid never sees a page that looks like failure.
// Before the first answer the island shows nothing for up to FIRST_ANSWER_MS, so a buyer whose
// order is already recorded never sees "still being set up" flash first.
//
// DARK: online-year-order-status answers 404 until ONLINE_YEAR_ENABLED. The order page sends no
// x-online-year-preview header (OnlineYearCheckout.tsx), so neither does this page: while dark it
// stops asking and shows the "still being set up" words.
//
// No analytics, no tracking, no em dashes.
import { useEffect, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { readCheckoutSessionId } from "@/lib/checkoutSession";
import { ONLINE_YEAR_SIGNIN_PATH, OY_APPROVED_THANK_YOU, OY_HELP_EMAIL } from "../../lib/onlineYearCopy";
import {
  onlineYearOpenButton,
  onlineYearReadyHeading,
  onlineYearStartWeek1,
  onlineYearYearSentences,
  readOnlineYearReadyStatus,
  type OnlineYearReadyStatus,
} from "../../lib/onlineYearThankYou";

/** How often, and for how long, to ask while the order is still being recorded. */
export const POLL_EVERY_MS = 3000;
export const POLL_FOR_MS = 60_000;
/** Show the "still being set up" words if the first answer takes longer than this. */
export const FIRST_ANSWER_MS = 2500;

type View = { kind: "checking" } | { kind: "pending" } | { kind: "ready"; status: OnlineYearReadyStatus };
type Answer = { kind: "ready"; status: OnlineYearReadyStatus } | { kind: "pending" } | { kind: "stop" };

async function askStatus(sessionId: string): Promise<Answer> {
  try {
    const { data, error } = await supabase.functions.invoke("online-year-order-status", { body: { session_id: sessionId } });
    if (error) {
      // 404 = dark (or no such function), 400 = not a session id: asking again will not change it.
      const status = error instanceof FunctionsHttpError ? (error.context as Response | undefined)?.status : undefined;
      return status === 404 || status === 400 ? { kind: "stop" } : { kind: "pending" };
    }
    const ready = readOnlineYearReadyStatus(data);
    return ready ? { kind: "ready", status: ready } : { kind: "pending" };
  } catch {
    return { kind: "pending" };
  }
}

const BARK = { color: "hsl(var(--eden-bark))" } as const;
const FOREST = { color: "hsl(var(--eden-forest))" } as const;

/** An approved line with the support address made a mailto link (the words are unchanged). */
function WithHelpLink({ line }: { line: string }) {
  const at = line.indexOf(OY_HELP_EMAIL);
  if (at < 0) return <>{line}</>;
  return (
    <>
      {line.slice(0, at)}
      <a href={`mailto:${OY_HELP_EMAIL}`} className="underline" style={FOREST}>{OY_HELP_EMAIL}</a>
      {line.slice(at + OY_HELP_EMAIL.length)}
    </>
  );
}

export default function OnlineYearThankYou() {
  const [view, setView] = useState<View>({ kind: "checking" });

  useEffect(() => {
    const sessionId = readCheckoutSessionId();
    if (!sessionId) {
      setView({ kind: "pending" });
      return;
    }
    let cancelled = false;
    const showPending = () => setView((v) => (v.kind === "checking" ? { kind: "pending" } : v));
    const slow = setTimeout(() => { if (!cancelled) showPending(); }, FIRST_ANSWER_MS);
    (async () => {
      const deadline = Date.now() + POLL_FOR_MS;
      for (;;) {
        const answer = await askStatus(sessionId);
        if (cancelled) return;
        if (answer.kind === "ready") {
          setView({ kind: "ready", status: answer.status });
          return;
        }
        showPending();
        if (answer.kind === "stop" || Date.now() + POLL_EVERY_MS > deadline) return;
        await new Promise((r) => setTimeout(r, POLL_EVERY_MS));
        if (cancelled) return;
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(slow);
    };
  }, []);

  const wrap = "max-w-xl mx-auto px-5 py-12";
  const h1 = "font-display text-3xl md:text-4xl leading-tight";
  const p = "font-body text-base leading-relaxed mt-4";

  if (view.kind === "checking") {
    return <section className={wrap} aria-busy="true" style={{ minHeight: "16rem" }} data-online-year-thank-you="checking" />;
  }

  if (view.kind === "pending") {
    return (
      <section className={wrap} data-online-year-thank-you="pending">
        <h1 className={h1} style={BARK}>{OY_APPROVED_THANK_YOU.pendingHeading}</h1>
        <p className={p} style={BARK}>{OY_APPROVED_THANK_YOU.pendingBody}</p>
        <p className={p} style={BARK}><WithHelpLink line={OY_APPROVED_THANK_YOU.pendingHelp} /></p>
      </section>
    );
  }

  const { band, children } = view.status;
  return (
    <section className={wrap} data-online-year-thank-you="ready" data-band={band}>
      <h1 className={h1} style={BARK}>{onlineYearReadyHeading(band)}</h1>
      <p className={p} style={BARK}>{onlineYearYearSentences(children).join(" ")}</p>
      <a
        href={ONLINE_YEAR_SIGNIN_PATH}
        className="mt-6 inline-block w-full text-center rounded-md px-5 py-3 font-body font-semibold"
        style={{ backgroundColor: "hsl(var(--eden-forest))", color: "white" }}
      >
        {onlineYearOpenButton(band)}
      </a>
      <p className={p} style={BARK}>{onlineYearStartWeek1(children)}</p>
      <p className={p} style={BARK}>{OY_APPROVED_THANK_YOU.signIn}</p>
      <p className={p} style={BARK}>{OY_APPROVED_THANK_YOU.emailSent}</p>
      <p className={p} style={BARK}><WithHelpLink line={OY_APPROVED_THANK_YOU.help} /></p>
    </section>
  );
}
