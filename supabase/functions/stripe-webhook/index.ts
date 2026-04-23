// supabase/functions/stripe-webhook/index.ts
// Eden Apothecary — Stripe webhook handler
// Listens for subscription lifecycle events and reconciles the `profiles` table.
//
// Auth model: webhooks are NOT user-authenticated. Stripe signs every request with
// an HMAC-SHA256 signature using the STRIPE_WEBHOOK_SECRET. We verify that
// signature before trusting any payload. No JWT.
//
// IMPORTANT: Deploy with "Verify JWT with legacy secret" OFF — Stripe does not
// send a Supabase JWT. If the toggle is ON, every webhook request will 401.
//
// Events handled:
//   customer.subscription.created  → initial profile write (tier, status, period)
//   customer.subscription.updated  → plan change, cancellation scheduled, status change
//   customer.subscription.deleted  → subscription ended → downgrade to 'free'
//
// One-time payments (Eden's Table curriculum) will be added in Phase 2 via
// checkout.session.completed (payment mode). Not handled here yet.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.21.0?target=denonext"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-12-18.acacia",
  httpClient: Stripe.createFetchHttpClient(),
})

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!

// Admin client — webhook has no user context, so we use the service role key
// to write freely to `profiles` (bypasses RLS).
const adminClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
)

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  // ---------- 1. Verify Stripe signature ----------
  const signature = req.headers.get("Stripe-Signature")
  if (!signature) {
    console.error("Missing Stripe-Signature header")
    return new Response("Missing signature", { status: 400 })
  }

  // Raw body is required for signature verification. Do NOT parse as JSON yet.
  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("Signature verification failed:", message)
    return new Response(`Webhook signature verification failed: ${message}`, {
      status: 400,
    })
  }

  console.log(`Received event: ${event.type} (id: ${event.id})`)

  // ---------- 2. Dispatch by event type ----------
  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription
        await reconcileSubscription(subscription)
        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(subscription)
        break
      }

      default:
        // Acknowledge unhandled event types with 200 so Stripe does not retry.
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })
  } catch (err) {
    console.error(`Error processing ${event.type}:`, err)
    // Return 500 → Stripe will retry with exponential backoff
    const message = err instanceof Error ? err.message : "Unknown error"
    return new Response(JSON.stringify({ error: message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    })
  }
})

// ---------- Handlers ----------

/**
 * Write the current state of a subscription to the profiles table.
 * Called for both `created` and `updated` events. Idempotent — safe to replay.
 */
async function reconcileSubscription(subscription: Stripe.Subscription) {
  const userId = await resolveSupabaseUserId(subscription)
  if (!userId) {
    console.error(
      `Could not resolve Supabase user for subscription ${subscription.id} ` +
        `(customer: ${subscription.customer})`,
    )
    return
  }

  // Derive tier from the ACTIVE price's lookup_key, not from stale metadata.
  // Plan changes via Customer Portal update the price but leave metadata alone.
  const firstItem = subscription.items.data[0]
  const priceLookupKey = firstItem?.price.lookup_key ?? null
  const tier = tierFromLookupKey(priceLookupKey)

  // Stripe moved current_period_start/end from the subscription object onto the
  // subscription item in API versions >= 2025-x. Webhooks pinned to older versions
  // still return them at the top level. Check both locations for compatibility.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subAny = subscription as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itemAny = firstItem as any
  const periodStart = itemAny?.current_period_start ?? subAny.current_period_start
  const periodEnd = itemAny?.current_period_end ?? subAny.current_period_end

  const update = {
    stripe_subscription_id: subscription.id,
    subscription_tier: tier,
    subscription_status: subscription.status,
    current_period_start: toIso(periodStart),
    current_period_end: toIso(periodEnd),
    cancel_at_period_end: subscription.cancel_at_period_end,
  }

  const { error } = await adminClient
    .from("profiles")
    .update(update)
    .eq("user_id", userId)

  if (error) {
    throw new Error(`profiles update failed: ${error.message}`)
  }

  console.log(
    `Reconciled profile for user ${userId}: tier=${tier}, ` +
      `status=${subscription.status}, cancel_at_period_end=${subscription.cancel_at_period_end}`,
  )
}

/**
 * Subscription fully ended (after grace period or immediate cancellation).
 * Downgrade the user to the free tier and clear subscription fields.
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = await resolveSupabaseUserId(subscription)
  if (!userId) {
    console.error(
      `Could not resolve user for deleted subscription ${subscription.id}`,
    )
    return
  }

  const { error } = await adminClient
    .from("profiles")
    .update({
      subscription_tier: "free",
      subscription_status: "canceled",
      stripe_subscription_id: null,
      cancel_at_period_end: false,
      current_period_start: null,
      current_period_end: null,
    })
    .eq("user_id", userId)

  if (error) {
    throw new Error(`profiles downgrade failed: ${error.message}`)
  }

  console.log(`Downgraded user ${userId} to free (subscription ended)`)
}

// ---------- Helpers ----------

/**
 * Find the Supabase user_id associated with a Stripe subscription.
 *
 * Strategy (in order):
 *   1. Read supabase_user_id from subscription.metadata (we set this in create-checkout)
 *   2. Fallback: look up profiles by stripe_customer_id
 *
 * The fallback catches subscriptions created outside our checkout flow
 * (e.g. manually in Stripe Dashboard for admin/comp accounts).
 */
async function resolveSupabaseUserId(
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const metaUserId = subscription.metadata?.supabase_user_id
  if (metaUserId) return metaUserId

  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id

  const { data, error } = await adminClient
    .from("profiles")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle()

  if (error) {
    console.error(`Customer lookup failed: ${error.message}`)
    return null
  }

  return data?.user_id ?? null
}

/**
 * Map a Stripe price lookup_key to a subscription_tier enum value.
 * Reads the *prefix* of the lookup_key so monthly/yearly both map to the same tier.
 */
function tierFromLookupKey(key: string | null): "free" | "seed" | "root" | "practitioner" {
  if (!key) return "free"
  if (key.startsWith("seed")) return "seed"
  if (key.startsWith("root")) return "root"
  if (key.startsWith("practitioner")) return "practitioner"
  return "free"
}

/**
 * Stripe returns unix timestamps in seconds; Postgres timestamptz expects ISO 8601.
 */
function toIso(unixSeconds: number | null | undefined): string | null {
  if (!unixSeconds) return null
  return new Date(unixSeconds * 1000).toISOString()
}
