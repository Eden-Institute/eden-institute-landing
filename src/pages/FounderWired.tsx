// /founder/wired: the Wired quiz curriculum database (W5; spec section 12, answer 16).
// Founder only: the page asks is_founder() like FounderLeads, and every wired_admin_* RPC checks it
// again server-side. Approve, unapprove, roll back and import also need her authenticator code: the
// RPC answers MFA_REQUIRED and the shared step-up prompt (components/founder/StepUp.tsx) asks for it.
// Nothing here reaches families until a row is approved (wired-matches reads approved rows only).
// Outreach fields (dm_*) are shown here only; no public function ever returns them.

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FounderActionError, useStepUp } from "@/components/founder/StepUp";
import { mapCurricula, mapEsa, type CurriculumRow, type EsaImportRow } from "@/lib/wiredImport";

const DOMAINS = ["storyteller", "organizer", "designer", "maker", "psalmist", "connector", "ponderer", "cultivator", "seeker"];
const SIX_MONTHS_MS = 182 * 24 * 3600 * 1000;

interface EsaRow { curriculum_id: string; state: string; program: string; eligible: string; verified_at: string | null; source_url: string | null; notes: string | null }
interface Curriculum {
  id: string; sheet_id: string | null; name: string; publisher: string | null; approach: string | null; approach_secondary: string | null;
  subjects: string[]; grade_min: number | null; grade_max: number | null; domains_served: string[]; prep_load: string | null;
  price_cents: number | null; price_basis: string | null; multi_age: boolean; faith_alignment: string | null; url: string | null;
  affiliate_url: string | null; is_affiliate: boolean; eden_band: string | null; coming_soon: boolean; approved: boolean;
  approved_at: string | null; last_verified_at: string | null; dm_name: string | null; dm_role: string | null; dm_email: string | null;
  dm_source_url: string | null; esa: EsaRow[];
}
interface History { id: string; table_name: string; op: string; changed_at: string; changed_by: string | null; before: unknown; after: unknown }

/** An RPC error, with MFA_REQUIRED kept as a code so withStepUp can ask for her authenticator code. */
async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn as never, args as never);
  if (error) {
    const msg = error.message ?? String(error);
    if (msg.includes("MFA_REQUIRED")) throw new FounderActionError("This needs your authenticator code.", "MFA_REQUIRED");
    if (msg.includes("FOUNDER_ONLY")) throw new FounderActionError("Only the founder account can do this.", "FOUNDER_ONLY");
    throw new Error(msg);
  }
  return data as T;
}

const grade = (g: number | null) => (g === null ? "?" : g === 0 ? "K" : String(g));
const money = (c: number | null) => (c === null ? "no price" : c === 0 ? "Free" : `$${(c / 100).toFixed(2)}`);
const stale = (c: Curriculum) => !c.last_verified_at || Date.now() - new Date(c.last_verified_at).getTime() > SIX_MONTHS_MS;

