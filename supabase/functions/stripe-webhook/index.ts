// supabase/functions/stripe-webhook/index.ts
// Eden Apothecary — Stripe webhook handler
// Listens for subscription lifecycle events AND one-time payment completion,
// reconciling the `profiles` table for subscriptions and the
// `quiz_completions` table for one-off purchases (guide / course flags).
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
//   checkout.session.completed     → one-time payment completion (mode='payment')
//                                     → flip quiz_completions.purchased_guide
//                                       or quiz_completions.purchased_course
//                                     → mode='subscription' is skipped here;
//                                       customer.subscription.* events handle that
//                                       (avoids double-firing on plan changes)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.21.0?target=denonext"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-12-18.acacia",
  httpClient: Stripe.createFetchHttpClient(),
})

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!

// Admin client — webhook has no user context, so we use the service role key
// to write freely to `profiles` and `quiz_completions` (bypasses RLS).
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

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        // checkout.session.completed fires for BOTH modes. Subscription-mode
        // sessions are reconciled by customer.subscription.created/updated,
        // which we already handle above — handling them here too would
        // double-fire write paths. Only payment-mode sessions need this case.
        if (session.mode === "subscription") {
          console.log(
            `Skipping checkout.session.completed for subscription session ${session.id} ` +
              `(reconciled by customer.subscription.* events)`,
          )
          break
        }
        if (session.mode !== "payment") {
          console.log(
            `Skipping checkout.session.completed with unexpected mode=${session.mode} ` +
              `(session ${session.id})`,
          )
          break
        }
        await handleOneOffPayment(session)
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
 *
 * RACE-SAFETY: Stripe does not guarantee event delivery order. A late-arriving
 * `customer.subscription.created` event (with status='incomplete') could
 * overwrite an earlier-arriving `customer.subscription.updated` event (with
 * status='active'), leaving profiles stuck at an outdated status.
 *
 * Fix: rather than trust `event.data.object` as ground truth, re-fetch the
 * subscription from Stripe. `stripe.subscriptions.retrieve(id)` always returns
 * the CURRENT state, regardless of which event is being processed. This makes
 * the handler naturally idempotent across any event ordering, dashboard
 * replays, or retry scenarios. Costs one extra Stripe API call per event —
 * negligible at webhook volume.
 */
async function reconcileSubscription(subscription: Stripe.Subscription) {
  // Re-fetch the subscription from Stripe to get the authoritative current state.
  // Defensive: if retrieve fails, fall back to the event payload so we never
  // drop an event entirely.
  let fresh: Stripe.Subscription
  try {
    fresh = await stripe.subscriptions.retrieve(subscription.id)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.warn(
      `stripe.subscriptions.retrieve(${subscription.id}) failed, ` +
        `falling back to event payload: ${message}`,
    )
    fresh = subscription
  }

  const userId = await resolveSupabaseUserId(fresh)
  if (!userId) {
    console.error(
      `Could not resolve Supabase user for subscription ${fresh.id} ` +
        `(customer: ${fresh.customer})`,
    )
    return
  }

  // Derive tier from the ACTIVE price's lookup_key, not from stale metadata.
  // Plan changes via Customer Portal update the price but leave metadata alone.
  const firstItem = fresh.items.data[0]
  const priceLookupKey = firstItem?.price.lookup_key ?? null
  const tier = tierFromLookupKey(priceLookupKey)

  // Stripe moved current_period_start/end from the subscription object onto the
  // subscription item in API versions >= 2025-x. Webhooks pinned to older versions
  // still return them at the top level. Check both locations for compatibility.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subAny = fresh as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itemAny = firstItem as any
  const periodStart = itemAny?.current_period_start ?? subAny.current_period_start
  const periodEnd = itemAny?.current_period_end ?? subAny.current_period_end

  const update = {
    stripe_subscription_id: fresh.id,
    subscription_tier: tier,
    subscription_status: fresh.status,
    current_period_start: toIso(periodStart),
    current_period_end: toIso(periodEnd),
    cancel_at_period_end: fresh.cancel_at_period_end,
  }

  const { error } = await adminClient
    .from("profiles")
    .update(update)
    .eq("user_id", userId)

  if (error) {
    throw new Error(`profiles update failed: ${error.message}`)
  }

  console.log(
    `Reconciled profile for user ${userId} (event-type=${subscription.object === "subscription" ? "sub" : "event"}): ` +
      `tier=${tier}, status=${fresh.status}, cancel_at_period_end=${fresh.cancel_at_period_end} ` +
      `(fetched fresh from Stripe)`,
  )
}

