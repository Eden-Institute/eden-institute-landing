// src/components/founder/FunnelTab.tsx
//
// Founder dashboard → "Funnel" tab (CRO Phase 4, redesign plan §14).
// Reads the founder_funnel RPC (SECURITY DEFINER, is_founder()-gated,
// server-aggregated — cta_events will pass the 1000-row PostgREST cap
// quickly, so nothing here is ever derived from a row feed).
//
// Stages mix sources honestly: quiz starts / seed CTA clicks / checkout
// starts come from the new cta_events beacons; quiz completes from
// quiz_completions; accounts from profiles.created_at; subscribers are a
// live snapshot. Click data begins the day the Phase 4 migration runs, so
// early windows can show completes > starts — the footnote says so.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Funnel {
  stages: {
    quiz_starts: number;
    quiz_completes: number;
    accounts_created: number;
    seed_cta_clicks: number;
    checkout_starts: number;
    active_subscribers: number;
  };
  by_cta: Array<{ cta: string; clicks: number; visitors: number; last: string }>;
  by_path: Array<{ path: string; clicks: number }>;
  by_checkout_product: Array<{ lookup_key: string; starts: number }>;
  daily: Array<{ day: string; clicks: number }>;
}

function rate(numerator: number, denominator: number): string {
  if (!denominator || denominator <= 0) return "—";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

export default function FunnelTab({ since }: { since: string }) {
  const [data, setData] = useState<Funnel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res, error: e } = await supabase.rpc(
        "founder_funnel" as never,
        { p_since: since } as never,
      );
      if (e) throw e;
      setData((res as Funnel | null) ?? null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load funnel data. Has the Phase 4 migration run?",
      );
    } finally {
      setLoading(false);
    }
  }, [since]);

  useEffect(() => {
    load();
  }, [load]);

  const s = data?.stages;
  // Only ONE consecutive pair is a clean same-population conversion: quiz
  // completes ÷ quiz starts. The others are deliberately raw counts (prev:
  // null) — "Accounts created" counts ALL app signups (guide buyers,
  // homeschool, direct), not just quiz completers; "Seed CTA clicks" and
  // "Checkout starts" span different products and would otherwise divide
  // into a self-referential, routinely-over-100% "rate". Showing them as
  // counts keeps the table honest. (Adversarial review, CRO Phase 4.)
  const funnelRows: Array<{ stage: string; count: number; prev: number | null }> = s
    ? [
        { stage: "Quiz starts (first answer)", count: s.quiz_starts, prev: null },
        { stage: "Quiz completes (email captured)", count: s.quiz_completes, prev: s.quiz_starts },
        { stage: "Accounts created (all app signups)", count: s.accounts_created, prev: null },
        { stage: "Seed CTA clicks", count: s.seed_cta_clicks, prev: null },
        { stage: "Checkout starts (all products)", count: s.checkout_starts, prev: null },
      ]
    : [];

  return (
    <div>
      {error && (
        <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="font-body text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard label="Quiz starts (window)" value={String(s?.quiz_starts ?? 0)} />
        <StatCard label="Quiz completes (window)" value={String(s?.quiz_completes ?? 0)} />
        <StatCard label="Checkout starts (window)" value={String(s?.checkout_starts ?? 0)} />
        <StatCard label="Active subscribers (now)" value={String(s?.active_subscribers ?? 0)} />
      </div>

      <section className="mb-8">
        <SectionLabel>Funnel stages</SectionLabel>
        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-muted/40">
                <Th>Stage</Th>
                <Th right>Count</Th>
                <Th right>Rate vs previous</Th>
              </tr>
            </thead>
            <tbody>
              {funnelRows.map((row) => (
                <tr key={row.stage} className="border-t border-border">
                  <Td>{row.stage}</Td>
                  <Td right className="font-semibold">{row.count}</Td>
                  <Td right className="text-muted-foreground">
                    {row.prev === null ? "—" : rate(row.count, row.prev)}
                  </Td>
                </tr>
              ))}
              {funnelRows.length === 0 && !loading && (
                <tr className="border-t border-border">
                  <Td className="text-muted-foreground">No data yet.</Td>
                  <Td right>{""}</Td>
                  <Td right>{""}</Td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <SectionLabel>Checkout starts by product</SectionLabel>
        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-muted/40">
                <Th>Product (Stripe lookup key)</Th>
                <Th right>Starts</Th>
              </tr>
            </thead>
            <tbody>
              {(data?.by_checkout_product ?? []).map((p) => (
                <tr key={p.lookup_key} className="border-t border-border">
                  <Td>{p.lookup_key}</Td>
                  <Td right className="font-semibold">{p.starts}</Td>
                </tr>
              ))}
              {(data?.by_checkout_product ?? []).length === 0 && !loading && (
                <tr className="border-t border-border">
                  <Td className="text-muted-foreground" colSpan={2}>
                    No checkout starts in this window.
                  </Td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <SectionLabel>CTA clicks (top 40)</SectionLabel>
        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-muted/40">
                <Th>CTA</Th>
                <Th right>Clicks</Th>
                <Th right>Visitors</Th>
              </tr>
            </thead>
            <tbody>
              {(data?.by_cta ?? []).map((c) => (
                <tr key={c.cta} className="border-t border-border">
                  <Td>{c.cta}</Td>
                  <Td right className="font-semibold">{c.clicks}</Td>
                  <Td right className="text-muted-foreground">{c.visitors}</Td>
                </tr>
              ))}
              {(data?.by_cta ?? []).length === 0 && !loading && (
                <tr className="border-t border-border">
                  <Td className="text-muted-foreground" colSpan={3}>
                    No CTA clicks recorded yet. Clicks start flowing once the
                    Phase 4 migration has been run.
                  </Td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="font-body text-[11px] text-muted-foreground mt-2">
          Visitors = distinct daily visitor hashes (cookieless; the hash
          rotates daily, so multi-day visitors count once per day).
        </p>
      </section>

      <section className="mb-8">
        <SectionLabel>Clicks by page (top 20)</SectionLabel>
        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-muted/40">
                <Th>Page</Th>
                <Th right>Clicks</Th>
              </tr>
            </thead>
            <tbody>
              {(data?.by_path ?? []).map((p) => (
                <tr key={p.path} className="border-t border-border">
                  <Td>{p.path}</Td>
                  <Td right className="font-semibold">{p.clicks}</Td>
                </tr>
              ))}
              {(data?.by_path ?? []).length === 0 && !loading && (
                <tr className="border-t border-border">
                  <Td className="text-muted-foreground" colSpan={2}>
                    No data yet.
                  </Td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="font-body text-[11px] text-muted-foreground">
        Only quiz completes ÷ quiz starts is a true conversion; the other
        stages are raw counts (accounts include all app signups, not just
        quiz completers, and checkout starts span all products), so they
        carry no rate. Quiz starts, Seed CTA clicks, and checkout starts
        come from the cookieless click beacon and begin the day the Phase 4
        migration runs, so windows reaching before that can show completes
        above starts. Quiz completes count captured emails; accounts count
        profiles created in the window; active subscribers are a live
        snapshot. Email-link guide checkouts start server-side and are not
        counted here.
      </p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-4 bg-card">
      <p className="font-accent text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-1">{label}</p>
      <p className="font-serif font-bold text-2xl" style={{ color: "hsl(var(--eden-bark))" }}>{value}</p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-accent text-xs tracking-[0.2em] uppercase" style={{ color: "hsl(var(--eden-gold))" }}>
      {children}
    </p>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-3 py-2 font-accent text-[10px] tracking-wider uppercase text-muted-foreground ${right ? "text-right" : ""}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
  right,
  colSpan,
}: {
  children: React.ReactNode;
  className?: string;
  right?: boolean;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={`px-3 py-2 font-body text-sm ${right ? "text-right" : ""} ${className}`}>
      {children}
    </td>
  );
}
