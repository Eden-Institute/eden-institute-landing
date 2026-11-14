// ESA hardening E3 + E2 wiring (2026-11-13, Lane 2 deep audit area 4; founder go "Yes, build + ship").
// The database half of E3 was proven on production inside a transaction that always rolled back
// (applied / payment_used / used / mark-paid refused; see the PR). These pin the code half, which
// cannot be imported (both edge functions start a server on import).
//   deno test --no-lock --allow-env --allow-net --allow-read supabase/functions/_shared/esa-hardening-e3.test.ts
import { assert, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

const root = new URL("../../", import.meta.url);
const read = (p: string) => Deno.readTextFileSync(new URL(p, root));

Deno.test("E3 migration: both functions lock the payment row and refuse a payment applied elsewhere", () => {
  const name = [...Deno.readDirSync(new URL("migrations/", root))].map((e) => e.name).find((n) => n.endsWith("_esa_one_payment_one_invoice.sql"));
  assert(name, "migration file present");
  const sql = read(`migrations/${name}`);
  assert((sql.match(/for update;/g) ?? []).length >= 3, "token row + payment row (twice) locked");
  assert((sql.match(/p\.applied and p\.invoice_id is distinct from/g) ?? []).length === 2, "guard in both functions");
  assertStringIncludes(sql, "'payment_used'::text");
  assert(!/grant|revoke/i.test(sql.replace(/--.*$/gm, "")), "grants untouched (CREATE OR REPLACE keeps them)");
});

Deno.test("E3 Confirm page: checks the payment before the button and handles the payment_used outcome", () => {
  const src = read("functions/esa-payment-confirm/index.ts");
  const guard = src.indexOf("const usedFor = await paymentUsedFor(tok);");
  const button = src.indexOf('<button type="submit"');
  assert(guard > 0 && button > guard, "the payment check runs before the Confirm button is shown");
  assertStringIncludes(src, 'c.outcome === "payment_used"');
  assertStringIncludes(src, "cannot pay this one too. Nothing was changed.");
});

Deno.test("E2 route: esa-payment answers retry_fulfilment, and intake comes from the tested module", () => {
  const src = read("functions/esa-payment/index.ts");
  assertStringIncludes(src, 'case "retry_fulfilment": return await retryFulfil(b);');
  assertStringIncludes(src, 'import { intake } from "../_shared/esa-intake.ts";');
  assert(!src.includes("will try it again on its next run"), "the old false promise is gone");
});
