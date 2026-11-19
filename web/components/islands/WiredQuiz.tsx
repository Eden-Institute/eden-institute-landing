// Fearfully & Wonderfully Wired: the quiz itself on /wired (W4; spec 7.1).
// welcome -> child (nickname + grade) -> 12 moments -> 9 how-often items -> 6 family questions
// -> ranking (tap in order, skippable) -> email -> wired-submit -> /wired/results.
//
// Rules kept: questions come from wired-bank with no scoring keys; scoring happens on the server
// only; no child data goes to analytics (rule 7: the only event is "wired_start", with no child
// detail); answers stay in memory until submit; if saving fails the page says so (approved line).
// Copy: web/lib/wiredCopy.ts (approved, word for word, incl. the welcome screen and child step
// approved 2026-11-19 2:19 PM CT) + the bank's own approved text.
// client:only (reads localStorage and the address bar).

import { useEffect, useMemo, useState } from "react";
import { trackCta } from "@/lib/trackCta";
import { getBank, submitQuiz, WiredDark, writeStore, RESULTS_KEY } from "../../lib/wiredApi";
import { FAMILY_INTRO, FAMILY_QUESTIONS, RANKING, RESULTS, SCREENS, fill } from "../../lib/wiredCopy";

type Step = "checking" | "welcome" | "child" | "scenario" | "frequency" | "family" | "ranking" | "email" | "saving" | "saved_later" | "dark" | "error";

interface PublicBank {
  version: string;
  instructions: string;
  frequency_stem: string;
  scale: { points: number; labels: string[] };
  scenarios: { id: string; prompt: string; options: { id: string; text: string }[] }[];
  frequency: { id: string; text: string }[];
}

const GRADES: [number, string][] = [[0, "K"], ...Array.from({ length: 12 }, (_, i) => [i + 1, String(i + 1)] as [number, string])];
const setForGrade = (g: number) => (g <= 2 ? "k2" : g <= 5 ? "g3_5" : g <= 8 ? "g6_8" : "g9_12");

const btn = "inline-flex items-center justify-center font-accent text-sm tracking-[0.2em] uppercase font-bold px-6 py-3 rounded-md transition-opacity hover:opacity-90";
const forest = { backgroundColor: "hsl(var(--eden-forest))", color: "hsl(var(--eden-cream))" };
const choice = "w-full text-left font-body text-base rounded-md border px-4 py-3 mt-3 transition-colors";
const choiceStyle = (on: boolean) => ({ borderColor: "hsl(var(--eden-gold) / 0.6)", backgroundColor: on ? "hsl(var(--eden-cream))" : "transparent" });

function attribution(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const q = new URLSearchParams(window.location.search);
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
      const v = q.get(k);
      if (v) out[k] = v.slice(0, 100);
    }
    const p = q.get("p");
    if (p) out.placement = p.slice(0, 100);
    out.landing_path = window.location.pathname;
  } catch {
    /* no attribution */
  }
  return out;
}

