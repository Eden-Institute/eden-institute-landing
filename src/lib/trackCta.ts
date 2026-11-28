import { supabase } from "@/integrations/supabase/client";

/**
 * trackCta — cookieless first-party CTA / funnel-moment event
 * (CRO Phase 4, plan §14).
 *
 * Fire-and-forget on the record_page_view rails: the RPC derives a
 * daily-rotating salted visitor hash server-side; nothing identifying is
 * sent or stored, so no consent gate applies (same rationale as the
 * page-view beacon). Analytics must never block render or surface an
 * error — both promise arms are swallowed, including the PGRST202 "no
 * such function" the client sees until the founder runs the Phase 4
 * migration (the instrumentation ships dormant-safe).
 *
 * Two producers:
 *   • CtaClickTracker — delegated document listener for every [data-cta]
 *     element (no per-component wiring).
 *   • Explicit calls at funnel moments a click can't represent:
 *     trackCta("quiz-start") on the first quiz answer and
 *     trackCta("checkout-start", { lookupKey }) at every create-checkout
 *     invoke site (the post-signup auto-resume never sees a click).
 *
 * Elements handled by the delegated listener must NOT also call this
 * explicitly, or clicks double-count.
 */
export function trackCta(
  cta: string,
  opts?: { path?: string; lookupKey?: string | null; placement?: string | null },
): void {
  if (!cta) return;
  // A synchronous throw (no client, a stubbed client without .rpc) must not escape
  // either: the curriculum buy boxes call this right before create-checkout, and an
  // analytics error there would stop checkout from opening (2026-11-18).
  try {
    const path =
      opts?.path ??
      (typeof window !== "undefined" ? window.location.pathname : "/");
    void supabase
      .rpc("record_cta_click", {
        p_cta: cta,
        p_path: path,
        // p_lookup_key is optional (SQL default null), so omit it rather than send null.
        ...(opts?.lookupKey ? { p_lookup_key: opts.lookupKey } : {}),
        // p_placement (4-argument record_cta_click): the affiliate item (src/lib/affiliateClick.ts).
        ...(opts?.placement ? { p_placement: opts.placement.slice(0, 50) } : {}),
      })
      .then(
        () => {},
        () => {},
      );
  } catch {
    /* analytics never breaks a click */
  }
}
