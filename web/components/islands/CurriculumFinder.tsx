// /curriculum-finder island (2026-11-19). Server-rendered with every curriculum (SEO), then filters in
// the browser. Stars live on her device (localStorage); "Email me my shortlist" posts to the
// curriculum-shortlist edge function. The Friday box is UNTICKED by default (Camila's tap).
// Copy: FINDER_COPY in web/lib/curriculumFinder.ts (DRAFT, pending her approval).
import { useEffect, useMemo, useState } from "react";
import { EDEN_TABLE_SHEET_IDS, EDEN_TESTIMONIALS, FINDER_COPY as T, PREP_ORDER, SUBJECT_GROUPS, type FinderCurriculum } from "../../lib/curriculumFinder";

const STARS_KEY = "eden_finder_stars";
const STATES = "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");
const GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const btn = "inline-flex items-center justify-center font-accent text-xs tracking-[0.15em] uppercase font-bold px-4 py-2 rounded-md";
const forest = { backgroundColor: "hsl(var(--eden-forest))", color: "hsl(var(--eden-cream))" };
const gradeText = (g: number | null) => (g === null ? "?" : g === 0 ? "K" : String(g));

function readStars(): string[] {
  try { return JSON.parse(window.localStorage.getItem(STARS_KEY) ?? "[]"); } catch { return []; }
}
function writeStars(ids: string[]) {
  try { window.localStorage.setItem(STARS_KEY, JSON.stringify(ids)); } catch { /* private window */ }
}
function attribution(): Record<string, string> {
  try {
    const p = new URLSearchParams(window.location.search);
    const out: Record<string, string> = {};
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content"]) { const v = p.get(k); if (v) out[k] = v.slice(0, 100); }
    return out;
  } catch { return {}; }
}