/**
 * Subscription fully ended (after grace period or immediate cancellation).
 * Downgrade the user to the free tier and clear subscription fields.
 *
 * RACE-SAFETY: Only downgrade if the profile's current stripe_subscription_id
 * matches the deleted subscription's id. This guards against a late-arriving
 * `deleted` event for an OLD subscription clobbering a NEW active subscription
 * on the same user (e.g., user canceled and immediately re-subscribed; Stripe
 * retried the old delete event after the new sub was created).
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = await resolveSupabaseUserId(subscription)
  if (!userId) {
    console.error(
      `Could not resolve user for deleted subscription ${subscription.id}`,
    )
    return
  }

  const { data: profile, error: readError } = await adminClient
    .from("profiles")
    .select("stripe_subscription_id")
    .eq("user_id", userId)
    .maybeSingle()

  if (readError) {
    throw new Error(`profiles read failed: ${readError.message}`)
  }

  if (profile?.stripe_subscription_id && profile.stripe_subscription_id !== subscription.id) {
    console.log(
      `Ignoring delete for ${subscription.id}; user ${userId} is now on a different subscription (${profile.stripe_subscription_id})`,
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

  console.log(`Downgraded user ${userId} to free (subscription ${subscription.id} ended)`)
}

/**
 * One-time (mode='payment') checkout session completed.
 *
 * Foundation for the customer-journey state machine: without flipping these
 * flags, the journey hook would surface "Buy the guide" CTAs after a user
 * has already paid. Reads the lookup_key, dispatches by product class, and
 * idempotently flips the corresponding flag on quiz_completions for every
 * row owned by the purchaser's email.
 *
 * Resolution priority for the purchased product:
 *   1. session.metadata.lookup_key   (set by our create-checkout EF)
 *   2. line_items.data[].price.lookup_key  (fallback for purchases made
 *      via Stripe payment links or dashboard manual sessions where our
 *      create-checkout EF didn't author the metadata)
 *
 * Email priority for attribution:
 *   1. session.customer_details.email   (canonical post-checkout — what
 *      Stripe captured during the buyer's session)
 *   2. session.customer_email           (set by our create-checkout EF
 *      when the buyer is anonymous-with-email)
 *   3. session.metadata.email           (last resort — same metadata bag
 *      our EF mirrors)
 *
 * Match is case-insensitive (lower(email) = lower(stripe_email)) per the
 * canonical pattern; the column ILIKE behaves as a case-insensitive exact
 * match for any email without literal `_` or `%` characters (RFC-permitted
 * but vanishingly rare in practice; logged for follow-up if observed).
 *
 * Idempotency: re-running the update keeps the boolean true; Stripe retries
 * are safe.
 *
 * Multi-row case: a single email may have multiple quiz_completions rows
 * (re-takes over time). The flag describes "did this person pay?" not
 * "did this submission pay?" so we flip every matching row, keeping reads
 * consistent regardless of which row the journey hook fetches.
 */
async function handleOneOffPayment(session: Stripe.Checkout.Session) {
  // ---- 1. Resolve email (purchaser identity for attribution) ----
  const rawEmail =
    session.customer_details?.email ??
    session.customer_email ??
    (session.metadata?.email as string | undefined) ??
    null

  const email = rawEmail?.toLowerCase().trim() || null

  if (!email) {
    console.warn(
      `checkout.session.completed (mode=payment) without email; cannot attribute purchase. ` +
        `session=${session.id} payment_status=${session.payment_status}`,
    )
    return
  }

  // ---- 2. Resolve lookup_key (which product was bought) ----
  let lookupKey: string | null =
    (session.metadata?.lookup_key as string | undefined) ?? null

  if (!lookupKey) {
    // Fallback: expand line_items and read the price's lookup_key.
    // Covers payment-link and dashboard-manual sessions where our
    // create-checkout EF didn't author session.metadata.
    try {
      const expanded = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ["line_items.data.price"],
      })
      const firstItem = expanded.line_items?.data?.[0]
      // Stripe types: line_items.data[].price is a Price object when expanded.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lookupKey = (firstItem?.price as any)?.lookup_key ?? null
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      console.warn(
        `Failed to expand line_items for session ${session.id}: ${message}`,
      )
    }
  }

  if (!lookupKey) {
    console.warn(
      `checkout.session.completed (mode=payment) without resolvable lookup_key; ` +
        `cannot dispatch product. session=${session.id} email=${email}`,
    )
    return
  }

  // ---- 3. Dispatch by product class ----
  // - "deep_dive_guide" → purchased_guide (today's $14 Pattern Deep-Dive Guide)
  // - "course_*" prefix → purchased_course (forward-compat: when the $97
  //   Foundations Course migrates from Thinkific to Eden's Stripe in Phase 2
  //   of the value ladder, this branch already handles it)
  // - else: log + return; Stripe should not retry unhandled product types.
  let column: "purchased_guide" | "purchased_course" | null = null
  if (lookupKey === "deep_dive_guide") {
    column = "purchased_guide"
  } else if (lookupKey.startsWith("course_")) {
    column = "purchased_course"
  }

  if (!column) {
    console.log(
      `checkout.session.completed with unhandled lookup_key='${lookupKey}'; ` +
        `session=${session.id} email=${email}`,
    )
    return
  }

  // ---- 4. Idempotent flag flip on quiz_completions ----
  const { data: updated, error } = await adminClient
    .from("quiz_completions")
    .update({ [column]: true })
    .ilike("email", email)
    .select("id")

  if (error) {
    throw new Error(
      `quiz_completions ${column} flip failed for email=${email}: ${error.message}`,
    )
  }

  const updatedCount = updated?.length ?? 0
  if (updatedCount === 0) {
    // No quiz_completions row matched. Possible if the purchaser bought the
    // guide without ever taking the quiz (e.g., gift purchase, direct payment
    // link). Log for audit; not an error — Stripe should still get a 200.
    console.warn(
      `checkout.session.completed: no quiz_completions row matched email=${email}; ` +
        `${column} not flipped. session=${session.id} lookup_key=${lookupKey}`,
    )
    return
  }

  console.log(
    `checkout.session.completed: flipped ${column}=true on ${updatedCount} ` +
      `quiz_completions row(s) for email=${email}, lookup_key=${lookupKey}, session=${session.id}`,
  )
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
