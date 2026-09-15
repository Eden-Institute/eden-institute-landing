// deno test supabase/functions/_shared/esa-payment-intake.test.ts
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { intakeFailureRow, normaliseReceivedAt, shouldAlertIntakeFailure } from "./esa-payment-intake.ts";

const now = new Date("2026-09-16T15:00:00Z");

Deno.test("received_at: the intake script's Python isoformat is kept", () => {
  assertEquals(normaliseReceivedAt("2026-09-15T14:03:22.123000+00:00", now), { iso: "2026-09-15T14:03:22.123Z", note: null });
  assertEquals(normaliseReceivedAt("2026-09-15T09:03:22-05:00", now), { iso: "2026-09-15T14:03:22.000Z", note: null });
  assertEquals(normaliseReceivedAt("2026-09-15", now).note, null);
  // Small clock skew is fine.
  assertEquals(normaliseReceivedAt("2026-09-16T15:05:00Z", now).note, null);
});

Deno.test("received_at: missing, garbage, future or ancient becomes now with a note", () => {
  for (const [raw, why] of [
    [undefined, "missing"],
    ["", "missing"],
    [12345, "not text"],
    ["Tue, 15 Sep 2026 14:03:22 +0000", "not an ISO date"],
    ["2026-02-31T10:00:00Z", "not a real date"],
    ["2026-09-17T15:00:00Z", "in the future"],
    ["2019-01-01T00:00:00Z", "more than a year old"],
    ["2026-09-15'); drop table x;--", "not an ISO date"],
  ] as [unknown, string][]) {
    const r = normaliseReceivedAt(raw, now);
    assertEquals(r.iso, now.toISOString(), String(raw));
    assert(r.note?.includes(why), `${String(raw)} -> ${r.note}`);
  }
});

Deno.test("intake failure row keeps the raw notice, capped", () => {
  const row = intakeFailureRow(
    { gmail_msg_id: "m1", received_at: "bad", from: "noreply@classwallet.com", subject: "Payment", body: "x".repeat(9000) },
    new Error("boom"),
  );
  assertEquals([row.gmail_msg_id, row.received_at_raw, row.error], ["m1", "bad", "boom"]);
  assertEquals(String(row.excerpt).length, 4000);
  assertEquals(intakeFailureRow({}, "").error, "unknown error");
  assertEquals(intakeFailureRow({}, "").gmail_msg_id, null);
});

Deno.test("founder is alerted once per message, and when the earlier count is unknown", () => {
  assertEquals(shouldAlertIntakeFailure(0), true);
  assertEquals(shouldAlertIntakeFailure(null), true);
  assertEquals(shouldAlertIntakeFailure(2), false);
});
