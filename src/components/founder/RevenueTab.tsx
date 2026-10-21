// src/components/founder/RevenueTab.tsx
//
// Founder dashboard → "Revenue" tab. Unifies the places Eden money
// actually lives, which were previously scattered / invisible:
//   1. App subscriptions      → profiles (Stripe)
//   2. Deep-Dive Guide $4.99  → quiz_completions.purchased_guide (Stripe)
//
// Reads the founder_revenue RPC (SECURITY DEFINER, is_founder()-gated).
// Amazon kit/book affiliate income is NOT here — it lives only in Amazon
// Associates — so a footnote says so rather than implying $0.
//
// The Foundations Course section (course_sales + founder_course_funnel) was
// removed 2026-10-20: the adult course is retired and LearnWorlds is closed.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PaymentsPanel from "./PaymentsPanel";

interface Revenue {
  subscriptions: {
    active_seed: number;
    active_root: number;
    active_practitioner: number;
    active_total: number;
    canceled: number;
  };
  // All three come from founder_revenue (20260720070000_founder_revenue_net_refunds.sql),
  // read from public.payments: purchased_total counts distinct buyers, sales_total
  // counts transactions (repeat buyers included) and revenue_cents is net of
  // refunds. All-time, not windowed by p_since.
  guide: { purchased_total: number; sales_total: number; revenue_cents: number };
}

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
  }).format((cents ?? 0) / 100);
}

export default function RevenueTab({ since }: { since: string }) {
  const [data, setData] = useState<Revenue | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data: res, error: e } = await supabase.rpc("founder_revenue", { p_since: since });
      if (e) throw e;
      setData((res as unknown as Revenue | null) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load revenue data.");
    }
  }, [since]);

  useEffect(() => {
    load();
  }, [load]);

  const subs = data?.subscriptions;

  // A failed query must never render as a real zero. Every `?? 0` below turns a broken
  // request into a confident "$0.00" in the same weight and colour as the truth, and on
  // a revenue screen the reflexive reading of that is "we sold nothing", not "the query
  // died". Show an em-dash instead: unknown, visibly.
  const unknown = !!error && !data;
  const n = (v: number | null | undefined) => (unknown ? "—" : String(v ?? 0));

  return (
    <div>
      {error && (
        <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="font-body text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Actual money first. Everything below counts STATE (who currently holds a
          tier, whether a boolean was flipped), which is what made two real guide
          sales read as "1" and every renewal invisible. */}
      <PaymentsPanel since={since} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard label="Active subscriptions" value={n(subs?.active_total)} />
        <StatCard
          label="Guide buyers (all-time)"
          value={n(data?.guide?.purchased_total)}
        />
        <StatCard
          label="Deep-Dive Guide sales (all time)"
          value={n(data?.guide?.sales_total)}
        />
        <StatCard
          label="Deep-Dive Guide revenue (net, all time)"
          value={data?.guide && !unknown ? money(data.guide.revenue_cents ?? 0, "usd") : "—"}
        />
      </div>

      <section className="mb-8">
        <SectionLabel>App subscriptions (Stripe)</SectionLabel>
        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-muted/40">
                <Th>Tier</Th><Th right>Active</Th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border"><Td>Seed</Td><Td right className="font-semibold">{n(subs?.active_seed)}</Td></tr>
              <tr className="border-t border-border"><Td>Root</Td><Td right className="font-semibold">{n(subs?.active_root)}</Td></tr>
              <tr className="border-t border-border"><Td>Practitioner</Td><Td right className="font-semibold">{n(subs?.active_practitioner)}</Td></tr>
              <tr className="border-t border-border"><Td className="text-muted-foreground">Canceled</Td><Td right className="text-muted-foreground">{n(subs?.canceled)}</Td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <p className="font-body text-[11px] text-muted-foreground">
        Subscriptions are a live snapshot (no per-event history). Guide sales are all-time (no purchase timestamp recorded). Amazon kit + book income is affiliate revenue tracked only in Amazon Associates, not here.
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

function Td({ children, className = "", right }: { children: React.ReactNode; className?: string; right?: boolean }) {
  return (
    <td className={`px-3 py-2 font-body text-sm ${right ? "text-right" : ""} ${className}`}>
      {children}
    </td>
  );
}
