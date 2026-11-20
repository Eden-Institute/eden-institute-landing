// Fearfully & Wonderfully Wired, W9: /wired/delete, "Delete my quiz data" (spec 7.6, answers 10, 32).
//   No ?c=: ask for the confirm email. With her results token on this device, one button; otherwise her
//            email address (the footer link in every learner email lands here). The answer never says
//            whether an address took the quiz.
//   ?c=<signed delete link from the confirm email>: stripped from the address bar at once, then one button
//            deletes everything (wired-delete confirm).
// Private page (noThirdPartyTags, noindex). Copy: web/lib/wiredCopyW9.ts. client:only.

import { useEffect, useState } from "react";
import { deleteData, RESULTS_KEY, savedResultsToken, WiredDark, writeStore } from "../../lib/wiredApi";
import { W9 } from "../../lib/wiredCopyW9";

const btn = "inline-flex items-center justify-center font-accent text-sm tracking-[0.2em] uppercase font-bold px-6 py-3 rounded-md";
const forest = { backgroundColor: "hsl(var(--eden-forest))", color: "hsl(var(--eden-cream))" };

function takeConfirm(): string | null {
  try {
    const url = new URL(window.location.href);
    const c = url.searchParams.get("c");
    if (!c) return null;
    url.searchParams.delete("c");
    window.history.replaceState(null, "", url.pathname + (url.search ? url.search : "") + url.hash);
    return c;
  } catch { return null; }
}

export default function WiredDelete() {
  const [confirmTok, setConfirmTok] = useState<string | null>(null);
  const [results, setResults] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"ask" | "sent" | "confirm" | "done" | "expired" | "dark">("ask");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const c = takeConfirm();
    if (c) { setConfirmTok(c); setState("confirm"); }
    setResults(savedResultsToken());
  }, []);

  async function request() {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      const { status } = await deleteData(results ? { action: "request", token: results } : { action: "request", email: email.trim() });
      if (status === 200) setState("sent");
      else if (status === 401) { setResults(null); setErr(W9.tryAgain); }
      else setErr(W9.tryAgain);
    } catch (e) { if (e instanceof WiredDark) setState("dark"); else setErr(W9.tryAgain); }
    setBusy(false);
  }
  async function confirm() {
    if (busy || !confirmTok) return;
    setBusy(true); setErr(null);
    try {
      const { status } = await deleteData({ action: "confirm", token: confirmTok });
      if (status === 200) { writeStore(RESULTS_KEY, null); setState("done"); }
      else if (status === 401) setState("expired");
      else setErr(W9.tryAgain);
    } catch (e) { if (e instanceof WiredDark) setState("dark"); else setErr(W9.tryAgain); }
    setBusy(false);
  }

  const card = (c: React.ReactNode) => <div className="max-w-xl mx-auto px-4 py-8 font-body" style={{ color: "hsl(var(--eden-bark))" }}>{c}</div>;
  if (state === "dark") return card(<p>This page isn't open yet.</p>);
  if (state === "done") return card(<p className="text-lg">{W9.deleteDone}</p>);
  if (state === "sent") return card(<p>{W9.deleteSent}</p>);
  if (state === "confirm") {
    return card(<>
      <h1 className="font-display text-3xl mb-4">{W9.deleteHeading}</h1>
      <p className="mb-6">{W9.deleteConfirmBody}</p>
      <button type="button" className={btn} style={forest} disabled={busy} onClick={confirm}>{W9.deleteConfirmButton}</button>
      {err && <p className="text-sm mt-3" role="alert">{err}</p>}
    </>);
  }
  return card(<>
    <h1 className="font-display text-3xl mb-4">{W9.deleteHeading}</h1>
    {state === "expired" && <p className="mb-4">{W9.deleteExpired}</p>}
    <p className="mb-6">{W9.deleteBody}</p>
    {!results && (
      <label className="block text-sm mb-4">{W9.deleteEmailLabel}
        <input type="email" className="w-full rounded-md border px-3 py-3 text-base bg-background mt-1" style={{ borderColor: "hsl(var(--eden-gold) / 0.5)" }}
          autoComplete="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
    )}
    <button type="button" className={btn} style={forest} disabled={busy || (!results && !email.trim())} onClick={request}>{W9.deleteSend}</button>
    {err && <p className="text-sm mt-3" role="alert">{err}</p>}
  </>);
}