/** Stable anchor per curriculum, so /curriculum-finder#math-u-see links straight to its card. */
export function finderSlug(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export function priceText(c: FinderCurriculum): string | null {
  if (c.completely_free) return T.free;
  if (c.price_cents === null) return null;
  return `About $${Math.round(c.price_cents / 100)}${c.price_basis ? ` (${c.price_basis.toLowerCase()})` : ""}`;
}

export function matches(c: FinderCurriculum, f: { q: string; grade: string; subject: string; prep: string; state: string; freeOnly: boolean; hasTrial: boolean; christian: boolean }): boolean {
  if (f.q) {
    const q = f.q.toLowerCase();
    if (!c.name.toLowerCase().includes(q) && !(c.publisher ?? "").toLowerCase().includes(q)) return false;
  }
  if (f.grade) {
    const g = f.grade === "K" ? 0 : Number(f.grade);
    if (c.grade_min === null || c.grade_max === null || g < c.grade_min || g > c.grade_max) return false;
  }
  if (f.subject && !c.subjects.some((s) => (SUBJECT_GROUPS[f.subject] ?? []).includes(s))) return false;
  if (f.prep && c.prep_load !== f.prep) return false;
  if (f.state && !c.esa_yes_states.includes(f.state)) return false;
  if (f.freeOnly && !c.completely_free) return false;
  if (f.hasTrial && !c.free_trial_url) return false;
  if (f.christian && c.faith_alignment !== "Christian (explicit)") return false;
  return true;
}

function Card({ c, starred, onStar }: { c: FinderCurriculum; starred: boolean; onStar: () => void }) {
  const price = priceText(c);
  const facts = [
    c.grade_min !== null ? `Grades ${gradeText(c.grade_min)}-${gradeText(c.grade_max)}` : null,
    c.subjects.join(", ") || null,
    c.approach,
    c.prep_load ? `Prep: ${c.prep_load}` : null,
    price,
    c.faith_alignment,
  ].filter(Boolean);
  return (
    <article id={finderSlug(c.name)} className="rounded-lg border p-5 bg-white/70 scroll-mt-24" style={{ borderColor: "hsl(var(--eden-gold) / 0.35)" }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl">
            {c.link ? <a href={c.link} target="_blank" rel={c.is_affiliate ? "sponsored noopener" : "noopener"} className="underline decoration-1 underline-offset-4">{c.name}</a> : c.name}
          </h2>
          {c.publisher && <p className="text-sm opacity-80">{c.publisher}</p>}
          {c.is_affiliate && <p className="text-xs opacity-70">{T.affiliateLabel}</p>}
        </div>
        <button type="button" onClick={onStar} aria-pressed={starred} className={`${btn} border`} style={starred ? forest : { borderColor: "hsl(var(--eden-forest))", color: "hsl(var(--eden-forest))" }}>
          {starred ? `★ ${T.starred}` : `☆ ${T.star}`}
        </button>
      </div>
      <p className="mt-2 text-sm">{facts.join("  ·  ")}</p>
      {c.completely_free && <p className="mt-2 inline-block text-xs font-bold uppercase tracking-wide px-2 py-1 rounded" style={forest}>{T.free}</p>}
      {c.free_trial_url && (
        <p className="mt-3 text-sm">
          <a href={c.free_trial_url} target="_blank" rel="noopener" className="font-semibold underline underline-offset-4">{T.tryFree}</a>
          {c.free_trial_note ? <span className="opacity-80">: {c.free_trial_note}</span> : null}
        </p>
      )}
      {EDEN_TABLE_SHEET_IDS.includes(c.sheet_id) && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold">{T.familiesSay}</summary>
          <p className="mt-2 text-xs opacity-75">{T.familiesNote}</p>
          <div className="mt-2 grid gap-3 text-sm">
            {EDEN_TESTIMONIALS.map((t) => (
              <blockquote key={t.by} className="border-l-2 pl-3" style={{ borderColor: "hsl(var(--eden-gold))" }}>
                <p className="italic">“{t.quote}”</p>
                <footer className="mt-1 text-xs opacity-80">– {t.by}</footer>
              </blockquote>
            ))}
          </div>
        </details>
      )}
      {(c.mom_pros.length > 0 || c.mom_cons.length > 0) && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold">{T.moms}</summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 text-sm">
            <div><p className="font-semibold">{T.pros}</p><ul className="list-disc pl-5">{c.mom_pros.map((p) => <li key={p}>{p}</li>)}</ul></div>
            <div><p className="font-semibold">{T.cons}</p><ul className="list-disc pl-5">{c.mom_cons.map((p) => <li key={p}>{p}</li>)}</ul></div>
          </div>
          {c.mom_note && <p className="mt-2 text-xs opacity-75">{c.mom_note}</p>}
          {c.mom_sources.length > 0 && (
            <p className="mt-1 text-xs opacity-75">{T.sources}{" "}
              {c.mom_sources.map((s, i) => <span key={s.url}>{i > 0 ? " · " : ""}<a href={s.url} target="_blank" rel="noopener nofollow" className="underline">{s.title || "source"}</a></span>)}
            </p>
          )}
        </details>
      )}
    </article>
  );
}

