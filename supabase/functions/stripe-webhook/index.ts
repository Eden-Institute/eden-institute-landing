// supabase/functions/stripe-webhook/index.ts
// Eden Apothecary — Stripe webhook handler
// Listens for subscription lifecycle events AND one-time payment completion,
// reconciling the `profiles` table for subscriptions, the `quiz_completions`
// table for guide/course one-off purchases, AND the homeschool bundle-buyer
// flag for Two-Band Family Bundle purchases.
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
//                                     → dispatch by lookup_key:
//                                       deep_dive_guide → quiz_completions.purchased_guide
//                                       course_*        → quiz_completions.purchased_course
//                                       two_band_bundle → provision Supabase user +
//                                                         set profiles.homeschool_bundle_buyer
//                                       sprouts/seedlings/nb_addon → log only (v1)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.21.0?target=denonext"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-12-18.acacia",
  httpClient: Stripe.createFetchHttpClient(),
})

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!

// Admin client — webhook has no user context, so we use the service role key
// to write freely to `profiles` and `quiz_completions` (bypasses RLS) and to
// call auth.admin.inviteUserByEmail for bundle-buyer provisioning.
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
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })
  } catch (err) {
    console.error(`Error processing ${event.type}:`, err)
    const message = err instanceof Error ? err.message : "Unknown error"
    return new Response(JSON.stringify({ error: message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    })
  }
})

// ---------- Subscription handlers (unchanged from prior version) ----------

async function reconcileSubscription(subscription: Stripe.Subscription) {
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

  const firstItem = fresh.items.data[0]
  const priceLookupKey = firstItem?.price.lookup_key ?? null
  const tier = tierFromLookupKey(priceLookupKey)

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
    `Reconciled profile for user ${userId}: ` +
      `tier=${tier}, status=${fresh.status}, cancel_at_period_end=${fresh.cancel_at_period_end}`,
  )
}

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

// ---------- One-off payment dispatcher ----------

async function handleOneOffPayment(session: Stripe.Checkout.Session) {
  // ---- Resolve email (purchaser identity for attribution) ----
  const rawEmail =
    session.customer_details?.email ??
    session.customer_email ??
    (session.metadata?.email as string | undefined) ??
    null
  const email = rawEmail?.toLowerCase().trim() || null

  // ---- Resolve lookup_key (which product was bought) ----
  let lookupKey: string | null =
    (session.metadata?.lookup_key as string | undefined) ?? null

  if (!lookupKey) {
    try {
      const expanded = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ["line_items.data.price"],
      })
      const firstItem = expanded.line_items?.data?.[0]
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
        `cannot dispatch product. session=${session.id} email=${email ?? "(none)"}`,
    )
    return
  }

  // ---- Dispatch by product class ----
  // Branch 1: homeschool bundle — provision Supabase user + set bundle-buyer flag.
  if (lookupKey === "two_band_bundle") {
    if (!email) {
      console.warn(
        `Bundle purchase without email — cannot provision user. session=${session.id}`,
      )
      return
    }
    await handleHomeschoolBundlePurchase(session, email)
    return
  }

  // Branch 2: homeschool single-band or add-on — log only in v1.
  // The Customer Portal v1.1 will optionally provision users for these too.
  if (
    lookupKey === "sprouts_complete" ||
    lookupKey === "seedlings_complete" ||
    lookupKey === "nb_addon"
  ) {
    console.log(
      `Homeschool purchase recorded: lookup_key=${lookupKey}, email=${email ?? "(anonymous)"}, ` +
        `session=${session.id}. No DB writes in v1; portal provisioning ships in v1.1.`,
    )
    return
  }

  // Branch 3: existing quiz-completion flag flips (Deep-Dive Guide, future courses).
  let column: "purchased_guide" | "purchased_course" | null = null
  if (lookupKey === "deep_dive_guide") {
    column = "purchased_guide"
  } else if (lookupKey.startsWith("course_")) {
    column = "purchased_course"
  }

  if (!column) {
    console.log(
      `checkout.session.completed with unhandled lookup_key='${lookupKey}'; ` +
        `session=${session.id} email=${email ?? "(none)"}`,
    )
    return
  }

  if (!email) {
    console.warn(
      `Guide/course purchase without email — cannot attribute. session=${session.id} lookup_key=${lookupKey}`,
    )
    return
  }

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

