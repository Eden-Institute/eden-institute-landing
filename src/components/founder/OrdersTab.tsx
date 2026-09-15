// src/components/founder/OrdersTab.tsx
//
// Founder dashboard · Orders tab. View of the orders table via the founder_orders
// RPC (SECURITY DEFINER, is_founder()-gated like every other founder_* RPC, so
// non-founder accounts get 'Not authorized' from the server regardless of the UI).
// Refunds are issued in the Stripe Dashboard (the charge.refunded webhook syncs
// our status). The only actions here are the Lulu print-on-demand controls
// (Resubmit / Cancel at Lulu / Refresh), which call the founder-gated lulu-admin
// edge function; every state change still flows through the shared transition
// engine, so the buttons cannot do anything a webhook could not.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { safeHttpHref } from "@/lib/safeHref";

interface OrderItem {
  sku: string;
  name: string;
  quantity: number;
  unit_price_cents: number;
  is_founding: boolean;
}

interface OrderMsg {
  channel: "email" | "sms";
  template_key: string;
  status: "sent" | "failed";
  created_at: string;
}

interface LuluJob {
  status: "pending" | "in_progress" | "submitted" | "failed" | "cancelled";
  attempts: number;
  last_error: string | null;
  submitted_at: string | null;
}

interface OrderRow {
  id: string;
  /** Customer-facing identifier (ET-1001...). What a buyer quotes in support email. */
  order_number: string | null;
  customer_email: string | null;
  /** Collected by Stripe Checkout. Exists so the founder can phone a buyer directly
      when an order goes wrong. Service contact only, not a marketing list: SMS to
      this number still requires sms_consent. */
  customer_phone: string | null;
  shipping_name: string | null;
  status: string;
  amount_total_cents: number | null;
  tax_cents: number | null;
  currency: string | null;
  sms_consent: boolean;
  is_preorder: boolean;
  product_label: string | null;
  created_at: string;
  /** Our own test purchases and staff accounts (is_internal_email). The summary
      tiles exclude these; the table lists them greyed out. */
  is_internal: boolean;
  /** 'stock' | 'lulu' | 'digital' | null on legacy rows. */
  fulfillment: string | null;
  lulu_print_job_id: number | null;
  lulu_status: string | null;
  lulu_status_message: string | null;
  lulu_cost_cents: number | null;
  shipping_carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  lulu_job: LuluJob | null;
  items: OrderItem[];
  messages: OrderMsg[];
}

interface OrdersPayload {
  error?: string;
  summary: {
    total: number;
    preorder_hold: number;
    ready_to_fulfill: number;
    in_production: number;
    shipped: number;
    delivered: number;
    lulu_cost_cents: number;
    cancelled: number;
    refunded: number;
    sms_consent: number;
    gross_cents: number;
    tax_cents: number;
    internal_cents: number;
    internal_count: number;
  };
  orders: OrderRow[];
}

