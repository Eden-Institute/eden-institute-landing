// src/components/founder/OrdersTab.tsx
//
// Founder dashboard · Orders tab (preorder system Phase 1). READ-ONLY view of the
// orders table via the founder_orders RPC (SECURITY DEFINER, is_founder()-gated like
// every other founder_* RPC, so non-founder accounts get 'Not authorized' from the
// server regardless of the UI). No actions here by design: refunds are issued in the
// Stripe Dashboard (the charge.refunded webhook syncs our status), cancellation is a
// founder-run SQL/MCP update in Phase 1, and shipping actions are Phase 2.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

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

interface OrderRow {
  id: string;
  customer_email: string | null;
  shipping_name: string | null;
  status: string;
  amount_total_cents: number | null;
  tax_cents: number | null;
  currency: string | null;
  sms_consent: boolean;
  is_preorder: boolean;
  product_label: string | null;
  created_at: string;
  items: OrderItem[];
  messages: OrderMsg[];
}

interface OrdersPayload {
  error?: string;
  summary: {
    total: number;
    preorder_hold: number;
    cancelled: number;
    refunded: number;
    sms_consent: number;
    gross_cents: number;
    tax_cents: number;
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

// Status pill colors — terminal states muted red, held/active states brand tones.
function statusStyle(status: string): React.CSSProperties {
  if (status === "cancelled" || status === "refunded") {
    return { backgroundColor: "hsl(var(--destructive) / 0.12)", color: "hsl(var(--destructive))" };
  }
  if (status === "preorder_hold") {
    return { backgroundColor: "hsl(var(--eden-gold) / 0.18)", color: "hsl(var(--eden-bark))" };
  }
  return { backgroundColor: "hsl(var(--eden-sage) / 0.18)", color: "hsl(var(--eden-forest))" };
}

export default function OrdersTab({ since }: { since: string }) {
  const [payload, setPayload] = useState<OrdersPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase.rpc("founder_orders" as never, { p_since: since } as never);
      if (e) throw e;
      const p = data as OrdersPayload | null;
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

  const s = payload?.summary;
  const orders = payload?.orders ?? [];

  return (
    <>
      {error && (
        <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="font-body text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <Stat label="Preorders held" value={String(s?.preorder_hold ?? 0)} />
        <Stat label="Gross (excl. cancelled/refunded)" value={money(s?.gross_cents ?? 0)} />
        <Stat label="SMS opt-ins" value={String(s?.sms_consent ?? 0)} />
        <Stat label="Cancelled + refunded" value={String((s?.cancelled ?? 0) + (s?.refunded ?? 0))} />
      </div>

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
                {["Customer", "Items", "Amount", "Status", "SMS", "Messages", "Date (CT)"].map((h) => (
                  <th key={h} className="px-3 py-2 font-accent text-[10px] tracking-wider uppercase text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-border align-top">
                  <td className="px-3 py-2 font-body text-sm">
                    {o.customer_email ?? "(no email)"}
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
                                className="ml-1 text-[10px] uppercase tracking-wide px-1 py-0.5 rounded"
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
                    <span className="font-accent text-[10px] tracking-wider uppercase px-2 py-1 rounded whitespace-nowrap" style={statusStyle(o.status)}>
                      {o.status.replace(/_/g, " ")}
                    </span>
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
              {orders.length === 0 && !loading && (
                <tr>
                  <td className="px-3 py-3 font-body text-sm text-muted-foreground" colSpan={7}>
                    No orders in this window yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="font-body text-[11px] text-muted-foreground mt-2">
          Read-only. Refunds are issued from the Stripe Dashboard; the charge.refunded webhook
          updates the status here automatically. Showing up to 500 most recent orders in the window.
        </p>
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-4 bg-card">
      <p className="font-accent text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-1">{label}</p>
      <p className="font-serif font-bold text-2xl" style={{ color: "hsl(var(--eden-bark))" }}>{value}</p>
    </div>
  );
}
