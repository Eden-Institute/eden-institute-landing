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
import CrmTab from "@/components/founder/CrmTab";

const FOUNDER_EMAIL = "hello@edeninstitute.health";

type Tab = "leads" | "traffic" | "crm";

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

// A drill-down request: a human-readable title, the rows to show, and the
// exact server-side count this drill represents. exactCount lets the modal
// warn when the capped feed holds fewer rows than the headline number.
interface Drill {
  title: string;
  rows: LeadRow[];
  exactCount: number;
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
  const [drill, setDrill] = useState<Drill | null>(null);

  const isFounder = !!user && user.email?.toLowerCase() === FOUNDER_EMAIL;

  const load = useCallback(async () => {
    if (tab === "crm") return;
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

  // Close any open drill-down when the window/tab changes or data reloads, so a
  // stale list from a previous filter can't linger over fresh numbers.
  useEffect(() => {
    setDrill(null);
  }, [tab, windowIdx, leads]);

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

  // ── Drill-down openers (all filter the already-loaded feed) ──
  const openActiveDrill = useCallback(() => {
    const rows = (leads ?? []).filter((r) => !r.unsubscribed);
    setDrill({ title: "New leads (active)", rows, exactCount: leadSummary?.active ?? rows.length });
  }, [leads, leadSummary]);

  const openUnsubDrill = useCallback(() => {
    const rows = (leads ?? []).filter((r) => r.unsubscribed);
    setDrill({ title: "Unsubscribed", rows, exactCount: unsubCount });
  }, [leads, unsubCount]);

  const openMagnetDrill = useCallback(
    (label: string, exactCount: number) => {
      const rows = (leads ?? []).filter((r) => magnetLabel(r.funnel, r.source) === label);
      setDrill({ title: label, rows, exactCount });
    },
    [leads],
  );

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
          {(["leads", "traffic", "crm"] as Tab[]).map((t) => (
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
              {t === "leads" ? "Lead magnets" : t === "traffic" ? "Website traffic" : "CRM"}
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              <StatCard label="New leads" value={String(leadSummary?.active ?? 0)} onClick={openActiveDrill} />
              <StatCard label="Unsubscribed" value={String(unsubCount)} onClick={unsubCount > 0 ? openUnsubDrill : undefined} />
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
                  <tr
                    key={m.label}
                    className="border-t border-border cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => openMagnetDrill(m.label, m.count)}
                    title="Click to see who's in this magnet"
                  >
                    <Td>{m.label}</Td>
                    <Td className="text-right font-semibold underline decoration-dotted underline-offset-4" style={{ color: "hsl(var(--eden-bark))" }}>{m.count}</Td>
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
        ) : tab === "traffic" ? (
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
        ) : (
          <CrmTab since={sinceISO(WINDOWS[windowIdx].days)} />
        )}

        <p className="font-body text-xs text-muted-foreground">
          {fetchedAt
            ? `Updated ${fetchedAt.toLocaleString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit", hour12: true, month: "short", day: "numeric" })} CT · `
            : ""}
          Live data — reloads each visit. Visit tracking is cookieless and stores no personal data.
        </p>
      </div>

      {drill && <DrillModal drill={drill} onClose={() => setDrill(null)} />}
    </div>
  );
}

function StatCard({ label, value, small, onClick }: { label: string; value: string; small?: boolean; onClick?: () => void }) {
  const clickable = typeof onClick === "function";
  return (
    <div
      className={`rounded-lg border border-border p-4 bg-card ${clickable ? "cursor-pointer hover:border-[hsl(var(--eden-gold))] transition-colors" : ""}`}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick!(); } } : undefined}
      title={clickable ? "Click to see who's included" : undefined}
    >
      <p className="font-accent text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-1">{label}</p>
      <p
        className={`font-serif font-bold ${small ? "text-base" : "text-2xl"} ${clickable ? "underline decoration-dotted underline-offset-4" : ""}`}
        style={{ color: "hsl(var(--eden-bark))" }}
      >
        {value}
      </p>
    </div>
  );
}

// Drill-down overlay: lists the actual people behind a clicked number. Rows are
// filtered from the already-loaded founder_lead_feed, so no extra fetch. When
// the exact server count exceeds the rows we hold (1000-row feed cap), a banner
// makes that explicit rather than implying the list is complete.
function DrillModal({ drill, onClose }: { drill: Drill; onClose: () => void }) {
  const capped = drill.exactCount > drill.rows.length;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-10 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-2xl rounded-lg border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <p className="font-accent text-[10px] tracking-[0.2em] uppercase text-muted-foreground">Drill-down</p>
            <h2 className="font-serif text-lg font-bold" style={{ color: "hsl(var(--eden-bark))" }}>
              {drill.title} · {drill.exactCount}
            </h2>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>

        {capped && (
          <div className="border-b border-border bg-muted/30 px-5 py-2">
            <p className="font-body text-[11px] text-muted-foreground">
              Showing the {drill.rows.length} most recent of {drill.exactCount}. The feed is
              capped at 1,000 rows; the headline count is exact. Narrow the time window to see older captures.
            </p>
          </div>
        )}

        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-muted/40 sticky top-0">
                <th className="px-4 py-2 font-accent text-[10px] tracking-wider uppercase text-muted-foreground">Subscriber</th>
                <th className="px-4 py-2 font-accent text-[10px] tracking-wider uppercase text-muted-foreground">Magnet</th>
                <th className="px-4 py-2 font-accent text-[10px] tracking-wider uppercase text-muted-foreground">Captured (CT)</th>
              </tr>
            </thead>
            <tbody>
              {drill.rows.map((r, i) => (
                <tr key={`${r.email}-${r.entered_at}-${i}`} className="border-t border-border align-top">
                  <td className="px-4 py-2 font-body text-sm">
                    <span className={r.unsubscribed ? "line-through text-muted-foreground" : ""}>{r.email}</span>
                    {r.unsubscribed && <span className="ml-2 text-[10px] uppercase tracking-wide text-destructive">unsub</span>}
                    <br />
                    <span className="text-xs text-muted-foreground">{r.first_name ?? "(no name)"}</span>
                  </td>
                  <td className="px-4 py-2 font-body text-sm">{magnetLabel(r.funnel, r.source)}</td>
                  <td className="px-4 py-2 font-body text-sm text-muted-foreground whitespace-nowrap">{fmtDateTimeCT(r.entered_at)}</td>
                </tr>
              ))}
              {drill.rows.length === 0 && (
                <tr><td className="px-4 py-3 font-body text-sm text-muted-foreground" colSpan={3}>
                  No one in this window. (The headline count may include captures older than the loaded feed — widen the time window.)
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
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

function Td({ children, className = "", colSpan, style }: { children: React.ReactNode; className?: string; colSpan?: number; style?: React.CSSProperties }) {
  return (
    <td className={`px-3 py-2 font-body text-sm ${className}`} colSpan={colSpan} style={style}>
      {children}
    </td>
  );
}
