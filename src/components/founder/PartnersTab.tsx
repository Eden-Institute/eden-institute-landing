// src/components/founder/PartnersTab.tsx
//
// Founder dashboard → "Partners" tab. Answers "which founding partners actually
// opened and clicked the six-week sample." Reads the founder_partner_engagement
// RPC (SECURITY DEFINER, is_founder()-gated), which LEFT JOINs
// public.founding_partners to public.email_events.
//
// Deliberately NOT windowed. Unlike the Emails tab, this is a small, long-running
// relationship list, so the RPC returns lifetime totals and takes no p_since. A
// 7-day window would render "Christy never opened it" and "Christy opened it three
// weeks ago" identically, which is the opposite of useful here.
//
// Read opens with suspicion. An open is a tracking pixel loading. Outlook and
// Hotmail block images by default, and two of the founding partners are on
// hotmail.com, so a zero in the Opens column is not evidence the email went
// unread. Clicks are the trustworthy signal, which is why the table sorts on them.
//
// Only Resend-sent mail appears here at all. Anything sent by hand from Gmail
// carries no tracking and will never show up, by design.

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PartnerRow {
  // Null since 2026-08-31: a partner served by an Instagram DM link has no address on file.
  // She is recorded, shown here, and deliberately excluded from the follow-up cadence.
  email: string | null;
  name: string;
  handle: string | null;
  status: string;
  welcome_sent_at: string | null;
  opens: number;
  clicks: number;
  first_open: string | null;
  last_click: string | null;
  clicked_urls: string[];
}

// Row identity. Email was the key until 2026-08-31, when it became nullable — several
// handle-only partners would all have keyed on `null` and React would have treated them as
// one row. The RPC returns no id, so fall through email -> handle -> name.
function partnerKey(p: PartnerRow): string {
  return p.email ?? p.handle ?? p.name;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Nothing here is a judgement about the partner, only about what we can observe.
function engagementLabel(p: PartnerRow): { text: string; tone: "good" | "soft" | "none" } {
  if (p.clicks > 0) return { text: "Clicked", tone: "good" };
  if (p.opens > 0) return { text: "Opened", tone: "soft" };
  if (!p.welcome_sent_at) return { text: "Not sent yet", tone: "none" };
  return { text: "No signal", tone: "none" };
}

export default function PartnersTab() {
  const [rows, setRows] = useState<PartnerRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase.rpc("founder_partner_engagement" as never);
      if (e) throw e;
      setRows((data as PartnerRow[] | null) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load partner engagement.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const list = useMemo(() => rows ?? [], [rows]);

  const totals = useMemo(
    () => ({
      partners: list.length,
      sent: list.filter((p) => p.welcome_sent_at).length,
      engaged: list.filter((p) => p.clicks > 0 || p.opens > 0).length,
      clicked: list.filter((p) => p.clicks > 0).length,
    }),
    [list],
  );

  return (
    <div>
      {error && (
        <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="font-body text-sm text-destructive">{error}</p>
        </div>
      )}

      {!error && !loading && list.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="font-accent text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2">
            No partners on the roster
          </p>
          <p className="font-body text-sm text-muted-foreground">
            Partners live in <code>public.founding_partners</code>. Add a row there and it appears here.
          </p>
        </div>
      )}

      {list.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <StatCard label="Partners" value={String(totals.partners)} />
            <StatCard label="Welcomed" value={String(totals.sent)} />
            <StatCard label="Any signal" value={String(totals.engaged)} />
            <StatCard label="Clicked" value={String(totals.clicked)} />
          </div>

          <section className="mb-8">
            <SectionLabel>Per partner</SectionLabel>
            <div className="mt-3 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-muted/40">
                    <Th>Partner</Th>
                    <Th>Welcomed</Th>
                    <Th right>Opens</Th>
                    <Th right>Clicks</Th>
                    <Th>First open</Th>
                    <Th>Last click</Th>
                    <Th>Signal</Th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => {
                    const sig = engagementLabel(p);
                    return (
                      <tr key={partnerKey(p)} className="border-t border-border align-top">
                        <Td>
                          <span className="font-semibold">{p.name}</span>
                          {p.handle && (
                            <span className="text-muted-foreground"> {p.handle}</span>
                          )}
                          <br />
                          <span className="font-mono text-[11px] text-muted-foreground break-all">
                            {p.email ?? "no email on file — served on Instagram"}
                          </span>
                        </Td>
                        <Td className="whitespace-nowrap">{fmtDate(p.welcome_sent_at)}</Td>
                        <Td right className="text-muted-foreground">{p.opens}</Td>
                        <Td right className="font-semibold">{p.clicks}</Td>
                        <Td className="whitespace-nowrap text-muted-foreground">{fmtDate(p.first_open)}</Td>
                        <Td className="whitespace-nowrap text-muted-foreground">{fmtDate(p.last_click)}</Td>
                        <Td
                          className={
                            sig.tone === "good"
                              ? "font-semibold"
                              : sig.tone === "soft"
                                ? ""
                                : "text-muted-foreground"
                          }
                        >
                          {sig.text}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="font-body text-[11px] text-muted-foreground mt-2">
              Opens undercount badly. An open needs a tracking pixel to load, and Outlook and Hotmail
              block images by default, so a zero here is not proof an email went unread. Clicks are the
              signal to trust. Lifetime totals, not filtered by the date range above.
            </p>
          </section>

          <section className="mb-10">
            <SectionLabel>What they clicked</SectionLabel>
            <div className="mt-3 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-muted/40">
                    <Th>Partner</Th>
                    <Th>Destination clicked</Th>
                  </tr>
                </thead>
                <tbody>
                  {list.flatMap((p) =>
                    (p.clicked_urls ?? []).map((u, i) => (
                      <tr key={`${partnerKey(p)}-${i}`} className="border-t border-border align-top">
                        <Td className="whitespace-nowrap">{i === 0 ? p.name : ""}</Td>
                        <Td className="font-mono text-xs break-all">{u}</Td>
                      </tr>
                    )),
                  )}
                  {list.every((p) => (p.clicked_urls ?? []).length === 0) && (
                    <tr>
                      <Td colSpan={2} className="text-muted-foreground">
                        No clicks recorded yet.
                      </Td>
                    </tr>
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
