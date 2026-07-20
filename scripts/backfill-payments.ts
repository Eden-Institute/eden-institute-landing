// Rebuild the payments ledger from Stripe.
//
// WHY THIS EXISTS
// Subscription invoices were never recorded. The webhook only ever handled
// customer.subscription.* (state) and not invoice.paid (money), so every subscription
// payment ever taken is missing from the database. That history exists only in Stripe,
// which is why this talks to the API rather than reading stripe_events.
//
// One-off Checkout purchases are already reconstructible locally and were handled by
// migration 20260720020000. Running this as well is harmless: it dedupes.
//
// SAFETY
//   * READ-ONLY against Stripe. It lists invoices and charges. It never creates,
//     modifies, or refunds anything.
//   * Idempotent against the database: every insert is keyed on stripe_invoice_id
//     (partial unique where status='paid'), so re-running inserts nothing new.
//   * --dry-run is the DEFAULT. Nothing is written unless you pass --commit.
//
// USAGE
//   $env:STRIPE_SECRET_KEY="sk_live_..."
//   $env:SUPABASE_URL="https://noeqztssupewjidpvhar.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."
//   deno run --allow-net --allow-env scripts/backfill-payments.ts
//   deno run --allow-net --allow-env scripts/backfill-payments.ts --commit
//
// Exit codes: 0 ok, 1 error, 2 misconfigured.

import Stripe from "https://esm.sh/stripe@14.21.0?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const COMMIT = Deno.args.includes("--commit");

if (!STRIPE_KEY || !SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing env. Need STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.",
  );
  Deno.exit(2);
}

const stripe = new Stripe(STRIPE_KEY, {
  apiVersion: "2024-12-18.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});
const db = createClient(SUPABASE_URL, SERVICE_KEY);

const money = (c: number, cur = "usd") =>
  `${(c / 100).toFixed(2)} ${cur.toUpperCase()}`;

function tierFromLookupKey(key: string | null): string {
  if (!key) return "subscription";
  if (key.startsWith("seed")) return "seed";
  if (key.startsWith("root")) return "root";
  if (key.startsWith("practitioner")) return "practitioner";
  return "subscription";
}

interface Row {
  stripe_invoice_id: string;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  user_id: string | null;
  customer_email: string | null;
  kind: "subscription";
  description: string;
  lookup_key: string | null;
  amount_cents: number;
  currency: string;
  status: "paid";
  period_start: string | null;
  period_end: string | null;
  occurred_at: string;
  raw: unknown;
}

console.log(
  `\nBackfilling subscription payments from Stripe  [${COMMIT ? "COMMIT" : "DRY RUN"}]\n`,
);

// Map Stripe customers -> Supabase users once, so each row can be attributed.
const { data: profiles, error: profErr } = await db
  .from("profiles")
  .select("user_id, stripe_customer_id, email")
  .not("stripe_customer_id", "is", null);
if (profErr) {
  console.error("profiles read failed:", profErr.message);
  Deno.exit(1);
}
const byCustomer = new Map<string, { user_id: string; email: string | null }>();
for (const p of profiles ?? []) {
  if (p.stripe_customer_id) {
    byCustomer.set(p.stripe_customer_id, { user_id: p.user_id, email: p.email });
  }
}
console.log(`Mapped ${byCustomer.size} Stripe customers to Supabase users.`);

// Walk every paid invoice. Auto-pagination handles accounts of any size.
const rows: Row[] = [];
let scanned = 0;

for await (const inv of stripe.invoices.list({ status: "paid", limit: 100 })) {
  scanned++;
  // deno-lint-ignore no-explicit-any
  const i = inv as any;
  const amount = i.amount_paid ?? 0;
  if (!amount) continue; // $0 invoice: real event, no money

  const line = i.lines?.data?.[0];
  const lookupKey = line?.price?.lookup_key ?? null;
  const customerId = typeof i.customer === "string" ? i.customer : i.customer?.id ?? null;
  const mapped = customerId ? byCustomer.get(customerId) : undefined;
  const period = line?.period ?? null;

  rows.push({
    stripe_invoice_id: i.id,
    stripe_payment_intent_id: typeof i.payment_intent === "string" ? i.payment_intent : null,
    stripe_charge_id: typeof i.charge === "string" ? i.charge : null,
    stripe_customer_id: customerId,
    stripe_subscription_id: typeof i.subscription === "string" ? i.subscription : i.subscription?.id ?? null,
    user_id: mapped?.user_id ?? null,
    customer_email: (i.customer_email ?? mapped?.email ?? "")?.toLowerCase() || null,
    kind: "subscription",
    description: `${tierFromLookupKey(lookupKey)} subscription`,
    lookup_key: lookupKey,
    amount_cents: amount,
    currency: i.currency ?? "usd",
    status: "paid",
    period_start: period?.start ? new Date(period.start * 1000).toISOString() : null,
    period_end: period?.end ? new Date(period.end * 1000).toISOString() : null,
    occurred_at: new Date((i.status_transitions?.paid_at ?? i.created) * 1000).toISOString(),
    raw: i,
  });
}

console.log(`Scanned ${scanned} paid invoices in Stripe; ${rows.length} carry money.\n`);

if (!rows.length) {
  console.log("Nothing to backfill.");
  Deno.exit(0);
}

// What is already in the ledger, so the report shows the real delta.
const { data: existing } = await db
  .from("payments")
  .select("stripe_invoice_id")
  .not("stripe_invoice_id", "is", null);
const have = new Set((existing ?? []).map((r) => r.stripe_invoice_id));
const missing = rows.filter((r) => !have.has(r.stripe_invoice_id));

const total = missing.reduce((s, r) => s + r.amount_cents, 0);
console.log(`Already in ledger: ${rows.length - missing.length}`);
console.log(`To insert:         ${missing.length}  (${money(total)})\n`);

for (const r of missing.slice(0, 40)) {
  console.log(
    `  ${r.occurred_at.slice(0, 10)}  ${money(r.amount_cents, r.currency).padStart(12)}  ` +
      `${r.description.padEnd(26)} ${r.customer_email ?? "(no email)"}` +
      `${r.user_id ? "" : "   [UNMATCHED to a Supabase user]"}`,
  );
}
if (missing.length > 40) console.log(`  ... and ${missing.length - 40} more`);

if (!COMMIT) {
  console.log("\nDRY RUN. Nothing written. Re-run with --commit to insert.\n");
  Deno.exit(0);
}

// Chunked insert. onConflict on the invoice guards against a concurrent webhook.
let inserted = 0;
for (let i = 0; i < missing.length; i += 100) {
  const chunk = missing.slice(i, i + 100);
  const { error } = await db.from("payments").insert(chunk);
  if (error) {
    // 23505 means the webhook beat us to it, which is fine.
    // deno-lint-ignore no-explicit-any
    if ((error as any).code === "23505") {
      console.warn(`  chunk ${i / 100 + 1}: some rows already present, skipped`);
      continue;
    }
    console.error("Insert failed:", error.message);
    Deno.exit(1);
  }
  inserted += chunk.length;
}

console.log(`\nInserted ${inserted} payment rows (${money(total)}).`);
console.log("Verify:  select kind, status, count(*), sum(amount_cents) from payments group by 1,2;\n");
