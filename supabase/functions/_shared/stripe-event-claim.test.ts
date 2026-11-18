// deno test --no-lock -A supabase/functions/_shared/stripe-event-claim.test.ts
//
// (2026-11-17, Lane 2 area 1 A5) claimDecision: a Stripe event already in the ledger is skipped when
// processed, answered 409 (Stripe retries later) while another delivery is probably still running,
// and run again when an earlier run crashed or failed.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { claimDecision, EVENT_IN_PROGRESS_MS } from "./order-db.ts"

const now = Date.parse("2026-11-17T23:00:00Z")
const ago = (ms: number) => new Date(now - ms).toISOString()

Deno.test("a processed event is a duplicate, however recent", () => {
  assertEquals(claimDecision("processed", ago(1_000), now), "duplicate")
  assertEquals(claimDecision("processed", null, now), "duplicate")
})

Deno.test("a 'received' event from moments ago is still in progress", () => {
  assertEquals(claimDecision("received", ago(5_000), now), "in_progress")
  assertEquals(claimDecision("received", ago(EVENT_IN_PROGRESS_MS - 1), now), "in_progress")
})

Deno.test("a 'received' event older than the lease is a crashed run: run it again", () => {
  assertEquals(claimDecision("received", ago(EVENT_IN_PROGRESS_MS), now), "proceed")
  assertEquals(claimDecision("received", ago(60 * 60 * 1000), now), "proceed")
})

Deno.test("an errored, unknown or unreadable row is run again (a dropped event is worse than a retry)", () => {
  assertEquals(claimDecision("error", ago(1_000), now), "proceed")
  assertEquals(claimDecision(null, null, now), "proceed")
  assertEquals(claimDecision("received", null, now), "proceed")
  assertEquals(claimDecision("received", "not a date", now), "proceed")
})
