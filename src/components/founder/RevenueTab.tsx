// src/components/founder/RevenueTab.tsx
//
// Founder dashboard → "Revenue" tab. Unifies the three places Eden money
// actually lives, which were previously scattered / invisible:
//   1. App subscriptions      → profiles (Stripe)
//   2. Deep-Dive Guide $4.99  → quiz_completions.purchased_guide (Stripe)
//   3. Foundations Course $97 → course_sales (LearnWorlds webhook)
//
// Reads the founder_revenue RPC (SECURITY DEFINER, is_founder()-gated).
// Amazon kit/book affiliate income is NOT here — it lives only in Amazon
// Associates — so a footnote says so rather than implying $0.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Revenue {
  subscriptions: {
    active_seed: number;
    active_root: number;
    active_practitioner: number;
    active_total: number;
    canceled: number;
  };
  guide: { purchased_total: number };
  course: { orders: number; revenue_cents: number; currency: string };
}

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
  }).format((cents ?? 0) / 100);
}

export default function RevenueTab({ since }: { since: string }) {
  const [data, setData] = useState<Revenue | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res, error: e } = await supabase.rpc(
        "founder_revenue" as never,
        { p_since: since } as never,
      );
      if (e) throw e;
      setData((res as Revenue | null) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load revenue data.");
    } finally {
      setLoading(false);
    }
  }, [since]);

  useEffect(() => {
    load();
  }, [load]);

  const subs = data?.subscriptions;
  const course = data?.course;

  return (
    <div>
      {error && (
        <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="font-body text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard label="Active subscriptions" value={String(subs?.active_total ?? 0)} />
        <StatCard label="Guide sales (all-time)" value={String(data?.guide?.purchased_total ?? 0)} />
        <StatCard label="Course orders (window)" value={String(course?.orders ?? 0)} />
        <StatCard label="Course revenue (window)" value={course ? money(course.revenue_cents, course.currency) : "—"} />
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
              <tr className="border-t border-border"><Td>Seed</Td><Td right className="font-semibold">{subs?.active_seed ?? 0}</Td></tr>
              <tr className="border-t border-border"><Td>Root</Td><Td right className="font-semibold">{subs?.active_root ?? 0}</Td></tr>
              <tr className="border-t border-border"><Td>Practitioner</Td><Td right className="font-semibold">{subs?.active_practitioner ?? 0}</Td></tr>
              <tr className="border-t border-border"><Td className="text-muted-foreground">Canceled</Td><Td right className="text-muted-foreground">{subs?.canceled ?? 0}</Td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <SectionLabel>Foundations Course (LearnWorlds)</SectionLabel>
        {course && course.orders > 0 ? (
          <div className="mt-3 rounded-lg border border-border bg-card p-4">
            <p className="font-body text-sm">
              <span className="font-semibold">{course.orders}</span> course orders ·{" "}
              <span className="font-semibold">{money(course.revenue_cents, course.currency)}</span> in this window.
            </p>
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-border bg-card p-6">
            <p className="font-accent text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2">
              No course sales recorded {loading ? "…" : "yet"}
            </p>
            <p className="font-body text-sm text-muted-foreground">
              Course revenue appears here once the LearnWorlds purchase webhook is connected:
            </p>
            <ol className="font-body text-sm text-muted-foreground mt-2 ml-5 list-decimal space-y-1">
              <li>LearnWorlds → Settings → Developers → Webhooks → add the purchase event, pointed at the <code>learnworlds-webhook</code> function URL, with a signing secret.</li>
              <li>Set that secret as the <code>LEARNWORLDS_WEBHOOK_SECRET</code> Supabase function secret.</li>
            </ol>
            <p className="font-body text-[11px] text-muted-foreground mt-3">
              The Foundations Course ($97) is the dominant CTA in your nurture emails but sells off-site, so until this is wired its sales never reach the dashboard — making conversion look worse than it may be.
            </p>
          </div>
        )}
      </section>

      <p className="font-body text-[11px] text-muted-foreground">
        Subscriptions are a live snapshot (no per-event history). Guide sales are all-time (no purchase timestamp recorded). Course orders/revenue are within the selected window. Amazon kit + book income is affiliate revenue tracked only in Amazon Associates, not here.
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
