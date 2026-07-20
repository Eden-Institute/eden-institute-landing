// FeedbackTriageTab — founder triage surface for the structured feedback
// intake (Workstream B, Feature_Request_Intake_Spec.md).
//
// Reads feedback_submissions directly (the select policy admits the founder
// via is_founder()); every WRITE goes through the founder-gated SECURITY
// DEFINER RPCs (feedback_triage / feedback_merge / feedback_promote) — the
// same authority pattern as the dashboard RPCs (Lock #78). Promotion creates
// a founder_punch_list row, which the existing daily digest already carries;
// punch-list status changes reflect back to submissions via trigger.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface Submission {
  id: string;
  created_at: string;
  message: string;
  email: string | null;
  page_url: string | null;
  type: string | null;
  area: string | null;
  sub_area: string | null;
  title: string | null;
  description: string | null;
  impact: string | null;
  frequency: string | null;
  status: string;
  merged_into: string | null;
  tier: string | null;
  punch_list_id: string | null;
  reach: number | null;
  impact_score: number | null;
  effort: number | null;
}

const OPEN_STATUSES = ["new", "triaged", "planned", "in_progress"];
const rice = (s: Submission) =>
  ((s.reach ?? 3) * (s.impact_score ?? 3)) / Math.max(s.effort ?? 3, 1);

