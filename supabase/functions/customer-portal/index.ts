// supabase/functions/customer-portal/index.ts
// Eden Apothecary — Stripe Customer Billing Portal session creator
// Closes Stage 5 Customer Account Surface (Lane C §25.2).
//
// Auth: requires logged-in Supabase user (JWT in Authorization header).
// verify_jwt defaults to true — no config.toml entry needed.
//
// Flow:
//   1. Verify JWT → get auth user.
//   2. Read profiles.stripe_customer_id via service role (bypasses RLS).
//   3. If null → 400 no_stripe_customer (caller should not have shown the
//      Manage subscription button in the first place; this is defense in depth).
//   4. Call stripe.billingPortal.sessions.create({ customer, return_url }).
//   5. Return { url }.
//
// The returned URL is a one-shot Stripe-hosted session. Frontend redirects
// the user to it via window.location.href. Changes the user makes in the
// portal (plan change, cancel-at-period-end, payment method update) flow
// back through the existing stripe-webhook function, which is race-safe
// after Stage 4.5 (PR #9 — re-fetches authoritative state from Stripe).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-12-18.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_RETURN_URL =
  "https://edeninstitute.health/apothecary/account";

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405);
  }

  try {
    // 1. Authenticate via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonError("Missing Authorization header", 401);
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return jsonError("Invalid or expired session", 401);
    }

    // 2. Parse body for optional return_url override
    const body = await req.json().catch(() => ({}));
    const requestedReturnUrl =
      typeof body?.return_url === "string" && body.return_url.length > 0
        ? body.return_url
        : null;

    // Restrict return_url to our production origin to avoid open-redirect
    // through the portal flow. Accept any path under edeninstitute.health.
    const returnUrl = isSafeReturnUrl(requestedReturnUrl)
      ? requestedReturnUrl!
      : DEFAULT_RETURN_URL;

    // 3. Look up stripe_customer_id via admin client (bypasses RLS)
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("customer-portal profile lookup failed:", profileError);
      return jsonError(
        `Profile lookup failed: ${profileError.message}`,
        500,
      );
    }

    const stripeCustomerId = profile?.stripe_customer_id ?? null;
    if (!stripeCustomerId) {
      return jsonError(
        "No Stripe customer on record for this user. Start a subscription first.",
        400,
        "no_stripe_customer",
      );
    }

    // 4. Create the Billing Portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (err) {
    console.error("customer-portal error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonError(message, 500);
  }
});

function jsonError(
  message: string,
  status: number,
  code?: string,
): Response {
  const body: Record<string, unknown> = { error: message };
  if (code) body.code = code;
  return new Response(
    JSON.stringify(body),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    },
  );
}

/**
 * Only accept return_url values on our production domain. Stripe's portal
 * dutifully returns users to whatever URL we pass, so validating this
 * prevents an authenticated user's session from being redirected to an
 * attacker-controlled host after they exit the portal.
 */
function isSafeReturnUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return (
      parsed.hostname === "edeninstitute.health" ||
      parsed.hostname === "www.edeninstitute.health"
    );
  } catch {
    return false;
  }
}
