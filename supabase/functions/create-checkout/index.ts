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
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2023-10-16",
    });

    const { constitution_type, constitution_nickname, email } = await req.json();

    if (!constitution_type || !constitution_nickname) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the slug from nickname for the success redirect
    const slug = constitution_nickname
      .replace(/^The\s+/i, "")
      .toLowerCase()
      .replace(/\s+/g, "-");

    const priceId = Deno.env.get("STRIPE_PRICE_ID") || "price_1TEJKU2KexXXgW0BGMxeGmJe";
    const origin = req.headers.get("origin") || "https://eden-institute-landing.lovable.app";

    const sessionParams: any = {
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        constitution_type,
        constitution_nickname,
        slug,
        email: email || "",
      },
      success_url: `${origin}/guide/${slug}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/results/${slug}`,
    };

    // Only set customer_email if provided
    if (email) {
      sessionParams.customer_email = email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Checkout error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