export default function CurriculumFinder({ rows }: { rows: FinderCurriculum[] }) {
  const [q, setQ] = useState("");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [prep, setPrep] = useState("");
  const [state, setState] = useState("");
  const [freeOnly, setFreeOnly] = useState(false);
  const [hasTrial, setHasTrial] = useState(false);
  const [christian, setChristian] = useState(false);
  const [stars, setStars] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [first, setFirst] = useState("");
  const [friday, setFriday] = useState(false);
  const [honey, setHoney] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => { setStars(readStars().filter((id) => rows.some((r) => r.id === id))); }, [rows]);
  const toggle = (id: string) => setStars((s) => { const n = s.includes(id) ? s.filter((x) => x !== id) : [...s, id].slice(0, 30); writeStars(n); return n; });

  const shown = useMemo(
    () => rows.filter((c) => matches(c, { q, grade, subject, prep, state, freeOnly, hasTrial, christian })),
    [rows, q, grade, subject, prep, state, freeOnly, hasTrial, christian],
  );

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending"); setMsg("");
    try {
      const res = await fetch(`${BASE}/curriculum-shortlist`, {
        method: "POST",
        headers: { apikey: KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email, first_name: first || undefined, ids: stars, friday_opt_in: friday, esa_state: state || undefined, attribution: attribution(), website: honey }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { setStatus("sent"); return; }
      setStatus("error"); setMsg(data.message ?? "Something went wrong. Please try again.");
    } catch {
      setStatus("error"); setMsg("Something went wrong. Please try again.");
    }
  }

  const select = "rounded-md border px-3 py-2 bg-white text-sm";
  return (
    <div className="max-w-5xl mx-auto px-4 py-10 font-body" style={{ color: "hsl(var(--eden-bark))" }}>
      <h1 className="font-display text-3xl sm:text-4xl">{T.heading}</h1>
      <p className="mt-3 max-w-3xl">{T.intro}</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input aria-label={T.searchLabel} placeholder={T.searchLabel} value={q} onChange={(e) => setQ(e.target.value)} className={select} />
        <select aria-label={T.anyGrade} value={grade} onChange={(e) => setGrade(e.target.value)} className={select}>
          <option value="">{T.anyGrade}</option>{GRADES.map((g) => <option key={g} value={g}>{g === "K" ? "Kindergarten" : `Grade ${g}`}</option>)}
        </select>
        <select aria-label={T.anySubject} value={subject} onChange={(e) => setSubject(e.target.value)} className={select}>
          <option value="">{T.anySubject}</option>{Object.keys(SUBJECT_GROUPS).map((s) => <option key={s}>{s}</option>)}
        </select>
        <select aria-label={T.anyPrep} value={prep} onChange={(e) => setPrep(e.target.value)} className={select}>
          <option value="">{T.anyPrep}</option>{PREP_ORDER.map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={freeOnly} onChange={(e) => setFreeOnly(e.target.checked)} />{T.freeOnly}</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={hasTrial} onChange={(e) => setHasTrial(e.target.checked)} />{T.hasTrial}</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={christian} onChange={(e) => setChristian(e.target.checked)} />{T.christianOnly}</label>
        <select aria-label={T.anyState} value={state} onChange={(e) => setState(e.target.value)} className={select}>
          <option value="">{T.anyState}</option>{STATES.map((s) => <option key={s}>{s}</option>)}
        </select>
        {state && <span className="opacity-80">{T.esaYes}</span>}
      </div>

      <p className="mt-6 text-sm opacity-80">{T.count(shown.length)}</p>
      {rows.some((r) => r.is_affiliate) && <p className="mt-1 text-xs opacity-70">{T.affiliate}</p>}
      <div className="mt-3 grid gap-4">
        {shown.length ? shown.map((c) => <Card key={c.id} c={c} starred={stars.includes(c.id)} onStar={() => toggle(c.id)} />) : <p>{T.empty}</p>}
      </div>

      <section className="mt-10 rounded-lg p-6" style={{ backgroundColor: "hsl(var(--eden-cream))" }}>
        <h2 className="font-display text-2xl">{T.quizTitle}</h2>
        <p className="mt-2">{T.quizLine}</p>
        <a href="/wired" className={`${btn} mt-4`} style={forest}>{T.quizButton}</a>
      </section>

      {stars.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 backdrop-blur px-4 py-3" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          {!formOpen ? (
            <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
              <span className="font-semibold">{T.barLine(stars.length)}</span>
              <button type="button" className={btn} style={forest} onClick={() => setFormOpen(true)}>{T.barButton}</button>
            </div>
          ) : status === "sent" ? (
            <p className="max-w-5xl mx-auto font-semibold" role="status">{T.sent}</p>
          ) : (
            <form onSubmit={send} className="max-w-5xl mx-auto grid gap-2">
              <p className="font-display text-lg">{T.formTitle}</p>
              <p className="text-sm">{T.formLine}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <input type="email" required aria-label={T.emailLabel} placeholder={T.emailLabel} value={email} onChange={(e) => setEmail(e.target.value)} className={select} />
                <input aria-label={T.nameLabel} placeholder={T.nameLabel} value={first} onChange={(e) => setFirst(e.target.value)} className={select} />
              </div>
              <input tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={honey} onChange={(e) => setHoney(e.target.value)} name="website" />
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={friday} onChange={(e) => setFriday(e.target.checked)} className="mt-1" />{T.fridayBox}</label>
              <div className="flex items-center gap-3">
                <button type="submit" disabled={status === "sending"} className={btn} style={forest}>{status === "sending" ? T.sending : T.send}</button>
                {status === "error" && <span className="text-sm" role="alert">{msg}</span>}
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
