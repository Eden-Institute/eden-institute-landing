// Fearfully & Wonderfully Wired, W12: /wired/pilot (spec section 13, answer 33). DARK: wired-pilot answers
// pilot_closed until Camila approves the pilot launch (WIRED_PILOT_OPEN), so a visitor sees one plain line.
//   - A selected tester (her results token on this device): her ladder, the next survey, the 30-day retake.
//   - Everyone else: the approved application.
// Copy: web/lib/wiredPilotCopy.ts (approved, word for word) + the quiz's approved approach list and bank text.
// No child data reaches analytics: the page sends answers only to wired-pilot. client:only.

import { useEffect, useMemo, useState } from "react";
import { getBank, pilot, savedResultsToken, WiredDark } from "../../lib/wiredApi";
import { FAMILY_QUESTIONS } from "../../lib/wiredCopy";
import { PILOT, pilotThanks, SURVEYS, type Q } from "../../lib/wiredPilotCopy";
import { WIRING_WRITEUPS } from "../../lib/wiredWriteups";

const STATES = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");
const GRADES: [number, string][] = [[0, "K"], ...Array.from({ length: 12 }, (_, i) => [i + 1, String(i + 1)] as [number, string])];
const setForGrade = (g: number) => (g <= 2 ? "k2" : g <= 5 ? "g3_5" : g <= 8 ? "g6_8" : "g9_12");
const btn = "inline-flex items-center justify-center font-accent text-sm tracking-[0.2em] uppercase font-bold px-6 py-3 rounded-md";
const forest = { backgroundColor: "hsl(var(--eden-forest))", color: "hsl(var(--eden-cream))" };
const field = "w-full rounded-md border px-3 py-3 text-base bg-background mt-1";
const fs = { borderColor: "hsl(var(--eden-gold) / 0.5)" };
const choice = "w-full text-left font-body text-base rounded-md border px-4 py-3 mt-3";
const choiceStyle = (on: boolean) => ({ borderColor: "hsl(var(--eden-gold) / 0.6)", backgroundColor: on ? "hsl(var(--eden-cream))" : "transparent" });
const APPROACH = FAMILY_QUESTIONS.find((q) => q.key === "approach")!;

interface Status { selected: boolean; child?: { id: string; nickname: string; grade: number } | null; next?: string; opens_at?: string | null; retake_needed?: boolean }
interface PublicBank { version: string; instructions: string; frequency_stem: string; scale: { labels: string[] }; scenarios: { id: string; prompt: string; options: { id: string; text: string }[] }[]; frequency: { id: string; text: string }[] }

