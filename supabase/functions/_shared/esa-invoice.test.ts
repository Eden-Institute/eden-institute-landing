// deno test supabase/functions/_shared/esa-invoice.test.ts
// No permissions needed: pdf-lib is a pinned remote module (deno.lock), and module fetching is not gated by --allow-net.
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  addDays,
  CHOICE_SKU,
  PRODUCTS,
  centralDate,
  feeFor,
  feeSentence,
  forbiddenInFamilyText,
  forbiddenOnInvoice,
  parseSubmission,
  planInvoices,
  secondDate,
  STATE_RULES,
} from "./esa-invoice.ts";
import { renderInvoicePdf } from "./esa-invoice-pdf.ts";
import { ESA_CHOICES, ESA_STATE_OPTIONS, esaFeeCents, esaFeeSentence } from "../../../web/lib/esaInvoice.ts";

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

Deno.test("Alabama wording ban covers family-typed fields, and only in Alabama", async () => {
  assertEquals(forbiddenInFamilyText("AL", "Jane Classwallet").length, 1);
  assertEquals(forbiddenInFamilyText("AL", "Sam Choose  Act").length, 1);
  assertEquals(forbiddenInFamilyText("AZ", "Jane Classwallet").length, 0);
  // A real surname is never rejected by the static-only credit/coupon rule.
  assertEquals(forbiddenInFamilyText("AL", "Sam Credit").length, 0);

  const p = parseSubmission(base({ state: "AL", address: { ...addr, region: "AL" }, students: [{ first: "Sam", last: "ClassWallet", choice: "set" }] }));
  assert(p.ok);
  const [plan] = planInvoices(p.value);
  let threw = false;
  try {
    await renderInvoicePdf(plan, "ET-AL-2026-003", "2026-09-14");
  } catch (e) {
    threw = e instanceof Error && e.message.includes("family-supplied field");
  }
  assert(threw, "an Alabama invoice naming ClassWallet in a family field must not render");
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
    if (code === "AZ") {
      assert(out.text.includes("$266.33") && out.text.includes("$5.33"));
      // The PDF wraps lines, so compare with whitespace collapsed.
      assert(out.text.replace(/\s+/g, " ").includes("ClassWallet deducts 2%, so this invoice adds 2.0408% to cover it."), out.text);
    }
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

Deno.test("Arizona fee: one sentence and the same numbers on the invoice and the web form", () => {
  const sentence = "ClassWallet deducts 2%, so this invoice adds 2.0408% to cover it.";
  assertEquals(STATE_RULES.AZ.feeRate, 0.020408);
  assertEquals(feeSentence(STATE_RULES.AZ.feeRate), sentence);
  assertEquals(esaFeeSentence(ESA_STATE_OPTIONS.AZ.feeRate), sentence);
  assertEquals(ESA_STATE_OPTIONS.AZ.feeRate, STATE_RULES.AZ.feeRate);
  assertEquals(26100 + esaFeeCents(26100, ESA_STATE_OPTIONS.AZ.feeRate), 26633);
  assertEquals(3999 + esaFeeCents(3999, ESA_STATE_OPTIONS.AZ.feeRate), 4081);
});

// Seedlings (grades 3-5), founder decisions 2026-09-24.
const stateAddr = (code: "AZ" | "AR" | "AL" | "NH") =>
  code === "NH" ? { ...addr, city: "Concord", region: "NH", zip: "03301" } : { ...addr, region: code };

Deno.test("Seedlings set: allowed in all four states, $261, AZ grossed up to $266.33", () => {
  const expected = { AZ: 26633, AR: 26100, AL: 26100, NH: 26100 } as const;
  for (const code of ["AZ", "AR", "AL", "NH"] as const) {
    const p = parseSubmission(base({ state: code, address: stateAddr(code), students: [{ first: "Ava", last: "Doe", choice: "sdl_set" }] }));
    assert(p.ok, code);
    const [plan] = planInvoices(p.value);
    assertEquals(plan.items[0].sku, "ET-SDL-35-004");
    assertEquals(plan.items[0].title, "Seedlings 3-5 36-Week Science and Nature Study Printed Curriculum Set, Bible-Based");
    assertEquals(plan.subtotalCents, 26100);
    assertEquals(plan.totalCents, expected[code], code);
    assert(plan.printed);
    assert(!plan.shipTo.startsWith("Digital download"));
  }
});

Deno.test("Seedlings Starter: Alabama only, $39, no address needed", () => {
  for (const code of ["AZ", "AR", "NH"] as const) {
    assertEquals(parseSubmission(base({ state: code, address: stateAddr(code), students: [{ first: "Ava", last: "Doe", choice: "sdl_start" }] })).ok, false, code);
  }
  const al = parseSubmission(base({ state: "AL", address: null, students: [{ first: "Ava", last: "Doe", choice: "sdl_start" }] }));
  assert(al.ok);
  assertEquals(al.value.address, null);
  const [plan] = planInvoices(al.value);
  assertEquals(plan.items[0].sku, "ET-SDL-35-003");
  assertEquals(plan.totalCents, 3900);
  assertEquals(plan.feeCents, 0);
  assert(!plan.printed);
  assert(plan.shipTo.startsWith("Digital download"));
});

Deno.test("Seedlings: no extra notebook, and a mixed Sprouts + Seedlings family gets one invoice per student", () => {
  assert(!Object.values(CHOICE_SKU).some((s) => s.startsWith("ET-SDL-35-005")));
  const p = parseSubmission(base({ students: [{ first: "Sam", last: "Doe", choice: "set" }, { first: "Ava", last: "Doe", choice: "sdl_set" }] }));
  assert(p.ok);
  const plans = planInvoices(p.value);
  assertEquals(plans.map((x) => x.items[0].sku), ["ET-SPR-K2-004", "ET-SDL-35-004"]);
  assertEquals(plans.map((x) => x.totalCents), [26633, 26633]);
});

Deno.test("choice keys fit str(o.choice, 10), and the web form matches the server exactly", () => {
  for (const c of Object.keys(CHOICE_SKU)) assert(c.length <= 10, c);
  assertEquals(Object.keys(ESA_CHOICES).sort(), Object.keys(CHOICE_SKU).sort());
  for (const [c, sku] of Object.entries(CHOICE_SKU)) {
    const web = ESA_CHOICES[c as keyof typeof ESA_CHOICES];
    assertEquals(web.cents, PRODUCTS[sku].unitCents, c);
    assertEquals(web.printed, PRODUCTS[sku].printed, c);
  }
  for (const code of ["AZ", "AR", "AL", "NH"] as const) {
    assertEquals(ESA_STATE_OPTIONS[code].choices, STATE_RULES[code].choices, code);
    assertEquals(ESA_STATE_OPTIONS[code].feeRate, STATE_RULES[code].feeRate, code);
  }
});

Deno.test("no em dashes and no 'herbalism' in any ESA product title or description", () => {
  for (const p of Object.values(PRODUCTS)) {
    for (const t of [p.title, p.description]) {
      assert(!t.includes("—"), t);
      assert(!/herbalism/i.test(t), t);
    }
  }
});
