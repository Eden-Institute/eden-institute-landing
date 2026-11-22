// Fearfully & Wonderfully Wired, W9: /wired/teen and /wired/observer (spec 7.3, 7.4, answers 11, 12, 23).
// The private link arrives as ?c=<code>; it is moved to sessionStorage and STRIPPED from the address bar at
// once (answer 12). The page asks for no name or email (teen: DECIDED 11/17), loads no analytics or pixels
// (the .astro page sets noThirdPartyTags), and sends the answers only to wired-rater, which scores them on
// the server. Teen: the approved intro screen + the teen-v1 set. Observer: the child's own band set.
// Copy: web/lib/wiredCopyW9.ts + the bank's own approved text. client:only.

import { useEffect, useState } from "react";
import { getBank, rater, raterPass, WiredDark, wiredIsDark } from "../../lib/wiredApi";
import WiredNotOpen from "./WiredNotOpen";
import { W9, w9fill } from "../../lib/wiredCopyW9";

interface PublicBank {
  version: string;
  instructions: string;
  frequency_stem: string;
  scale: { points: number; labels: string[] };
  scenarios: { id: string; prompt: string; options: { id: string; text: string }[] }[];
  frequency: { id: string; text: string }[];
}
type Step = "loading" | "intro" | "scenario" | "frequency" | "saving" | "done" | "dark" | "error" | "used" | "expired" | "bad" | "nomom";

const btn = "inline-flex items-center justify-center font-accent text-sm tracking-[0.2em] uppercase font-bold px-6 py-3 rounded-md transition-opacity hover:opacity-90";
const forest = { backgroundColor: "hsl(var(--eden-forest))", color: "hsl(var(--eden-cream))" };
const choice = "w-full text-left font-body text-base rounded-md border px-4 py-3 mt-3 transition-colors";
const choiceStyle = (on: boolean) => ({ borderColor: "hsl(var(--eden-gold) / 0.6)", backgroundColor: on ? "hsl(var(--eden-cream))" : "transparent" });

function takeCode(kind: string): string | null {
  const key = `eden_wired_${kind}_code`;
  try {
    const url = new URL(window.location.href);
    const c = url.searchParams.get("c");
    if (c) {
      try { window.sessionStorage.setItem(key, c); } catch { /* memory only */ }
      url.searchParams.delete("c");
      window.history.replaceState(null, "", url.pathname + (url.search ? url.search : "") + url.hash);
      return c;
    }
  } catch { /* fall through */ }
  try { return window.sessionStorage.getItem(key); } catch { return null; }
}

