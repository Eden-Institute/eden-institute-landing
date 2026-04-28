// supabase/functions/verify-session/index.ts
// Eden Apothecary — post-checkout session verification
//
// Two paths:
//   Path A: caller passes session_id → verify Stripe session, return paid status
//           and (for one-off Deep-Dive Guide purchases) flip
//           quiz_completions.purchased_guide=TRUE for the email.
//   Path B: caller passes check_slug → quick "has this email already bought
//           this slug's guide?" lookup against quiz_completions.purchased_guide.
//
// PRODUCT-AWARE FILTER (Phase 5 fix #4 / launch-blocker #58):
//   The legacy implementation flipped purchased_guide=TRUE for ANY paid
//   session matching the email — including subscription checkouts (Seed,
//   Root). That meant a Seed Monthly purchase would silently mark the
//   user as having bought the $14 Deep-Dive Guide.
//
//   The new behavior: only flip purchased_guide when session.mode ===
//   "payment" (one-off product purchase). Subscription sessions (mode ===
//   "subscription") are still verified for the welcome-page paid signal
//   but never touch quiz_completions.purchased_guide. This keeps the two
//   product lines (subscription tiers vs one-off guides) cleanly
//   separated at the data layer per Locked Decision §0.8 #2 + #15 spirit.
//
// Auth model: this EF runs with verify_jwt: true — callers (welcome page,
// guide landing) pass a valid Supabase JWT. Database writes use the
// service role to bypass RLS on quiz_completions per the same pattern as
// record-quiz-completion.

import Stripe from "https://esm.sh/stripe@14?target=deno";

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
    const { session_id, check_slug } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    // --- Path B: Check prior purchase by slug ---
    if (check_slug && !session_id) {
      if (!supabaseUrl || !serviceRoleKey) {
        return new Response(
          JSON.stringify({ paid: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      const res = await fetch(
        `${supabaseUrl}/rest/v1/quiz_completions?constitution_type=eq.${encodeURIComponent(check_slug)}&purchased_guide=eq.true&limit=1&select=id`,
        {
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
        }
      );
      const rows = await res.json();
      const hasPurchased = Array.isArray(rows) && rows.length > 0;

      return new Response(
        JSON.stringify({ paid: hasPurchased }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // --- Path A: Verify Stripe session_id ---
    if (!session_id) {
      return new Response(
        JSON.stringify({ error: "Missing session_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2023-10-16",
    });

    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== "paid") {
      return new Response(
        JSON.stringify({ paid: false, error: "Payment not completed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const constitution_type = session.metadata?.constitution_type || "";
    const constitution_nickname = session.metadata?.constitution_nickname || "";
    const slug = session.metadata?.slug || "";
    const email = session.metadata?.email || session.customer_email || session.customer_details?.email || "";

    // Product-aware filter (Phase 5 fix #4 / launch-blocker #58):
    // Subscription-mode sessions (mode === "subscription") are reconciled
    // by the stripe-webhook EF into the profiles table — they MUST NOT
    // touch quiz_completions.purchased_guide. Only payment-mode sessions
    // (one-off products like the $14 Deep-Dive Guide) flip the flag.
    const isOneOffPurchase = session.mode === "payment";

    // Update quiz_completions.purchased_guide ONLY for one-off purchases.
    if (isOneOffPurchase && email && supabaseUrl && serviceRoleKey) {
      try {
        await fetch(`${supabaseUrl}/rest/v1/quiz_completions?email=eq.${encodeURIComponent(email)}`, {
          method: "PATCH",
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ purchased_guide: true }),
        });
        console.log(`quiz_completions.purchased_guide=TRUE for email: ${email} (mode=payment)`);
      } catch (dbErr) {
        console.error("DB update failed (non-blocking):", dbErr);
      }
    } else if (!isOneOffPurchase) {
      console.log(
        `verify-session: skipping purchased_guide flip for subscription-mode session ${session.id} (email: ${email})`,
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

    return new Response(
      JSON.stringify({ paid: true, constitution_type, constitution_nickname, slug, mode: session.mode }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Verify session error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
