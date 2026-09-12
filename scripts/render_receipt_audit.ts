// Assert every curriculum receipt is ITEMIZED and says CURRICULUM.
// Founder requirement 2026-09-12: Eden's Table is targeting scholarship states,
// whose reviewers need both.
//
//   deno run --allow-read --node-modules-dir=none scripts/render_receipt_audit.ts
//
// Uses the REAL stored totals of three production orders (read 2026-09-12), so the
// arithmetic under test is what Stripe actually recorded, not invented numbers:
//   ET-1026  printed set   subtotal 24900, shipping 1200, tax 2480, total 28580
//   ET-1017  Starter Unit  subtotal  3900, tax 371, total 4271
//   ET-1023  Starter Unit  subtotal  3900, tax 0,   total 3900
// Exit 1 on any failure.
import {
  RECEIPT_NAMES,
  STARTER_ORDER_LABEL,
  curriculumInvoiceCreation,
  loadOrderReceipt,
  receiptBalances,
  renderReceiptHtml,
  renderReceiptText,
  starterReceipt,
} from "../supabase/functions/_shared/receipt.ts";
import { buildOrderConfirmationEmail } from "../supabase/functions/_shared/order-messages.ts";
import { renderStarterDeliveryEmail } from "../supabase/functions/_shared/starter-email.ts";

let failures = 0;
const check = (ok: boolean, label: string, detail = "") => {
  if (ok) console.log(`ok   ${label}`);
  else { failures++; console.log(`FAIL ${label}${detail ? "  " + detail : ""}`); }
};

// A stand-in for the supabase client: just enough of from().select().eq() to
// return order_items rows shaped like PostgREST's embedded select.
// deno-lint-ignore no-explicit-any
function fakeDb(items: any[]) {
  return {
    from: (_t: string) => ({
      select: (_c: string) => ({ eq: (_k: string, _v: string) => Promise.resolve({ data: items, error: null }) }),
    }),
    rpc: () => Promise.resolve({ data: null, error: null }),
  };
}

// ── 1. Every receipt name says curriculum ──
for (const [sku, v] of Object.entries(RECEIPT_NAMES)) {
  check(/curriculum/i.test(v.name), `receipt name for ${sku} contains "curriculum"`, v.name);
}
check(/curriculum/i.test(STARTER_ORDER_LABEL), "Starter order label contains curriculum", STARTER_ORDER_LABEL);

// ── 2. The printed set, ET-1026's real numbers, through the real loader ──
const et1026 = {
  id: "00000000-0000-0000-0000-000000001026",
  order_number: "ET-1026",
  customer_email: "buyer@example.com",
  customer_phone: null,
  shipping_name: "Camila Johnson",
  product_label: "Sprouts Printed Curriculum Set",
  amount_total_cents: 28580,
  tax_cents: 2480,
  currency: "usd",
  sms_consent: false,
  status: "ready_to_fulfill",
  created_at: "2026-09-11T19:53:01.050Z",
  raw: { total_details: { amount_tax: 2480, amount_discount: 0, amount_shipping: 1200 }, amount_subtotal: 24900 },
};
// deno-lint-ignore no-explicit-any
const printReceipt = await loadOrderReceipt(fakeDb([
  { quantity: 1, unit_price_cents: 24900, products: { sku: "sprouts_print_set", name: "Sprouts Printed Curriculum Set" } },
]) as any, et1026 as any);
check(printReceipt !== null, "ET-1026 receipt loads from order_items");
if (printReceipt) {
  check(receiptBalances(printReceipt), "ET-1026 lines + shipping + tax = total charged",
    JSON.stringify({ lines: printReceipt.lines, s: printReceipt.shippingCents, t: printReceipt.taxCents, total: printReceipt.totalCents }));
  check(printReceipt.shippingCents === 1200 && printReceipt.taxCents === 2480, "ET-1026 shipping and tax read from Stripe totals");
  // deno-lint-ignore no-explicit-any
  const email = buildOrderConfirmationEmail(et1026 as any, printReceipt);
  for (const needle of ["Itemized receipt", "Printed Curriculum Set", "$249.00", "Shipping", "$12.00", "Sales tax", "$24.80", "Total paid", "$285.80", "Rooted in Faith Ventures LLC", "303 Holly Cir, Unit 3262, Clarksville, TN 37043", "ET-1026"]) {
    check(email.html.includes(needle), `print confirmation shows "${needle}"`);
  }
  check(!/—/.test(renderReceiptHtml(printReceipt)), "print receipt has no em dash");
}

// ── 3. Set plus two extra notebooks: quantity rows and arithmetic ──
const withNotebooks = await loadOrderReceipt(fakeDb([
  { quantity: 2, unit_price_cents: 3999, products: { sku: "sprouts_nb_print", name: "Extra Student Notebook, printed" } },
  { quantity: 1, unit_price_cents: 24900, products: { sku: "sprouts_print_set", name: "Sprouts Printed Curriculum Set" } },
// deno-lint-ignore no-explicit-any
]) as any, { ...et1026, amount_total_cents: 24900 + 7998 + 1200 + 3100, tax_cents: 3100,
  raw: { total_details: { amount_tax: 3100, amount_discount: 0, amount_shipping: 1200 } } } as any);