function Apply() {
  const [f, setF] = useState<Record<string, string>>({ kids: "1" });
  const [kids, setKids] = useState<{ nickname: string; grade: string }[]>([{ nickname: "", grade: "" }]);
  const [commit, setCommit] = useState(false);
  const [state, setState] = useState<"form" | "sending" | "done">("form");
  const [err, setErr] = useState<string | null>(null);
  const n = f.kids === "5plus" ? 5 : Number(f.kids || 1);
  useEffect(() => setKids((k) => Array.from({ length: n }, (_, i) => k[i] ?? { nickname: "", grade: "" })), [n]);
  const set = (k: string, v: string) => setF({ ...f, [k]: v });

  async function send() {
    setErr(null); setState("sending");
    try {
      const attribution: Record<string, string> = {};
      try { const q = new URLSearchParams(window.location.search); for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content"]) { const v = q.get(k); if (v) attribution[k] = v.slice(0, 100); } } catch { /* none */ }
      const { status, data } = await pilot({
        action: "apply", email: f.email, first_name: f.first_name, state: f.state, years: f.years, kids: f.kids, approach: f.approach, heard: f.heard,
        children: kids.map((k) => ({ nickname: k.nickname, grade: Number(k.grade) })), commitment: commit, attribution,
      });
      if (status === 200) return setState("done");
      setErr(status === 400 ? "Please check the highlighted answers and try again." : status === 429 ? "Please try again a little later." : "We could not send your application. Please try again.");
      void data;
    } catch (e) {
      setErr(e instanceof WiredDark ? "This page isn't open yet." : "We could not send your application. Please try again.");
    }
    setState("form");
  }

  if (state === "done") return <><p className="text-lg">{pilotThanks()}</p><p className="text-xs mt-3">{PILOT.smallPrint}</p></>;
  const ready = f.first_name && f.email && f.state && f.years && f.kids && f.approach && f.heard && commit && kids.every((k) => k.nickname.trim() && k.grade !== "");
  return (
    <>
      <h1 className="font-display text-3xl mb-4">{PILOT.heading}</h1>
      <p className="mb-3">{PILOT.intro}</p>
      <p className="mb-3">{PILOT.get}</p>
      <p className="mb-3">{PILOT.ask}</p>
      <p className="mb-6">{PILOT.pick}</p>
      <div className="grid gap-4">
        <label className="text-sm">{PILOT.firstName}<input id="p-first" className={field} style={fs} maxLength={60} value={f.first_name ?? ""} onChange={(e) => set("first_name", e.target.value)} /></label>
        <label className="text-sm">{PILOT.email}<input id="p-email" type="email" className={field} style={fs} maxLength={254} value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} /></label>
        <label className="text-sm">{PILOT.state}<select id="p-state" className={field} style={fs} value={f.state ?? ""} onChange={(e) => set("state", e.target.value)}><option value="" />{STATES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
        <label className="text-sm">{PILOT.years.q}<select id="p-years" className={field} style={fs} value={f.years ?? ""} onChange={(e) => set("years", e.target.value)}><option value="" />{PILOT.years.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="text-sm">{PILOT.kids.q}<select id="p-kids" className={field} style={fs} value={f.kids} onChange={(e) => set("kids", e.target.value)}>{PILOT.kids.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <fieldset className="text-sm"><legend>{PILOT.eachChild}</legend>
          {kids.map((k, i) => (
            <div key={i} className="grid grid-cols-[1fr_7rem] gap-3 mt-2">
              <input id={`p-nick-${i}`} aria-label={`Child ${i + 1} nickname`} className={field} style={fs} maxLength={40} value={k.nickname} onChange={(e) => setKids(kids.map((x, j) => (j === i ? { ...x, nickname: e.target.value } : x)))} />
              <select id={`p-grade-${i}`} aria-label={`Child ${i + 1} grade`} className={field} style={fs} value={k.grade} onChange={(e) => setKids(kids.map((x, j) => (j === i ? { ...x, grade: e.target.value } : x)))}><option value="" />{GRADES.map(([g, l]) => <option key={g} value={g}>{l}</option>)}</select>
            </div>
          ))}
        </fieldset>
        <label className="text-sm">{PILOT.approachQ}<select id="p-approach" className={field} style={fs} value={f.approach ?? ""} onChange={(e) => set("approach", e.target.value)}><option value="" />{APPROACH.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="text-sm">{PILOT.heard.q}<select id="p-heard" className={field} style={fs} value={f.heard ?? ""} onChange={(e) => set("heard", e.target.value)}><option value="" />{PILOT.heard.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="flex gap-2 text-sm"><input id="p-commit" type="checkbox" checked={commit} onChange={(e) => setCommit(e.target.checked)} />{PILOT.commitment}</label>
        <div><button type="button" className={btn} style={forest} disabled={!ready || state === "sending"} onClick={send}>{PILOT.button}</button></div>
        {err && <p className="text-sm" role="alert">{err}</p>}
        <p className="text-xs">{PILOT.smallPrint}</p>
      </div>
    </>
  );
}

function SurveyForm({ kind, nickname, top3, onSubmit }: { kind: keyof typeof SURVEYS; nickname: string; top3: string[]; onSubmit: (a: Record<string, unknown>) => Promise<void> }) {
  const s = SURVEYS[kind];
  const [a, setA] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const fill = (t: string, w?: string) => t.replace(/\[Nickname\]/g, nickname).replace(/\[Wiring\]/g, w ?? "");
  const one = (q: Q, opts: string[], key = q.key) => opts.map((o, i) => (
    <button key={o} type="button" className={choice} style={choiceStyle(a[key] === (q.kind === "scale7" ? i + 1 : o))}
      onClick={() => setA({ ...a, [key]: q.kind === "scale7" ? i + 1 : o })}>{o}</button>
  ));
  return (
    <section>
      <h2 className="font-display text-2xl mb-2">{s.title}</h2>
      <p className="text-sm italic mb-3">{PILOT.everySurvey}</p>
      {s.top && <p className="mb-4">{s.top}</p>}
      {s.questions.map((q) => (
        <div key={q.key} className="mt-6">
          {q.kind !== "perWiring" && <p className="font-semibold">{fill(q.label)}</p>}
          {q.kind === "text" && <textarea id={`s-${q.key}`} className={field} style={fs} maxLength={600} value={(a[q.key] as string) ?? ""} onChange={(e) => setA({ ...a, [q.key]: e.target.value })} />}
          {(q.kind === "choice" || q.kind === "scale7") && one(q, q.options)}
          {q.kind === "multi" && q.options.map((o) => {
            const cur = (a[q.key] as string[]) ?? [];
            const on = cur.includes(o);
            return <button key={o} type="button" className={choice} style={choiceStyle(on)} onClick={() => setA({ ...a, [q.key]: on ? cur.filter((x) => x !== o) : [...cur, o] })}>{o}</button>;
          })}
          {q.kind === "perWiring" && top3.map((w) => (
            <div key={w} className="mt-4"><p className="font-semibold">{fill(q.label, w)}</p>{one(q, q.options, `each_${w}`)}</div>
          ))}
        </div>
      ))}
      <button type="button" className={`${btn} mt-8`} style={forest} disabled={busy} onClick={async () => { setBusy(true); await onSubmit(a); setBusy(false); }}>Send</button>
    </section>
  );
}

function Retake({ grade, onSubmit }: { grade: number; onSubmit: (bank: string, answers: unknown) => Promise<void> }) {
  const [bank, setBank] = useState<PublicBank | null>(null);
  const [i, setI] = useState(0);
  const [part, setPart] = useState<"s" | "f">("s");
  const [sc, setSc] = useState<Record<string, string>>({});
  const [fq, setFq] = useState<Record<string, number>>({});
  useEffect(() => { getBank(setForGrade(grade)).then(({ data }) => setBank(data as unknown as PublicBank)).catch(() => {}); }, [grade]);
  if (!bank) return <p>Loading...</p>;
  if (part === "s") {
    const s = bank.scenarios[i];
    return <>{i === 0 && <p className="mb-4">{bank.instructions}</p>}<p className="text-xs mb-2">{i + 1} of {bank.scenarios.length}</p><h2 className="font-display text-xl">{s.prompt}</h2>
      {s.options.map((o) => <button key={o.id} type="button" className={choice} style={choiceStyle(sc[s.id] === o.id)} onClick={() => { setSc({ ...sc, [s.id]: o.id }); if (i + 1 < bank.scenarios.length) setI(i + 1); else { setI(0); setPart("f"); } }}>{o.text}</button>)}</>;
  }
  const f = bank.frequency[i];
  return <><p className="text-xs mb-2">{i + 1} of {bank.frequency.length}</p><p className="text-sm">{bank.frequency_stem}</p><h2 className="font-display text-xl">{f.text}</h2>
    {bank.scale.labels.map((l, k) => <button key={l} type="button" className={choice} style={choiceStyle(fq[f.id] === k + 1)} onClick={() => { const next = { ...fq, [f.id]: k + 1 }; setFq(next); if (i + 1 < bank.frequency.length) setI(i + 1); else void onSubmit(bank.version, { scenarios: sc, frequency: next }); }}>{l}</button>)}</>;
}

export default function WiredPilot() {
  const [token] = useState(() => savedResultsToken());
  const [status, setStatus] = useState<Status | null>(null);
  const [view, setView] = useState<"loading" | "apply" | "tester" | "closed">("loading");
  const [msg, setMsg] = useState<string | null>(null);
  const [top3, setTop3] = useState<string[]>([]);

  async function load() {
    try {
      if (token) {
        const { status: st, data } = await pilot({ action: "status", token });
        if (st === 404) return setView("closed");
        if (st === 200 && (data as unknown as Status).selected) { setStatus(data as unknown as Status); return setView("tester"); }
      } else {
        const { status: st } = await pilot({ action: "status", token: "" });
        if (st === 404) return setView("closed");
      }
      setView("apply");
    } catch (e) {
      setView(e instanceof WiredDark ? "closed" : "apply");
    }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    // Survey 2 asks about each of her child's top 3 wirings, by name.
    if (!token || !status?.child) return;
    import("../../lib/wiredApi").then(({ getResults }) => getResults(token, status.child!.id)).then(({ data }) => {
      const c = ((data as { children?: { top3?: string[] }[] }).children ?? [])[0];
      setTop3((c?.top3 ?? []).map((d) => WIRING_WRITEUPS[d as keyof typeof WIRING_WRITEUPS]?.name ?? d));
    }).catch(() => {});
  }, [token, status?.child?.id]);

  const card = (c: React.ReactNode) => <div className="max-w-xl mx-auto px-4 py-8 font-body" style={{ color: "hsl(var(--eden-bark))" }}>{c}</div>;
  const child = status?.child;
  const opens = useMemo(() => (status?.opens_at ? new Date(status.opens_at).toLocaleDateString() : null), [status?.opens_at]);
  if (view === "loading") return card(<p>Loading...</p>);
  if (view === "closed") return card(<p>This page isn't open yet.</p>);
  if (view === "apply") return card(<Apply />);
  if (!child) return card(<p><a className="underline" href="/wired">Take the quiz</a> for one of your children first, on this device.</p>);
  if (msg) return card(<p className="text-lg">{msg}</p>);
  if (status?.next === "done") return card(<p className="text-lg">Thank you! You've finished every step.</p>);
  if (opens) return card(<p>Your next step opens on {opens}.</p>);
  const next = status!.next as keyof typeof SURVEYS;
  if (next === "retake" && status?.retake_needed) {
    return card(<Retake grade={child.grade} onSubmit={async (bank, answers) => {
      const { status: st } = await pilot({ action: "retake", token, child_id: child.id, bank_version: bank, answers });
      if (st === 200) await load(); else setMsg("We could not save your answers. Please try again.");
    }} />);
  }
  return card(<SurveyForm kind={next} nickname={child.nickname} top3={top3} onSubmit={async (answers) => {
    const { status: st } = await pilot({ action: "survey", token, child_id: child.id, kind: next, answers });
    if (st === 200) { setMsg(null); await load(); } else setMsg("We could not save your answers. Please check the required questions and try again.");
  }} />);
}
