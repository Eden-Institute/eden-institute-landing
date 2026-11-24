// src/components/founder/HeardAboutPanel.tsx
//
// Founder dashboard → Funnel tab → "How did you hear about us?". The optional question went live on
// 2026-11-24 on the free-week form and every checkout (supabase/functions/_shared/heard-about.ts); this panel
// counts the answers per choice, free-week sign-ups and paid orders side by side.
//
// Reads founder_heard_about_counts (SECURITY DEFINER, is_founder()-gated, counted in the database; see
// supabase/migrations/*_founder_heard_about_counts.sql). It has no date range: the question is new, so the panel
// shows everything since it went live and the dashboard's window selector does not apply.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HEARD_ABOUT_OPTIONS, HEARD_ABOUT_QUESTION } from "../../../supabase/functions/_shared/heard-about";

export interface HeardAboutCounts {
  launched_at: string;
  by_answer: Array<{ value: string; signups: number; orders: number }>;
  signups: { answered: number; skipped: number };
  orders: { answered: number; skipped: number };
}

const LABELS: ReadonlyMap<string, string> = new Map(HEARD_ABOUT_OPTIONS.map((o) => [o.value, o.label]));

export default function HeardAboutPanel() {
  const [data, setData] = useState<HeardAboutCounts | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res, error: e } = await supabase.rpc("founder_heard_about_counts");
      if (e) throw e;
      if (!res) throw new Error("No answer from founder_heard_about_counts.");
      setData(res as unknown as HeardAboutCounts);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load the answers. Has the founder_heard_about_counts migration run?",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="mb-8">
      <SectionLabel>{HEARD_ABOUT_QUESTION}</SectionLabel>

      {error && (
        <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="font-body text-sm text-destructive">{error}</p>
        </div>
      )}

      {!data && loading && <p className="mt-3 font-body text-sm text-muted-foreground">Loading…</p>}

      {data && (
        <>
          <div className="mt-3 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-muted/40">
                  <Th>Answer</Th>
                  <Th right>Free-week sign-ups</Th>
                  <Th right>Orders</Th>
                </tr>
              </thead>
              <tbody>
                {data.by_answer.map((r) => (
                  <tr key={r.value} className="border-t border-border">
                    <Td>{LABELS.get(r.value) ?? r.value}</Td>
                    <Td right className="font-semibold">{r.signups}</Td>
                    <Td right className="font-semibold">{r.orders}</Td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border bg-muted/20">
                  <Td className="font-semibold">Answered</Td>
                  <Td right className="font-semibold">{data.signups.answered}</Td>
                  <Td right className="font-semibold">{data.orders.answered}</Td>
                </tr>
                <tr className="border-t border-border">
                  <Td className="text-muted-foreground">Skipped the question</Td>
                  <Td right className="text-muted-foreground">{data.signups.skipped}</Td>
                  <Td right className="text-muted-foreground">{data.orders.skipped}</Td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="font-body text-[11px] text-muted-foreground mt-2">
            Asked since {formatLaunch(data.launched_at)} on the free-week form and at every checkout; nobody has to
            answer, and a family's first answer is kept. Skipped counts only sign-ups and paid orders made since then.
            A family can answer in both places, so the two columns are separate counts. Test sign-ups and orders are
            left out. The window selector does not change these numbers.
          </p>
        </>
      )}
    </section>
  );
}

/** "November 24, 2026", in Central time like the rest of /founder. */
export function formatLaunch(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "the day it went live";
  return d.toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
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
    <th
      className={`px-3 py-2 font-accent text-[11px] tracking-wider uppercase text-muted-foreground ${right ? "text-right" : ""}`}
    >
      {children}
    </th>
  );
}

function Td({ children, className = "", right }: { children: React.ReactNode; className?: string; right?: boolean }) {
  return <td className={`px-3 py-2 font-body text-sm ${right ? "text-right" : ""} ${className}`}>{children}</td>;
}
