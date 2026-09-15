// preorder-response — the buyer's answer to a delay notice.
//
//   GET/HEAD /functions/v1/preorder-response?token=...  → NEVER writes. Verifies the
//            token, reads the notice, and 303s to https://edeninstitute.health/
//            preorder-response with ?state=confirm (plus the token and display values)
//            or ?state=answered-* | not-found | invalid | error.
//   POST     form body token=...&choice=...  (the button on that page)
//            → verify, record, 303 to ?state=done-* | answered-* | invalid | error.
//
// The delay-notice email links to https://edeninstitute.health/preorder-response?token=...
// vercel.json redirects any request there WITHOUT ?state to this function, so every
// link already sent keeps working; it now lands on a confirm page instead of recording.
//
// Routing lives in _shared/preorder-response-request.ts (tested there). The pages are
// on edeninstitute.health (web/pages/preorder-response.astro) because Supabase serves
// a text/html function response as text/plain, so HTML from here showed as raw source
// (verified 2026-09-15).
//
// WHY A GET NEVER RECORDS: link scanners fetch every link in an inbound email, and
// each notice carries BOTH answer links. When a GET recorded, a scanner could record
// consent or a cancellation the buyer never gave (first fetch wins). Only the page's
// button POST records now.
//
// 435.2(b)(3) requires the cancellation mechanism to be free and easy, at the seller's
// expense. That is why there is a signed token and no login: the buyer has no account,
// and asking them to authenticate to exercise a legal right would not satisfy "easy".
//
// verify_jwt = false. Security is the HMAC token, not a session. The token proves the
// bearer received that specific notice for that specific order; it carries no PII, so a
// forwarded or logged URL leaks nothing beyond the fact that an order exists.
//
// The refund itself is deliberately NOT issued here. This endpoint is public and
// unauthenticated; automatically moving money from it would make a signed URL a
// money-moving instrument. Instead a cancellation is recorded and surfaced to the
// founder, who issues the refund in Stripe. The legal obligation is a PROMPT refund
// (7 working days for a card), not an instantaneous one.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { captureException } from "../_shared/sentry.ts";
import { verifyDelayToken } from "../_shared/delay-consent-token.ts";
import {
  answeredState,
  choiceMatchesToken,
  confirmPageUrl,
  doneState,
  readPreorderForm,
  resultPageUrl,
  routePreorderRequest,
  stateForGet,
} from "../_shared/preorder-response-request.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
};

function redirect(location: string): Response {
  return new Response(null, {
    status: 303,
    headers: { ...corsHeaders, Location: location, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const form = req.method.toUpperCase() === "POST" ? await readPreorderForm(req) : null;
    const route = routePreorderRequest({ method: req.method, queryToken: url.searchParams.get("token"), form });

    if (route.kind === "preflight") return new Response(null, { headers: corsHeaders });
    if (route.kind === "method_not_allowed") {
      return new Response(null, { status: 405, headers: { ...corsHeaders, Allow: "GET, HEAD, POST, OPTIONS" } });
    }

    const payload = await verifyDelayToken(route.token);
    if (!payload) {
      console.warn("preorder-response: invalid or missing token", { method: req.method, kind: route.kind });
      return redirect(resultPageUrl("invalid"));
    }
    // The button must have shown the same answer the token records.
    if (route.kind === "record" && !choiceMatchesToken(route.choice, payload.r)) {
      console.warn("preorder-response: choice does not match token", { choice: route.choice });
      return redirect(resultPageUrl("invalid"));
    }

    if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("preorder-response: missing env");
    const db = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: notice, error } = await db
      .from("order_delay_notices")
      .select("id, response, requires_opt_in")
      .eq("order_id", payload.o)
      .eq("broadcast_id", payload.b)
      .maybeSingle();
    if (error) throw error;

    if (route.kind === "confirm") {
      // Read-only. A scanner fetching the link ends here.
      const state = stateForGet(notice);
      if (state === "confirm" && notice) {
        return redirect(confirmPageUrl(route.token, payload.r, notice.requires_opt_in === true));
      }
      return redirect(resultPageUrl(state === "confirm" ? "not-found" : state));
    }

    // route.kind === "record": the buyer pressed the button.
    if (!notice) return redirect(resultPageUrl("not-found"));

    // Idempotent: pressing twice, or answering both ways, must not thrash the record.
    // First answer wins, and the page says plainly which one it was.
    if (notice.response) return redirect(resultPageUrl(answeredState(notice.response)));

    const { data: updated, error: updErr } = await db
      .from("order_delay_notices")
      .update({ response: payload.r, responded_at: new Date().toISOString() })
      .eq("id", notice.id)
      .is("response", null)            // lose a race rather than overwrite an answer
      .select("id");
    if (updErr) throw updErr;

    if (!updated || updated.length === 0) {
      // Lost the race to another answer: show the answer that was actually recorded.
      const { data: winner, error: reErr } = await db
        .from("order_delay_notices")
        .select("response")
        .eq("id", notice.id)
        .maybeSingle();
      if (reErr) throw reErr;
      if (!winner?.response) throw new Error("preorder-response: update matched no row and no answer is recorded");
      return redirect(resultPageUrl(answeredState(winner.response)));
    }

    return redirect(resultPageUrl(doneState(payload.r)));
  } catch (err) {
    console.error("preorder-response error:", err);
    await captureException(err, { function: "preorder-response" });
    return redirect(resultPageUrl("error"));
  }
});
