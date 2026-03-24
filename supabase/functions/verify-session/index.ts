// verify-session — verifies Stripe checkout and updates Resend contact properties

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2023-10-16",
    });

    const { session_id } = await req.json();

    if (!session_id) {
      return new Response(
        JSON.stringify({ error: "Missing session_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== "paid") {
      return new Response(
        JSON.stringify({ paid: false, error: "Payment not completed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const constitution_type = session.metadata?.constitution_type || "";
    const constitution_nickname = session.metadata?.constitution_nickname || "";
    const email = session.metadata?.email || session.customer_email || "";
    const product_type = session.metadata?.product_type || "guide"; // "guide" or "course"

    // Determine which purchase flag to set
    const isPurchasedGuide = product_type === "guide" || !session.metadata?.product_type;
    const isPurchasedCourse = product_type === "course";

    // Update Resend contact with purchase info
    try {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      const audienceId = Deno.env.get("RESEND_AUDIENCE_ID");
      if (resendKey && audienceId && email) {
        const properties: Record<string, string> = {
          constitution_type,
          constitution_name: constitution_nickname,
        };
        if (isPurchasedGuide) properties.purchased_guide = "true";
        if (isPurchasedCourse) properties.purchased_course = "true";

        await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            unsubscribed: false,
            properties,
          }),
        });
        console.log(`Resend contact updated for ${email}: ${isPurchasedGuide ? 'guide' : ''}${isPurchasedCourse ? 'course' : ''}`);
      }
    } catch (resendErr) {
      console.error("Resend update failed (non-blocking):", resendErr);
    }

    // If course purchase, also update quiz_completions.purchased_course
    if (isPurchasedCourse && email) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (supabaseUrl && serviceRoleKey) {
          await fetch(`${supabaseUrl}/rest/v1/quiz_completions?email=eq.${encodeURIComponent(email)}`, {
            method: "PATCH",
            headers: {
              "apikey": serviceRoleKey,
              "Authorization": `Bearer ${serviceRoleKey}`,
              "Content-Type": "application/json",
              "Prefer": "return=minimal",
            },
            body: JSON.stringify({ purchased_course: true }),
          });
          console.log(`quiz_completions.purchased_course set to true for ${email}`);
        }
      } catch (dbErr) {
        console.error("DB update failed (non-blocking):", dbErr);
      }
    }

    return new Response(
      JSON.stringify({
        paid: true,
        constitution_type,
        constitution_nickname,
      }),
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