export default function WiredQuiz() {
  const [step, setStep] = useState<Step>("checking");
  const [nickname, setNickname] = useState("");
  const [grade, setGrade] = useState<number | null>(null);
  const [bank, setBank] = useState<PublicBank | null>(null);
  const [i, setI] = useState(0);
  const [scenarios, setScenarios] = useState<Record<string, string>>({});
  const [frequency, setFrequency] = useState<Record<string, number>>({});
  const [family, setFamily] = useState<Record<string, string>>({});
  const [ranking, setRanking] = useState<string[]>([]);
  const [skippedRanking, setSkippedRanking] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const name = nickname.trim() || "your child";
  const oneChild = family.kids === "1";
  const rankOptions = useMemo(() => RANKING.options.filter(([code]) => !(oneChild && code === "siblings")), [oneChild]);

  // Dark until launch: a visitor who reaches /wired before it opens sees one plain line, not the
  // welcome screen. One light request (the K-2 questions, cached 5 minutes by wired-bank).
  useEffect(() => {
    getBank("k2")
      .then(() => setStep("welcome"))
      .catch((err) => setStep(err instanceof WiredDark ? "dark" : "welcome"));
  }, []);

  async function start() {
    trackCta("wired_start");
    setStep("child");
  }

  async function loadQuestions() {
    if (grade === null || !nickname.trim()) return;
    setError(null);
    try {
      const { status, data } = await getBank(setForGrade(grade));
      if (status !== 200) throw new Error("bank");
      setBank(data as unknown as PublicBank);
      setI(0);
      setStep("scenario");
    } catch (err) {
      if (err instanceof WiredDark) setStep("dark");
      else setError("We could not load the questions. Please check your connection and try again.");
    }
  }

  async function submit() {
    if (!bank) return;
    setStep("saving");
    setError(null);
    const rank = skippedRanking || ranking.length < rankOptions.length ? null : ranking;
    try {
      const { status, data } = await submitQuiz({
        email: email.trim(),
        first_name: firstName.trim() || null,
        child: { nickname: nickname.trim(), grade },
        bank_version: bank.version,
        answers: { scenarios, frequency },
        family_answers: family,
        ranking: rank,
        attribution: attribution(),
      });
      const token = (data as { token?: string }).token;
      if ((status === 200 || status === 409) && token) {
        writeStore(RESULTS_KEY, token);
        window.location.assign("/wired/results");
        return;
      }
      if (status === 502) return setStep("saved_later");
      if (status === 429) {
        setError((data as { message?: string }).message ?? "Please try again a little later.");
        return setStep("email");
      }
      if (status === 400) {
        setError("Please check your email address and try again.");
        return setStep("email");
      }
      throw new Error(String(status));
    } catch (err) {
      if (err instanceof WiredDark) return setStep("dark");
      setError("We could not save your answers. Please check your connection and press the button again.");
      setStep("email");
    }
  }

  const card = (children: React.ReactNode) => (
    <div className="max-w-xl mx-auto px-4 py-8 font-body" style={{ color: "hsl(var(--eden-bark))" }}>{children}</div>
  );
  const progress = (n: number, of: number) => <p className="font-body text-xs text-muted-foreground mb-2">{n} of {of}</p>;

  if (step === "checking") return card(<p className="font-body text-base">Loading...</p>);
  if (step === "dark") return card(<p className="font-body text-base">This page isn't open yet.</p>);
  if (step === "saved_later") return card(<p className="font-body text-base">{RESULTS.savingFailed}</p>);

  if (step === "welcome") {
    return card(<>
      <h1 className="font-display text-3xl mb-3">{SCREENS.welcomeTitle}</h1>
      <p className="italic mb-4">{SCREENS.welcomeVerse}</p>
      <p className="mb-3">{SCREENS.welcomeBody}</p>
      <p className="mb-6">{SCREENS.welcomeNote}</p>
      <button type="button" className={btn} style={forest} onClick={start}>{SCREENS.welcomeButton}</button>
      <p className="text-xs text-muted-foreground mt-3">{SCREENS.welcomeSmall}</p>
    </>);
  }

  if (step === "child") {
    return card(<>
      <h1 className="font-display text-2xl mb-4">{SCREENS.childHeading}</h1>
      <label className="block text-sm mb-1" htmlFor="wired-nick">{SCREENS.nicknameLabel}</label>
      <input id="wired-nick" className="w-full rounded-md border px-3 py-3 text-base bg-background" maxLength={40} autoComplete="off"
        value={nickname} onChange={(e) => setNickname(e.target.value)} style={{ borderColor: "hsl(var(--eden-gold) / 0.5)" }} />
      <label className="block text-sm mt-4 mb-1" htmlFor="wired-grade">{SCREENS.gradeLabel}</label>
      <p className="text-xs text-muted-foreground mb-1">{SCREENS.gradeHelper}</p>
      <select id="wired-grade" className="w-full rounded-md border px-3 py-3 text-base bg-background" value={grade ?? ""}
        onChange={(e) => setGrade(e.target.value === "" ? null : Number(e.target.value))} style={{ borderColor: "hsl(var(--eden-gold) / 0.5)" }}>
        <option value="">Choose a grade</option>
        {GRADES.map(([g, label]) => <option key={g} value={g}>{label}</option>)}
      </select>
      {error && <p className="text-sm mt-3" role="alert" style={{ color: "hsl(var(--destructive))" }}>{error}</p>}
      <button type="button" className={`${btn} mt-6`} style={forest} onClick={loadQuestions}>{SCREENS.next}</button>
    </>);
  }

  if (step === "scenario" && bank) {
    const s = bank.scenarios[i];
    return card(<>
      {i === 0 && <h2 className="font-display text-lg mb-2">{SCREENS.part1}</h2>}
      {i === 0 && <p className="mb-4">{bank.instructions}</p>}
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

  if (step === "frequency" && bank) {
    const f = bank.frequency[i];
    return card(<>
      {i === 0 && <h2 className="font-display text-lg mb-2">{SCREENS.part2}</h2>}
      {progress(i + 1, bank.frequency.length)}
      <p className="text-sm mb-1">{bank.frequency_stem}</p>
      <h2 className="font-display text-xl">{f.text}</h2>
      {bank.scale.labels.map((label, k) => (
        <button key={label} type="button" className={choice} style={choiceStyle(frequency[f.id] === k + 1)}
          onClick={() => {
            setFrequency({ ...frequency, [f.id]: k + 1 });
            if (i + 1 < bank.frequency.length) setI(i + 1);
            else { setI(0); setStep("family"); }
          }}>{label}</button>
      ))}
      <button type="button" className="text-sm underline mt-4" onClick={() => (i > 0 ? setI(i - 1) : (setI(bank.scenarios.length - 1), setStep("scenario")))}>Back</button>
    </>);
  }

  if (step === "family") {
    const q = FAMILY_QUESTIONS[i];
    return card(<>
      {i === 0 && <h2 className="font-display text-lg mb-2">{SCREENS.part3}</h2>}
      {i === 0 && <p className="mb-4">{FAMILY_INTRO}</p>}
      {progress(i + 1, FAMILY_QUESTIONS.length)}
      <h2 className="font-display text-xl">{q.question}</h2>
      {q.helper && <p className="text-sm text-muted-foreground mt-1">{q.helper}</p>}
      {q.options.map(([code, label]) => (
        <button key={code} type="button" className={choice} style={choiceStyle(family[q.key] === code)}
          onClick={() => {
            setFamily({ ...family, [q.key]: code });
            if (i + 1 < FAMILY_QUESTIONS.length) setI(i + 1);
            else setStep("ranking");
          }}>{label}</button>
      ))}
      <button type="button" className="text-sm underline mt-4" onClick={() => (i > 0 ? setI(i - 1) : (bank && setI(bank.frequency.length - 1), setStep("frequency")))}>Back</button>
    </>);
  }

  if (step === "ranking") {
    const done = ranking.length === rankOptions.length;
    return card(<>
      <h2 className="font-display text-xl">{RANKING.title}</h2>
      <p className="mt-1">{fill(RANKING.body, { name })}</p>
      {rankOptions.map(([code, label]) => {
        const pos = ranking.indexOf(code);
        return (
          <button key={code} type="button" className={choice} style={choiceStyle(pos >= 0)} disabled={pos >= 0}
            onClick={() => setRanking([...ranking, code])}>
            {pos >= 0 ? `${pos + 1}. ` : ""}{fill(label, { name })}
          </button>
        );
      })}
      {done && <p className="text-sm mt-3">{RANKING.after}</p>}
      <div className="flex flex-wrap gap-3 mt-5">
        {done && <button type="button" className={btn} style={forest} onClick={() => { setSkippedRanking(false); setStep("email"); }}>{SCREENS.next}</button>}
        <button type="button" className="text-sm underline" onClick={() => setRanking([])}>{RANKING.startOver}</button>
        <button type="button" className="text-sm underline" onClick={() => { setSkippedRanking(true); setRanking([]); setStep("email"); }}>{RANKING.skip}</button>
      </div>
      {!done && <p className="text-xs text-muted-foreground mt-3">{fill(RANKING.skipNote, { name })}</p>}
    </>);
  }

  if (step === "email" || step === "saving") {
    return card(<>
      <h2 className="font-display text-xl mb-2">{fill(SCREENS.beforeEmail, { name })}</h2>
      <p className="mb-4">{RESULTS.emailStep}</p>
      <label className="block text-sm mb-1" htmlFor="wired-email">{RESULTS.emailLabel}</label>
      <input id="wired-email" type="email" inputMode="email" autoComplete="email" className="w-full rounded-md border px-3 py-3 text-base bg-background"
        value={email} onChange={(e) => setEmail(e.target.value)} style={{ borderColor: "hsl(var(--eden-gold) / 0.5)" }} />
      <label className="block text-sm mt-4 mb-1" htmlFor="wired-first">{RESULTS.firstNameLabel}</label>
      <input id="wired-first" autoComplete="given-name" className="w-full rounded-md border px-3 py-3 text-base bg-background" maxLength={60}
        value={firstName} onChange={(e) => setFirstName(e.target.value)} style={{ borderColor: "hsl(var(--eden-gold) / 0.5)" }} />
      <p className="text-xs text-muted-foreground mt-3">{fill(RESULTS.privacyShort, { name })}</p>
      {error && <p className="text-sm mt-3" role="alert" style={{ color: "hsl(var(--destructive))" }}>{error}</p>}
      <button type="button" className={`${btn} mt-6 ${step === "saving" ? "opacity-60 cursor-wait" : ""}`} style={forest}
        disabled={step === "saving"} onClick={submit}>{step === "saving" ? "Saving..." : RESULTS.emailButton}</button>
    </>);
  }

  return card(<p>Something went wrong. Please reload the page.</p>);
}
