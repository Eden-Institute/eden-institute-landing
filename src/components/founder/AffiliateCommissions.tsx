// src/components/founder/AffiliateCommissions.tsx
//
// Founder dashboard → Partners tab → "Codes & commission owed". One row per partner
// code: orders, what buyers paid, what the partner has earned, what is payable now,
// what has been paid, and what is still owed. Reads founder_affiliate_commissions
// (SECURITY DEFINER, is_founder()-gated).
//
// Terms (founder 2026-10-05, Laws L-30): 10% of goods paid (after the buyer's 10% off,
// before tax and shipping), every store product, payable 30 days after shipping
// (digital: 30 days after purchase), refunds and cancellations earn nothing, paid by hand.
// A 0% row is a partner who waived commission (ONTHECOVE): sales still show, owed stays $0.
//
// Codes come from the Outreach Bible Affiliates tab via scripts/sync_affiliate_codes.py.
// A freshly minted code is invisible here until that sync runs.
// "Mark paid" writes public.affiliate_payouts, which is the payout ledger of record.

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CommissionRow {
  promo_code_id: string;
  code: string;
  partner: string;
  commission_rate: number;
  orders: number;
  goods_cents: number;
  earned_cents: number;
  holding_cents: number;
  waiting_cents: number;
  payable_cents: number;
  paid_cents: number;
  owed_cents: number;
  last_order_at: string | null;
  last_paid_on: string | null;
}

function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  // A bare date (paid_on) must not shift a day west of UTC.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AffiliateCommissions() {
  const [rows, setRows] = useState<CommissionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: e } = await supabase.rpc("founder_affiliate_commissions");
    if (e) setError(e.message);
    else setRows((data as CommissionRow[] | null) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    const list = rows ?? [];
    const sum = (k: keyof CommissionRow) => list.reduce((n, r) => n + Number(r[k] ?? 0), 0);
    return {
      orders: sum("orders"),
      sales: sum("goods_cents"),
      earned: sum("earned_cents"),
      owed: sum("owed_cents"),
      paid: sum("paid_cents"),
    };
  }, [rows]);

  function openPay(r: CommissionRow) {
    setPaying(r.promo_code_id);
    setAmount(r.owed_cents > 0 ? (r.owed_cents / 100).toFixed(2) : "");
    setNote("");
  }

  async function savePayout(r: CommissionRow) {
    const cents = Math.round(parseFloat(amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      setError("Enter the amount you paid, in dollars.");
      return;
    }
    if (!window.confirm(`Record ${money(cents)} paid to ${r.partner} (${r.code})?`)) return;
    setSaving(true);
    const { error: e } = await supabase.rpc("founder_record_affiliate_payout", {
      p_promo_code_id: r.promo_code_id,
      p_amount_cents: cents,
      p_note: note || undefined,
    });
    setSaving(false);
    if (e) {
      setError(e.message);
      return;
    }
    setPaying(null);
    await load();
  }

  return (
    <section className="mb-10">
      <SectionLabel>Codes &amp; commission owed</SectionLabel>

      {error && (
        <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <p className="font-body text-sm text-destructive">{error}</p>
        </div>
      )}

      {rows && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 mb-4">
            <StatCard label="Coded orders" value={String(totals.orders)} />
            <StatCard label="Sales via codes" value={money(totals.sales)} />
            <StatCard label="Commission earned" value={money(totals.earned)} />
            <StatCard label="You owe now" value={money(totals.owed)} />
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-muted/40">
                  <Th>Partner</Th>
                  <Th>Rate</Th>
                  <Th right>Orders</Th>
                  <Th right>Sales</Th>
                  <Th right>Earned</Th>
                  <Th right>On hold</Th>
                  <Th right>Paid</Th>
                  <Th right>Owed now</Th>
                  <Th>{""}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const rate = Number(r.commission_rate);
                  const hold = Number(r.holding_cents) + Number(r.waiting_cents);
                  return (
                    <tr key={r.promo_code_id} className="border-t border-border align-top">
                      <Td>
                        <span className="font-semibold">{r.partner}</span>
                        <br />
                        <span className="font-mono text-[11px] text-muted-foreground">{r.code}</span>
                        {r.last_order_at && (
                          <span className="text-[11px] text-muted-foreground">
                            {" "}· last order {fmtDate(r.last_order_at)}
                          </span>
                        )}
                        {paying === r.promo_code_id && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              inputMode="decimal"
                              value={amount}
                              onChange={(e) => setAmount(e.target.value)}
                              placeholder="Amount $"
                              className="w-28 rounded border border-border bg-background px-2 py-1 text-sm"
                            />
                            <input
                              value={note}
                              onChange={(e) => setNote(e.target.value)}
                              placeholder="Note (e.g. PayPal, Oct payout)"
                              className="w-56 rounded border border-border bg-background px-2 py-1 text-sm"
                            />
                            <button
                              onClick={() => savePayout(r)}
                              disabled={saving}
                              className="rounded bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                            >
                              {saving ? "Saving…" : "Save payment"}
                            </button>
                            <button
                              onClick={() => setPaying(null)}
                              className="text-xs text-muted-foreground underline"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap">
                        {rate === 0 ? (
                          <span className="text-muted-foreground">Waived</span>
                        ) : (
                          `${Math.round(rate * 100)}%`
                        )}
                      </Td>
                      <Td right>{r.orders}</Td>
                      <Td right>{money(Number(r.goods_cents))}</Td>
                      <Td right>{money(Number(r.earned_cents))}</Td>
                      <Td right className="text-muted-foreground">{money(hold)}</Td>
                      <Td right className="text-muted-foreground">
                        {money(Number(r.paid_cents))}
                        {r.last_paid_on && (
                          <>
                            <br />
                            <span className="text-[11px]">{fmtDate(r.last_paid_on)}</span>
                          </>
                        )}
                      </Td>
                      <Td right className={Number(r.owed_cents) > 0 ? "font-semibold" : "text-muted-foreground"}>
                        {money(Number(r.owed_cents))}
                      </Td>
                      <Td>
                        {rate > 0 && paying !== r.promo_code_id && (
                          <button
                            onClick={() => openPay(r)}
                            className="whitespace-nowrap text-xs underline text-muted-foreground hover:text-foreground"
                          >
                            Mark paid
                          </button>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="font-body text-[11px] text-muted-foreground mt-2">
            Commission is 10% of what the buyer paid for the goods (after their 10% off, before tax and
            shipping). It becomes owed 30 days after the order ships (digital: 30 days after purchase), so
            a refund in that window cancels it. "On hold" is earned but not payable yet. Refunded or
            cancelled orders earn nothing. A new code shows up here after scripts/sync_affiliate_codes.py runs.
          </p>
        </>
      )}
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-4 bg-card">
      <p className="font-accent text-[11px] tracking-[0.2em] uppercase text-muted-foreground mb-1">{label}</p>
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
    <th className={`px-3 py-2 font-accent text-[11px] tracking-wider uppercase text-muted-foreground ${right ? "text-right" : ""}`}>
      {children}
    </th>
  );
}

function Td({ children, className = "", right }: { children: React.ReactNode; className?: string; right?: boolean }) {
  return (
    <td className={`px-3 py-2 font-body text-sm ${right ? "text-right" : ""} ${className}`}>{children}</td>
  );
}