// ---------- Homeschool bundle-buyer provisioning ----------

/**
 * Bundle purchase webhook handler.
 *
 * Steps:
 *   1. Find existing Supabase user by email (case-insensitive).
 *   2. If not found, invite via auth.admin.inviteUserByEmail — Supabase
 *      creates the auth.users row + sends an invitation email with a
 *      magic-link the buyer can use to set their password and access the
 *      future Customer Portal at /homeschool/account (v1.1).
 *   3. Update profiles.homeschool_bundle_buyer = true (idempotent — safe
 *      to replay on Stripe webhook retries).
 *   4. If the session has a stripe_customer (from customer_creation: "always"
 *      in create-checkout), link it to profiles.stripe_customer_id so future
 *      add-on purchases reuse the same Stripe Customer.
 *
 * Idempotency: re-running this for the same email + session is a no-op
 * on the DB (the flag is already true; the timestamp updates harmlessly).
 */
async function handleHomeschoolBundlePurchase(
  session: Stripe.Checkout.Session,
  email: string,
) {
  // 1. Try to find an existing profiles row by email
  const { data: existing, error: lookupError } = await adminClient
    .from("profiles")
    .select("user_id, stripe_customer_id, homeschool_bundle_buyer")
    .ilike("email", email)
    .maybeSingle()

  if (lookupError) {
    throw new Error(`profiles lookup failed for ${email}: ${lookupError.message}`)
  }

  let userId: string | null = existing?.user_id ?? null

  // 2. Provision a new user via invitation if none exists
  if (!userId) {
    console.log(`Provisioning new Supabase user for bundle buyer email=${email}`)
    const { data: invited, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        // Redirect the magic-link to the Apothecary signup completion page —
        // the existing auth flow knows how to handle a user without a password,
        // and lands them at /apothecary on success.
        redirectTo: "https://edeninstitute.health/apothecary/auth/update-password",
      })

    if (inviteError) {
      throw new Error(
        `auth.admin.inviteUserByEmail failed for ${email}: ${inviteError.message}`,
      )
    }
    userId = invited.user?.id ?? null

    if (!userId) {
      throw new Error(
        `Bundle buyer invitation returned no user.id for ${email} (session=${session.id})`,
      )
    }

    // The handle_new_user trigger has now created a profiles row with
    // subscription_tier='free' for this user_id. We update it next.
  }

  // 3. Extract Stripe Customer ID from session
  const stripeCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null

  // 4. Update the flag + (optionally) link the Stripe Customer
  const updates: Record<string, unknown> = {
    homeschool_bundle_buyer: true,
    homeschool_bundle_purchased_at: new Date().toISOString(),
  }
  if (stripeCustomerId && !existing?.stripe_customer_id) {
    updates.stripe_customer_id = stripeCustomerId
  }

  const { error: updateError } = await adminClient
    .from("profiles")
    .update(updates)
    .eq("user_id", userId)

  if (updateError) {
    throw new Error(
      `Bundle flag write failed for user=${userId}: ${updateError.message}`,
    )
  }

  console.log(
    `Bundle purchase provisioned: user=${userId}, email=${email}, ` +
      `session=${session.id}, stripe_customer=${stripeCustomerId ?? "none"}, ` +
      `new_user=${existing ? "false" : "true"}`,
  )
}

// ---------- Helpers ----------

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

function tierFromLookupKey(key: string | null): "free" | "seed" | "root" | "practitioner" {
  if (!key) return "free"
  if (key.startsWith("seed")) return "seed"
  if (key.startsWith("root")) return "root"
  if (key.startsWith("practitioner")) return "practitioner"
  return "free"
}

function toIso(unixSeconds: number | null | undefined): string | null {
  if (!unixSeconds) return null
  return new Date(unixSeconds * 1000).toISOString()
}
