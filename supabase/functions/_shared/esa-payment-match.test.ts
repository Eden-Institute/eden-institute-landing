// deno test supabase/functions/_shared/esa-payment-match.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { amountsIn, matchPayment, namesStudent, noticeText, type OpenInvoice } from "./esa-payment-match.ts";

const open: OpenInvoice[] = [
  { id: "a", invoice_number: "ET-AZ-2026-001", student_name: "Sam Doe", parent_name: "Jane Doe", total_cents: 26633, state: "AZ" },
  { id: "b", invoice_number: "ET-AZ-2026-002", student_name: "Ava Doe", parent_name: "Jane Doe", total_cents: 4081, state: "AZ" },
  { id: "c", invoice_number: "ET-AR-2026-001", student_name: "Levi Brown", parent_name: "Kim Brown", total_cents: 26100, state: "AR" },
  { id: "d", invoice_number: "ET-AL-2026-001", student_name: "Mia Stone", parent_name: "Ray Stone", total_cents: 26100, state: "AL" },
];

Deno.test("amounts: dollars with cents, commas, entities", () => {
  assertEquals(amountsIn(noticeText("<td>Amount:&nbsp;$266.33</td> total $ 1,261.00 and USD 40.81")).sort(), [4081, 26633, 126100].sort());
  assertEquals(amountsIn("paid 261 dollars"), []);
});

Deno.test("names: whole words, either order, accents", () => {
  assertEquals(namesStudent("Student: Doe, Sam", "Sam Doe"), true);
  assertEquals(namesStudent("Student: Samantha Doering", "Sam Doe"), false);
  assertEquals(namesStudent("Student: José Núñez", "Jose Nunez"), true);
});

Deno.test("invoice number + total = matched", () => {
  const r = matchPayment("Your payment for invoice ET-AZ-2026-002 of $40.81 has been sent.", open);
  assertEquals([r.status, r.invoiceId], ["matched", "b"]);
});

Deno.test("student + total = matched, even when another invoice shares the total", () => {
  const r = matchPayment("Direct Pay approved. Student: Levi Brown. Amount $261.00", open);
  assertEquals([r.status, r.invoiceId], ["matched", "c"]);
});

Deno.test("total shared by two invoices and no name = ambiguous", () => {
  const r = matchPayment("A payment of $261.00 has been issued to your account.", open);
  assertEquals(r.status, "ambiguous");
  assertEquals(r.candidateIds.sort(), ["c", "d"]);
});

Deno.test("unique total, no name = amount_only (never automatic)", () => {
  const r = matchPayment("A payment of $266.33 has been issued to your account.", open);
  assertEquals([r.status, r.invoiceId], ["amount_only", "a"]);
});

Deno.test("named but wrong amount = amount_mismatch (e.g. fee deducted differently)", () => {
  const r = matchPayment("Student Sam Doe payment $260.89 settled", open);
  assertEquals([r.status, r.invoiceId], ["amount_mismatch", null]);
  assertEquals(r.candidateIds, ["a"]);
});

Deno.test("nothing recognisable = unmatched", () => {
  assertEquals(matchPayment("Your ClassWallet statement is ready.", open).status, "unmatched");
  assertEquals(matchPayment("Payment $999.00 for Pat Smith", open).status, "unmatched");
});
