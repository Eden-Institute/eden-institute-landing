// src/components/founder/OrdersTab.tsx
//
// Founder dashboard · Orders tab. Phase 1: read-only order list. Phase 2: the
// fulfillment queue. Reads via the founder_orders RPC (SECURITY DEFINER,
// is_founder()-gated); all ACTIONS go through the founder-fulfillment Edge Function
// (founder JWT required server-side), and every state change runs through the shared
// transition engine, so edge validation and message idempotency are identical no
// matter which button fired it. Full refunds still happen in the Stripe Dashboard;
// the charge.refunded webhook keeps status in sync.

import { useCallback, useEffect, useMemo, useState } from "react";
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
  channel: "email" | "sms" | "note";
  template_key: string;
  status: "sent" | "failed" | "logged";
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
  lookup_key: string | null;
  created_at: string;
  shipping_label_url: string | null;
  shipping_carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  shipping_cost_cents: number | null;
  easypost_shipment_id: string | null;
  address_validation_status: string | null;
  address_validation_error: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  shipping_address: any;
  items: OrderItem[];
  messages: OrderMsg[];
}

interface OrdersPayload {
  error?: string;
  summary: {
    total: number;
    preorder_hold: number;
    ready_to_fulfill: number;
    label_created: number;
    shipped: number;
    delivered: number;
    cancelled: number;
    refunded: number;
    sms_consent: number;
    gross_cents: number;
    tax_cents: number;
  };
  orders: OrderRow[];
}

const STATUSES = [
  "preorder_hold",
  "ready_to_fulfill",
  "label_created",
  "shipped",
  "delivered",
  "paid",
  "cancelled",
  "refunded",
] as const;

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

