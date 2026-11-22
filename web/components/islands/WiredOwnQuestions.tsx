// Fearfully & Wonderfully Wired: the "Your own questions" box on her private results page (2026-11-21, Camila's
// tap "Build it, as written"). Shown by WiredResults to a family with a Family Map (paid or pilot) whose mom has not
// answered her own set this quiz year (wired-results: has_family_map, own_questions_answered).
//
// The box: the approved heading, line and button (web/lib/wiredCopy.ts OWN_QUESTIONS). The button runs the approved
// adult-v1 screens with their own approved instructions, all from the bank (wired-bank?set=adult, no scoring keys):
// Part A = the 12 moments + the 9 how-often items, Part B = the 12 teaching-style lines on the 5 labelled points.
// Answers stay in memory and go only to wired-submit as {set: 'adult', token}: the server reads her email from her
// results token (the page never holds it), scores everything, and queues the complete Family Map once. Then the
// approved done line. No analytics event carries any answer.

import { useState } from "react";
import { getBank, submitQuiz } from "../../lib/wiredApi";
import { OWN_QUESTIONS } from "../../lib/wiredCopy";
import { W9 } from "../../lib/wiredCopyW9";

export interface AdultBank {
  version: string;
  instructions: string;
  frequency_stem: string;
  scale: { points: number; labels: string[] };
  scenarios: { id: string; prompt: string; options: { id: string; text: string }[] }[];
  frequency: { id: string; text: string }[];
  teaching_style?: {
    instructions: string;
    scale: { points: number; labels: string[] };
    items: { id: string; stem: string; left: string; right: string }[];
  };
}
type Step = "box" | "loading" | "scenario" | "frequency" | "teaching" | "saving" | "done";

const btn = "inline-flex items-center justify-center font-accent text-sm tracking-[0.2em] uppercase font-bold px-6 py-3 rounded-md";
const forest = { backgroundColor: "hsl(var(--eden-forest))", color: "hsl(var(--eden-cream))" };
const choice = "w-full text-left font-body text-base rounded-md border px-4 py-3 mt-3 transition-colors";
const choiceStyle = (on: boolean) => ({ borderColor: "hsl(var(--eden-gold) / 0.6)", backgroundColor: on ? "hsl(var(--eden-cream))" : "hsl(var(--background))" });

