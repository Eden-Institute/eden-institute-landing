// src/pages/FounderLeads.tsx
//
// Founder-only dashboard at /founder. Two tabs:
//   - Leads:   lead-magnet captures (founder_lead_feed RPC, includes PII)
//   - Traffic: cookieless web analytics (founder_traffic RPC, aggregates)
//
// Mounted in App.tsx wrapped in <RequireAuth>, so unauthenticated visitors are
// bounced to sign-in. The REAL access boundary is server-side: both RPCs are
// SECURITY DEFINER gated by is_founder() (JWT email check), so the other
// authenticated accounts get "Not authorized" regardless of the UI. The email
// check below is UX only.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

const FOUNDER_EMAIL = "hello@edeninstitute.health";

type Tab = "leads" | "traffic";

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

// Server-computed lead aggregates (founder_lead_summary). These are exact —
// counted in the database, so they are NOT subject to the 1000-row API cap that
// truncates the founder_lead_feed row list below.
interface LeadSummary {
  total: number;
  active: number;
  unsub: number;
  last_capture: string | null;
  by_magnet: { funnel: string; source: string; count: number; last: string }[];
  daily: { day: string; count: number }[];
}

interface Traffic {
  totals: { views: number; visitors: number; signups: number };
  daily: { day: string; views: number; visitors: number; signups: number }[];
  top_pages: { path: string; views: number; visitors: number }[];
  sources: { referrer: string; views: number }[];
  campaigns: { campaign: string; views: number; signups: number }[];
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

function sinceISO(days: number | null): string {
  return days == null
    ? "2000-01-01T00:00:00Z"
    : new Date(Date.now() - days * 86_400_000).toISOString();
}

// Mirrors the (funnel, source) → label mapping in notify-founder-digest/index.ts.
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

function dayLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
}