export default function FounderWired() {
  const { user } = useAuth();
  const [founder, setFounder] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Curriculum[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState({ approved: "all", stale: false, band: "", approach: "", q: "" });
  const [openId, setOpenId] = useState<string | null>(null);
  const { withStepUp, stepUpDialog } = useStepUp();

  useEffect(() => {
    let live = true;
    if (!user?.id) { setFounder(false); return; }
    supabase.rpc("is_founder").then(({ data, error: e }) => live && setFounder(!e && data === true), () => live && setFounder(false));
    return () => { live = false; };
  }, [user?.id]);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await rpc<Curriculum[]>("wired_admin_list"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => { if (founder) void load(); }, [founder, load]);

  const approaches = useMemo(() => [...new Set(rows.map((r) => r.approach).filter(Boolean))].sort() as string[], [rows]);
  const bands = useMemo(() => [...new Set(rows.map((r) => r.eden_band).filter(Boolean))].sort() as string[], [rows]);
  const shown = rows.filter((r) =>
    (filter.approved === "all" || (filter.approved === "yes") === r.approved) &&
    (!filter.stale || stale(r)) && (!filter.band || r.eden_band === filter.band) && (!filter.approach || r.approach === filter.approach) &&
    (!filter.q || r.name.toLowerCase().includes(filter.q.toLowerCase())));

  async function act(label: string, fn: () => Promise<unknown>) {
    setError(null); setNotice(null);
    try {
      await withStepUp(fn);
      setNotice(label);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (founder === null) return <main className="p-8">Checking your account...</main>;
  if (!founder) return <main className="p-8">This page is for the founder account only.</main>;

  const approvedCount = rows.filter((r) => r.approved).length;
  return (
    <main className="max-w-6xl mx-auto p-6 font-body">
      {stepUpDialog}
      <h1 className="text-2xl font-display mb-1">Wired quiz: curriculum database</h1>
      <p className="text-sm text-muted-foreground mb-4">
        {rows.length} curricula, {approvedCount} approved. Only approved ones ever show to families. Approve, unapprove, roll back and import ask for your authenticator code.
      </p>
      {error && <p role="alert" className="mb-3 text-sm" style={{ color: "hsl(var(--destructive))" }}>{error}</p>}
      {notice && <p className="mb-3 text-sm" style={{ color: "hsl(var(--eden-forest))" }}>{notice}</p>}

      <ImportBox onImport={(cur, esa) => act("Import finished.", async () => {
        const r = await rpc<Record<string, number>>("wired_admin_import", { p_rows: cur, p_esa: esa });
        setNotice(`Import: ${r.inserted} new, ${r.updated} updated, ${r.skipped} left alone (already approved or incomplete), ${r.esa_rows} ESA rows.`);
      })} />

      <PilotBox act={act} />

      <div className="flex flex-wrap gap-3 items-end my-4 text-sm">
        <label>Show <select className="border rounded px-2 py-1" value={filter.approved} onChange={(e) => setFilter({ ...filter, approved: e.target.value })}>
          <option value="all">All</option><option value="yes">Approved</option><option value="no">Not approved</option></select></label>
        <label className="flex gap-1 items-center"><input type="checkbox" checked={filter.stale} onChange={(e) => setFilter({ ...filter, stale: e.target.checked })} />Not verified in 6 months</label>
        <label>Band <select className="border rounded px-2 py-1" value={filter.band} onChange={(e) => setFilter({ ...filter, band: e.target.value })}>
          <option value="">Any</option>{bands.map((b) => <option key={b}>{b}</option>)}</select></label>
        <label>Approach <select className="border rounded px-2 py-1" value={filter.approach} onChange={(e) => setFilter({ ...filter, approach: e.target.value })}>
          <option value="">Any</option>{approaches.map((a) => <option key={a}>{a}</option>)}</select></label>
        <input className="border rounded px-2 py-1" placeholder="Search name" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
      </div>

      {shown.some((r) => !r.approved) && (
        <button type="button" className="mb-3 border rounded px-3 py-1 text-sm"
          onClick={() => {
            const todo = shown.filter((r) => !r.approved);
            if (!window.confirm(`Approve all ${todo.length} rows shown? Each can then show to families. You can unapprove any of them later.`)) return;
            void act(`Approved ${todo.length}.`, async () => {
              for (const r of todo) await rpc("wired_admin_set_approved", { p_id: r.id, p_approved: true });
            });
          }}>Approve all shown ({shown.filter((r) => !r.approved).length})</button>
      )}

      <table className="w-full text-sm border-collapse">
        <thead><tr className="text-left border-b"><th className="py-2">Name</th><th>Grades</th><th>Approach</th><th>Price</th><th>Verified</th><th>Status</th></tr></thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.id} className="border-b align-top">
              <td className="py-2"><button type="button" className="underline text-left" onClick={() => setOpenId(openId === r.id ? null : r.id)}>{r.name}</button>
                <div className="text-xs text-muted-foreground">{r.publisher}{r.sheet_id ? ` · ${r.sheet_id}` : ""}</div>
                {openId === r.id && <Detail c={r} act={act} />}
              </td>
              <td>{grade(r.grade_min)}-{grade(r.grade_max)}</td>
              <td>{r.approach ?? ""}</td>
              <td>{money(r.price_cents)}</td>
              <td className={stale(r) ? "text-destructive" : ""}>{r.last_verified_at ? r.last_verified_at.slice(0, 10) : "never"}</td>
              <td>{r.approved ? "Approved" : "Not approved"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

function ImportBox({ onImport }: { onImport: (cur: CurriculumRow[], esa: EsaImportRow[]) => void }) {
  const [cur, setCur] = useState<{ rows: CurriculumRow[]; skipped: number } | null>(null);
  const [esa, setEsa] = useState<{ rows: EsaImportRow[]; skipped: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const read = (f: File | undefined, map: (t: string) => unknown, set: (v: never) => void) => {
    setErr(null);
    if (!f) return;
    f.text().then((t) => { try { set(map(t) as never); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } });
  };
  return (
    <details className="border rounded p-3">
      <summary className="cursor-pointer text-sm font-semibold">Import from the curriculum workbook (CSV)</summary>
      <p className="text-xs text-muted-foreground mt-2">Save the "Curricula" tab (and, if you like, "ESA by state") as CSV. New rows come in not approved. A row you already approved is never changed by an import.</p>
      <div className="flex flex-wrap gap-4 mt-2 text-sm">
        <label>Curricula CSV <input type="file" accept=".csv,text/csv" onChange={(e) => read(e.target.files?.[0], mapCurricula, setCur as never)} /></label>
        <label>ESA by state CSV <input type="file" accept=".csv,text/csv" onChange={(e) => read(e.target.files?.[0], mapEsa, setEsa as never)} /></label>
      </div>
      {err && <p className="text-sm mt-2" style={{ color: "hsl(var(--destructive))" }}>{err}</p>}
      {cur && <p className="text-sm mt-2">{cur.rows.length} curricula ready ({cur.skipped} left out: example or rejected rows){esa ? `, ${esa.rows.length} ESA rows` : ""}.</p>}
      {cur && <button type="button" className="mt-2 border rounded px-3 py-1 text-sm" onClick={() => onImport(cur.rows, esa?.rows ?? [])}>Import</button>}
    </details>
  );
}

function Detail({ c, act }: { c: Curriculum; act: (label: string, fn: () => Promise<unknown>) => Promise<void> }) {
  const [f, setF] = useState({
    name: c.name, publisher: c.publisher ?? "", url: c.url ?? "", approach: c.approach ?? "", approach_secondary: c.approach_secondary ?? "",
    subjects: c.subjects.join("; "), grade_min: grade(c.grade_min), grade_max: grade(c.grade_max), domains_served: c.domains_served,
    prep_load: c.prep_load ?? "", price: c.price_cents === null ? "" : (c.price_cents / 100).toFixed(2), price_basis: c.price_basis ?? "",
    multi_age: c.multi_age, faith_alignment: c.faith_alignment ?? "", affiliate_url: c.affiliate_url ?? "", is_affiliate: c.is_affiliate,
    eden_band: c.eden_band ?? "", coming_soon: c.coming_soon, last_verified_at: c.last_verified_at ? c.last_verified_at.slice(0, 10) : "",
    dm_name: c.dm_name ?? "", dm_role: c.dm_role ?? "", dm_email: c.dm_email ?? "", dm_source_url: c.dm_source_url ?? "",
  });
  const [history, setHistory] = useState<History[] | null>(null);
  const [esaNew, setEsaNew] = useState({ state: "", program: "", eligible: "unknown", verified_at: "", source_url: "", notes: "" });
  const g = (v: string) => (v.trim().toUpperCase() === "K" ? 0 : v.trim() === "" ? null : Number(v));
  const text = (k: keyof typeof f, label: string) => (
    <label className="block text-xs mt-2">{label}<input className="block w-full border rounded px-2 py-1 text-sm" value={String(f[k])} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>
  );
  const check = (k: "multi_age" | "is_affiliate" | "coming_soon", label: string) => (
    <label className="flex gap-1 items-center text-xs mt-2"><input type="checkbox" checked={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} />{label}</label>
  );
  const save = () => act("Saved.", () => rpc("wired_admin_save", { p: {
    id: c.id, name: f.name, publisher: f.publisher, url: f.url, approach: f.approach, approach_secondary: f.approach_secondary,
    subjects: f.subjects.split(";").map((s) => s.trim()).filter(Boolean), grade_min: g(f.grade_min), grade_max: g(f.grade_max),
    domains_served: f.domains_served, prep_load: f.prep_load, price_cents: f.price.trim() === "" ? null : Math.round(Number(f.price) * 100),
    price_basis: f.price_basis, multi_age: f.multi_age, faith_alignment: f.faith_alignment, affiliate_url: f.affiliate_url, is_affiliate: f.is_affiliate,
    eden_band: f.eden_band, coming_soon: f.coming_soon, last_verified_at: f.last_verified_at || null,
    dm_name: f.dm_name, dm_role: f.dm_role, dm_email: f.dm_email, dm_source_url: f.dm_source_url,
  } }));

  return (
    <div className="mt-3 border rounded p-3 bg-background">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="border rounded px-3 py-1 text-sm" onClick={() => act(c.approved ? "Unapproved." : "Approved: it can now show to families.", () => rpc("wired_admin_set_approved", { p_id: c.id, p_approved: !c.approved }))}>
          {c.approved ? "Unapprove" : "Approve"}</button>
        <button type="button" className="border rounded px-3 py-1 text-sm" onClick={save}>Save changes</button>
        <button type="button" className="border rounded px-3 py-1 text-sm" onClick={() => rpc<History[]>("wired_admin_history", { p_curriculum: c.id }).then(setHistory, () => setHistory([]))}>Show history</button>
        {c.url && <a className="underline text-sm self-center" href={c.url} target="_blank" rel="noopener noreferrer">Open the publisher page</a>}
      </div>
      <div className="grid md:grid-cols-2 gap-x-4">
        <div>{text("name", "Name")}{text("publisher", "Publisher")}{text("url", "Product page")}{text("approach", "Approach")}{text("approach_secondary", "Second approach")}
          {text("subjects", "Subjects (separate with ;)")}{text("grade_min", "Lowest grade (K to 12)")}{text("grade_max", "Highest grade")}{text("prep_load", "Prep load")}</div>
        <div>{text("price", "Price (USD)")}{text("price_basis", "Price basis")}{text("faith_alignment", "Faith alignment")}{text("affiliate_url", "Affiliate link")}
          {text("eden_band", "Eden band")}{text("last_verified_at", "Last verified (YYYY-MM-DD)")}{check("multi_age", "Works for several ages")}{check("is_affiliate", "Affiliate link")}{check("coming_soon", "Coming soon (Eden's Table sets still being built)")}</div>
      </div>
      <fieldset className="mt-3 text-xs"><legend>Wirings it serves</legend>
        <div className="flex flex-wrap gap-3">{DOMAINS.map((d) => (
          <label key={d} className="flex gap-1 items-center"><input type="checkbox" checked={f.domains_served.includes(d)}
            onChange={(e) => setF({ ...f, domains_served: e.target.checked ? [...f.domains_served, d] : f.domains_served.filter((x) => x !== d) })} />{d}</label>
        ))}</div>
      </fieldset>
      <details className="mt-3"><summary className="text-xs cursor-pointer">Publisher contact (founder only)</summary>
        <div className="grid md:grid-cols-2 gap-x-4">{text("dm_name", "Name")}{text("dm_role", "Role")}{text("dm_email", "Email")}{text("dm_source_url", "Where we found it")}</div>
      </details>

      <h3 className="text-sm font-semibold mt-4">ESA by state</h3>
      <table className="w-full text-xs mt-1"><thead><tr className="text-left"><th>State</th><th>Program</th><th>Eligible</th><th>Verified</th><th>Source</th></tr></thead>
        <tbody>{c.esa.map((e) => (
          <tr key={`${e.state}|${e.program}`}><td>{e.state}</td><td>{e.program}</td>
            <td><select className="border rounded" defaultValue={e.eligible}
              onChange={(ev) => act("ESA row saved.", () => rpc("wired_admin_esa_save", { p: { ...e, eligible: ev.target.value, verified_at: new Date().toISOString().slice(0, 10) } }))}>
              <option value="yes">yes</option><option value="no">no</option><option value="unknown">unknown</option></select></td>
            <td>{e.verified_at ?? "never"}</td><td>{e.source_url ? <a className="underline" href={e.source_url} target="_blank" rel="noopener noreferrer">source</a> : ""}</td></tr>
        ))}</tbody></table>
      <div className="flex flex-wrap gap-2 mt-2 text-xs items-end">
        <input className="border rounded px-1 w-14" placeholder="TN" maxLength={2} value={esaNew.state} onChange={(e) => setEsaNew({ ...esaNew, state: e.target.value.toUpperCase() })} />
        <input className="border rounded px-1" placeholder="Program" value={esaNew.program} onChange={(e) => setEsaNew({ ...esaNew, program: e.target.value })} />
        <select className="border rounded" value={esaNew.eligible} onChange={(e) => setEsaNew({ ...esaNew, eligible: e.target.value })}><option>yes</option><option>no</option><option>unknown</option></select>
        <input className="border rounded px-1" type="date" value={esaNew.verified_at} onChange={(e) => setEsaNew({ ...esaNew, verified_at: e.target.value })} />
        <input className="border rounded px-1" placeholder="Source link" value={esaNew.source_url} onChange={(e) => setEsaNew({ ...esaNew, source_url: e.target.value })} />
        <button type="button" className="border rounded px-2 py-1" disabled={!esaNew.state || !esaNew.program}
          onClick={() => act("ESA row added.", () => rpc("wired_admin_esa_save", { p: { curriculum_id: c.id, ...esaNew } }))}>Add state</button>
      </div>

      {history && (
        <div className="mt-4"><h3 className="text-sm font-semibold">History</h3>
          {history.length === 0 && <p className="text-xs">No changes recorded.</p>}
          <ul className="text-xs mt-1 space-y-1">{history.map((h) => (
            <li key={h.id}>{h.changed_at.slice(0, 16).replace("T", " ")} · {h.op === "INSERT" ? "created" : h.op === "DELETE" ? "deleted" : "changed"} {h.table_name === "wired_curriculum_esa" ? "an ESA row" : ""} by {h.changed_by ?? "?"}
              {h.op !== "INSERT" || h.table_name === "wired_curriculum_esa" ? (
                <button type="button" className="ml-2 underline" onClick={() => act("Rolled back.", () => rpc("wired_admin_rollback", { p_history_id: h.id }))}>Roll back to before this</button>
              ) : null}</li>
          ))}</ul>
        </div>
      )}
    </div>
  );
}

// ── W12: pilot applications. Counts per band so she can pick a balanced 30-50 (about 10-12 per band); selecting
// or declining asks for her authenticator code (wired_admin_pilot_set_status, aal2). Nothing emails a family from
// here: the "you're in" / "not this round" emails need her approved copy first. ──
interface PilotApp { id: string; first_name: string | null; email: string; state: string | null; years: string | null; kids: string | null; children: { nickname: string; grade: number }[]; bands: string[]; approach: string | null; heard: string | null; status: string; created_at: string }
function PilotBox({ act }: { act: (msg: string, fn: () => Promise<unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ applications: PilotApp[]; bands: Record<string, { applied: number; selected: number }> } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => {
    rpc<{ applications: PilotApp[]; bands: Record<string, { applied: number; selected: number }> }>("wired_admin_pilot_list").then(setData).catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);
  useEffect(() => { if (open) load(); }, [open, load]);
  const setStatus = (id: string, status: string) => void act(`Marked ${status}.`, async () => { await rpc("wired_admin_pilot_set_status", { p_id: id, p_status: status }); load(); });
  return (
    <section className="my-4 border rounded p-3 text-sm">
      <button type="button" className="underline" onClick={() => setOpen(!open)}>{open ? "Hide" : "Show"} pilot applications</button>
      {err && <p role="alert" className="mt-2">{err}</p>}
      {open && data && (
        <div className="mt-3">
          <p className="mb-2">{["K-2", "3-5", "6-8", "9-12"].map((b) => `${b}: ${data.bands?.[b]?.selected ?? 0} picked of ${(data.bands?.[b]?.applied ?? 0) + (data.bands?.[b]?.selected ?? 0)}`).join(" · ")}</p>
          {data.applications.length === 0 ? <p>No applications yet.</p> : (
            <table className="w-full border-collapse">
              <thead><tr className="text-left border-b"><th className="py-1">Name</th><th>State</th><th>Children</th><th>Years</th><th>Approach</th><th>Heard</th><th>Status</th><th /></tr></thead>
              <tbody>{data.applications.map((a) => (
                <tr key={a.id} className="border-b align-top">
                  <td className="py-1">{a.first_name}<div className="text-xs text-muted-foreground">{a.email}</div></td>
                  <td>{a.state}</td>
                  <td>{a.children.map((c) => `${c.nickname} (${grade(c.grade)})`).join(", ")}</td>
                  <td>{a.years}</td><td>{a.approach}</td><td>{a.heard}</td><td>{a.status}</td>
                  <td className="whitespace-nowrap">
                    {a.status !== "selected" && <button type="button" className="underline mr-2" onClick={() => setStatus(a.id, "selected")}>Pick</button>}
                    {a.status !== "declined" && <button type="button" className="underline" onClick={() => setStatus(a.id, "declined")}>Not this round</button>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}
