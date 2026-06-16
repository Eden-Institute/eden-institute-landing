// src/components/founder/EmailEngagementTab.tsx
//
// Founder dashboard → "Emails" tab. Answers "which nurture email gets
// engagement, and which CTA gets clicked." Reads the founder_email_engagement
// RPC (SECURITY DEFINER, is_founder()-gated) which aggregates public.email_events.
//
// email_events is populated by the resend-webhook EF from Resend's
// email.opened / email.clicked events. Until Open+Click tracking is enabled in
// the Resend dashboard AND those two events are subscribed at the webhook
// endpoint, this tab is empty by design — the empty-state says so.
//
// Apple Mail Privacy Protection pre-fetches images, inflating OPEN counts. Treat
// CLICKS (and unique clicks) as the trustworthy engagement signal.

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ByEmail {
  email_key: string;
  campaign: string | null;
  opens: number;
  unique_opens: number;
  clicks: number;
  unique_clicks: number;
}

interface ByCta {
  email_key: string;
  clicked_url: string;
  clicks: number;
  unique_clicks: number;
}

interface Engagement {
  by_email: ByEmail[];
  by_cta: ByCta[];
}

// Friendly labels mirror the email_key values tagged in nurture-emails/index.ts.
const EMAIL_LABELS: Record<string, string> = {
  constitution_1: "Constitution · Email 1 (immediate)",
  constitution_2: "Constitution · Email 2 (day 2)",
  constitution_3: "Constitution · Email 3 (day 4)",
  constitution_4: "Constitution · Email 4 (day 6)",
  constitution_5: "Constitution · Email 5 (day 8 · herb kit)",
  arc_1: "Quiz arc · 1 (day 11)",
  arc_2: "Quiz arc · 2 (day 14)",
  arc_3: "Quiz arc · 3 (day 17)",
  magnet_w2_sprouts: "Homeschool · Sprouts Week 2",
  magnet_w2_seedlings: "Homeschool · Seedlings Week 2",
  magnet_w3_fb: "Homeschool · Week 3 (Facebook)",
};

function emailLabel(key: string): string {
  return EMAIL_LABELS[key] ?? key;
}

function ctr(clicks: number, opens: number): string {
  return opens > 0 ? `${((clicks / opens) * 100).toFixed(0)}%` : "—";
}

export default function EmailEngagementTab({ since }: { since: string }) {
  const [data, setData] = useState<Engagement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res, error: e } = await supabase.rpc(
        "founder_email_engagement" as never,
        { p_since: since } as never,
      );
      if (e) throw e;
      setData((res as Engagement | null) ?? { by_email: [], by_cta: [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load engagement data.");
    } finally {
      setLoading(false);
    }
  }, [since]);

  useEffect(() => {
    load();
  }, [load]);

  const byEmail = data?.by_email ?? [];
  const byCta = data?.by_cta ?? [];

  // Group CTA rows under their email for a readable per-email breakdown.
  const ctaByEmail = useMemo(() => {
    const m = new Map<string, ByCta[]>();
    for (const c of byCta) {
      const arr = m.get(c.email_key) ?? [];
      arr.push(c);
      m.set(c.email_key, arr);
    }
    return m;
  }, [byCta]);

  const totals = useMemo(() => {
    return byEmail.reduce(
      (acc, e) => ({
        opens: acc.opens + (e.opens ?? 0),
        clicks: acc.clicks + (e.clicks ?? 0),
      }),
      { opens: 0, clicks: 0 },
    );
  }, [byEmail]);

  const isEmpty = !loading && byEmail.length === 0 && byCta.length === 0;

  return (
    <div>
      {error && (
        <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="font-body text-sm text-destructive">{error}</p>
        </div>
      )}

      {isEmpty && !error && (
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="font-accent text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2">
            No engagement recorded yet
          </p>
          <p className="font-body text-sm text-muted-foreground">
            Opens and clicks populate here once email tracking is switched on. To enable it:
          </p>
          <ol className="font-body text-sm text-muted-foreground mt-2 ml-5 list-decimal space-y-1">
            <li>In Resend, turn on <strong>Open tracking</strong> and <strong>Click tracking</strong> for edeninstitute.health.</li>
            <li>Subscribe <code>email.opened</code> and <code>email.clicked</code> at the Resend webhook endpoint.</li>
          </ol>
          <p className="font-body text-[11px] text-muted-foreground mt-3">
            Heads up: Apple Mail inflates open rates by pre-loading images. Clicks are the number to trust.
          </p>
        </div>
      )}

      {!isEmpty && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
            <StatCard label="Total opens" value={String(totals.opens)} />
            <StatCard label="Total clicks" value={String(totals.clicks)} />
            <StatCard label="Emails with activity" value={String(byEmail.length)} />
          </div>

          <section className="mb-8">
            <SectionLabel>Per email — opens vs. clicks</SectionLabel>
            <div className="mt-3 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-muted/40">
                    <Th>Email</Th>
                    <Th right>Opens</Th>
                    <Th right>Unique opens</Th>
                    <Th right>Clicks</Th>
                    <Th right>Unique clicks</Th>
                    <Th right>Click-to-open</Th>
                  </tr>
                </thead>
                <tbody>
                  {byEmail.map((e) => (
                    <tr key={e.email_key} className="border-t border-border">
                      <Td>{emailLabel(e.email_key)}</Td>
                      <Td right>{e.opens}</Td>
                      <Td right className="text-muted-foreground">{e.unique_opens}</Td>
                      <Td right className="font-semibold">{e.clicks}</Td>
                      <Td right className="text-muted-foreground">{e.unique_clicks}</Td>
                      <Td right className="text-muted-foreground">{ctr(e.clicks, e.opens)}</Td>
                    </tr>
                  ))}
                  {byEmail.length === 0 && !loading && (
                    <tr><Td colSpan={6} className="text-muted-foreground">No opens or clicks in this window.</Td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="font-body text-[11px] text-muted-foreground mt-2">
              Click-to-open = clicks ÷ opens. Opens are inflated by Apple Mail pre-fetch; clicks are the reliable signal.
            </p>
          </section>

          <section className="mb-10">
            <SectionLabel>Which CTA gets clicked</SectionLabel>
            <div className="mt-3 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-muted/40">
                    <Th>Email</Th>
                    <Th>Destination clicked</Th>
                    <Th right>Clicks</Th>
                    <Th right>Unique</Th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(ctaByEmail.entries()).flatMap(([key, ctas]) =>
                    ctas.map((c, i) => (
                      <tr key={`${key}-${c.clicked_url}-${i}`} className="border-t border-border align-top">
                        <Td className="whitespace-nowrap">{i === 0 ? emailLabel(key) : ""}</Td>
                        <Td className="font-mono text-xs break-all">{c.clicked_url}</Td>
                        <Td right className="font-semibold">{c.clicks}</Td>
                        <Td right className="text-muted-foreground">{c.unique_clicks}</Td>
                      </tr>
                    )),
                  )}
                  {byCta.length === 0 && !loading && (
                    <tr><Td colSpan={4} className="text-muted-foreground">No CTA clicks in this window.</Td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
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

function Td({ children, className = "", right, colSpan }: { children: React.ReactNode; className?: string; right?: boolean; colSpan?: number }) {
  return (
    <td className={`px-3 py-2 font-body text-sm ${right ? "text-right" : ""} ${className}`} colSpan={colSpan}>
      {children}
    </td>
  );
}