export default function FounderLeads() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("leads");
  const [windowIdx, setWindowIdx] = useState(1); // default 30 days
  const [leads, setLeads] = useState<LeadRow[] | null>(null);
  const [leadSummary, setLeadSummary] = useState<LeadSummary | null>(null);
  const [traffic, setTraffic] = useState<Traffic | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);

  const isFounder = !!user && user.email?.toLowerCase() === FOUNDER_EMAIL;

  const load = useCallback(async () => {
    const since = sinceISO(WINDOWS[windowIdx].days);
    setLoading(true);
    setError(null);
    try {
      if (tab === "leads") {
        // Two calls: summary = exact server-side aggregates (headline numbers,
        // by-magnet, daily strip); feed = the raw capped row list for the table.
        const [summaryRes, feedRes] = await Promise.all([
          supabase.rpc("founder_lead_summary" as never, { p_since: since } as never),
          supabase.rpc("founder_lead_feed" as never, { p_since: since } as never),
        ]);
        if (summaryRes.error) throw summaryRes.error;
        if (feedRes.error) throw feedRes.error;
        setLeadSummary((summaryRes.data as LeadSummary | null) ?? null);
        setLeads((feedRes.data as LeadRow[] | null) ?? []);
      } else {
        const { data, error: e } = await supabase.rpc(
          "founder_traffic" as never,
          { p_since: since } as never,
        );
        if (e) throw e;
        setTraffic((data as Traffic | null) ?? null);
      }
      setFetchedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load data.");
    } finally {
      setLoading(false);
    }
  }, [tab, windowIdx]);

  useEffect(() => {
    if (isFounder) load();
  }, [isFounder, load]);

  // ── Lead aggregates (server-computed; never derived from the capped row feed) ──
  // by_magnet arrives grouped by raw (funnel, source); collapse to display
  // labels here so the magnetLabel mapping stays in one place.
  const byMagnet = useMemo(() => {
    const m = new Map<string, { count: number; last: string }>();
    for (const g of leadSummary?.by_magnet ?? []) {
      const label = magnetLabel(g.funnel, g.source);
      const cur = m.get(label);
      if (cur) {
        cur.count += g.count;
        if (g.last > cur.last) cur.last = g.last;
      } else m.set(label, { count: g.count, last: g.last });
    }
    return Array.from(m.entries())
      .map(([label, v]) => ({ label, ...v }))
      .sort((a, b) => b.count - a.count);
  }, [leadSummary]);
  const leadDaily = useMemo(() => {
    const counts = new Map((leadSummary?.daily ?? []).map((d) => [d.day, d.count]));
    const keys = Array.from(counts.keys()).sort().slice(-14);
    const max = keys.reduce((mx, k) => Math.max(mx, counts.get(k) ?? 0), 0);
    return { bars: keys.map((k) => ({ key: k, count: counts.get(k) ?? 0 })), max };
  }, [leadSummary]);
  const unsubCount = leadSummary?.unsub ?? 0;

  // ── Traffic daily strip ──
  const trafficDaily = useMemo(() => {
    const d = (traffic?.daily ?? []).slice(-14);
    const max = d.reduce((mx, x) => Math.max(mx, x.views), 0);
    return { bars: d, max };
  }, [traffic]);

  const trafficSignups = useMemo(() => {
    const d = (traffic?.daily ?? []).slice(-14);
    const bars = d.map((x) => ({ key: x.day, count: x.signups ?? 0 }));
    const max = bars.reduce((mx, b) => Math.max(mx, b.count), 0);
    return { bars, max };
  }, [traffic]);

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
          <p className="font-accent text-xs tracking-[0.3em] uppercase mb-3" style={{ color: "hsl(var(--eden-gold))" }}>
            Restricted
          </p>
          <h1 className="font-serif text-2xl font-bold mb-3" style={{ color: "hsl(var(--eden-bark))" }}>
            Founder access only
          </h1>
          <p className="font-body text-muted-foreground mb-6">
            This dashboard is limited to the Eden Institute founder account. You're signed in as{" "}
            {user?.email ?? "an unknown account"}.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => signOut()}>Sign out</Button>
            <Button asChild variant="eden"><Link to={ROUTES.HOME}>Home</Link></Button>
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
        <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
          <div>
            <p className="font-accent text-xs tracking-[0.3em] uppercase mb-2" style={{ color: "hsl(var(--eden-gold))" }}>
              The Eden Institute
            </p>
            <h1 className="font-serif text-3xl font-bold" style={{ color: "hsl(var(--eden-bark))" }}>
              Founder dashboard
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {fetchedAt && (
              <span className="font-body text-[11px] text-muted-foreground whitespace-nowrap">
                Updated{" "}
                {fetchedAt.toLocaleTimeString("en-US", {
                  timeZone: "America/Chicago",
                  hour: "numeric",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: true,
                })}{" "}
                CT
              </span>
            )}
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => signOut()} disabled={loading}>
              Sign out
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-border">
          {(["leads", "traffic"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="font-accent text-xs tracking-[0.15em] uppercase px-4 py-2 -mb-px border-b-2 transition-colors"
              style={
                tab === t
                  ? { borderColor: "hsl(var(--eden-gold))", color: "hsl(var(--eden-bark))" }
                  : { borderColor: "transparent", color: "hsl(var(--muted-foreground))" }
              }
            >
              {t === "leads" ? "Lead magnets" : "Website traffic"}
            </button>
          ))}
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

        {tab === "leads" ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
              <StatCard label="New leads" value={String(leadSummary?.active ?? 0)} />
              <StatCard label="Active magnets" value={String(byMagnet.length)} />
              <StatCard label="Last capture" value={leadSummary?.last_capture ? fmtDateTimeCT(leadSummary.last_capture) : "—"} small />
            </div>

            {leadDaily.bars.length > 0 && (
              <BarStrip title="Signups · recent days (CT)" bars={leadDaily.bars} max={leadDaily.max} />
            )}

            <section className="mb-8">
              <SectionLabel>By magnet</SectionLabel>
              <Table head={["Magnet", "Leads", "Last capture (CT)"]} align={["", "right", ""]}>
                {byMagnet.map((m) => (
                  <tr key={m.label} className="border-t border-border">
                    <Td>{m.label}</Td>
                    <Td className="text-right font-semibold">{m.count}</Td>
                    <Td className="text-muted-foreground whitespace-nowrap">{fmtDateTimeCT(m.last)}</Td>
                  </tr>
                ))}
                {byMagnet.length === 0 && !loading && (
                  <tr><Td className="text-muted-foreground" colSpan={3}>No captures in this window.</Td></tr>
                )}
              </Table>
            </section>

            <section className="mb-10">
              <SectionLabel>
                All captures{leadSummary ? ` (${leadSummary.total})` : ""}{unsubCount > 0 ? ` · ${unsubCount} unsubscribed` : ""}
              </SectionLabel>
              <Table head={["Subscriber", "Magnet", "Captured (CT)", "Attribution"]}>
                {(leads ?? []).map((r, i) => {
                  const utm = [
                    r.utm_source ? `utm_source=${r.utm_source}` : "",
                    r.utm_campaign ? `utm_campaign=${r.utm_campaign}` : "",
                  ].filter(Boolean).join(" · ");
                  return (
                    <tr key={`${r.email}-${r.entered_at}-${i}`} className="border-t border-border align-top">
                      <Td>
                        <span className={r.unsubscribed ? "line-through text-muted-foreground" : ""}>{r.email}</span>
                        {r.unsubscribed && <span className="ml-2 text-[10px] uppercase tracking-wide text-destructive">unsub</span>}
                        <br />
                        <span className="text-xs text-muted-foreground">{r.first_name ?? "(no name)"}</span>
                      </Td>
                      <Td>{magnetLabel(r.funnel, r.source)}</Td>
                      <Td className="text-muted-foreground whitespace-nowrap">{fmtDateTimeCT(r.entered_at)}</Td>
                      <Td className="text-xs text-muted-foreground">{utm || <span className="opacity-60">direct</span>}</Td>
                    </tr>
                  );
                })}
                {(leads ?? []).length === 0 && !loading && (
                  <tr><Td className="text-muted-foreground" colSpan={4}>No captures in this window.</Td></tr>
                )}
              </Table>
              {leadSummary && leads && leadSummary.total > leads.length && (
                <p className="font-body text-[11px] text-muted-foreground mt-2">
                  Showing the {leads.length} most recent captures. The counts above
                  reflect all {leadSummary.total} in this window.
                </p>
              )}
            </section>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              <StatCard label="Page views" value={String(traffic?.totals?.views ?? 0)} />
              <StatCard label="Visitors (approx.)" value={String(traffic?.totals?.visitors ?? 0)} />
              <StatCard label="Sign-ups" value={String(traffic?.totals?.signups ?? 0)} />
              <StatCard
                label="Conversion"
                value={(() => {
                  const v = traffic?.totals?.visitors ?? 0;
                  const sg = traffic?.totals?.signups ?? 0;
                  return v > 0 ? `${((sg / v) * 100).toFixed(1)}%` : "—";
                })()}
              />
            </div>

            {trafficDaily.bars.length > 0 ? (
              <BarStrip
                title="Page views · recent days (CT)"
                bars={trafficDaily.bars.map((d) => ({ key: d.day, count: d.views }))}
                max={trafficDaily.max}
              />
            ) : (
              <p className="font-body text-sm text-muted-foreground mb-8">
                No visits recorded yet in this window. Data starts accumulating the moment this ships —
                check back after the site sees traffic.
              </p>
            )}

            {trafficSignups.bars.length > 0 && trafficSignups.max > 0 && (
              <BarStrip title="Sign-ups · recent days (CT)" bars={trafficSignups.bars} max={trafficSignups.max} />
            )}

            <section className="mb-8">
              <SectionLabel>Top pages</SectionLabel>
              <Table head={["Page", "Views", "Visitors"]} align={["", "right", "right"]}>
                {(traffic?.top_pages ?? []).map((p) => (
                  <tr key={p.path} className="border-t border-border">
                    <Td className="font-mono text-xs">{p.path}</Td>
                    <Td className="text-right font-semibold">{p.views}</Td>
                    <Td className="text-right text-muted-foreground">{p.visitors}</Td>
                  </tr>
                ))}
                {(traffic?.top_pages ?? []).length === 0 && !loading && (
                  <tr><Td className="text-muted-foreground" colSpan={3}>No data yet.</Td></tr>
                )}
              </Table>
            </section>

            <section className="mb-8">
              <SectionLabel>Traffic sources (external referrers)</SectionLabel>
              <Table head={["Referrer", "Views"]} align={["", "right"]}>
                {(traffic?.sources ?? []).map((s) => (
                  <tr key={s.referrer} className="border-t border-border">
                    <Td>{s.referrer}</Td>
                    <Td className="text-right font-semibold">{s.views}</Td>
                  </tr>
                ))}
                {(traffic?.sources ?? []).length === 0 && !loading && (
                  <tr><Td className="text-muted-foreground" colSpan={2}>No external referrers yet.</Td></tr>
                )}
              </Table>
            </section>

            <section className="mb-10">
              <SectionLabel>Campaigns — visits → signups</SectionLabel>
              <Table head={["Campaign (utm)", "Visits", "Signups", "Rate"]} align={["", "right", "right", "right"]}>
                {(traffic?.campaigns ?? []).map((c) => (
                  <tr key={c.campaign} className="border-t border-border">
                    <Td>{c.campaign}</Td>
                    <Td className="text-right">{c.views}</Td>
                    <Td className="text-right font-semibold">{c.signups}</Td>
                    <Td className="text-right text-muted-foreground">
                      {c.views > 0 ? `${((c.signups / c.views) * 100).toFixed(1)}%` : "—"}
                    </Td>
                  </tr>
                ))}
                {(traffic?.campaigns ?? []).length === 0 && !loading && (
                  <tr><Td className="text-muted-foreground" colSpan={4}>No campaign data yet.</Td></tr>
                )}
              </Table>
              <p className="font-body text-[11px] text-muted-foreground mt-2">
                Rate = signups ÷ page views for that UTM campaign (rough — views are page loads, not unique visitors).
              </p>
            </section>
          </>
        )}

        <p className="font-body text-xs text-muted-foreground">
          {fetchedAt
            ? `Updated ${fetchedAt.toLocaleString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit", hour12: true, month: "short", day: "numeric" })} CT · `
            : ""}
          Live data — reloads each visit. Visit tracking is cookieless and stores no personal data.
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-lg border border-border p-4 bg-card">
      <p className="font-accent text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-1">{label}</p>
      <p className={`font-serif font-bold ${small ? "text-base" : "text-2xl"}`} style={{ color: "hsl(var(--eden-bark))" }}>
        {value}
      </p>
    </div>
  );
}