function statusStyle(status: string): React.CSSProperties {
  if (status === "cancelled" || status === "refunded") {
    return { backgroundColor: "hsl(var(--destructive) / 0.12)", color: "hsl(var(--destructive))" };
  }
  if (status === "preorder_hold") {
    return { backgroundColor: "hsl(var(--eden-gold) / 0.18)", color: "hsl(var(--eden-bark))" };
  }
  return { backgroundColor: "hsl(var(--eden-sage) / 0.18)", color: "hsl(var(--eden-forest))" };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatAddress(a: any): string {
  if (!a) return "(no address)";
  return [a.line1, a.line2, `${a.city ?? ""}, ${a.state ?? ""} ${a.postal_code ?? ""}`]
    .filter(Boolean)
    .join(" · ");
}

export default function OrdersTab({ since }: { since: string }) {
  const [payload, setPayload] = useState<OrdersPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null); // action key while running
  const [notice, setNotice] = useState<string | null>(null);
  const [releaseSku, setReleaseSku] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase.rpc("founder_orders" as never, { p_since: since } as never);
      if (e) throw e;
      const p = data as OrdersPayload | null;
      if (p?.error) throw new Error(p.error);
      setPayload(p);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load orders.");
    } finally {
      setLoading(false);
    }
  }, [since]);

  useEffect(() => {
    load();
  }, [load]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const callAction = useCallback(async (key: string, body: Record<string, any>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(key);
    setNotice(null);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("founder-fulfillment", { body });
      if (fnError) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let msg = fnError.message;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const j = await (fnError as any).context?.json?.();
          if (j?.error) msg = j.error;
        } catch { /* keep generic */ }
        throw new Error(msg);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = data as any;
      if (d && d.ok === false) throw new Error(d.error ?? "Action failed");
      if (d && typeof d.released === "number") {
        setNotice(`Released ${d.released}${typeof d.found === "number" ? ` of ${d.found} held` : ""}${d.failed ? ` (${d.failed} failed)` : ""}${typeof d.skipped === "number" && d.skipped ? ` (${d.skipped} skipped)` : ""}.`);
      } else {
        setNotice("Done.");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  }, [load]);

  const s = payload?.summary;
  const orders = useMemo(() => {
    const all = payload?.orders ?? [];
    return filter === "all" ? all : all.filter((o) => o.status === filter);
  }, [payload, filter]);

  const heldSkus = useMemo(() => {
    const set = new Set<string>();
    for (const o of payload?.orders ?? []) {
      if (o.status === "preorder_hold" && o.lookup_key) set.add(o.lookup_key);
    }
    return Array.from(set).sort();
  }, [payload]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedHeld = useMemo(
    () => Array.from(selected).filter((id) => (payload?.orders ?? []).find((o) => o.id === id)?.status === "preorder_hold"),
    [selected, payload],
  );

  return (
    <>
      {error && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="font-body text-sm text-destructive">{error}</p>
        </div>
      )}
      {notice && (
        <div className="mb-4 rounded-lg border p-3" style={{ borderColor: "hsl(var(--eden-sage) / 0.5)", backgroundColor: "hsl(var(--eden-sage) / 0.08)" }}>
          <p className="font-body text-sm" style={{ color: "hsl(var(--eden-forest))" }}>{notice}</p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Held preorders" value={String(s?.preorder_hold ?? 0)} />
        <Stat label="Ready to fulfill" value={String(s?.ready_to_fulfill ?? 0)} />
        <Stat label="Label created / shipped" value={`${s?.label_created ?? 0} / ${s?.shipped ?? 0}`} />
        <Stat label="Gross (excl. cancelled/refunded)" value={money(s?.gross_cents ?? 0)} />
      </div>

      {/* Batch release (the switch, Phase 4). Idempotent: re-running cannot double-send. */}
      <div className="mb-6 rounded-lg border border-border p-4 bg-card">
        <p className="font-accent text-xs tracking-[0.2em] uppercase mb-2" style={{ color: "hsl(var(--eden-gold))" }}>
          Release preorders
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={releaseSku}
            onChange={(e) => setReleaseSku(e.target.value)}
            className="font-body text-sm border border-border rounded-md px-2 py-1.5 bg-background"
          >
            <option value="">Choose product…</option>
            {heldSkus.map((sku) => (
              <option key={sku} value={sku}>{sku}</option>
            ))}
          </select>
          <Button
            size="sm"
            variant="eden"
            disabled={!releaseSku || busy !== null}
            onClick={() =>
              callAction("release", { action: "release_preorders", sku: releaseSku },
                `Release ALL held preorders for ${releaseSku}? Each order moves to ready_to_fulfill and gets ONE \"we are preparing your order\" email (and text if consented).`)
            }
          >
            {busy === "release" ? "Releasing…" : "Batch release"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={selectedHeld.length === 0 || busy !== null}
            onClick={() =>
              callAction("release_sel", { action: "release_orders", order_ids: selectedHeld },
                `Release the ${selectedHeld.length} selected held order(s)?`)
            }
          >
            {busy === "release_sel" ? "Releasing…" : `Release selected (${selectedHeld.length})`}
          </Button>
        </div>
        <p className="font-body text-[11px] text-muted-foreground mt-2">
          Moves preorder_hold orders to ready_to_fulfill and sends exactly one preorder_released message per order (message_log enforced).
        </p>
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        {["all", ...STATUSES].map((st) => (
          <button
            key={st}
            onClick={() => setFilter(st)}
            className="font-body text-xs px-3 py-1 rounded-full border transition-colors"
            style={
              filter === st
                ? { backgroundColor: "hsl(var(--eden-bark))", color: "white", borderColor: "hsl(var(--eden-bark))" }
                : { backgroundColor: "transparent", color: "hsl(var(--eden-bark))", borderColor: "hsl(var(--eden-bark) / 0.3)" }
            }
          >
            {st.replace(/_/g, " ")}
          </button>
        ))}
        <span className="ml-auto">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border mb-2">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-muted/40">
              <th className="px-2 py-2"></th>
              {["Customer / address", "Items", "Amount", "Status", "Shipping", "Messages", "Date (CT)", "Actions"].map((h) => (
                <th key={h} className="px-3 py-2 font-accent text-[10px] tracking-wider uppercase text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-border align-top">
                <td className="px-2 py-2">
                  <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleSelect(o.id)} className="h-4 w-4" />
                </td>
                <td className="px-3 py-2 font-body text-sm max-w-[240px]">
                  {o.customer_email ?? "(no email)"}
                  <br />
                  <span className="text-xs text-muted-foreground">{o.shipping_name ?? "(no name)"}</span>
                  <br />
                  <span className="text-xs text-muted-foreground">{formatAddress(o.shipping_address)}</span>
                  {o.address_validation_status === "failed" && (
                    <p className="text-xs mt-1" style={{ color: "hsl(var(--destructive))" }}>
                      Address failed validation: {o.address_validation_error ?? "undeliverable"}. Fix in Stripe/DB, then re-validate.
                    </p>
                  )}
                  {o.address_validation_status === "valid" && (
                    <span className="text-[10px] uppercase tracking-wide" style={{ color: "hsl(var(--eden-sage))" }}>address valid</span>
                  )}
                </td>
                <td className="px-3 py-2 font-body text-sm">
                  {o.items.length > 0
                    ? o.items.map((it, i) => (
                        <span key={`${it.sku}-${i}`}>
                          {it.quantity} × {it.name}
                          {it.is_founding && (
                            <span className="ml-1 text-[10px] uppercase tracking-wide px-1 py-0.5 rounded" style={{ backgroundColor: "hsl(var(--eden-gold) / 0.18)", color: "hsl(var(--eden-bark))" }}>
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
                  {o.shipping_cost_cents != null && (
                    <span className="block text-xs text-muted-foreground">postage {money(o.shipping_cost_cents)}</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className="font-accent text-[10px] tracking-wider uppercase px-2 py-1 rounded whitespace-nowrap" style={statusStyle(o.status)}>
                    {o.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-3 py-2 font-body text-xs">
                  {o.shipping_label_url && (
                    <a href={o.shipping_label_url} target="_blank" rel="noopener noreferrer" className="underline block">Label</a>
                  )}
                  {o.tracking_number && (
                    <a href={o.tracking_url ?? "#"} target="_blank" rel="noopener noreferrer" className="underline block">
                      {o.shipping_carrier ?? "carrier"} {o.tracking_number}
                    </a>
                  )}
                  {!o.shipping_label_url && !o.tracking_number && <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-2 font-body text-xs text-muted-foreground">
                  {o.messages.length === 0
                    ? "—"
                    : o.messages.map((m, i) => (
                        <span key={i} className="whitespace-nowrap">
                          {m.template_key.split(":")[0]}{" "}
                          <span style={{ color: m.status === "failed" ? "hsl(var(--destructive))" : "hsl(var(--eden-sage))" }}>
                            {m.status === "sent" ? "✓" : m.status}
                          </span>
                          <br />
                        </span>
                      ))}
                </td>
                <td className="px-3 py-2 font-body text-sm text-muted-foreground whitespace-nowrap">{fmtDateTimeCT(o.created_at)}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex flex-col gap-1">
                    {o.status === "ready_to_fulfill" && (
                      <>
                        <Button size="sm" variant="outline" disabled={busy !== null}
                          onClick={() => callAction(`val-${o.id}`, { action: "validate_address", order_id: o.id })}>
                          {busy === `val-${o.id}` ? "Checking…" : "Validate address"}
                        </Button>
                        <Button size="sm" variant="eden" disabled={busy !== null || o.address_validation_status === "failed"}
                          onClick={() => callAction(`buy-${o.id}`, { action: "buy_label", order_id: o.id },
                            "Buy a shipping label for this order? Postage is charged to the EasyPost account.")}>
                          {busy === `buy-${o.id}` ? "Buying…" : "Buy label"}
                        </Button>
                      </>
                    )}
                    {o.status === "label_created" && (
                      <>
                        <Button size="sm" variant="eden" disabled={busy !== null}
                          onClick={() => callAction(`ship-${o.id}`, { action: "mark_shipped", order_id: o.id },
                            "Has the carrier ALREADY picked up this package? Confirm only AFTER pickup. This sends the tracking email (and text if consented) and cannot be unsent.")}>
                          {busy === `ship-${o.id}` ? "Marking…" : "Mark shipped"}
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy !== null}
                          onClick={() => callAction(`void-${o.id}`, { action: "void_label", order_id: o.id },
                            "Void this label and return the order to the fulfillment queue? EasyPost will refund the postage.")}>
                          {busy === `void-${o.id}` ? "Voiding…" : "Void label"}
                        </Button>
                      </>
                    )}
                    {o.status === "shipped" && (
                      <Button size="sm" variant="outline" disabled={busy !== null}
                        onClick={() => callAction(`del-${o.id}`, { action: "mark_delivered", order_id: o.id },
                          "Mark delivered? Normally the carrier webhook does this; use only if tracking shows delivered but the webhook missed it. Sends the delivered text if consented.")}>
                        {busy === `del-${o.id}` ? "Marking…" : "Mark delivered"}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {orders.length === 0 && !loading && (
              <tr>
                <td className="px-3 py-3 font-body text-sm text-muted-foreground" colSpan={9}>
                  No orders in this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="font-body text-[11px] text-muted-foreground">
        Full refunds: issue in the Stripe Dashboard; the webhook flips the order to refunded and suppresses
        all messaging. Partial refunds keep the order in its current state and appear as a note in Messages.
        Delivered normally arrives via the EasyPost tracking webhook. Showing up to 500 orders in the window.
      </p>
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
