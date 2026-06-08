// CrmTab — the CRM view on /founder. Self-contained so FounderLeads.tsx only
// needs a tiny wiring change. Pulls the two founder-gated RPCs:
//   founder_crm_summary -> exact segment counts (server-aggregated, NOT subject
//     to the 1000-row API cap)
//   founder_crm_feed    -> the per-person rows for the table (recent first)
// Both enforce is_founder() server-side; the underlying crm_people view is
// revoked from anon/authenticated, so PII is only reachable via these RPCs.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CrmSummary {
  total: number;
  leads: number;
  quiz_takers: number;
  customers: number;
  homeschool: number;
  unsubscribed: number;
  by_stage: { stage: string; count: number }[];
  by_pattern: { pattern: string; count: number }[];
  by_source: { source: string; count: number }[];
}

interface CrmRow {
  email: string;
  first_name: string | null;
  last_name: string | null;
  stage: string;
  first_seen: string;
  source: string | null;
  utm_source: string | null;
  quiz_pattern: string | null;
  homeschool_bands: string | null;
  subscription_status: string | null;
  unsubscribed: boolean;
}

function fmtCT(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function CrmTab({ since }: { since: string }) {
  const [summary, setSummary] = useState<CrmSummary | null>(null);
  const [rows, setRows] = useState<CrmRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, feedRes] = await Promise.all([
        supabase.rpc("founder_crm_summary" as never, { p_since: since } as never),
        supabase.rpc("founder_crm_feed" as never, { p_since: since } as never),
      ]);
      if (sumRes.error) throw sumRes.error;
      if (feedRes.error) throw feedRes.error;
      setSummary((sumRes.data as CrmSummary | null) ?? null);
      setRows((feedRes.data as CrmRow[] | null) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the CRM.");
    } finally {
      setLoading(false);
    }
  }, [since]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
        <p className="font-body text-sm text-destructive">{error}</p>
      </div>
    );
  }
  if (!summary && loading) {
    return <p className="font-body text-sm text-muted-foreground">Loading CRM…</p>;
  }
  if (!summary) return null;

  const stat = (label: string, value: number) => (
    <div className="rounded-lg border border-border p-4">
      <p className="font-accent text-[10px] tracking-[0.15em] uppercase text-muted-foreground">{label}</p>
      <p className="font-serif text-2xl font-bold" style={{ color: "hsl(var(--eden-bark))" }}>
        {value.toLocaleString()}
      </p>
    </div>
  );

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {stat("People", summary.total)}
        {stat("Leads", summary.leads)}
        {stat("Quiz-takers", summary.quiz_takers)}
        {stat("Customers", summary.customers)}
        {stat("Homeschool", summary.homeschool)}
        {stat("Unsubscribed", summary.unsubscribed)}
      </div>

      {summary.by_pattern && summary.by_pattern.length > 0 && (
        <section className="mb-8">
          <p className="font-accent text-xs tracking-[0.2em] uppercase mb-2" style={{ color: "hsl(var(--eden-gold))" }}>
            Quiz patterns
          </p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-muted/40">
                  <th className="px-3 py-2 font-accent text-[10px] tracking-wider uppercase text-muted-foreground">Pattern</th>
                  <th className="px-3 py-2 font-accent text-[10px] tracking-wider uppercase text-muted-foreground text-right">People</th>
                </tr>
              </thead>
              <tbody>
                {summary.by_pattern.map((p) => (
                  <tr key={p.pattern} className="border-t border-border">
                    <td className="px-3 py-2 font-body text-sm">{p.pattern}</td>
                    <td className="px-3 py-2 font-body text-sm text-right font-semibold">{p.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="mb-10">
        <p className="font-accent text-xs tracking-[0.2em] uppercase mb-2" style={{ color: "hsl(var(--eden-gold))" }}>
          People
          {rows && rows.length >= 1000
            ? " · most recent 1,000 (use the window filter to narrow)"
            : rows
            ? ` · ${rows.length.toLocaleString()}`
            : ""}
        </p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-muted/40">
                {["Name", "Email", "Stage", "Quiz pattern", "Homeschool", "Source", "Joined (CT)"].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 font-accent text-[10px] tracking-wider uppercase text-muted-foreground whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((r) => (
                <tr key={r.email} className="border-t border-border">
                  <td className="px-3 py-2 font-body text-sm whitespace-nowrap">
                    {[r.first_name, r.last_name].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="px-3 py-2 font-body text-sm">
                    {r.email}
                    {r.unsubscribed ? <span className="ml-1 text-[10px] uppercase text-destructive">unsub</span> : null}
                  </td>
                  <td className="px-3 py-2 font-body text-sm">{r.stage}</td>
                  <td className="px-3 py-2 font-body text-sm">{r.quiz_pattern ?? "—"}</td>
                  <td className="px-3 py-2 font-body text-sm whitespace-nowrap">{r.homeschool_bands ?? "—"}</td>
                  <td className="px-3 py-2 font-body text-sm">{r.source ?? "—"}</td>
                  <td className="px-3 py-2 font-body text-sm text-muted-foreground whitespace-nowrap">{fmtCT(r.first_seen)}</td>
                </tr>
              ))}
              {rows && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center font-body text-sm text-muted-foreground">
                    No people in this window.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
