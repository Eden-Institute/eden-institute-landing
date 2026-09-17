// supabase/functions/stripe-webhook-e2e/index.ts
//
// TEST-ONLY twin of stripe-webhook, registered as a Stripe TEST-mode webhook
// endpoint. Refuses live events; never queues a Lulu print. See _shared/e2e-mode.ts.
// The flag must be set BEFORE the real module loads, hence the dynamic import.
;(globalThis as { __EDEN_E2E__?: boolean }).__EDEN_E2E__ = true
await import("../stripe-webhook/index.ts")
