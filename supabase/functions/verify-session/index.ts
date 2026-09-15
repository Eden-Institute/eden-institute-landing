// supabase/functions/verify-session/index.ts
// Eden Apothecary — post-checkout session verification
//
// Flow: the caller passes a Stripe session_id (from the post-checkout redirect,
// stored client-side and re-sent on return visits). We verify the session with
// Stripe and, for a paid one-off Deep-Dive Guide purchase, flip
// quiz_completions.purchased_guide=TRUE for the email and return the guide
// content so the /guide page can render it. The guide text lives only
// server-side (_shared/guide) — it is not shipped in the client bundle, so a
// verified paid session is the sole way to obtain it.
//
// PRODUCT-AWARE FILTER (Phase 5 fix #4 / launch-blocker #58):
//   The legacy implementation flipped purchased_guide=TRUE for ANY paid
//   session matching the email — including subscription checkouts (Seed,
//   Root). That meant a Seed Monthly purchase would silently mark the
//   user as having bought the $14 Deep-Dive Guide.
//
//   The new behavior: only flip purchased_guide when session.mode ===
//   "payment" AND metadata.lookup_key === "deep_dive_guide", the same match
//   stripe-webhook uses (preorder / print / Starter sessions are also
//   mode=payment but carry no such lookup_key). Subscription sessions (mode ===
//   "subscription") are still verified for the welcome-page paid signal
//   but never touch quiz_completions.purchased_guide. This keeps the two
//   product lines (subscription tiers vs one-off guides) cleanly
//   separated at the data layer per Locked Decision §0.8 #2 + #15 spirit.
//
// Auth model: runs at verify_jwt=true (pinned in supabase/config.toml).
// Anonymous guide callers (GuideLanding, GuideSuccess) send the anon key; the
// signed-in Welcome page sends the user JWT. The session's supabase_user_id
// (session.metadata for one-offs, subscription.metadata for subscriptions, both
// stamped by create-checkout) must match that user when both are present, and a
// subscription session requires a signed-in caller. Database writes use the
// service role to bypass RLS on quiz_completions per the same pattern as
// record-quiz-completion.

import Stripe from "https://esm.sh/stripe@14.21.0?target=denonext";
import { getGuideByNickname, getGuideBySlug } from "../_shared/guide/registry.ts";
import { getCallerUser } from "../_shared/caller-user.ts";
import {
  CHECKOUT_SESSION_ID_RE,
  isCallerAllowed,
  sessionBoundUserId,
} from "../_shared/checkout-session-binding.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { session_id } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    // Access to the guide is proven by a paid Stripe session_id (verified below),
    // stored client-side and re-verified on return visits. The former slug-only
    // "has anyone bought this type?" path was removed — it granted access
    // catalog-wide once a single purchase existed for a constitution type.

    // --- Verify Stripe session_id ---
    if (typeof session_id !== "string" || !CHECKOUT_SESSION_ID_RE.test(session_id)) {
      return new Response(
        JSON.stringify({ error: "Missing session_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2024-12-18.acacia",
    });

    const session = await stripe.checkout.sessions.retrieve(session_id, { expand: ["subscription"] });

    if (session.payment_status !== "paid") {
      return new Response(
        JSON.stringify({ paid: false, error: "Payment not completed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Checked before any write or audience add, so a refused caller causes no side effects.
    const caller = await getCallerUser(req);
    if (!isCallerAllowed({
      mode: session.mode ?? null,
      boundUserId: sessionBoundUserId(session),
      callerUserId: caller?.id ?? null,
    })) {
      console.warn(`verify-session: session ${session.id} refused for caller ${caller?.id ?? "anon"} (mode=${session.mode})`);
      return new Response(
        JSON.stringify({ error: "Session does not belong to this account" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const constitution_type = session.metadata?.constitution_type || "";
    const constitution_nickname = session.metadata?.constitution_nickname || "";
    const slug = session.metadata?.slug || "";
    const email = session.metadata?.email || session.customer_email || session.customer_details?.email || "";

    // Product-aware filter (Phase 5 fix #4 / launch-blocker #58):
    // Subscription-mode sessions (mode === "subscription") are reconciled
    // by the stripe-webhook EF into the profiles table — they MUST NOT
    // touch quiz_completions.purchased_guide. Only a payment-mode session whose
    // lookup_key is deep_dive_guide flips the flag.
    const isOneOffPurchase = session.mode === "payment";
    const lookupKey = typeof session.metadata?.lookup_key === "string" ? session.metadata.lookup_key : "";
    const isGuidePurchase = isOneOffPurchase && lookupKey === "deep_dive_guide";

    // Update quiz_completions.purchased_guide ONLY for a Deep-Dive Guide purchase.
    if (isGuidePurchase && email && supabaseUrl && serviceRoleKey) {
      try {
        // quiz_completions is unique on lower(email) and stores it lowercased.
        // Not ilike: "_" in an address is an ilike wildcard.
        const normEmail = email.trim().toLowerCase();
        await fetch(`${supabaseUrl}/rest/v1/quiz_completions?email=eq.${encodeURIComponent(normEmail)}`, {
          method: "PATCH",
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ purchased_guide: true }),
        });
        console.log(`verify-session: purchased_guide=TRUE (session ${session.id})`);
      } catch (dbErr) {
        console.error("DB update failed (non-blocking):", dbErr);
      }
    } else if (!isGuidePurchase) {
      console.log(
        `verify-session: skipping purchased_guide flip for session ${session.id} (mode=${session.mode}, lookup_key=${lookupKey || "none"})`,
      );
    }

    // Also try to update Resend contact (non-blocking).
    // Kept on every paid session because resend audience membership is
    // additive and idempotent — a subscription customer is also a valid
    // audience member.
    try {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      const audienceId = Deno.env.get("RESEND_AUDIENCE_ID");
      if (resendKey && audienceId && email) {
        await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, unsubscribed: false }),
        });
      }
    } catch (resendErr) {
      console.error("Resend update failed (non-blocking):", resendErr);
    }

    // Return the full guide content ONLY for a verified paid one-off purchase.
    // This is the sole delivery path to the /guide page — the content is not in
    // the client bundle, so a valid paid Stripe session is required to read it.
    const guide = isOneOffPurchase
      ? (getGuideByNickname(constitution_nickname) ?? getGuideBySlug(slug))
      : null;

    return new Response(
      JSON.stringify({ paid: true, constitution_type, constitution_nickname, slug, mode: session.mode, guide }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Verify session error:", error);
    // Stripe answers an unknown session id (or one from the other mode) with a
    // 404 StripeInvalidRequestError, code resource_missing. That is a caller
    // problem, not a server fault: say so with a fixed message. The old path
    // returned 500 with Stripe's own error text (post-ship QA, 2026-09-15).
    const stripeError = error as { type?: unknown; code?: unknown; statusCode?: unknown };
    if (
      stripeError?.type === "StripeInvalidRequestError" &&
      (stripeError.code === "resource_missing" || stripeError.statusCode === 404)
    ) {
      return new Response(JSON.stringify({ paid: false, error: "Session not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }
    // No caller reads this body (supabase-js surfaces a generic non-2xx error),
    // so the details stay in the function log.
    return new Response(JSON.stringify({ error: "Verification failed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
