// Founder dashboard → the money that actually arrived.
//
// Everything else on the Revenue tab counts STATE: how many people currently hold a
// tier, whether a boolean flag was flipped. That is what made two real $4.99 guide
// sales show as "1", and what made every subscription renewal invisible.
//
// This reads the payments ledger, which is one row per charge. It answers "what came in
// and when", and it reconciles directly against Stripe.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PaymentRow {
  id: string;
  occurred_at: string;
  kind: "subscription" | "one_off";
  status: "paid" | "failed" | "refunded";
  description: string | null;
  lookup_key: string | null;
  amount_cents: number;
  currency: string | null;
  customer_email: string | null;
  stripe_invoice_id: string | null;
  period_start: string | null;
  period_end: string | null;
}

interface Payload {
  error?: string;
  summary: {
    gross_cents: number;
    refunded_cents: number;
    net_cents: number;
    subscription_cents: number;
    one_off_cents: number;
    paid_count: number;
    failed_count: number;
  };
  payments: PaymentRow[];
}

function money(cents: number | null | undefined, currency = "usd"): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago",
  });
}

export default function PaymentsPanel({ since }: { since: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res, error: rpcError } = await supabase.rpc(
        "founder_payments" as never,
        { p_since: since } as never,
      );
      if (rpcError) throw rpcError;
      const payload = res as unknown as Payload;
      if (payload?.error) throw new Error(payload.error);
      setData(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load payments");
    } finally {
      setLoading(false);
    }
  }, [since]);

  useEffect(() => { void load(); }, [load]);

  const s = data?.summary;

  return (
    <section className="mb-10">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-serif text-lg font-bold" style={{ color: "hsl(var(--eden-bark))" }}>
          Money received
        </h3>
        <button type="button" onClick={() => void load()} disabled={loading}
          className="font-body text-xs underline text-muted-foreground disabled:opacity-50">
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="font-body text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat label="Received (window)" value={money(s?.gross_cents ?? 0)} strong />
        <Stat label="Subscriptions" value={money(s?.subscription_cents ?? 0)} />
        <Stat label="One-off sales" value={money(s?.one_off_cents ?? 0)} />
        <Stat
          label="Refunded"
          value={money(s?.refunded_cents ?? 0)}
          muted={!s?.refunded_cents}
        />
      </div>

      {!!s?.failed_count && (
        <p className="font-body text-sm mb-4" style={{ color: "hsl(var(--destructive))" }}>
          {s.failed_count} failed payment{s.failed_count === 1 ? "" : "s"} in this window.
          A failed renewal is usually a card that needs updating, and it is the start of
          involuntary churn.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-muted/40">
              {["Date", "What", "Type", "Amount", "Customer"].map((h) => (
                <th key={h} className="px-3 py-2 font-accent text-[10px] tracking-wider uppercase text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data?.payments ?? []).map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-3 py-2 font-body text-sm whitespace-nowrap">{day(p.occurred_at)}</td>
                <td className="px-3 py-2 font-body text-sm">
                  {p.description ?? p.lookup_key ?? "—"}
                  {p.period_start && p.period_end && (
                    <span className="block text-xs text-muted-foreground">
                      {day(p.period_start)} to {day(p.period_end)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 font-body text-xs text-muted-foreground">
                  {p.kind === "subscription" ? "Subscription" : "One-off"}
                  {p.status !== "paid" && (
                    <span className="ml-1 uppercase" style={{ color: "hsl(var(--destructive))" }}>
                      {p.status}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 font-body text-sm whitespace-nowrap"
                  style={p.status === "refunded" ? { textDecoration: "line-through", opacity: 0.6 } : undefined}>
                  {money(p.amount_cents, p.currency ?? "usd")}
                </td>
                <td className="px-3 py-2 font-body text-sm">{p.customer_email ?? "—"}</td>
              </tr>
            ))}
            {!loading && (data?.payments?.length ?? 0) === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center font-body text-sm text-muted-foreground">
                  No payments recorded in this window.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="font-body text-xs text-muted-foreground mt-2">
        One row per charge, straight from Stripe events. Subscription renewals appear
        here as they happen. Counts below this panel are current subscriber totals, not
        money.
      </p>
    </section>
  );
}

function Stat({ label, value, strong, muted }: {
  label: string; value: string; strong?: boolean; muted?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="font-accent text-[10px] tracking-wider uppercase text-muted-foreground">{label}</p>
      <p
        className={`font-serif ${strong ? "text-2xl" : "text-xl"} font-bold`}
        style={{ color: muted ? "hsl(var(--muted-foreground))" : "hsl(var(--eden-bark))" }}
      >
        {value}
      </p>
    </div>
  );
}
