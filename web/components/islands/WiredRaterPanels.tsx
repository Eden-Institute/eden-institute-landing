// Fearfully & Wonderfully Wired, W9: the results-page panels for the other raters (spec 7.3, 7.4, answers 28d, 32).
//   SideBySide  "Mom sees / Teen sees" + each invited person by her label (never a name or email), when more
//               than one person has answered.
//   TeenLink    grade 9+: a neutral age list (10-18, FTC COPPA FAQ H.3); 13+ gets a link to copy, under 13 the
//               approved "ages 13 and up" line. No teen name or email is asked.
//   Observers   a Blueprint / Family Map child: up to 3 invites (email + who they are), status, remove.
// Copy: web/lib/wiredCopyW9.ts (APPROVED vs PROPOSED marked there). Rendered inside the private results page.

import { useEffect, useState } from "react";
import { getTeenLink, observers as callObservers, type ObserverRow } from "../../lib/wiredApi";
import { OBSERVER_LABELS, W9, w9fill } from "../../lib/wiredCopyW9";
import { DOMAINS, type Domain } from "../../../supabase/functions/_shared/wired-engine";
import { WIRING_WRITEUPS } from "../../lib/wiredWriteups";

export interface RaterView { role: string; label: string | null; scores: Record<Domain, number>; top3: Domain[] }

const btn = "inline-flex items-center justify-center font-accent text-sm tracking-[0.2em] uppercase font-bold px-5 py-3 rounded-md";
const forest = { backgroundColor: "hsl(var(--eden-forest))", color: "hsl(var(--eden-cream))" };
const field = "w-full rounded-md border px-3 py-3 text-base bg-background";
const fieldStyle = { borderColor: "hsl(var(--eden-gold) / 0.5)" };

export function SideBySide({ name, raters }: { name: string; raters: RaterView[] }) {
  if (raters.length < 2) return null;
  const head = (r: RaterView) => r.role === "mom" ? W9.momSees : r.role === "teen" ? W9.teenSees : w9fill(W9.labelSees, { label: r.label ?? "Someone" });
  return (
    <section className="mt-8">
      <h2 className="font-display text-2xl">{w9fill(W9.sideHeading, { name })}</h2>
      <p className="text-sm mt-1">{W9.sideNote}</p>
      <div className="overflow-x-auto mt-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr><th className="text-left py-2 pr-3" />{raters.map((r, i) => <th key={i} className="text-right py-2 px-2 font-semibold">{head(r)}</th>)}</tr>
          </thead>
          <tbody>
            {DOMAINS.map((d) => (
              <tr key={d} className="border-t" style={{ borderColor: "hsl(var(--eden-gold) / 0.3)" }}>
                <td className="py-2 pr-3">{WIRING_WRITEUPS[d].name}</td>
                {raters.map((r, i) => (
                  <td key={i} className="text-right py-2 px-2" style={{ fontWeight: r.top3.includes(d) ? 700 : 400 }}>{Math.round(r.scores[d])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function TeenLink({ token, childId, name }: { token: string; childId: string; name: string }) {
  const [age, setAge] = useState<number | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [under, setUnder] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  async function go() {
    if (age === null || busy) return;
    setBusy(true); setErr(null); setUrl(null); setUnder(false);
    try {
      const { status, data } = await getTeenLink({ token, child_id: childId, age });
      if (status === 200 && data.under_13) setUnder(true);
      else if (status === 200 && data.url) setUrl(data.url);
      else setErr(W9.tryAgain);
    } catch { setErr(W9.tryAgain); }
    setBusy(false);
  }
  async function copy() {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); setCopied(true); } catch { /* the link stays visible to copy by hand */ }
  }
  return (
    <section className="mt-8">
      <p>{w9fill(W9.teenAsk, { name })}</p>
      <div className="flex flex-wrap gap-3 items-end mt-3">
        <label className="text-sm">{W9.teenAgeLabel}
          <select className={`${field} mt-1`} style={fieldStyle} value={age ?? ""} onChange={(e) => setAge(e.target.value === "" ? null : Number(e.target.value))}>
            <option value="">{W9.teenAgeChoose}</option>
            {Array.from({ length: 9 }, (_, i) => 10 + i).map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <button type="button" className={btn} style={forest} disabled={age === null || busy} onClick={go}>{W9.teenButton}</button>
      </div>
      {under && <p className="mt-3">{w9fill(W9.teenUnder13, { name })}</p>}
      {url && (
        <div className="mt-3">
          <p>{w9fill(W9.teenLinkLine, { name })}</p>
          <p className="mt-2 break-all text-sm rounded-md p-3" style={{ backgroundColor: "hsl(var(--eden-cream))" }}>{url}</p>
          <button type="button" className="text-sm underline mt-2" onClick={copy}>{copied ? W9.copied : W9.copyButton}</button>
        </div>
      )}
      {err && <p className="text-sm mt-3" role="alert">{err}</p>}
    </section>
  );
}

export function Observers({ token, childId, name }: { token: string; childId: string; name: string }) {
  const [rows, setRows] = useState<ObserverRow[]>([]);
  const [max, setMax] = useState(3);
  const [email, setEmail] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const apply = (data: { observers?: ObserverRow[]; max?: number }) => { if (data.observers) setRows(data.observers); if (data.max) setMax(data.max); };
  useEffect(() => {
    callObservers({ token, child_id: childId, action: "list" }).then(({ status, data }) => status === 200 && apply(data)).catch(() => {});
  }, [token, childId]);
  async function act(body: { action: "add" | "remove"; email?: string; label?: string; observer_id?: string }) {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      const { status, data } = await callObservers({ token, child_id: childId, ...body });
      if (status === 200) { apply(data); if (body.action === "add") { setEmail(""); setLabel(""); } }
      else setErr(w9fill(W9.obsErrors[data.error ?? ""] ?? W9.tryAgain, { name }));
    } catch { setErr(W9.tryAgain); }
    setBusy(false);
  }
  return (
    <section className="mt-8">
      <h2 className="font-display text-2xl">{w9fill(W9.obsHeading, { name })}</h2>
      <p className="mt-2 text-sm">{W9.obsBody}</p>
      {rows.length > 0 && (
        <ul className="mt-4">
          {rows.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-3 py-2 border-t text-sm" style={{ borderColor: "hsl(var(--eden-gold) / 0.3)" }}>
              <span className="font-semibold">{o.label}</span><span>{o.email}</span><span className="text-muted-foreground">{W9.obsStatus[o.status]}</span>
              <button type="button" className="underline ml-auto" disabled={busy} onClick={() => act({ action: "remove", observer_id: o.id })}>{W9.obsRemove}</button>
            </li>
          ))}
        </ul>
      )}
      {rows.length >= max ? <p className="mt-3 text-sm">{w9fill(W9.obsFull, { name })}</p> : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">{W9.obsEmail}
            <input type="email" className={`${field} mt-1`} style={fieldStyle} autoComplete="off" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="text-sm">{W9.obsWho}
            <select className={`${field} mt-1`} style={fieldStyle} value={label} onChange={(e) => setLabel(e.target.value)}>
              <option value="">{W9.obsWhoChoose}</option>
              {OBSERVER_LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <div><button type="button" className={btn} style={forest} disabled={busy || !email.trim() || !label} onClick={() => act({ action: "add", email: email.trim(), label })}>{W9.obsButton}</button></div>
        </div>
      )}
      {err && <p className="text-sm mt-3" role="alert">{err}</p>}
    </section>
  );
}
