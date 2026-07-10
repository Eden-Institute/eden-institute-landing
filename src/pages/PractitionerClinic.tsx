// PractitionerClinic — the Phase 3 one-screen pocket materia medica + client
// roster (PD-1, PD-2, PD-9, PD-10, PD-11).
//
// UNLINKED route (/practitioner): built, internally usable, NOT surfaced in
// any customer-facing nav per PD-1 — launch timing is a founder decision.
// RequireAuth bounces anon visitors; the real boundary is server-side: every
// call goes through the practitioner-clinical EF, which enforces
// tier='practitioner' (founder allowlisted) and per-profile ownership, and is
// the ONLY path to the clinical schema (TL-3/TL-4).
//
// Flow: active client → framework dropdown → pattern beneath → chief
// complaint → refer-out gate (blocks herbs until acknowledged) → matched,
// safety-filtered herb cards showing every lens's verdict (Avoid wins the
// badge on conflict) with one-tap dual-source citations → formulary builder
// with batch print.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const EF_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/practitioner-clinical`;

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

const FRAMEWORK_LABELS: Record<string, string> = {
  eden: "Pattern of Eden",
  western: "Western temperament",
  ayurveda: "Ayurvedic dosha",
  tcm: "TCM pattern",
};

function fmtDate(iso?: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Exportable PDF (spec parity with the marketing card): render the case file
// as a formatted document in a print window — the browser's Save-as-PDF is
// the export path, no server-side PDF dependency.
function printCaseFile(cf: Json) {
  const c = cf.client ?? {};
  const readings = (cf.readings ?? []).filter((r: Json) => r.role === "primary");
  const html = `
    <h1>Clinical case file — ${esc(c.name)}</h1>
    <p class="meta">Exported ${new Date(cf.exported_at ?? Date.now()).toLocaleString()} · Eden Apothecary Practitioner</p>
    <h2>Client</h2>
    <p>${esc(c.profile_kind ?? "adult")} · DOB ${esc(c.date_of_birth ?? "—")} · ${esc(c.biological_sex ?? "—")}</p>
    ${c.medications ? `<p><strong>Medications:</strong> ${esc(c.medications)}</p>` : ""}
    ${c.allergies ? `<p><strong>Allergies:</strong> ${esc(c.allergies)}</p>` : ""}
    ${c.conditions ? `<p><strong>Conditions:</strong> ${esc(c.conditions)}</p>` : ""}
    <h2>Standing constitutional readings</h2>
    <table><tr><th>Framework</th><th>Pattern</th><th>Kind</th><th>Confidence</th><th>Note</th></tr>
    ${readings.map((r: Json) =>
      `<tr><td>${esc(r.framework)}</td><td>${esc(r.pattern_id)}</td><td>${esc(r.reading_kind)}</td><td>${r.confidence != null ? Math.round(r.confidence * 100) + "%" : "—"}</td><td>${esc(r.adjustment_note ?? "")}</td></tr>`).join("")}
    </table>
    <h2>Assessment history</h2>
    <table><tr><th>Date</th><th>Version</th><th>Temp</th><th>Moisture</th><th>Tone</th></tr>
    ${(cf.completions ?? []).map((d: Json) =>
      `<tr><td>${esc(new Date(d.completed_at).toLocaleDateString())}</td><td>${esc(d.quiz_version)}</td><td>${d.temperature_score ?? "—"}</td><td>${d.moisture_score ?? "—"}</td><td>${d.tone_score ?? "—"}</td></tr>`).join("")}
    </table>
    <h2>Encounters</h2>
    ${(cf.encounters ?? []).map((e: Json) => `
      <div class="enc">
        <p><strong>${esc(new Date(e.encounter_date).toLocaleDateString())}</strong> · ${esc(e.chief_complaint_id ?? "no complaint")} · ${esc(e.status)}
        ${e.refer_out_trigger_ids?.length ? ` · refer-out ${e.refer_out_acknowledged_at ? "acknowledged: " + esc(e.refer_out_acknowledged_note) : "PENDING"}` : ""}</p>
        ${e.soap ? `<p>${["s", "o", "a", "p"].filter((k) => e.soap[k]).map((k) => `<strong>${k.toUpperCase()}:</strong> ${esc(e.soap[k])}`).join("<br>")}</p>` : ""}
      </div>`).join("")}
    <h2>Formularies</h2>
    ${(cf.formularies ?? []).map((f: Json) => `
      <div class="enc"><p><strong>${esc(f.name)}</strong>${f.notes ? " — " + esc(f.notes) : ""}</p>
      <table><tr><th>Herb</th><th>Parts</th><th>Note</th></tr>
      ${(f.items ?? []).map((it: Json) => `<tr><td>${esc(it.common_name)}</td><td>${esc(it.parts)} ${esc(it.unit)}</td><td>${esc(it.note ?? "")}</td></tr>`).join("")}
      </table></div>`).join("")}
    <p class="meta">Terrain-based clinical decision support. Educational reference for licensed judgment — not a prescription.</p>`;
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>Case file — ${esc(c.name)}</title><style>
    body{font-family:Georgia,serif;color:#3D3832;margin:32px;line-height:1.5}
    h1{font-size:20px;color:#2C3E2D} h2{font-size:14px;color:#2C3E2D;border-bottom:1px solid #E8E3DA;padding-bottom:2px;margin-top:20px}
    p{font-size:12px;margin:4px 0} .meta{color:#6B6560;font-size:10px}
    table{border-collapse:collapse;width:100%;font-size:11px;margin:6px 0}
    th,td{border:1px solid #E8E3DA;padding:3px 6px;text-align:left} th{background:#F5F0E8}
    .enc{margin:6px 0;padding:6px;border:1px solid #E8E3DA}
  </style></head><body>${html}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

export default function PractitionerClinic() {
  const { user, loading: authLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [reference, setReference] = useState<Json | null>(null);
  const [roster, setRoster] = useState<Json | null>(null);
  const [clientId, setClientId] = useState<string>("");
  const [client, setClient] = useState<Json | null>(null);
  const [encounter, setEncounter] = useState<Json | null>(null);
  const [framework, setFramework] = useState<string>("");
  const [patternId, setPatternId] = useState<string>("");
  const [complaintId, setComplaintId] = useState<string>("");
  const [pregnant, setPregnant] = useState(false);
  const [breastfeeding, setBreastfeeding] = useState(false);
  const [triggerIds, setTriggerIds] = useState<string[]>([]);
  const [ackNote, setAckNote] = useState("");
  const [pocket, setPocket] = useState<Json | null>(null);
  const [busy, setBusy] = useState(false);
  const [soapNote, setSoapNote] = useState("");
  const [blend, setBlend] = useState<{ herb_id: string; common_name: string; parts: number }[]>([]);
  const [blendName, setBlendName] = useState("");
  const [openCitation, setOpenCitation] = useState<string | null>(null);
  const [overrideFramework, setOverrideFramework] = useState("");
  const [overridePattern, setOverridePattern] = useState("");
  const [overrideNote, setOverrideNote] = useState("");

  const call = useCallback(async (payload: Json): Promise<Json | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const res = await fetch(EF_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 403) { setForbidden(true); return null; }
    if (!res.ok) { setError(data?.error ?? `Request failed (${res.status})`); return null; }
    return data;
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      const [ref, ros] = await Promise.all([call({ action: "reference" }), call({ action: "roster" })]);
      if (ref) setReference(ref);
      if (ros) setRoster(ros);
    })();
  }, [authLoading, user, call]);

  const loadClient = useCallback(async (id: string) => {
    setClientId(id);
    setClient(null); setEncounter(null); setPocket(null); setTriggerIds([]); setComplaintId("");
    if (!id) return;
    const data = await call({ action: "client", personProfileId: id });
    if (data) setClient(data);
  }, [call]);

  async function startEncounter() {
    setBusy(true);
    const data = await call({
      action: "encounter_save",
      personProfileId: clientId,
      chiefComplaintId: complaintId || null,
      pregnant, breastfeeding,
      triggerIds,
      soap: soapNote ? { s: soapNote } : null,
    });
    setBusy(false);
    if (data?.encounter?.id) {
      setEncounter(data.encounter);
      await runPocket(data.encounter.id);
    }
  }

  async function runPocket(encId?: string) {
    setBusy(true);
    const data = await call({
      action: "pocket",
      personProfileId: clientId,
      encounterId: encId ?? encounter?.id,
      framework: framework || null,
      patternId: patternId || null,
    });
    setBusy(false);
    if (data) setPocket(data.pocket);
  }

  async function acknowledgeReferOut() {
    if (!ackNote.trim()) return;
    setBusy(true);
    const data = await call({ action: "ack_refer_out", encounterId: encounter.id, note: ackNote.trim() });
    setBusy(false);
    if (data?.encounter?.id) {
      setEncounter(data.encounter);
      await runPocket(data.encounter.id);
    }
  }

  async function applyOverride() {
    if (!overrideFramework || !overridePattern) return;
    setBusy(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/record-diagnostic-completion`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({
        personProfileId: clientId,
        quizVersion: "mf-v1",
        administeredBy: "practitioner",
        overrides: [{ framework: overrideFramework, pattern_id: overridePattern, role: "primary", note: overrideNote || null }],
      }),
    });
    setBusy(false);
    if (res.ok) {
      setOverrideFramework(""); setOverridePattern(""); setOverrideNote("");
      await loadClient(clientId);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data?.error?.message ?? data?.error ?? "Override failed");
    }
  }

  async function saveBlend() {
    if (!blend.length) return;
    setBusy(true);
    const data = await call({
      action: "formulary_save",
      personProfileId: clientId,
      name: blendName || "Untitled blend",
      items: blend.map((b, i) => ({ herb_id: b.herb_id, parts: b.parts, sort_order: (i + 1) * 10 })),
    });
    setBusy(false);
    if (data?.formulary?.id) {
      setBlend([]); setBlendName("");
      await loadClient(clientId);
    }
  }

  const lensPatterns: Json[] = useMemo(() => {
    if (!reference || !framework) return [];
    const l = reference.lenses[framework] ?? [];
    return l.map((p: Json) => ({
      id: p.pattern_id ?? p.constitution_id ?? p.dosha_id,
      label: p.name ?? p.pattern_name ?? p.dosha_name,
    }));
  }, [reference, framework]);

  const readingsByLens: Record<string, Json[]> = useMemo(() => {
    const out: Record<string, Json[]> = {};
    for (const r of client?.readings ?? []) (out[r.framework] ??= []).push(r);
    return out;
  }, [client]);

  const disagreements: Json[] = client?.completions?.[0]?.framework_readings?.disagreements ?? [];
  const latest = client?.completions?.[0];
  const previous = client?.completions?.[1];

  if (authLoading) return null;
  if (!user) return <div className="p-8 font-body">Sign in required.</div>;
  if (forbidden) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center">
        <h1 className="font-display text-xl mb-2">Practitioner tools</h1>
        <p className="font-body text-sm text-muted-foreground">
          This workspace is part of the Practitioner tier, which isn&apos;t open yet.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 print:p-0">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-baseline justify-between mb-6 print:hidden">
          <div>
            <h1 className="font-display text-2xl">Practitioner clinic</h1>
            <p className="font-body text-xs text-muted-foreground">
              Terrain-first clinical decision support. Every claim carries its two sources; every safety
              verdict is shown, never hidden. Education for licensed judgment — not a prescription.
            </p>
          </div>
        </div>

        {error && (
          <p className="font-body text-sm text-destructive mb-4 print:hidden">{error}
            <button className="underline ml-2" onClick={() => setError(null)}>dismiss</button>
          </p>
        )}

        {/* Client picker */}
        <div className="flex flex-wrap items-center gap-3 mb-6 print:hidden">
          <label className="font-body text-sm">Active client</label>
          <select value={clientId} onChange={(e) => loadClient(e.target.value)}
                  className="rounded-md border bg-background px-3 py-2 text-sm min-w-[220px]">
            <option value="">— choose —</option>
            {(roster?.clients ?? []).map((c: Json) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {client?.profile && (
            <span className="font-body text-xs text-muted-foreground">
              {client.profile.profile_kind ?? "adult"} · last assessment {fmtDate(client.profile.diagnostic_completed_at)}
            </span>
          )}
        </div>

        {client && (
          <>
            {/* Standing readings, all four lenses (PD-2), adjusted markers (PD-8),
                disagreement flags (PD-10), re-take delta */}
            <section className="grid md:grid-cols-4 gap-3 mb-6 print:hidden">
              {(["eden", "western", "ayurveda", "tcm"] as const).map((fw) => {
                const rows = readingsByLens[fw] ?? [];
                const adjusted = rows.find((r) => r.reading_kind === "adjusted" && r.role === "primary");
                const computed = rows.find((r) => r.reading_kind === "computed" && r.role === "primary");
                const secondary = rows.find((r) => r.reading_kind === (adjusted ? "adjusted" : "computed") && r.role === "secondary");
                const standing = adjusted ?? computed;
                const hasDisagreement = disagreements.some((d: Json) => d.framework === fw);
                return (
                  <div key={fw} className="rounded-lg border p-3">
                    <p className="font-accent text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                      {FRAMEWORK_LABELS[fw]}
                    </p>
                    <p className="font-body text-sm font-medium">
                      {standing ? standing.pattern_id : "No reading"}
                      {secondary && <span className="text-muted-foreground font-normal"> + {secondary.pattern_id}</span>}
                    </p>
                    <p className="font-body text-[11px] text-muted-foreground">
                      {standing?.confidence != null && `confidence ${Math.round(standing.confidence * 100)}%`}
                      {adjusted && <span className="ml-1 rounded bg-[#C5A44E]/20 px-1">practitioner-adjusted</span>}
                      {hasDisagreement && <span className="ml-1 rounded bg-destructive/15 px-1">lens disagreement</span>}
                    </p>
                  </div>
                );
              })}
              {/* Multi-system terrain analysis (Lock #37 Layer 3) */}
              {client.tissue_states?.length > 0 && (
                <div className="md:col-span-4 rounded-lg border p-3">
                  <p className="font-accent text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                    Terrain by body system
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {client.tissue_states.map((t: Json) => (
                      <span key={t.body_system_id} title={t.tissue_states?.description ?? ""}
                            className="rounded-full border px-2.5 py-1 font-body text-xs">
                        <strong>{t.body_systems?.system_name ?? t.body_system_id}</strong>
                        {": "}{t.tissue_states?.state_name ?? t.tissue_state_id}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {latest && previous && (
                <div className="md:col-span-4 rounded-lg border p-3">
                  <p className="font-accent text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Re-take delta</p>
                  <p className="font-body text-xs">
                    {(["temperature_score", "moisture_score", "tone_score"] as const).map((k) => {
                      const d = (latest[k] ?? 0) - (previous[k] ?? 0);
                      return `${k.replace("_score", "")}: ${d >= 0 ? "+" : ""}${d.toFixed(2)}  `;
                    })}
                    <span className="text-muted-foreground">({fmtDate(previous.completed_at)} → {fmtDate(latest.completed_at)})</span>
                  </p>
                </div>
              )}
            </section>

            {/* Practitioner override (PD-8): stores adjusted ALONGSIDE computed */}
            <details className="mb-6 print:hidden">
              <summary className="font-body text-sm cursor-pointer">Adjust a reading (stores both)</summary>
              <div className="flex flex-wrap gap-2 mt-2 items-center">
                <select value={overrideFramework} onChange={(e) => { setOverrideFramework(e.target.value); setOverridePattern(""); }}
                        className="rounded-md border bg-background px-2 py-1.5 text-sm">
                  <option value="">framework…</option>
                  {Object.entries(FRAMEWORK_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select value={overridePattern} onChange={(e) => setOverridePattern(e.target.value)}
                        className="rounded-md border bg-background px-2 py-1.5 text-sm" disabled={!overrideFramework}>
                  <option value="">pattern…</option>
                  {(reference?.lenses?.[overrideFramework] ?? []).map((p: Json) => {
                    const id = p.pattern_id ?? p.constitution_id ?? p.dosha_id;
                    return <option key={id} value={id}>{p.name ?? p.pattern_name ?? p.dosha_name}</option>;
                  })}
                </select>
                <input value={overrideNote} onChange={(e) => setOverrideNote(e.target.value)} placeholder="clinical rationale (audited)"
                       className="rounded-md border bg-background px-2 py-1.5 text-sm flex-1 min-w-[200px]" />
                <Button size="sm" onClick={applyOverride} disabled={busy || !overrideFramework || !overridePattern}>Apply</Button>
              </div>
            </details>

            {/* Encounter intake → refer-out gate → pocket query */}
            <section className="rounded-lg border p-4 mb-6 print:hidden">
              <h2 className="font-display text-lg mb-3">Encounter</h2>
              <div className="grid md:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="font-body text-xs text-muted-foreground">Chief complaint</label>
                  <select value={complaintId} onChange={(e) => setComplaintId(e.target.value)}
                          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm">
                    <option value="">— select —</option>
                    {(reference?.complaints ?? []).map((c: Json) => (
                      <option key={c.complaint_id} value={c.complaint_id}>{c.complaint_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-body text-xs text-muted-foreground">Framework lens</label>
                  <select value={framework} onChange={(e) => { setFramework(e.target.value); setPatternId(""); }}
                          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm">
                    <option value="">All lenses (client readings)</option>
                    {Object.entries(FRAMEWORK_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-body text-xs text-muted-foreground">Pattern under the lens</label>
                  <select value={patternId} onChange={(e) => setPatternId(e.target.value)} disabled={!framework}
                          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm">
                    <option value="">Client&apos;s reading</option>
                    {lensPatterns.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 mb-3 font-body text-sm">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={pregnant} onChange={(e) => setPregnant(e.target.checked)} /> Pregnant
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={breastfeeding} onChange={(e) => setBreastfeeding(e.target.checked)} /> Breastfeeding
                </label>
              </div>
              <div className="mb-3">
                <p className="font-body text-xs text-muted-foreground mb-1">
                  Red-flag screen (any checked item blocks herb suggestions until acknowledged)
                </p>
                <div className="grid md:grid-cols-2 gap-1 max-h-40 overflow-y-auto border rounded p-2">
                  {(reference?.triggers ?? []).map((t: Json) => (
                    <label key={t.trigger_id} className="font-body text-xs flex items-start gap-1.5">
                      <input
                        type="checkbox"
                        checked={triggerIds.includes(t.trigger_id)}
                        onChange={(e) => setTriggerIds((ids) =>
                          e.target.checked ? [...ids, t.trigger_id] : ids.filter((i) => i !== t.trigger_id))}
                      />
                      <span>{t.trigger_description}</span>
                    </label>
                  ))}
                </div>
              </div>
              <textarea value={soapNote} onChange={(e) => setSoapNote(e.target.value)} rows={2}
                        placeholder="Subjective note (kept in the encounter record)"
                        className="w-full rounded-md border bg-background px-2 py-1.5 text-sm mb-3" />
              <div className="flex gap-2">
                <Button onClick={startEncounter} disabled={busy || !clientId}>
                  {encounter ? "Update encounter & re-run" : "Start encounter → match herbs"}
                </Button>
                <Button variant="outline" onClick={async () => {
                  const data = await call({ action: "case_file", personProfileId: clientId });
                  if (data?.case_file) printCaseFile(data.case_file);
                }}>Export case file (PDF)</Button>
                <Button variant="ghost" onClick={async () => {
                  const data = await call({ action: "case_file", personProfileId: clientId });
                  if (data?.case_file) {
                    const blob = new Blob([JSON.stringify(data.case_file, null, 2)], { type: "application/json" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = `case-file-${client.profile.name.replace(/\s+/g, "-")}.json`;
                    a.click();
                  }
                }}>JSON</Button>
              </div>
            </section>

            {/* PD-9: refer-out BLOCK */}
            {pocket?.blocked && (
              <section className="rounded-lg border-2 border-destructive/60 bg-destructive/5 p-4 mb-6 print:hidden">
                <h2 className="font-display text-lg mb-1">Refer out first</h2>
                <p className="font-body text-sm mb-2">
                  Herb suggestions are withheld — the intake tripped {pocket.triggers?.length} red-flag condition{pocket.triggers?.length > 1 ? "s" : ""}:
                </p>
                <ul className="font-body text-sm mb-3 list-disc pl-5">
                  {pocket.triggers?.map((t: Json) => (
                    <li key={t.trigger_id}><strong>{t.description}</strong> — {t.action}</li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <input value={ackNote} onChange={(e) => setAckNote(e.target.value)}
                         placeholder="Acknowledgment: how the referral was handled (required, audited)"
                         className="flex-1 rounded-md border bg-background px-2 py-1.5 text-sm" />
                  <Button variant="destructive" onClick={acknowledgeReferOut} disabled={busy || !ackNote.trim()}>
                    Acknowledge & continue
                  </Button>
                </div>
              </section>
            )}

            {/* The pocket list (PD-11: all lenses, Avoid wins) */}
            {pocket && !pocket.blocked && (
              <section className="mb-6">
                <div className="flex items-baseline justify-between mb-2 print:hidden">
                  <h2 className="font-display text-lg">
                    Matched herbs {pocket.herbs?.length ? `(${pocket.herbs.length})` : ""}
                  </h2>
                  <p className="font-body text-[11px] text-muted-foreground">
                    Safety-filtered for: {pocket.population?.pregnant && "pregnancy · "}
                    {pocket.population?.breastfeeding && "breastfeeding · "}
                    {pocket.population?.kind === "child" && "pediatric · "}
                    {pocket.population?.age >= 65 && "geriatric · "}
                    medication interactions
                  </p>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  {(pocket.herbs ?? []).map((h: Json) => (
                    <div key={h.herb_id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-body text-sm font-medium">{h.common_name}
                          <span className="text-muted-foreground font-normal italic text-xs"> {h.latin_name}</span>
                        </p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                          h.badge === "avoid" ? "bg-destructive/15 text-destructive" : "bg-[#2C3E2D]/10 text-[#2C3E2D]"}`}>
                          {h.badge}{h.has_conflict ? " · conflict" : ""}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 my-1.5">
                        {Object.entries(h.lens_verdicts ?? {}).map(([fw, v]: [string, Json]) => (
                          <button key={fw} type="button"
                            onClick={() => setOpenCitation(openCitation === `${h.herb_id}:${fw}` ? null : `${h.herb_id}:${fw}`)}
                            className={`rounded px-1.5 py-0.5 text-[10px] border ${
                              v.verdict === "avoid" ? "border-destructive/50 text-destructive" : "border-[#2C3E2D]/30 text-[#2C3E2D]"}`}>
                            {fw}: {v.verdict} ({v.pattern_id})
                          </button>
                        ))}
                      </div>
                      {Object.entries(h.lens_verdicts ?? {}).map(([fw, v]: [string, Json]) =>
                        openCitation === `${h.herb_id}:${fw}` ? (
                          <div key={fw} className="rounded bg-muted/50 p-2 my-1 font-body text-[11px]">
                            {v.note && <p className="mb-1">{v.note}</p>}
                            <p><strong>Primary:</strong> {v.primary_citation?.author} — {v.primary_citation?.title} ({v.primary_citation?.year})</p>
                            <p><strong>Secondary:</strong> {v.secondary_citation?.author} — {v.secondary_citation?.title} ({v.secondary_citation?.year})</p>
                          </div>
                        ) : null,
                      )}
                      {(h.dosage_notes || h.preparation_methods) && (
                        <p className="font-body text-[11px] text-muted-foreground my-1">
                          {h.part_used && <><strong>Part:</strong> {h.part_used} · </>}
                          {h.preparation_methods && <><strong>Prep:</strong> {h.preparation_methods} · </>}
                          {h.dosage_notes && <><strong>Dosing:</strong> {h.dosage_notes}</>}
                        </p>
                      )}
                      {h.caution_items && (
                        <ul className="font-body text-[11px] text-destructive/90 list-disc pl-4 my-1">
                          {h.caution_items.map((c: Json, i: number) => (
                            <li key={i}>{c.kind}: {c.entity} — {c.guidance}</li>
                          ))}
                        </ul>
                      )}
                      <Button size="sm" variant="outline" className="mt-1 print:hidden"
                        onClick={() => setBlend((b) => b.some((x) => x.herb_id === h.herb_id) ? b
                          : [...b, { herb_id: h.herb_id, common_name: h.common_name, parts: 1 }])}>
                        + Add to blend
                      </Button>
                    </div>
                  ))}
                </div>
                {pocket.avoid_list?.length > 0 && (
                  <details className="mt-3 print:hidden">
                    <summary className="font-body text-sm cursor-pointer">
                      Avoid / flagged for this client ({pocket.avoid_list.length})
                    </summary>
                    <div className="grid md:grid-cols-2 gap-2 mt-2">
                      {pocket.avoid_list.map((h: Json) => (
                        <div key={h.herb_id} className="rounded border border-destructive/30 p-2">
                          <p className="font-body text-xs font-medium">{h.common_name}
                            <span className="ml-1 rounded bg-destructive/15 text-destructive px-1 text-[10px] uppercase">
                              {h.excluded ? "excluded" : h.badge}{h.has_conflict ? " · conflict" : ""}
                            </span>
                          </p>
                          {(h.caution_items ?? []).map((c: Json, i: number) => (
                            <p key={i} className="font-body text-[11px] text-muted-foreground">{c.kind}: {c.entity} — {c.guidance}</p>
                          ))}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </section>
            )}

            {/* Formulary builder + batch print */}
            {blend.length > 0 && (
              <section className="rounded-lg border p-4 mb-6">
                <h2 className="font-display text-lg mb-2">Formulary</h2>
                <input value={blendName} onChange={(e) => setBlendName(e.target.value)} placeholder="Blend name"
                       className="rounded-md border bg-background px-2 py-1.5 text-sm mb-2 w-full max-w-sm print:hidden" />
                <table className="w-full font-body text-sm mb-3">
                  <thead><tr className="text-left text-xs text-muted-foreground">
                    <th className="py-1">Herb</th><th>Parts</th><th className="print:hidden"></th></tr></thead>
                  <tbody>
                    {blend.map((b, i) => (
                      <tr key={b.herb_id} className="border-t">
                        <td className="py-1.5">{b.common_name}</td>
                        <td>
                          <input type="number" min={0.5} step={0.5} value={b.parts}
                                 onChange={(e) => setBlend((arr) => arr.map((x, j) => j === i ? { ...x, parts: Number(e.target.value) } : x))}
                                 className="w-16 rounded border bg-background px-1 py-0.5 print:border-0" />
                        </td>
                        <td className="print:hidden">
                          <button className="text-xs text-destructive underline"
                                  onClick={() => setBlend((arr) => arr.filter((_, j) => j !== i))}>remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex gap-2 print:hidden">
                  <Button onClick={saveBlend} disabled={busy}>Save formulary</Button>
                  <Button variant="outline" onClick={() => window.print()}>Print</Button>
                </div>
              </section>
            )}

            {/* Saved formularies + encounters (print-friendly) */}
            {client.formularies?.length > 0 && (
              <details className="mb-4 print:hidden">
                <summary className="font-body text-sm cursor-pointer">Saved formularies ({client.formularies.length})</summary>
                {client.formularies.map((f: Json) => (
                  <div key={f.id} className="rounded border p-2 mt-2 font-body text-xs">
                    <strong>{f.name}</strong> — {(f.items ?? []).map((it: Json) => `${it.common_name} ${it.parts} ${it.unit}`).join(", ")}
                  </div>
                ))}
              </details>
            )}
            {client.encounters?.length > 0 && (
              <details className="mb-8 print:hidden">
                <summary className="font-body text-sm cursor-pointer">Encounter history ({client.encounters.length})</summary>
                {client.encounters.map((e: Json) => (
                  <div key={e.id} className="rounded border p-2 mt-2 font-body text-xs">
                    {fmtDate(e.encounter_date)} · {e.chief_complaint_id ?? "no complaint"} · {e.status}
                    {e.refer_out_trigger_ids?.length > 0 && (
                      <span className="ml-1 text-destructive">
                        {e.refer_out_acknowledged_at ? "refer-out acknowledged" : "REFER-OUT PENDING"}
                      </span>
                    )}
                    {e.soap?.s && <p className="text-muted-foreground mt-1">{e.soap.s}</p>}
                  </div>
                ))}
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}
