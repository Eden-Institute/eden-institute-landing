// deno test --allow-net supabase/functions/_shared/esa-invoice.test.ts
// (--allow-net only because the PDF module imports pdf-lib from esm.sh)
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  addDays,
  centralDate,
  feeFor,
  forbiddenOnInvoice,
  parseSubmission,
  planInvoices,
  secondDate,
  STATE_RULES,
} from "./esa-invoice.ts";
import { renderInvoicePdf } from "./esa-invoice-pdf.ts";

const addr = { line1: "123 Main St", line2: "", city: "Mesa", region: "AZ", zip: "85201" };
const base = (over: Record<string, unknown> = {}) => ({
  state: "AZ",
  parentName: "Jane Doe",
  email: "Jane@Example.com",
  address: addr,
  students: [{ first: "Sam", last: "Doe", choice: "set" }],
  ...over,
});

Deno.test("Arizona fee matches the founder-approved template totals", () => {
  // ESA_Invoice_Templates notes: set $5.33 / $266.33, notebook $0.82 / $40.81, set+notebook $6.14.
  assertEquals(feeFor(26100, STATE_RULES.AZ.feeRate), 533);
  assertEquals(feeFor(3999, STATE_RULES.AZ.feeRate), 82);
  assertEquals(feeFor(30099, STATE_RULES.AZ.feeRate), 614);
  assertEquals(feeFor(26100, STATE_RULES.AR.feeRate), 0);
});

Deno.test("one invoice per student, with per-state totals", () => {
  const p = parseSubmission(base({ students: [{ first: "Sam", last: "Doe", choice: "set" }, { first: "Ava", last: "Doe", choice: "notebook" }] }));
  assert(p.ok);
  const plans = planInvoices(p.value);
  assertEquals(plans.length, 2);
  assertEquals(plans[0].totalCents, 26633);
  assertEquals(plans[1].totalCents, 4081);
  assertEquals(plans[0].email, "jane@example.com");
  assertEquals(plans[1].studentName, "Ava Doe");
});

Deno.test("Starter is Alabama only, and a Starter-only order needs no address", () => {
  assertEquals(parseSubmission(base({ students: [{ first: "Sam", last: "Doe", choice: "starter" }] })).ok, false);
  const al = parseSubmission(base({ state: "AL", address: null, students: [{ first: "Sam", last: "Doe", choice: "starter" }] }));
  assert(al.ok);
  const [plan] = planInvoices(al.value);
  assertEquals(plan.totalCents, 3900);
  assert(plan.shipTo.startsWith("Digital download"));
  assertEquals(secondDate(plan, "2026-09-20"), "2026-09-20");
});

Deno.test("New Hampshire ships only to New Hampshire", () => {
  const bad = parseSubmission(base({ state: "NH" }));
  assertEquals(bad.ok, false);
  const good = parseSubmission(base({ state: "NH", address: { ...addr, city: "Concord", region: "NH", zip: "03301" } }));
  assert(good.ok);
});

Deno.test("phone is optional, and when given it must pass Lulu's shape", () => {
  const blank = parseSubmission(base());
  assert(blank.ok);
  assertEquals(blank.value.phone, "");
  const good = parseSubmission(base({ phone: "(480) 555-0134" }));
  assert(good.ok);
  assertEquals(good.value.phone, "(480) 555-0134");
  assertEquals(parseSubmission(base({ phone: "call me" })).ok, false);
});

Deno.test("validation catches the obvious mistakes", () => {
  assertEquals(parseSubmission(base({ parentName: "Jane" })).ok, false);
  assertEquals(parseSubmission(base({ email: "nope" })).ok, false);
  assertEquals(parseSubmission(base({ students: [] })).ok, false);
  assertEquals(parseSubmission(base({ address: { ...addr, zip: "123" } })).ok, false);
  assertEquals(parseSubmission(base({ state: "UT" })).ok, false);
});

Deno.test("dates: Central date and +21 days for printed books", () => {
  assertEquals(centralDate(new Date("2026-09-15T03:30:00Z")), "2026-09-14"); // 22:30 CDT
  assertEquals(addDays("2026-12-20", 21), "2027-01-10");
  const p = parseSubmission(base({ state: "AR", address: { ...addr, region: "AR", city: "Little Rock", zip: "72201" } }));
  assert(p.ok);
  assertEquals(secondDate(planInvoices(p.value)[0], "2026-09-14"), "2026-10-05");
});

Deno.test("wording guard", () => {
  assertEquals(forbiddenOnInvoice("AL", "Payment: ClassWallet").length, 1);
  assertEquals(forbiddenOnInvoice("AZ", "Payment: ClassWallet, Pay Vendor").length, 0);
  assertEquals(forbiddenOnInvoice("AR", "store credit").length, 1);
});

for (const code of ["AZ", "AR", "AL", "NH"] as const) {
  Deno.test(`renders a one-page ${code} invoice with the right lines`, async () => {
    const region = code === "NH" ? "NH" : code;
    const p = parseSubmission(base({ state: code, address: { ...addr, region, zip: code === "NH" ? "03301" : "85201" } }));
    assert(p.ok);
    const [plan] = planInvoices(p.value);
    const out = await renderInvoicePdf(plan, `ET-${code}-2026-001`, "2026-09-14");
    assert(out.bytes.length > 1000 && out.bytes.length < 60000, `size ${out.bytes.length}`);
    assert(out.text.includes(`ET-${code}-2026-001`));
    assert(out.text.includes("09/14/2026"));
    if (code === "AL") {
      assert(!/choose|classwallet/i.test(out.text), "Alabama invoice must not name the program or ClassWallet");
      assert(out.text.includes("Date(s) of service: 10/05/2026"));
    }
    if (code === "AZ") assert(out.text.includes("$266.33") && out.text.includes("$5.33"));
    if (code === "AR") assert(out.text.includes("Expected ship date: 10/05/2026"));
    if (code === "NH") assert(out.text.includes("Amount due for this student (per pupil)"));
    // Set ESA_INVOICE_SAMPLES=<dir> (and --allow-env --allow-write) to save the PDFs for a visual check.
    const canEnv = Deno.permissions.querySync({ name: "env", variable: "ESA_INVOICE_SAMPLES" }).state === "granted";
    const dir = canEnv ? Deno.env.get("ESA_INVOICE_SAMPLES") : undefined;
    if (dir) await Deno.writeFile(`${dir}/${code}.pdf`, out.bytes);
  });
}

Deno.test("an unencodable name does not crash the render", async () => {
  const p = parseSubmission(base({ students: [{ first: "Bảo", last: "Nguyễn", choice: "set" }] }));
  assert(p.ok);
  const out = await renderInvoicePdf(planInvoices(p.value)[0], "ET-AZ-2026-002", "2026-09-14");
  assert(out.text.includes("Student: B"));
});