function BarStrip({ title, bars, max }: { title: string; bars: { key: string; count: number }[]; max: number }) {
  return (
    <section className="mb-8">
      <SectionLabel>{title}</SectionLabel>
      <div className="flex items-end gap-1.5 h-28 mt-3">
        {bars.map((b) => (
          <div key={b.key} className="flex-1 flex flex-col items-center justify-end h-full">
            <span className="font-body text-[10px] text-muted-foreground mb-1">{b.count}</span>
            <div
              className="w-full rounded-t"
              style={{ height: `${max ? Math.max(6, (b.count / max) * 88) : 6}px`, backgroundColor: "hsl(var(--eden-bark))" }}
              title={`${dayLabel(b.key)}: ${b.count}`}
            />
            <span className="font-body text-[9px] text-muted-foreground mt-1 whitespace-nowrap">{dayLabel(b.key)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-accent text-xs tracking-[0.2em] uppercase" style={{ color: "hsl(var(--eden-gold))" }}>
      {children}
    </p>
  );
}

function Table({
  head,
  align = [],
  children,
}: {
  head: string[];
  align?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-muted/40">
            {head.map((h, i) => (
              <th
                key={h}
                className={`px-3 py-2 font-accent text-[10px] tracking-wider uppercase text-muted-foreground ${align[i] === "right" ? "text-right" : ""}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Td({ children, className = "", colSpan }: { children: React.ReactNode; className?: string; colSpan?: number }) {
  return (
    <td className={`px-3 py-2 font-body text-sm ${className}`} colSpan={colSpan}>
      {children}
    </td>
  );
}
