// supabase/functions/create-checkout-e2e/index.ts
//
// TEST-ONLY twin of create-checkout: Stripe TEST key, token-gated, print shop only.
// See _shared/e2e-mode.ts. The flag must be set BEFORE the real module loads,
// which is why this is a dynamic import rather than a static one.
;(globalThis as { __EDEN_E2E__?: boolean }).__EDEN_E2E__ = true
await import("../create-checkout/index.ts")
