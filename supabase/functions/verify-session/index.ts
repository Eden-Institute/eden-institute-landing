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
        `${supabaseUrl}/rest/v1/quiz_completions?constitution_type=eq.${encodeURIComponent(check_slug)}&`${supabaseUrl}/rest/v1/quiz_completions?constitution_type=eq.${encodeURIComponent(check_slug)}&purchased_guide=eq.true&limit=1&select=id`,&limit=1&select=id`,
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
    const email = session.metadata?.email || session.customer_email || "";

    // Update quiz_completions to mark guide as purchased
    if (email && supabaseUrl && serviceRoleKey) {
      try {
        await fetch(`${supabaseUrl}/rest/v1/quiz_completions?email=eq.${encodeURIComponent(email)}`, {
          method: "PATCH",
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ body: JSON.stringify({ purchased_guide: true }), }),
        });
        console.log(`quiz_completions updated for ${email}`);
      } catch (dbErr) {
        console.error("DB update failed (non-blocking):", dbErr);
      }
    }

    // Also try to update Resend contact (non-blocking)
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
      JSON.stringify({ paid: true, constitution_type, constitution_nickname, slug }),
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
