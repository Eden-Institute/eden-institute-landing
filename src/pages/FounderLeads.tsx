// src/pages/FounderLeads.tsx
//
// Founder-only lead-magnet activity dashboard. Mounted at /founder, wrapped in
// <RequireAuth> (App.tsx) so unauthenticated visitors are bounced to sign-in.
//
// Security model:
//   - The REAL access boundary is server-side: founder_lead_feed() is a
//     SECURITY DEFINER RPC gated by is_founder() (JWT email check). Even the
//     other authenticated accounts get "Not authorized" from the RPC.
//   - The email check below is UX only — it shows a friendly restricted notice
//     to a logged-in non-founder instead of a raw RPC error.
//
// Data: one RPC call returns the PII capture rows in a window; counts, the
// per-magnet breakdown, and the daily strip are all derived client-side. No
// dependence on the anon v_lead_magnet_stats view — the whole page is behind
// founder auth (Lock #76 amendment).

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

const FOUNDER_EMAIL = "hello@edeninstitute.health";

interface LeadRow {
  email: string;
  first_name: string | null;
  funnel: string;
  source: string;
  entered_at: string;
  source_url: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  unsubscribed: boolean;
}

interface WindowOption {
  label: string;
  days: number | null; // null = all time
}

const WINDOWS: WindowOption[] = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "All time", days: null },
];

// Mirrors the (funnel, source) → label mapping in the notify-founder-digest EF.
// Keep in lockstep with supabase/functions/notify-founder-digest/index.ts.
function magnetLabel(funnel: string, source: string): string {
  if (funnel === "quiz_funnel") return "Constitution Quiz";
  if (funnel === "homeschool") {
    if (source === "sprouts_magnet") return "Homeschool · Sprouts (K-2) Magnet";
    if (source === "seedlings_magnet") return "Homeschool · Seedlings (3-5) Magnet";
    if (source === "reserve") return "Homeschool · Eden's Table Founders Club";
    return "Homeschool · General CTA";
  }
  if (funnel === "edens_table") return "Eden's Table · General Waitlist";
  if (funnel === "course_tier2") return "Tier 2 (Root) · Waitlist";
  if (funnel === "app_beta") return "Apothecary App · Beta Waitlist";
  if (funnel === "community") return "Community Waitlist";
  return `${funnel} · ${source}`;
}