if (withNotebooks) {
  check(withNotebooks.lines[0].unitCents === 24900, "the set is listed before the add-on notebooks");
  check(receiptBalances(withNotebooks), "set + 2 notebooks + shipping + tax balances");
  const html = renderReceiptHtml(withNotebooks);
  check(html.includes("2 x $39.99") && html.includes("$79.98"), "notebook line shows quantity and line total");
  check(!/Extra Student Notebook, printed/.test(html), "shop name replaced by the curriculum receipt name");
}

// ── 4. A discount shows as its own line and still balances ──
const discounted = await loadOrderReceipt(fakeDb([
  { quantity: 1, unit_price_cents: 24900, products: { sku: "sprouts_print_set", name: "x" } },
// deno-lint-ignore no-explicit-any
]) as any, { ...et1026, amount_total_cents: 24900 - 2500 + 1200 + 2200, tax_cents: 2200,
  raw: { total_details: { amount_tax: 2200, amount_discount: 2500, amount_shipping: 1200 } } } as any);
if (discounted) {
  check(receiptBalances(discounted), "affiliate discount receipt balances");
  check(renderReceiptHtml(discounted).includes("-$25.00"), "discount rendered as a negative line");
}

// ── 5. No items: the loader returns null so the caller falls back, never an empty receipt ──
// deno-lint-ignore no-explicit-any
check(await loadOrderReceipt(fakeDb([]) as any, et1026 as any) === null, "no order_items -> null, not an empty receipt");

// ── 6. Starter Unit, ET-1017 (taxed) and ET-1023 (untaxed), real numbers ──
for (const o of [
  { order_number: "ET-1017", amount_total_cents: 4271, tax_cents: 371, created_at: "2026-09-01T23:19:05Z",
    raw: { amount_subtotal: 3900, total_details: { amount_tax: 371, amount_discount: 0, amount_shipping: 0 }, customer_details: { name: "Camila Johnson" } } },
  { order_number: "ET-1023", amount_total_cents: 3900, tax_cents: 0, created_at: "2026-09-06T12:27:25Z",
    raw: { amount_subtotal: 3900, total_details: { amount_tax: 0, amount_discount: 0, amount_shipping: 0 }, customer_details: { name: "Melody L Schmoyer" } } },
]) {
  const r = starterReceipt(o);
  check(receiptBalances(r), `${o.order_number} Starter receipt balances`);
  const email = renderStarterDeliveryEmail({ firstName: "Sarah", email: "b@example.com", creditCode: null, downloadToken: "t", receipt: r });
  check(email.html.includes("Digital Curriculum, Weeks 1 to 9"), `${o.order_number} Starter HTML names the curriculum`);
  check(email.text.includes("ITEMIZED RECEIPT: HOMESCHOOL CURRICULUM"), `${o.order_number} Starter plain text carries the receipt`);
  check(email.html.includes(`Total paid`) && email.html.includes(o.order_number), `${o.order_number} Starter HTML shows total and order number`);
}

// ── 7. The Starter email no longer carries the stale plant-cards section ──
const bare = renderStarterDeliveryEmail({ firstName: null, email: "b@example.com", creditCode: "X", downloadToken: "t", receipt: null });
check(!/plant cards/i.test(bare.html) && !/printed kit/i.test(bare.html), 'Starter HTML has no "plant cards" / "printed kit" section');
check(!/Itemized receipt/i.test(bare.html), "no receipt block is rendered when the order row is missing");
check(!/credit/i.test(bare.html.replace(/<!--[\s\S]*?-->/g, "")), "Starter HTML still never mentions the credit");

// ── 8. Stripe invoice_creation shape: within Stripe's limits, says curriculum ──
for (const kind of ["print", "starter"] as const) {
  const inv = curriculumInvoiceCreation(kind);
  const f = inv.invoice_data.custom_fields;
  check(inv.enabled === true, `${kind} invoice creation enabled`);
  check(f.length <= 4 && f.every((x) => x.name.length <= 40 && x.value.length <= 140), `${kind} custom fields within Stripe limits`);
  check(f.some((x) => /curriculum/i.test(x.value)) && /curriculum/i.test(inv.invoice_data.description), `${kind} invoice says curriculum`);
  check(inv.invoice_data.footer.includes("Rooted in Faith Ventures LLC"), `${kind} invoice names the legal seller`);
}

// ── 9. Plain text receipt ──
if (printReceipt) {
  const t = renderReceiptText(printReceipt);
  check(t.includes("Subtotal   $249.00") && t.includes("Total paid $285.80"), "plain-text print receipt itemizes and totals");
}

console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL CLEAN");
Deno.exit(failures ? 1 : 0);