export default function WiredOwnQuestions({ token }: { token: string }) {
  const [step, setStep] = useState<Step>("box");
  const [bank, setBank] = useState<AdultBank | null>(null);
  const [i, setI] = useState(0);
  const [scenarios, setScenarios] = useState<Record<string, string>>({});
  const [frequency, setFrequency] = useState<Record<string, number>>({});
  const [teaching, setTeaching] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    setStep("loading");
    try {
      const { status, data } = await getBank("adult");
      const b = data as unknown as AdultBank;
      if (status !== 200 || !b.teaching_style?.items?.length) throw new Error("bank");
      setBank(b);
      setI(0);
      setStep("scenario");
    } catch {
      setError(W9.tryAgain);
      setStep("box");
    }
  }

  async function submit(t: Record<string, number>) {
    if (!bank) return;
    setStep("saving");
    setError(null);
    try {
      const { status, data } = await submitQuiz({ set: "adult", token, bank_version: bank.version, answers: { scenarios, frequency, teaching: t } });
      const d = data as { saved?: boolean; message?: string };
      // 409 = her answers for this year are already in (a second tab); 502 + saved = kept and finished by the replay.
      if (status === 200 || status === 409 || (status === 502 && d.saved === true)) return setStep("done");
      setError(status === 429 && d.message ? d.message : W9.tryAgain);
    } catch {
      setError(W9.tryAgain);
    }
    setStep("teaching");
  }

  const box = (c: React.ReactNode) => (
    <section id="own-questions" className="mb-8 rounded-md p-5" style={{ backgroundColor: "hsl(var(--eden-cream))" }} aria-live="polite">{c}</section>
  );
  const total = bank ? bank.scenarios.length + bank.frequency.length + (bank.teaching_style?.items.length ?? 0) : 0;
  const progress = (n: number) => <p className="font-body text-xs text-muted-foreground mb-2">{n} of {total}</p>;
  const back = (onClick: () => void) => <button type="button" className="text-sm underline mt-4" onClick={onClick}>Back</button>;

  if (step === "done") return box(<p className="text-base font-semibold" role="status">{OWN_QUESTIONS.done}</p>);
  if (step === "box" || step === "loading" || !bank) {
    return box(<>
      <h2 className="font-display text-2xl">{OWN_QUESTIONS.heading}</h2>
      <p className="mt-2">{OWN_QUESTIONS.line}</p>
      <button type="button" className={`${btn} mt-4`} style={forest} disabled={step === "loading"} onClick={start}>{OWN_QUESTIONS.button}</button>
      {error && <p className="text-sm mt-3" role="alert">{error}</p>}
    </>);
  }

  if (step === "scenario") {
    const s = bank.scenarios[i];
    return box(<>
      {i === 0 && <p className="mb-4">{bank.instructions}</p>}
      {progress(i + 1)}
      <h3 className="font-display text-xl">{s.prompt}</h3>
      {s.options.map((o) => (
        <button key={o.id} type="button" className={choice} style={choiceStyle(scenarios[s.id] === o.id)}
          onClick={() => {
            setScenarios({ ...scenarios, [s.id]: o.id });
            if (i + 1 < bank.scenarios.length) setI(i + 1);
            else { setI(0); setStep("frequency"); }
          }}>{o.text}</button>
      ))}
      {i > 0 && back(() => setI(i - 1))}
    </>);
  }

  if (step === "frequency") {
    const f = bank.frequency[i];
    return box(<>
      {progress(bank.scenarios.length + i + 1)}
      <p className="text-sm mb-1">{bank.frequency_stem}</p>
      <h3 className="font-display text-xl">{f.text}</h3>
      {bank.scale.labels.map((label, k) => (
        <button key={label} type="button" className={choice} style={choiceStyle(frequency[f.id] === k + 1)}
          onClick={() => {
            setFrequency({ ...frequency, [f.id]: k + 1 });
            if (i + 1 < bank.frequency.length) setI(i + 1);
            else { setI(0); setStep("teaching"); }
          }}>{label}</button>
      ))}
      {back(() => (i > 0 ? setI(i - 1) : (setI(bank.scenarios.length - 1), setStep("scenario"))))}
    </>);
  }

  // Part B: two ends, five labelled points (left to right).
  const ts = bank.teaching_style!;
  const t = ts.items[i];
  const saving = step === "saving";
  return box(<>
    {i === 0 && <p className="mb-4">{ts.instructions}</p>}
    {progress(bank.scenarios.length + bank.frequency.length + i + 1)}
    <h3 className="font-display text-xl">{t.stem}</h3>
    <div className="flex justify-between gap-4 mt-3 text-sm font-semibold">
      <span>{t.left}</span>
      <span className="text-right">{t.right}</span>
    </div>
    <div className="grid grid-cols-5 gap-1.5 mt-2" role="group" aria-label={t.stem}>
      {ts.scale.labels.map((label, k) => (
        <button key={label} type="button" disabled={saving} className="rounded-md border px-1 py-2 font-body text-[11px] leading-tight sm:text-xs"
          style={choiceStyle(teaching[t.id] === k + 1)}
          onClick={() => {
            const next = { ...teaching, [t.id]: k + 1 };
            setTeaching(next);
            if (i + 1 < ts.items.length) setI(i + 1);
            else void submit(next);
          }}>{label}</button>
      ))}
    </div>
    {saving && <p className="text-sm mt-3">Saving...</p>}
    {error && <p className="text-sm mt-3" role="alert">{error}</p>}
    {!saving && back(() => (i > 0 ? setI(i - 1) : (setI(bank.frequency.length - 1), setStep("frequency"))))}
  </>);
}