function fmtDateTimeCT(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function dayKeyCT(iso: string): string {
  // en-CA yields YYYY-MM-DD; pin to Central so day buckets match the digest.
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

function dayLabelCT(key: string): string {
  // key is YYYY-MM-DD; render as "May 30" without TZ re-shift.
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
}

export default function FounderLeads() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [windowIdx, setWindowIdx] = useState(1); // default 30 days
  const [rows, setRows] = useState<LeadRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);

  const isFounder = !!user && user.email?.toLowerCase() === FOUNDER_EMAIL;

  const load = useCallback(async () => {
    const opt = WINDOWS[windowIdx];
    const since =
      opt.days == null
        ? "2000-01-01T00:00:00Z"
        : new Date(Date.now() - opt.days * 86_400_000).toISOString();

    setLoading(true);
    setError(null);
    // RPC isn't in the generated Database types; cast mirrors the existing
    // `supabase.rpc("current_user_tier" as never)` pattern in this repo.
    const { data, error: rpcError } = await supabase.rpc(
      "founder_lead_feed" as never,
      { p_since: since } as never,
    );
    if (rpcError) {
      setError(rpcError.message || "Could not load lead activity.");
      setRows(null);
    } else {
      setRows((data as LeadRow[] | null) ?? []);
      setFetchedAt(new Date());
    }
    setLoading(false);
  }, [windowIdx]);

  useEffect(() => {
    if (isFounder) load();
  }, [isFounder, load]);

  // ── Derived aggregates ──
  const activeRows = useMemo(() => (rows ?? []).filter((r) => !r.unsubscribed), [rows]);
  const total = activeRows.length;

  const byMagnet = useMemo(() => {
    const m = new Map<string, { count: number; last: string }>();
    for (const r of activeRows) {
      const label = magnetLabel(r.funnel, r.source);
      const cur = m.get(label);
      if (cur) {
        cur.count += 1;
        if (r.entered_at > cur.last) cur.last = r.entered_at;
      } else {
        m.set(label, { count: 1, last: r.entered_at });
      }
    }
    return Array.from(m.entries())
      .map(([label, v]) => ({ label, ...v }))
      .sort((a, b) => b.count - a.count);
  }, [activeRows]);

  const dailyStrip = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of activeRows) {
      const k = dayKeyCT(r.entered_at);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const keys = Array.from(counts.keys()).sort(); // ascending
    const recent = keys.slice(-14);
    const max = recent.reduce((mx, k) => Math.max(mx, counts.get(k) ?? 0), 0);
    return { bars: recent.map((k) => ({ key: k, count: counts.get(k) ?? 0 })), max };
  }, [activeRows]);

  const unsubscribedCount = useMemo(
    () => (rows ?? []).filter((r) => r.unsubscribed).length,
    [rows],
  );

  const lastCapture = activeRows[0]?.entered_at ?? null;

  // ── Auth gates ──
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="font-body text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!isFounder) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-background">
        <div className="max-w-md text-center">
          <p
            className="font-accent text-xs tracking-[0.3em] uppercase mb-3"
            style={{ color: "hsl(var(--eden-gold))" }}
          >
            Restricted
          </p>
          <h1
            className="font-serif text-2xl font-bold mb-3"
            style={{ color: "hsl(var(--eden-bark))" }}
          >
            Founder access only
          </h1>
          <p className="font-body text-muted-foreground mb-6">
            This dashboard is limited to the Eden Institute founder account.
            You're signed in as {user?.email ?? "an unknown account"}.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => signOut()}>
              Sign out
            </Button>
            <Button asChild variant="eden">
              <Link to={ROUTES.HOME}>Home</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Dashboard ──
  return (
    <div className="min-h-screen bg-background px-4 sm:px-6 py-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-2">
          <div>
            <p
              className="font-accent text-xs tracking-[0.3em] uppercase mb-2"
              style={{ color: "hsl(var(--eden-gold))" }}
            >
              The Eden Institute
            </p>
            <h1
              className="font-serif text-3xl font-bold"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              Lead-magnet activity
            </h1>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>

        {/* Window selector */}
        <div className="flex flex-wrap gap-2 mb-6">
          {WINDOWS.map((w, i) => (
            <button
              key={w.label}
              onClick={() => setWindowIdx(i)}
              className="font-body text-sm px-3 py-1 rounded-full border transition-colors"
              style={
                i === windowIdx
                  ? { backgroundColor: "hsl(var(--eden-bark))", color: "white", borderColor: "hsl(var(--eden-bark))" }
                  : { backgroundColor: "transparent", color: "hsl(var(--eden-bark))", borderColor: "hsl(var(--eden-bark) / 0.3)" }
              }
            >
              {w.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
            <p className="font-body text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          <StatCard label="New leads" value={String(total)} />
          <StatCard label="Active magnets" value={String(byMagnet.length)} />
          <StatCard
            label="Last capture"
            value={lastCapture ? fmtDateTimeCT(lastCapture) : "—"}
            small
          />
        </div>

        {/* Daily strip */}
        {dailyStrip.bars.length > 0 && (
          <section className="mb-8">
            <SectionLabel>Recent days (CT)</SectionLabel>
            <div className="flex items-end gap-1.5 h-28 mt-3">
              {dailyStrip.bars.map((b) => (
                <div key={b.key} className="flex-1 flex flex-col items-center justify-end h-full">
                  <span className="font-body text-[10px] text-muted-foreground mb-1">{b.count}</span>
                  <div
                    className="w-full rounded-t"
                    style={{
                      height: `${dailyStrip.max ? Math.max(6, (b.count / dailyStrip.max) * 88) : 6}px`,
                      backgroundColor: "hsl(var(--eden-bark))",
                    }}
                    title={`${dayLabelCT(b.key)}: ${b.count}`}
                  />
                  <span className="font-body text-[9px] text-muted-foreground mt-1 whitespace-nowrap">
                    {dayLabelCT(b.key)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* By magnet */}
        <section className="mb-8">
          <SectionLabel>By magnet</SectionLabel>
          <div className="mt-3 overflow-hidden rounded-lg border border-border">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-muted/40">
                  <Th>Magnet</Th>
                  <Th className="text-right">Leads</Th>
                  <Th>Last capture (CT)</Th>
                </tr>
              </thead>
              <tbody>
                {byMagnet.map((m) => (
                  <tr key={m.label} className="border-t border-border">
                    <Td>{m.label}</Td>
                    <Td className="text-right font-semibold">{m.count}</Td>
                    <Td className="text-muted-foreground whitespace-nowrap">{fmtDateTimeCT(m.last)}</Td>
                  </tr>
                ))}
                {byMagnet.length === 0 && !loading && (
                  <tr>
                    <Td className="text-muted-foreground" colSpan={3}>
                      No captures in this window.
                    </Td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Recent captures */}
        <section className="mb-10">
          <SectionLabel>
            All captures{rows ? ` (${rows.length})` : ""}
            {unsubscribedCount > 0 ? ` · ${unsubscribedCount} unsubscribed` : ""}
          </SectionLabel>
          <div className="mt-3 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-muted/40">
                  <Th>Subscriber</Th>
                  <Th>Magnet</Th>
                  <Th>Captured (CT)</Th>
                  <Th>Attribution</Th>
                </tr>
              </thead>
              <tbody>
                {(rows ?? []).map((r, i) => {
                  const utm = [
                    r.utm_source ? `utm_source=${r.utm_source}` : "",
                    r.utm_campaign ? `utm_campaign=${r.utm_campaign}` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <tr key={`${r.email}-${r.entered_at}-${i}`} className="border-t border-border align-top">
                      <Td>
                        <span className={r.unsubscribed ? "line-through text-muted-foreground" : ""}>
                          {r.email}
                        </span>
                        {r.unsubscribed && (
                          <span className="ml-2 text-[10px] uppercase tracking-wide text-destructive">
                            unsub
                          </span>
                        )}
                        <br />
                        <span className="text-xs text-muted-foreground">{r.first_name ?? "(no name)"}</span>
                      </Td>
                      <Td>{magnetLabel(r.funnel, r.source)}</Td>
                      <Td className="text-muted-foreground whitespace-nowrap">{fmtDateTimeCT(r.entered_at)}</Td>
                      <Td className="text-xs text-muted-foreground">
                        {utm || <span className="opacity-60">direct</span>}
                      </Td>
                    </tr>
                  );
                })}
                {(rows ?? []).length === 0 && !loading && (
                  <tr>
                    <Td className="text-muted-foreground" colSpan={4}>
                      No captures in this window.
                    </Td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <p className="font-body text-xs text-muted-foreground">
          {fetchedAt ? `Updated ${fetchedAt.toLocaleString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit", hour12: true, month: "short", day: "numeric" })} CT · ` : ""}
          Live data — reloads each visit. The daily digest email carries the same captures once per morning.
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-lg border border-border p-4 bg-card">
      <p className="font-accent text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-1">
        {label}
      </p>
      <p
        className={`font-serif font-bold ${small ? "text-base" : "text-2xl"}`}
        style={{ color: "hsl(var(--eden-bark))" }}
      >
        {value}
      </p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="font-accent text-xs tracking-[0.2em] uppercase"
      style={{ color: "hsl(var(--eden-gold))" }}
    >
      {children}
    </p>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-3 py-2 font-accent text-[10px] tracking-wider uppercase text-muted-foreground ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
  colSpan,
}: {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td className={`px-3 py-2 font-body text-sm ${className}`} colSpan={colSpan}>
      {children}
    </td>
  );
}