function money(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
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

// lulu-admin returns the raw SubmitResult {status, detail?, print_job_id?},
// CancelResult {outcome, detail?} or ApplyResult {lulu_status, applied}
// (supabase/functions/_shared/lulu-fulfillment.ts). One readable line from any.
function luluResultText(d: unknown): string {
  const r = (d ?? {}) as Record<string, unknown>;
  const head = r.status ?? r.outcome ?? r.lulu_status ?? "done";
  const tail = [r.applied, r.print_job_id != null ? `job #${r.print_job_id}` : null, r.detail]
    .filter(Boolean)
    .join(" · ");
  return tail ? `${head} (${tail})` : String(head);
}

// Status pill colors — terminal states muted red, held/active states brand tones.
function statusStyle(status: string): React.CSSProperties {
  if (status === "cancelled" || status === "refunded") {
    return { backgroundColor: "hsl(var(--destructive) / 0.12)", color: "hsl(var(--destructive))" };
  }
  if (status === "preorder_hold" || status === "ready_to_fulfill" || status === "in_production") {
    return { backgroundColor: "hsl(var(--eden-gold) / 0.18)", color: "hsl(var(--eden-bark))" };
  }
  return { backgroundColor: "hsl(var(--eden-sage) / 0.18)", color: "hsl(var(--eden-forest))" };
}

export default function OrdersTab({ since }: { since: string }) {
  const [payload, setPayload] = useState<OrdersPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase.rpc("founder_orders", { p_since: since });
      if (e) throw e;
      const p = data as unknown as OrdersPayload | null;
      if (p?.error) throw new Error(p.error);
      setPayload(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load orders.");
    } finally {
      setLoading(false);
    }
  }, [since]);

  useEffect(() => {
    load();
  }, [load]);

  // Lulu actions. Each one round-trips lulu-admin and then reloads, so what the
  // table shows is always what the database says, never what the click hoped.
  const luluAction = useCallback(async (action: "resubmit" | "cancel" | "refresh", o: OrderRow) => {
    const ref = o.order_number ?? o.id;
    if (action === "cancel" && !window.confirm(`Cancel the Lulu print for ${ref}? This only works before printing starts. It does NOT refund the buyer; do that in Stripe.`)) return;
    setActing(`${action}:${o.id}`);
    setActionNote(null);
    try {
      const { data, error: e } = await supabase.functions.invoke("lulu-admin", { body: { action, order_id: o.id } });
      if (e) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ctx = (e as any)?.context;
        // A failed resubmit/cancel comes back 502/500 with a result body and no
        // `error` key, so fall through to Lulu's own detail and status.
        let detail: { error?: string; detail?: string; status?: string; outcome?: string } | null = null;
        try { detail = ctx && typeof ctx.json === "function" ? await ctx.json() : null; } catch { detail = null; }
        throw new Error(detail?.error ?? detail?.detail ?? (detail?.status || detail?.outcome) ?? e.message);
      }
      setActionNote(`${ref}: ${action} → ${luluResultText(data)}`);
    } catch (err) {
      setActionNote(`${ref}: ${action} failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setActing(null);
      load();
    }
  }, [load]);

  const s = payload?.summary;
  const orders = payload?.orders ?? [];

  // See RevenueTab: a broken query must not render as a confident zero. This tab is
  // worse than most, because its empty-state row prints the words "No orders in this
  // window yet" underneath a failed request.
  const unknown = !!error && !payload;
  const n = (v: number | null | undefined) => (unknown ? "—" : String(v ?? 0));

  return (
    <>
      {error && (
        <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="font-body text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat label="Preorders held" value={n(s?.preorder_hold)} />
        <Stat label="Gross (excl. cancelled/refunded)" value={unknown ? "—" : money(s?.gross_cents ?? 0)} />
        <Stat label="SMS opt-ins" value={n(s?.sms_consent)} />
        <Stat label="Cancelled + refunded" value={unknown ? "—" : String((s?.cancelled ?? 0) + (s?.refunded ?? 0))} />
      </div>
      {/* Fulfilment queue. "Awaiting printer" that stays non-zero means lulu-submit
          is not getting through; the drain log says why. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <Stat label="Awaiting printer" value={n(s?.ready_to_fulfill)} />
        <Stat label="At the printer" value={n(s?.in_production)} />
        <Stat label="Shipped / delivered" value={unknown ? "—" : `${s?.shipped ?? 0} / ${s?.delivered ?? 0}`} />
        <Stat label="Print cost (Lulu)" value={unknown ? "—" : money(s?.lulu_cost_cents ?? 0)} />
      </div>
      {!!s?.internal_count && (
        <p className="font-body text-sm mb-4 text-muted-foreground">
          Excludes {s.internal_count} internal order{s.internal_count === 1 ? "" : "s"}
          {" "}totalling {money(s.internal_cents)} (our own test purchases and staff
          accounts). They are listed below, greyed out.
        </p>
      )}
      {actionNote && (
        <p className="font-body text-xs mb-4 rounded-md px-3 py-2 break-all" style={{ backgroundColor: "hsl(var(--eden-cream))", color: "hsl(var(--eden-bark))" }}>
          {actionNote}
        </p>
      )}

      <section className="mb-4">
        <div className="flex items-center justify-between">
          <p className="font-accent text-xs tracking-[0.2em] uppercase" style={{ color: "hsl(var(--eden-gold))" }}>
            Orders{s ? ` (${s.total} in window)` : ""}
          </p>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-muted/40">
                {["Order / Customer", "Items", "Amount", "Status", "Fulfilment", "SMS", "Messages", "Date (CT)"].map((h) => (
                  <th key={h} className="px-3 py-2 font-accent text-[11px] tracking-wider uppercase text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-border align-top" style={o.is_internal ? { opacity: 0.55 } : undefined}>
                  <td className="px-3 py-2 font-body text-sm">
                    {/* The order number leads: it is the handle customers quote, and
                        /returns instructs them to. */}
                    <span className="font-mono text-xs font-semibold" style={{ color: "hsl(var(--eden-bark))" }}>
                      {o.order_number ?? "—"}
                    </span>
                    {o.is_internal && (
                      <span className="ml-2 rounded px-1.5 py-0.5 font-accent text-[11px] uppercase tracking-wider bg-muted text-muted-foreground">
                        internal
                      </span>
                    )}
                    <br />
                    {o.customer_email ?? "(no email)"}
                    <br />
                    {/* Click-to-call: the point of showing this is picking up the phone. */}
                    {o.customer_phone
                      ? (
                        <a
                          href={`tel:${o.customer_phone.replace(/[^\d+]/g, "")}`}
                          className="text-xs underline"
                          style={{ color: "hsl(var(--eden-forest))" }}
                        >
                          {o.customer_phone}
                        </a>
                      )
                      : <span className="text-xs text-muted-foreground">(no phone)</span>}
                    <br />
                    <span className="text-xs text-muted-foreground">{o.shipping_name ?? "(no name)"}</span>
                  </td>
                  <td className="px-3 py-2 font-body text-sm">
                    {o.items.length > 0
                      ? o.items.map((it, i) => (
                          <span key={`${it.sku}-${i}`}>
                            {it.quantity} × {it.name}
                            {it.is_founding && (
                              <span
                                className="ml-1 text-[11px] uppercase tracking-wide px-1 py-0.5 rounded"
                                style={{ backgroundColor: "hsl(var(--eden-gold) / 0.18)", color: "hsl(var(--eden-bark))" }}
                              >
                                founding
                              </span>
                            )}
                            <br />
                          </span>
                        ))
                      : (o.product_label ?? "—")}
                  </td>
                  <td className="px-3 py-2 font-body text-sm whitespace-nowrap">
                    {money(o.amount_total_cents)}
                    {o.tax_cents != null && o.tax_cents > 0 && (
                      <span className="block text-xs text-muted-foreground">incl. tax {money(o.tax_cents)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-accent text-[11px] tracking-wider uppercase px-2 py-1 rounded whitespace-nowrap" style={statusStyle(o.status)}>
                      {o.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-body text-xs">
                    {o.fulfillment === "lulu" ? (
                      <div className="space-y-1 min-w-[160px]">
                        <div>
                          <span className="font-semibold" style={{ color: "hsl(var(--eden-forest))" }}>Lulu</span>{" "}
                          {o.lulu_print_job_id ? <span className="font-mono">#{o.lulu_print_job_id}</span> : <span className="text-muted-foreground">(not submitted)</span>}
                          {o.lulu_status && <span className="ml-1 text-muted-foreground">{o.lulu_status}</span>}
                        </div>
                        {o.tracking_number && (() => {
                          const track = safeHttpHref(o.tracking_url);
                          return (
                            <div>
                              {track
                                ? <a href={track} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "hsl(var(--eden-forest))" }}>{o.shipping_carrier ?? "Track"} {o.tracking_number}</a>
                                : <span>{o.shipping_carrier ?? ""} {o.tracking_number}</span>}
                            </div>
                          );
                        })()}
                        {o.lulu_cost_cents != null && <div className="text-muted-foreground">cost {money(o.lulu_cost_cents)}</div>}
                        {o.lulu_job && o.lulu_job.status !== "submitted" && (
                          <div style={{ color: o.lulu_job.status === "failed" ? "hsl(var(--destructive))" : undefined }}>
                            job {o.lulu_job.status} ({o.lulu_job.attempts} tries)
                            {o.lulu_job.last_error && <span className="block break-all">{o.lulu_job.last_error}</span>}
                          </div>
                        )}
                        {o.status !== "cancelled" && o.status !== "refunded" && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {(!o.lulu_print_job_id || o.lulu_job?.status === "failed" || o.lulu_job?.status === "cancelled") && o.status !== "shipped" && o.status !== "delivered" && (
                              <Button variant="outline" size="sm" disabled={acting !== null} onClick={() => luluAction("resubmit", o)}>
                                {acting === `resubmit:${o.id}` ? "…" : "Resubmit"}
                              </Button>
                            )}
                            {o.lulu_print_job_id && (
                              <Button variant="outline" size="sm" disabled={acting !== null} onClick={() => luluAction("refresh", o)}>
                                {acting === `refresh:${o.id}` ? "…" : "Refresh"}
                              </Button>
                            )}
                            {o.lulu_print_job_id && o.status === "in_production" && (
                              <Button variant="outline" size="sm" disabled={acting !== null} onClick={() => luluAction("cancel", o)}>
                                {acting === `cancel:${o.id}` ? "…" : "Cancel at Lulu"}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">{o.fulfillment ?? (o.is_preorder ? "kit run" : "—")}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-body text-sm">{o.sms_consent ? "Yes" : "No"}</td>
                  <td className="px-3 py-2 font-body text-xs text-muted-foreground">
                    {o.messages.length === 0
                      ? "—"
                      : o.messages.map((m, i) => (
                          <span key={i} className="whitespace-nowrap">
                            {m.channel}{" "}
                            <span style={{ color: m.status === "sent" ? "hsl(var(--eden-sage))" : "hsl(var(--destructive))" }}>
                              {m.status === "sent" ? "✓" : "failed"}
                            </span>
                            <br />
                          </span>
                        ))}
                  </td>
                  <td className="px-3 py-2 font-body text-sm text-muted-foreground whitespace-nowrap">
                    {fmtDateTimeCT(o.created_at)}
                  </td>
                </tr>
              ))}
              {orders.length === 0 && !loading && !error && (
                <tr>
                  <td className="px-3 py-3 font-body text-sm text-muted-foreground" colSpan={8}>
                    No orders in this window yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="font-body text-[11px] text-muted-foreground mt-2">
          Refunds are issued from the Stripe Dashboard; the charge.refunded webhook updates the
          status here automatically and, for printed books, tries to stop the print at Lulu.
          "Cancel at Lulu" stops the print only; it does not refund. Showing up to 500 most
          recent orders in the window.
        </p>
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-4 bg-card">
      <p className="font-accent text-[11px] tracking-[0.2em] uppercase text-muted-foreground mb-1">{label}</p>
      <p className="font-serif font-bold text-2xl" style={{ color: "hsl(var(--eden-bark))" }}>{value}</p>
    </div>
  );
}