export default function FeedbackTriageTab() {
  const [rows, setRows] = useState<Submission[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    // try/catch, not just the { error } destructure. That only covers PostgREST-level
    // errors; a THROWN exception (offline, DNS failure, aborted fetch) escaped entirely,
    // left `rows` null, and pinned the tab on "Loading feedback…" forever with nothing
    // but an unhandled rejection in the console. This was the one place in the directory
    // whose loading state could never clear.
    try {
      const { data, error: e } = await supabase
        .from("feedback_submissions" as never)
        .select("id,created_at,message,email,page_url,type,area,sub_area,title,description,impact,frequency,status,merged_into,tier,punch_list_id,reach,impact_score,effort")
        .order("created_at", { ascending: false })
        .limit(200);
      if (e) throw e;
      setRows((data ?? []) as unknown as Submission[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load feedback.");
      // Leave rows as-is rather than nulling them: a refresh that fails should not
      // discard the list already on screen.
      setRows((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function rpc(name: string, args: Record<string, unknown>, id: string) {
    setBusy(id);
    // Clear first. Without this a stale message from a previous failure persists and
    // can blank the tab on the next render.
    setError(null);
    const { error: e } = await supabase.rpc(name as never, args as never);
    if (e) setError(e.message);
    else await load();
    setBusy(null);
  }

  // Deliberately NOT an early return on error. A single failed dropdown write used to
  // replace the entire triage list -- every open item, every control -- with one line of
  // red text, no retry and no way back but a page reload. Five of the seven tabs in this
  // directory already show the error as a banner and keep the data; that is the better
  // pattern and it wins here.
  if (!rows) {
    return error
      ? <p className="font-body text-sm text-destructive">{error}</p>
      : <p className="font-body text-sm text-muted-foreground">Loading feedback…</p>;
  }

  const open = rows
    .filter((r) => OPEN_STATUSES.includes(r.status))
    .sort((a, b) => {
      // Clinical/safety first (expedited), then inbox order, then RICE.
      const exp = Number(b.area === "clinical_safety") - Number(a.area === "clinical_safety");
      if (exp) return exp;
      const inbox = Number(b.status === "new") - Number(a.status === "new");
      if (inbox) return inbox;
      return rice(b) - rice(a);
    });
  const closed = rows.filter((r) => !OPEN_STATUSES.includes(r.status));

  return (
    <section className="mb-8">
      <h2 className="font-serif text-xl font-bold mb-1" style={{ color: "hsl(var(--eden-bark))" }}>
        Feedback triage
      </h2>
      <p className="font-body text-xs text-muted-foreground mb-4">
        {open.length} open · {closed.length} closed. Promote sends an item to the punch list (daily digest); punch-list status flows back automatically.
        {rows.length >= 200 && " Showing the 200 most recent."}
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 flex items-start justify-between gap-4">
          <p className="font-body text-sm text-destructive">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="font-body text-xs underline text-destructive shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="space-y-3">
        {open.map((s) => (
          <div
            key={s.id}
            className="rounded-lg border p-4"
            style={s.area === "clinical_safety" ? { borderColor: "hsl(0 65% 45% / 0.5)", background: "hsl(0 65% 45% / 0.04)" } : {}}
          >
            <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
              <p className="font-body text-sm font-medium">{s.title || s.message.slice(0, 100)}</p>
              <span className="font-accent text-[10px] uppercase tracking-widest rounded-full border px-2 py-0.5">{s.status}</span>
            </div>
            <p className="font-body text-xs text-muted-foreground mb-2 whitespace-pre-wrap">{s.description || s.message}</p>
            <p className="font-body text-[11px] text-muted-foreground mb-3">
              {[s.type, s.area && `${s.area}${s.sub_area ? " / " + s.sub_area : ""}`, s.impact, s.frequency, s.tier && `tier: ${s.tier}`, s.email]
                .filter(Boolean).join(" · ")}
              {s.area === "clinical_safety" && <strong> · EXPEDITED</strong>}
              {" · "}{new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              {(["reach", "impact_score", "effort"] as const).map((f) => (
                <label key={f} className="font-body text-[11px] text-muted-foreground">
                  {f === "impact_score" ? "impact" : f}{" "}
                  <select
                    value={s[f] ?? ""}
                    disabled={busy === s.id}
                    onChange={(e) =>
                      rpc("feedback_triage", {
                        p_id: s.id,
                        p_status: s.status === "new" ? "triaged" : s.status,
                        p_reach: f === "reach" ? Number(e.target.value) : s.reach,
                        p_impact_score: f === "impact_score" ? Number(e.target.value) : s.impact_score,
                        p_effort: f === "effort" ? Number(e.target.value) : s.effort,
                      }, s.id)
                    }
                    className="rounded border bg-background px-1 py-0.5 text-xs"
                  >
                    <option value="">–</option>
                    {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
              ))}
              <span className="font-body text-[11px] text-muted-foreground">RICE {rice(s).toFixed(1)}</span>

              <select
                value=""
                disabled={busy === s.id}
                onChange={(e) => e.target.value && rpc("feedback_triage", {
                  p_id: s.id, p_status: e.target.value,
                  p_reach: s.reach, p_impact_score: s.impact_score, p_effort: s.effort,
                }, s.id)}
                className="rounded border bg-background px-1 py-0.5 text-xs"
              >
                <option value="">status…</option>
                {["triaged", "planned", "in_progress", "shipped", "declined"].map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>

              <select
                value={mergeTarget[s.id] ?? ""}
                disabled={busy === s.id}
                onChange={(e) => setMergeTarget((m) => ({ ...m, [s.id]: e.target.value }))}
                className="rounded border bg-background px-1 py-0.5 text-xs max-w-[180px]"
              >
                <option value="">merge into…</option>
                {open.filter((o) => o.id !== s.id).map((o) => (
                  <option key={o.id} value={o.id}>{(o.title || o.message).slice(0, 40)}</option>
                ))}
              </select>
              {mergeTarget[s.id] && (
                <Button size="sm" variant="outline" disabled={busy === s.id}
                  onClick={() => { rpc("feedback_merge", { p_duplicate: s.id, p_canonical: mergeTarget[s.id] }, s.id); setMergeTarget((m) => ({ ...m, [s.id]: "" })); }}>
                  Merge
                </Button>
              )}

              {s.punch_list_id ? (
                <span className="font-body text-[11px] text-muted-foreground">On punch list ✓</span>
              ) : (
                <Button size="sm" disabled={busy === s.id}
                  onClick={() => rpc("feedback_promote", { p_id: s.id }, s.id)}>
                  Promote to punch list
                </Button>
              )}
            </div>
          </div>
        ))}
        {open.length === 0 && (
          <p className="font-body text-sm text-muted-foreground">Inbox zero — no open feedback.</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowClosed((v) => !v)}
        className="font-body text-xs underline underline-offset-2 mt-4 text-muted-foreground"
      >
        {showClosed ? "Hide" : "Show"} closed ({closed.length})
      </button>
      {showClosed && (
        <ul className="mt-2 space-y-1">
          {closed.map((s) => (
            <li key={s.id} className="font-body text-xs text-muted-foreground flex justify-between gap-2 rounded border px-3 py-1.5">
              <span className="line-clamp-1">{s.title || s.message}</span>
              <span className="shrink-0 uppercase text-[10px] tracking-wide">{s.status}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