export default function WiredRater({ kind }: { kind: "teen" | "observer" }) {
  const [step, setStep] = useState<Step>("loading");
  const [code, setCode] = useState<string | null>(null);
  const [ctx, setCtx] = useState<{ nickname: string; mom: string } | null>(null);
  const [bank, setBank] = useState<PublicBank | null>(null);
  const [i, setI] = useState(0);
  const [scenarios, setScenarios] = useState<Record<string, string>>({});
  const [frequency, setFrequency] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  const linkProblem = (e?: string): Step => (e === "used" ? "used" : e === "expired" ? "expired" : e === "no_mom_quiz" ? "nomom" : "bad");

  useEffect(() => {
    const c = takeCode(kind);
    setCode(c);
    if (!c) { void wiredIsDark().then((dark) => setStep(dark ? "dark" : "bad")); return; }
    (async () => {
      try {
        const { status, data } = await rater({ kind, code: c, action: "context" });
        if (status !== 200 || !data.set_kind) return setStep(linkProblem(data.error));
        setCtx({ nickname: data.nickname ?? "", mom: data.mom ?? "" });
        const b = await getBank(data.set_kind, raterPass(kind, c));
        if (b.status !== 200) return setStep("error");
        setBank(b.data as unknown as PublicBank);
        setStep("intro");
      } catch (err) {
        setStep(err instanceof WiredDark ? "dark" : "error");
      }
    })();
  }, [kind]);

  async function submit(freq: Record<string, number>) {
    if (!bank || !code) return;
    setStep("saving");
    setError(null);
    try {
      const { status, data } = await rater({ kind, code, action: "submit", bank_version: bank.version, answers: { scenarios, frequency: freq } });
      if (status === 200) {
        try { window.sessionStorage.removeItem(`eden_wired_${kind}_code`); } catch { /* nothing kept */ }
        return setStep("done");
      }
      if (status === 404 || status === 410 || status === 409) return setStep(linkProblem(data.error));
      setError(W9.tryAgain);
      setStep("frequency");
    } catch (err) {
      if (err instanceof WiredDark) return setStep("dark");
      setError(W9.tryAgain);
      setStep("frequency");
    }
  }

  const v = { name: ctx?.nickname ?? "", mom: ctx?.mom ?? "" };
  const card = (c: React.ReactNode) => <div className="max-w-xl mx-auto px-4 py-8 font-body" style={{ color: "hsl(var(--eden-bark))" }}>{c}</div>;
  const progress = (n: number, of: number) => <p className="font-body text-xs text-muted-foreground mb-2">{n} of {of}</p>;

  if (step === "loading" || step === "saving") return card(<p>Loading...</p>);
  if (step === "dark") return <WiredNotOpen />;
  if (step === "used") return card(<p>{W9.linkUsed}</p>);
  if (step === "expired") return card(<p>{W9.linkExpired}</p>);
  if (step === "nomom") return card(<p>{W9.linkNoMom}</p>);
  if (step === "bad") return card(<p>{W9.linkBad}</p>);
  if (step === "error" || !bank) return card(<p>{W9.tryAgain}</p>);
  if (step === "done") return card(<p className="text-lg">{kind === "teen" ? W9.thanksTeen : w9fill(W9.thanksObserver, v)}</p>);

  if (step === "intro") {
    return card(<>
      <p className="mb-4">{kind === "teen" ? W9.teenIntro : w9fill(W9.obsIntro, v)}</p>
      <p className="mb-6">{bank.instructions}</p>
      <button type="button" className={btn} style={forest} onClick={() => { setI(0); setStep("scenario"); }}>{W9.start}</button>
    </>);
  }

  if (step === "scenario") {
    const s = bank.scenarios[i];
    return card(<>
      {progress(i + 1, bank.scenarios.length)}
      <h2 className="font-display text-xl">{s.prompt}</h2>
      {s.options.map((o) => (
        <button key={o.id} type="button" className={choice} style={choiceStyle(scenarios[s.id] === o.id)}
          onClick={() => {
            setScenarios({ ...scenarios, [s.id]: o.id });
            if (i + 1 < bank.scenarios.length) setI(i + 1);
            else { setI(0); setStep("frequency"); }
          }}>{o.text}</button>
      ))}
      {i > 0 && <button type="button" className="text-sm underline mt-4" onClick={() => setI(i - 1)}>Back</button>}
    </>);
  }

  const f = bank.frequency[i];
  return card(<>
    {progress(i + 1, bank.frequency.length)}
    <p className="text-sm mb-1">{bank.frequency_stem}</p>
    <h2 className="font-display text-xl">{f.text}</h2>
    {bank.scale.labels.map((label, k) => (
      <button key={label} type="button" className={choice} style={choiceStyle(frequency[f.id] === k + 1)}
        onClick={() => {
          const next = { ...frequency, [f.id]: k + 1 };
          setFrequency(next);
          if (i + 1 < bank.frequency.length) setI(i + 1);
          else submit(next);
        }}>{label}</button>
    ))}
    {error && <p className="text-sm mt-3" role="alert">{error}</p>}
    {i > 0 && <button type="button" className="text-sm underline mt-4" onClick={() => setI(i - 1)}>Back</button>}
  </>);
}
