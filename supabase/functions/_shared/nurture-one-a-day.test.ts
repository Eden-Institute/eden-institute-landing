// The one-Eden-nurture-email-a-day guard is wired into EVERY nurture-emails queue (spec section 11, answer 5).
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const raw = await Deno.readTextFile(new URL("../nurture-emails/index.ts", import.meta.url));
const src = raw.replaceAll(String.fromCharCode(13), "");
const QUEUES = ["nurture_email_queue", "followup_email_queue", "magnet_email_queue", "launch_email_queue", "buyer_email_queue", "founding_family_queue"];

Deno.test("every queue drip passes its table + row id to sendEmail (so the day is claimed)", () => {
  for (const q of QUEUES) {
    assert(src.includes(`dripIdempotencyKey('${q}', row.id, row.retry_count),\n        { table: '${q}', id: row.id },`), q);
  }
});

Deno.test("a held row is never recorded as a failed send", () => {
  assertEquals((src.match(/\} else if \(!send\.inFlight\) \{/g) ?? []).length, 0);
  assertEquals((src.match(/\} else if \(!send\.inFlight && !send\.deferred\) \{/g) ?? []).length, QUEUES.length);
});

Deno.test("sendEmail claims before Resend and gives the day back on a failed send", () => {
  const body = src.slice(src.indexOf("async function sendEmail("), src.indexOf("async function sendEmailNow("));
  assert(body.indexOf("claimSendDay(") < body.indexOf("sendEmailNow("));
  assert(body.includes("if (!r.ok && !r.inFlight) await giveBack();"));
  assert(body.includes("nextCentralMorning("));
});
