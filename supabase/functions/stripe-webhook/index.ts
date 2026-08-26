// supabase/functions/stripe-webhook/index.ts
// Eden Apothecary — Stripe webhook handler
// Listens for subscription lifecycle events AND one-time payment completion,
// reconciling the `profiles` table for subscriptions, the `quiz_completions`
// table for guide/course one-off purchases, the homeschool bundle-buyer
// flag for Two-Band Family Bundle purchases, AND the orders table for the
// founding-preorder system (state machine + confirmation messaging).
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
//                                     → dispatch by metadata / lookup_key:
//                                       preorder_sku → preorder order + preorder_hold + messages
//                                       deep_dive_guide → quiz_completions.purchased_guide
//                                       course_*        → quiz_completions.purchased_course
//                                       sprouts/seedlings/nb_addon → record legacy order row
//                                       two_band_bundle → record legacy order row +
//                                                         provision user + bundle-buyer flag
//   charge.refunded                → preorder order → refunded (suppresses messaging)
//
// Errors are captured to Sentry (SENTRY_DSN secret; graceful no-op without it).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.21.0?target=denonext"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { claimStripeEvent, markEventProcessed, markEventError } from "../_shared/order-db.ts"
import { recordPreorderFromSession, applyRefundByPaymentIntent, ResolvedLineItem } from "../_shared/order-flow.ts"
import { notifyFoundingMilestones } from "../_shared/founding-milestones.ts"
import { productForPriceId } from "../_shared/order-config.ts"
import { captureException } from "../_shared/sentry.ts"
import { sendMetaCapiPurchase } from "../_shared/meta-capi.ts"
import { getGuideByNickname, getGuideBySlug } from "../_shared/guide/registry.ts"
import { STARTER_LOOKUP_KEY } from "../_shared/starter-config.ts"
import { creditIssuanceOpen, issueStarterCredit, markCreditRedeemed } from "../_shared/starter-credit.ts"

/**
 * Normalize a constitution identifier to a guide-registry slug.
 *
 * Three formats are in circulation for the same eight patterns:
 *   - registry keys       "pressure-cooker"       (what constitution-pdf accepts)
 *   - eden_patterns rows  "the_pressure_cooker"   (the DB canon)
 *   - display labels      "Hot / Damp / Tense"    (NOT resolvable; use the nickname)
 *
 * This bridges the first two. Labels are handled by the nickname lookup instead.
 */
function normalizeGuideSlug(raw: string): string {
  return raw.toLowerCase().trim().replace(/^the[_-]/, "").replace(/_/g, "-")
}

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-12-18.acacia",
  httpClient: Stripe.createFetchHttpClient(),
})

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

// Admin client — webhook has no user context, so we use the service role key
// to write freely to `profiles`, `quiz_completions`, and `orders`
// (bypasses RLS) and to call auth.admin.inviteUserByEmail for bundle-buyer
// provisioning.
const adminClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
)

// Human-readable labels for homeschool kit lookup_keys, stored on the order row.
const HOMESCHOOL_PRODUCT_LABELS: Record<string, string> = {
  sprouts_complete: "Sprouts Complete (K-2)",
  seedlings_complete: "Seedlings Complete (3-5)",
  two_band_bundle: "Two-Band Family Bundle",
  nb_addon: "Additional Student Notebook",
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

// Deliver the buyer's pattern-specific Deep-Dive Guide PDF by email immediately on
// purchase, so a buyer
// never depends on the client-rendered /guide page (which can render blank when
// opened from a mobile email browser). Best-effort: failures are logged and
// swallowed so the webhook still returns 200 (the purchase must not fail).
async function sendGuidePdf(
  email: string,
  constitutionType: string | null,
  constitutionNickname: string | null,
): Promise<void> {
  try {
    if (!RESEND_API_KEY) {
      console.warn("sendGuidePdf: RESEND_API_KEY missing; skipping guide delivery")
      return
    }

    // Resolve the guide through the registry — the SAME path verify-session uses
    // to serve the on-site copy, so the emailed PDF can never disagree with it.
    //
    // The previous code passed session.metadata.constitution_type straight through
    // as if it were a slug (the old comment even said "the 8-pattern slug"). It is
    // not: it is a display label like "Hot / Damp / Tense", which matches neither a
    // registry key ("pressure-cooker") nor the legacy quadrant map, so
    // constitution-pdf 400'd on every purchase. constitution_nickname
    // ("The Pressure Cooker") IS registry-shaped and was in the metadata all along.
    const guide =
      getGuideByNickname(constitutionNickname ?? "") ??
      getGuideBySlug(normalizeGuideSlug(constitutionType ?? ""))

    // Deliberately NO default guide. The old code fell back to "frozen-knot", which
    // would email a paying customer a guide for a constitution they do not have.
    // Sending nothing is recoverable; sending the wrong paid content is not.
    if (!guide) {
      console.error(
        `sendGuidePdf: could not resolve a guide (nickname=${JSON.stringify(constitutionNickname)}, ` +
          `type=${JSON.stringify(constitutionType)}); sending nothing rather than the wrong guide`,
      )
      return
    }
    const pdfType = guide.slug
    // constitution-pdf now requires the service role (it serves the paid guide);
    // authenticate this server-to-server fetch with the service-role key.
    const pdfRes = await fetch(`${SUPABASE_URL}/functions/v1/constitution-pdf?type=${encodeURIComponent(pdfType)}`, {
      headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    })
    if (!pdfRes.ok) {
      console.error("sendGuidePdf: constitution-pdf failed", pdfRes.status)
      return
    }
    const pdfB64 = bytesToBase64(new Uint8Array(await pdfRes.arrayBuffer()))
    const html = `<!DOCTYPE html><html><body style=\"margin:0;padding:24px;background:#F5F0E8;font-family:Georgia,serif;color:#3D3832;\">`
      + `<table role=\"presentation\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:600px;margin:0 auto;background:#FFFFFF;border:1px solid #E8E3DA;\">`
      + `<tr><td style=\"background:#2C3E2D;padding:28px 20px;text-align:center;\"><span style=\"font-family:Georgia,serif;font-size:13px;font-weight:bold;letter-spacing:4px;color:#C5A44E;\">THE EDEN INSTITUTE</span></td></tr>`
      + `<tr><td style=\"padding:32px 36px;font-size:16px;line-height:1.6;\">`
      + `<p style=\"margin:0 0 16px 0;\">Thank you. Your <strong>Constitutional Deep-Dive Guide</strong> is attached to this email as a PDF, so it is yours to keep, print, and return to anytime.</p>`
      + `<p style=\"margin:0 0 16px 0;\">Inside you will find your matched herbs and how to use them, your caution list, and the diet and lifestyle rhythms that keep your constitution in balance.</p>`
      + `<p style=\"margin:24px 0 4px 0;\">Grace and health,</p><p style=\"margin:0;font-weight:bold;\">Camila</p><p style=\"margin:4px 0 0 0;font-size:14px;\">The Eden Institute</p>`
      + `</td></tr></table></body></html>`
    const sendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Camila at The Eden Institute <hello@edeninstitute.health>",
        reply_to: "hello@edeninstitute.health",
        to: [email],
        subject: "Your Constitutional Deep-Dive Guide",
        html,
        attachments: [{ filename: "Eden-Institute-Constitutional-Deep-Dive-Guide.pdf", content: pdfB64 }],
      }),
    })
    if (!sendRes.ok) {
      console.error("sendGuidePdf: Resend failed", sendRes.status, await sendRes.text().catch(() => ""))
    } else {
      console.log(`sendGuidePdf: delivered guide PDF (type=${pdfType}) to ${email}`)
    }
  } catch (err) {
    console.error("sendGuidePdf error (non-fatal):", err instanceof Error ? err.message : String(err))
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  // ---------- 0. Admin-only deliberate error (Sentry end-to-end check) ----------
  // Verifies Sentry capture in production without touching Stripe. Requires the
  // PREORDER_ADMIN_TOKEN secret in the x-eden-sentry-test header; unauthenticated
  // requests fall through to normal signature verification (and fail there).
  const sentryTestHeader = req.headers.get("x-eden-sentry-test")
  const preorderAdminToken = Deno.env.get("PREORDER_ADMIN_TOKEN")
  if (sentryTestHeader && preorderAdminToken && sentryTestHeader === preorderAdminToken) {
    const testErr = new Error("Deliberate webhook test error (admin-triggered Sentry check)")
    console.error(testErr.message)
    await captureException(testErr, { function: "stripe-webhook", deliberate: true })
    return new Response(JSON.stringify({ sentry_test: "captured" }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    })
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

  // ---------- 2. Idempotency gate: skip events already fully processed ----------
  try {
    const { proceed } = await claimStripeEvent(adminClient, { id: event.id, type: event.type, payload: event })
    if (!proceed) {
      console.log(`Event ${event.id} (${event.type}) already processed; skipping.`)
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      })
    }
  } catch (err) {
    // If the ledger write itself fails, process anyway: a rare duplicate is safer than a
    // dropped event, and the order UNIQUE + message_log guard still prevent double effects.
    console.error(`stripe_events claim failed for ${event.id}:`, err instanceof Error ? err.message : String(err))
  }

  // ---------- 3. Dispatch by event type ----------
  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription
        await logSubscriptionEvent(event, subscription)
        await reconcileSubscription(subscription)
        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        await logSubscriptionEvent(event, subscription)
        await handleSubscriptionDeleted(subscription)
        break
      }

      // Money actually moving on a subscription. Previously UNHANDLED, which is why a
      // subscriber's payments were invisible: customer.subscription.* says the state
      // changed, invoice.paid says we got paid. Renewals only ever emit the latter, so
      // every month after the first left no trace anywhere.
      case "invoice.paid":
      case "invoice.payment_succeeded": {
        await recordInvoicePayment(event, "paid")
        break
      }

      case "invoice.payment_failed": {
        // Recorded rather than ignored: a failed renewal is the start of involuntary
        // churn, and it is invisible from profiles alone.
        await recordInvoicePayment(event, "failed")
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
        // Ledger row for the money itself, separate from the order (which is the
        // fulfillment record). A one-off produces BOTH; a subscription renewal
        // produces only a payment. Revenue is sum(payments) either way.
        await recordOneOffPayment(event, session)

        await handleOneOffPayment(session)

        // Report the sale to Meta (server-side Conversions API). Deliberately
        // AFTER handleOneOffPayment and deliberately un-awaited for failure:
        // sendMetaCapiPurchase never throws, so ad reporting can never break
        // fulfillment. event_id is the session id, so Stripe webhook retries
        // dedupe at Meta instead of double-counting revenue.
        // Match-quality inputs. Meta scored the email-only version 3.2/10, which
        // meant ad-driven sales frequently failed to attribute to the click that
        // produced them. fbp/fbc ride in from the browser via checkout metadata;
        // the address fields are Stripe's own collection, previously discarded.
        const billingAddr = session.customer_details?.address ?? null
        await sendMetaCapiPurchase({
          eventId: session.id,
          email: session.customer_details?.email ?? session.customer_email ?? null,
          amountTotalCents: session.amount_total ?? null,
          currency: session.currency ?? null,
          contentName: (session.metadata?.lookup_key as string | undefined) ?? null,
          fbp: (session.metadata?.fbp as string | undefined) ?? null,
          fbc: (session.metadata?.fbc as string | undefined) ?? null,
          billingName: session.customer_details?.name ?? null,
          city: billingAddr?.city ?? null,
          state: billingAddr?.state ?? null,
          postalCode: billingAddr?.postal_code ?? null,
          country: billingAddr?.country ?? null,
        })
        break
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge
        // Stripe fires charge.refunded for PARTIAL refunds too; charge.refunded
        // is true only once the charge is FULLY refunded. A partial refund
        // (e.g. a goodwill shipping credit) must not kill fulfillment or
        // reopen a founding slot.
        // The MONEY is recorded either way. Only the ORDER is left alone on a partial:
        // a goodwill shipping credit must not kill fulfillment or reopen a founding
        // slot, but it is still money that left the business and the ledger has to
        // show it or revenue is overstated by exactly that amount.
        await recordRefund(event, charge)

        if (!charge.refunded) {
          console.log(
            `charge.refunded: partial refund, order unchanged ` +
              `(amount_refunded=${charge.amount_refunded}, charge=${charge.id})`,
          )
          break
        }
        const pi = typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id ?? null
        if (pi) {
          const applied = await applyRefundByPaymentIntent(adminClient, pi)
          console.log(`charge.refunded: ${applied ? "order -> refunded" : "no matching order"} (pi=${pi}, charge=${charge.id})`)
          // A refunded Starter Unit takes its credit with it. The published
          // policy on /returns says so, and an uncancelled credit would let
          // someone buy the starter for $39, refund it, and still hold $39 off
          // the kit. Best-effort: the refund itself is already recorded, so a
          // failure here is logged loudly for manual cleanup rather than made
          // into a 500 that has Stripe retry a completed refund.
          await cancelCreditForRefundedStarter(pi).catch((err) =>
            console.error(
              `[pi=${pi}] starter credit cancellation after refund FAILED; ` +
                `the credit may still be live and should be deactivated by hand: ` +
                (err instanceof Error ? err.message : String(err)),
            )
          )
        } else {
          console.warn(`charge.refunded without payment_intent; charge=${charge.id}`)
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    await markEventProcessed(adminClient, event.id)

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })
  } catch (err) {
    console.error(`Error processing ${event.type}:`, err)
    await markEventError(adminClient, event.id, err instanceof Error ? err.message : String(err)).catch(() => {})
    await captureException(err, { function: "stripe-webhook", event_type: event.type, event_id: event.id })
    const message = err instanceof Error ? err.message : "Unknown error"
    return new Response(JSON.stringify({ error: message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    })
  }
})

// ---------- Subscription handlers (unchanged from prior version) ----------

// Log promotion-code redemptions to public.partner_referrals so each
// partner's code doubles as their sales counter. Upserts on subscription_id
// (subscription.updated re-touches the row with current status).
async function recordPartnerReferral(
  subscription: Stripe.Subscription,
  tier: string,
  lookupKey: string | null,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subAny = subscription as any
  const discounts = [
    subAny.discount,
    ...(Array.isArray(subAny.discounts) ? subAny.discounts : []),
  ].filter((d) => d && typeof d === "object")
  const promoRef = discounts
    .map((d) => d.promotion_code)
    .find((p) => p != null)
  if (!promoRef) return

  const promoId = typeof promoRef === "string" ? promoRef : promoRef.id
  let code = typeof promoRef === "object" && promoRef?.code ? promoRef.code : null
  let couponId: string | null = null
  try {
    const promo = await stripe.promotionCodes.retrieve(promoId)
    code = promo.code
    couponId = typeof promo.coupon === "string" ? promo.coupon : promo.coupon?.id ?? null
  } catch (err) {
    console.warn(
      `promotionCodes.retrieve(${promoId}) failed: ` +
        (err instanceof Error ? err.message : String(err)),
    )
  }
  if (!code) code = promoId

  let email: string | null = null
  try {
    const customer = typeof subscription.customer === "string"
      ? await stripe.customers.retrieve(subscription.customer)
      : subscription.customer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    email = (customer as any)?.email ?? null
  } catch (_err) {
    // email is enrichment only
  }

  const { error } = await adminClient.from("partner_referrals").upsert(
    {
      subscription_id: subscription.id,
      promo_code: code,
      promo_code_id: promoId,
      coupon_id: couponId,
      customer_email: email,
      tier,
      lookup_key: lookupKey,
      status: subscription.status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "subscription_id" },
  )
  if (error) throw new Error(error.message)
  console.log(
    `partner referral logged: code=${code} sub=${subscription.id} tier=${tier}`,
  )
}


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

  // Partner attribution (2026-07-09): if this subscription redeemed a
  // promotion code, log it — the per-partner code IS the attribution.
  // Best-effort: a referral-log failure must never block tier reconcile.
  try {
    await recordPartnerReferral(fresh, tier, priceLookupKey)
  } catch (err) {
    console.error(
      `partner referral log failed for ${fresh.id}: ` +
        (err instanceof Error ? err.message : String(err)),
    )
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

/**
 * Resolve a preorder session's cart lines, most-authoritative source first:
 *   1. Stripe line_items expansion — real price IDs map back to (sku, isFounding) via
 *      productForPriceId; quantities and unit amounts are what Stripe actually billed.
 *   2. metadata.preorder_cart (JSON stamped by create-checkout) + metadata.is_founding.
 *   3. metadata.preorder_sku alone as a single qty-1 line (the pre-cart shape).
 */
async function resolvePreorderLineItems(
  session: Stripe.Checkout.Session,
  preorderSku: string,
  isFounding: boolean,
): Promise<ResolvedLineItem[]> {
  try {
    const expanded = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ["line_items.data.price"],
    })
    const lines = expanded.line_items?.data ?? []
    const items: ResolvedLineItem[] = []
    for (const li of lines) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const price = li.price as any
      const resolved = productForPriceId(price?.id)
      if (!resolved) {
        console.warn(
          `preorder session ${session.id}: line price ${price?.id ?? "(none)"} not a known preorder price`,
        )
        continue
      }
      items.push({
        sku: resolved.sku,
        isFounding: resolved.isFounding,
        quantity: li.quantity ?? 1,
        unitPriceCents: typeof price?.unit_amount === "number" ? price.unit_amount : null,
      })
    }
    // Accept the expansion only if EVERY billed line resolved (shipping is a
    // shipping_option, never a line, so counts must match exactly). A partial
    // resolution means a price ID diverged from order-config (e.g. a runtime price
    // swap in the products table); recording the partial cart would silently drop
    // paid lines, so fall back to the checkout metadata instead.
    if (items.length > 0 && items.length === lines.length) return items
    console.warn(
      `preorder session ${session.id}: resolved ${items.length}/${lines.length} expanded lines; falling back to metadata`,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.warn(`preorder session ${session.id}: line_items expansion failed (${message}); falling back to metadata`)
  }

  const rawCart = session.metadata?.preorder_cart
  if (typeof rawCart === "string" && rawCart) {
    try {
      const parsed = JSON.parse(rawCart)
      if (Array.isArray(parsed)) {
        const items = parsed
          .filter((c) => typeof c?.sku === "string" && Number.isInteger(c?.qty) && c.qty > 0)
          .map((c) => ({ sku: c.sku as string, isFounding, quantity: c.qty as number }))
        if (items.length > 0) return items
      }
    } catch {
      // fall through to the single-sku shape
    }
  }

  return [{ sku: preorderSku, isFounding, quantity: 1 }]
}

async function handleOneOffPayment(session: Stripe.Checkout.Session) {
  // ---- Branch 0: founding-preorder products (Sprouts Kit, Student Notebook, ...) ----
  // Detected by the preorder_sku metadata stamped at checkout. Full lifecycle: record the
  // order + one line item per cart line, transition to preorder_hold, and fire the
  // confirmation email/SMS. Line items come from Stripe's expansion (billing truth: real
  // price IDs, quantities, unit amounts); the preorder_cart metadata JSON is the fallback,
  // then the single preorder_sku itself, so a session is never dropped on the floor.
  const preorderSku = (session.metadata?.preorder_sku as string | undefined) ?? null
  if (preorderSku) {
    // Async payment methods fire checkout.session.completed before money moves.
    // Only payment_status "paid" may record an order and tell the family their
    // card was charged. (Cards are the only enabled method; this guards drift.)
    if (session.payment_status !== "paid") {
      console.warn(
        `preorder session ${session.id} completed with payment_status=` +
          `${session.payment_status}; order NOT recorded`,
      )
      return
    }
    const isFounding = session.metadata?.is_founding === "true"
    const items = await resolvePreorderLineItems(session, preorderSku, isFounding)
    const orderNumber = await recordPreorderFromSession(adminClient, session, items)

    // Echo the order number back onto the PaymentIntent.
    //
    // order_number is a column DEFAULT off order_number_seq, so it does not exist until
    // the order row is inserted, which is here, after payment. Stripe therefore cannot
    // carry it at session creation and the Dashboard shows a payment with no human handle
    // on it. /returns tells customers to quote their order number in any email, so without
    // this a support request reading "about ET-1004" cannot be found in Stripe at all.
    //
    // Metadata updates merge by key, so this adds order_number without disturbing the
    // preorder metadata create-checkout already stamped (cart, acceptance evidence,
    // preorder_test). Best-effort by design: the order is already recorded and the customer
    // already emailed, so a Stripe hiccup here must never 500 the webhook and trigger a
    // retry of work that is done.
    const preorderPi = typeof session.payment_intent === "string" ? session.payment_intent : null
    if (orderNumber && preorderPi) {
      try {
        await stripe.paymentIntents.update(preorderPi, { metadata: { order_number: orderNumber } })
      } catch (err) {
        console.error(
          `order_number writeback failed for ${orderNumber} on ${preorderPi}:`,
          err instanceof Error ? err.message : String(err),
        )
      }
    }
    // If this kit was bought with a Starter Unit credit, close the loop.
    //
    // The promotion code id is stamped into session metadata by create-checkout,
    // which is more reliable than reading total_details.breakdown.discounts (that
    // needs an expansion the webhook payload does not carry). markCreditRedeemed
    // is a compare-and-set on redeemed_at, so a Stripe retry reports no-op instead
    // of overwriting the original timestamp, which is the one number the whole
    // starter-to-kit conversion metric is computed from.
    //
    // Best-effort: the kit order is already recorded and the buyer already
    // charged, so a failure here is a reporting gap, never a reason to 500 and
    // have Stripe retry a completed order.
    const creditPromoId = (session.metadata?.starter_credit_promo_id as string | undefined) ?? null
    if (creditPromoId) {
      try {
        const { data: kitOrder } = await adminClient
          .from("orders").select("id").eq("stripe_checkout_session_id", session.id).maybeSingle()
        const out = await markCreditRedeemed(adminClient, {
          promotionCodeId: creditPromoId,
          orderId: kitOrder?.id ?? null,
          sessionId: session.id,
        })
        if (!out.redeemed) {
          console.log(`[${session.id}] starter credit ${creditPromoId} was already marked redeemed; no-op`)
        }
      } catch (err) {
        console.error(
          `[${session.id}] starter credit redemption writeback failed: ` +
            (err instanceof Error ? err.message : String(err)),
        )
      }
    }

    // Founder milestone pings (250/400/475/490/cap) ride the recording path so the
    // final ping lands at the actual flip moment, and this call also advances the
    // one-way founding latch at payment time. Best-effort: a milestone or Resend
    // failure must never 500 the webhook and make Stripe retry a recorded order.
    //
    // The cap milestone is ALSO what runs the starter-credit phase transition, so
    // there is no separate 500-unit monitor, no cron and no polling: the trigger
    // is the same latch that flips the price.
    try {
      await notifyFoundingMilestones(adminClient, stripe)
    } catch (err) {
      console.error("founding milestone check failed:", err instanceof Error ? err.message : String(err))
    }
    return
  }

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
  // Branch 1: homeschool bundle — record the order, then provision Supabase
  // user + set the bundle-buyer flag (gates the nb_addon purchase).
  if (lookupKey === "two_band_bundle") {
    await recordHomeschoolOrder(session, lookupKey, email)
    if (!email) {
      console.warn(
        `Bundle purchase without email — order recorded but cannot provision user. session=${session.id}`,
      )
      return
    }
    await handleHomeschoolBundlePurchase(session, email)
    return
  }

  // Branch 2: homeschool single-band or add-on — record the order.
  if (
    lookupKey === "sprouts_complete" ||
    lookupKey === "seedlings_complete" ||
    lookupKey === "nb_addon"
  ) {
    await recordHomeschoolOrder(session, lookupKey, email)
    return
  }

  // Branch 2b: Eden's Table Sprouts Starter Unit ($39 digital).
  if (lookupKey === STARTER_LOOKUP_KEY) {
    await handleStarterUnitPurchase(session, email)
    return
  }

  // Branch 3: one-off DIGITAL products (Deep-Dive Guide, future courses).
  //
  // Order of operations here is deliberate and was previously wrong:
  //   1. RECORD THE SALE. Always, first, before anything that can bail out.
  //   2. Attribute it to a quiz row (best effort).
  //   3. Deliver the product. Never conditional on step 2.
  //
  // The old flow did only step 2, then step 3 gated on it succeeding. Two
  // consequences, both real and both hit in production:
  //   - purchased_guide is a BOOLEAN on quiz_completions, so a second purchase by
  //     the same email overwrote the first. Two $4.99 sales were indistinguishable
  //     from one, and neither amount, date, nor which guide was stored anywhere.
  //   - a buyer with NO matching quiz row (bought without taking the quiz, or used
  //     a different address) hit an early return that skipped sendGuidePdf. They
  //     paid and received nothing.
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

  // 1. The sale itself. Idempotent on the session id, so a Stripe retry is a no-op.
  await recordDigitalOrder(session, lookupKey, email)

  // 2. Attribution. Best effort: a missing quiz row is a reporting gap, not a
  //    reason to withhold a paid product, so this never returns early any more.
  if (email) {
    const { data: updated, error } = await adminClient
      .from("quiz_completions")
      .update({ [column]: true })
      .ilike("email", email)
      .select("id")

    if (error) {
      // Still not fatal to delivery: log loudly and carry on to step 3.
      console.error(`quiz_completions ${column} flip failed for email=${email}: ${error.message}`)
    } else if ((updated?.length ?? 0) === 0) {
      console.warn(
        `no quiz_completions row matched email=${email}; ${column} not flipped ` +
          `(the sale IS recorded in orders). session=${session.id}`,
      )
    } else {
      console.log(
        `flipped ${column}=true on ${updated!.length} quiz_completions row(s) ` +
          `for email=${email}, lookup_key=${lookupKey}, session=${session.id}`,
      )
    }
  } else {
    console.warn(`digital purchase without email; recorded but unattributed. session=${session.id}`)
  }

  // 3. Delivery. Unconditional for guides: they paid, so they get it.
  if (column === "purchased_guide" && email) {
    await sendGuidePdf(
      email,
      (session.metadata?.constitution_type as string | undefined) ?? null,
      (session.metadata?.constitution_nickname as string | undefined) ?? null,
    )
  }
}

// ---------- Digital order recording ----------

/**
 * Record a one-off DIGITAL sale (guide, course) in the orders table, so revenue is
 * countable and repeat purchases are distinguishable.
 *
 * Two fields matter and are easy to get wrong:
 *   - is_preorder MUST be false. It defaults to true, and preorder_broadcast_list
 *     selects on it: a guide buyer would otherwise receive kit manufacturing updates.
 *   - status is 'delivered', not 'paid'. A digital good is delivered at purchase, and
 *     'paid' would park it in the fulfillment queue forever looking unshipped.
 *
 * Idempotent on stripe_checkout_session_id. Throws on a real DB error so Stripe
 * retries, which is safe because the upsert ignores duplicates.
 */
async function recordDigitalOrder(
  session: Stripe.Checkout.Session,
  lookupKey: string,
  email: string | null,
) {
  const nickname = (session.metadata?.constitution_nickname as string | undefined) ?? null
  const label = lookupKey === "deep_dive_guide"
    ? `Deep-Dive Guide${nickname ? `: ${nickname}` : ""}`
    : lookupKey

  const { error } = await adminClient.from("orders").upsert({
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
    stripe_customer_id: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
    customer_email: email,
    lookup_key: lookupKey,
    product_label: label,
    amount_total_cents: session.amount_total ?? null,
    tax_cents: session.total_details?.amount_tax ?? null,
    currency: session.currency ?? null,
    quantity: 1,
    payment_status: session.payment_status ?? null,
    status: "delivered",
    is_preorder: false,
    raw: session,
  }, { onConflict: "stripe_checkout_session_id", ignoreDuplicates: true })

  if (error) {
    throw new Error(`digital order upsert failed for session ${session.id}: ${error.message}`)
  }
  console.log(`Recorded digital sale: ${label} ${session.amount_total ?? "?"} ${session.currency ?? ""} session=${session.id}`)
}

// ---------- Starter Unit ----------

/**
 * Eden's Table Sprouts Starter Unit: record the sale, issue the kit credit, and
 * queue delivery.
 *
 * ORDER OF OPERATIONS IS DELIBERATE, and it is the same lesson the Deep-Dive
 * Guide branch above learned the hard way:
 *
 *   1. RECORD THE SALE first, always, before anything that can bail out. A buyer
 *      whose delivery fails must still exist in the ledger.
 *   2. ISSUE THE CREDIT. Idempotent on the session id, so a Stripe retry returns
 *      the same code rather than minting a second one.
 *   3. QUEUE the delivery and return. The actual work (stamping ~20MB of PDFs and
 *      sending) happens in starter-fulfill, because doing it inline risks the
 *      webhook timing out, and a timed-out webhook is retried, which means
 *      re-doing work that already half-happened.
 *
 * Steps 2 and 3 are best-effort with respect to the HTTP response: neither may
 * throw the webhook into a 500, because Stripe would then retry an event whose
 * sale is already recorded. Both are individually recoverable (the credit by a
 * re-run of this branch, the delivery by the cron drain), and both log loudly.
 *
 * IDEMPOTENCY, end to end: `orders` is unique on stripe_checkout_session_id,
 * `starter_credits` is unique on stripe_checkout_session_id, and
 * `starter_deliveries` is unique on stripe_checkout_session_id. A duplicate
 * delivery of this event therefore records nothing new, issues no second code,
 * and queues no second email. That is the acceptance criterion, enforced by three
 * database constraints rather than by hoping this function runs once.
 */
async function handleStarterUnitPurchase(
  session: Stripe.Checkout.Session,
  email: string | null,
): Promise<void> {
  const sid = session.id

  // Async payment methods fire checkout.session.completed before money moves.
  if (session.payment_status !== "paid") {
    console.warn(`[${sid}] starter unit completed with payment_status=${session.payment_status}; not fulfilling`)
    return
  }
  if (!email) {
    // Nothing to deliver to. The sale is still recorded below so it is visible.
    console.error(`[${sid}] starter unit purchase carries NO email; recording the sale, cannot deliver`)
  }

  // 1. The sale.
  await recordDigitalOrder(session, STARTER_LOOKUP_KEY, email)
  const { data: orderRow } = await adminClient
    .from("orders").select("id").eq("stripe_checkout_session_id", sid).maybeSingle()
  const orderId = orderRow?.id ?? null

  if (!email) return

  const stripeCustomerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null
  const purchaserName = session.customer_details?.name ?? null

  // 2. The credit.
  let creditCode: string | null = null
  try {
    if (!stripeCustomerId) {
      // Without a Customer the code cannot be bound, and an UNBOUND code is a
      // transferable $39 that anyone can use. Refuse to issue rather than issue a
      // shareable one; create-checkout sets customer_creation="always" for this
      // product, so reaching here means something upstream changed.
      throw new Error("no Stripe Customer on the session; refusing to issue an unbound credit")
    }
    if (!(await creditIssuanceOpen(adminClient))) {
      console.log(`[${sid}] credit issuance is closed under the current policy; no code issued`)
    } else {
      const issued = await issueStarterCredit(adminClient, stripe, {
        sessionId: sid,
        orderId,
        email,
        purchaserName,
        stripeCustomerId,
      })
      creditCode = issued.code
    }
  } catch (err) {
    console.error(
      `[${sid}] starter credit issuance FAILED (sale is recorded, delivery will go without a code): ` +
        (err instanceof Error ? err.message : String(err)),
    )
  }

  // 3. The delivery work item.
  try {
    const { error } = await adminClient.from("starter_deliveries").insert({
      stripe_checkout_session_id: sid,
      order_id: orderId,
      email,
      purchaser_name: purchaserName,
      status: "pending",
      // 32 hex chars of CSPRNG. This is the durable re-request key, so it has to
      // be unguessable in the same way the /partner-sample ?k= secret is.
      download_token: crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, ""),
    })
    // deno-lint-ignore no-explicit-any
    if (error && (error as any).code !== "23505") throw error
    // deno-lint-ignore no-explicit-any
    if (error && (error as any).code === "23505") {
      console.log(`[${sid}] delivery already queued (duplicate webhook delivery); not queueing again`)
      return
    }
  } catch (err) {
    console.error(
      `[${sid}] starter delivery could not be queued: ` +
        (err instanceof Error ? err.message : String(err)),
    )
    return
  }

  // Kick the fulfiller so delivery is near-immediate rather than waiting for the
  // next cron tick. Deliberately NOT awaited into the webhook's response path and
  // deliberately unable to throw: the work item is durable, so the worst case of
  // this call failing is a delivery that arrives on the next drain instead of now.
  void kickStarterFulfill(sid)
}

/**
 * Cancel the kit credit attached to a refunded Starter Unit purchase.
 *
 * Published policy (/returns, 2026-08-26): "If a Starter Unit purchase is
 * refunded, its credit is cancelled with it." Without this, a $39 purchase could
 * be refunded and still leave a live $39 credit, which is a free kit discount for
 * the cost of a support email.
 *
 * An ALREADY-REDEEMED credit is deliberately left alone. If the buyer has already
 * spent it on a kit, revoking it retroactively would not claw anything back (the
 * kit sale is done) and the row is the evidence of what happened. Deactivating it
 * would only corrupt the redemption record.
 */
async function cancelCreditForRefundedStarter(paymentIntentId: string): Promise<void> {
  const { data: order } = await adminClient
    .from("orders").select("stripe_checkout_session_id, lookup_key")
    .eq("stripe_payment_intent_id", paymentIntentId).maybeSingle()
  if (!order || order.lookup_key !== STARTER_LOOKUP_KEY) return

  const { data: credit } = await adminClient
    .from("starter_credits").select("id, code, stripe_promotion_code_id, redeemed_at, deactivated_at")
    .eq("stripe_checkout_session_id", order.stripe_checkout_session_id).maybeSingle()
  if (!credit) return

  if (credit.redeemed_at) {
    console.log(
      `[${order.stripe_checkout_session_id}] starter refunded but credit ${credit.code} was already ` +
        `redeemed; leaving the redemption record intact`,
    )
    return
  }
  if (credit.deactivated_at) return

  // Stripe first. If it fails we throw, our row stays active, and the mismatch is
  // in the safe direction: a code live with us but dead at Stripe would refuse at
  // checkout with an opaque error.
  await stripe.promotionCodes.update(credit.stripe_promotion_code_id, { active: false })
  const { error } = await adminClient.from("starter_credits")
    .update({ deactivated_at: new Date().toISOString(), deactivated_reason: "starter_purchase_refunded" })
    .eq("id", credit.id)
  if (error) throw new Error(`local credit deactivation write failed: ${error.message}`)
  console.log(`[${order.stripe_checkout_session_id}] starter refunded; credit ${credit.code} cancelled`)
}

/** Fire-and-forget nudge to starter-fulfill. Never throws. */
async function kickStarterFulfill(sessionId: string): Promise<void> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/starter-fulfill`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ session_id: sessionId }),
    })
    if (!res.ok) {
      console.warn(`[${sessionId}] starter-fulfill kick returned ${res.status}; cron will pick it up`)
    }
  } catch (err) {
    console.warn(
      `[${sessionId}] starter-fulfill kick failed; cron will pick it up: ` +
        (err instanceof Error ? err.message : String(err)),
    )
  }
}

// ---------- Homeschool order recording ----------

/**
 * Record a homeschool kit purchase in the orders table — the source of truth
 * for fulfillment and the Founders 500-unit counter. Idempotent on
 * stripe_checkout_session_id (safe on Stripe webhook retries). Throws on a DB
 * error so Stripe retries; the ignore-duplicates upsert makes retries harmless.
 */
async function recordHomeschoolOrder(
  session: Stripe.Checkout.Session,
  lookupKey: string,
  email: string | null,
) {
  const stripeCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shipping = (session as any).shipping_details ?? (session as any).collected_information?.shipping_details ?? null

  const order = {
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
    stripe_customer_id: stripeCustomerId,
    customer_email: email,
    lookup_key: lookupKey,
    product_label: HOMESCHOOL_PRODUCT_LABELS[lookupKey] ?? lookupKey,
    amount_total_cents: session.amount_total ?? null,
    currency: session.currency ?? null,
    quantity: 1,
    payment_status: session.payment_status ?? null,
    shipping_name: shipping?.name ?? session.customer_details?.name ?? null,
    shipping_address: shipping?.address ?? null,
    status: "preorder_hold",
    is_preorder: true,
  }

  // NOTE: writes to the renamed `orders` table. This legacy path (old homeschool lookup_keys)
  // records the order but does NOT create order_items / fire the new confirmation messages;
  // the new founding-preorder products use Branch 0 above. Retire the old kit buttons in favor
  // of the price-ID preorder flow.
  const { error } = await adminClient
    .from("orders")
    .upsert(order, { onConflict: "stripe_checkout_session_id", ignoreDuplicates: true })

  if (error) {
    throw new Error(
      `homeschool_orders upsert failed for session ${session.id}: ${error.message}`,
    )
  }

  console.log(
    `Recorded homeschool order: lookup_key=${lookupKey}, email=${email ?? "(none)"}, ` +
      `session=${session.id}, amount_total=${session.amount_total ?? "n/a"}`,
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

// ---------- Payments ledger + subscription event log ----------

/**
 * Record a single Checkout purchase in the payments ledger. Covers every one-off:
 * guide, course, homeschool kit, and preorder.
 *
 * Best effort by design. The order row and the customer's product are what matter to
 * the buyer; a ledger write must never fail the webhook and trigger a Stripe retry that
 * re-runs fulfillment. Idempotent on stripe_event_id, so a retry from another cause is
 * still safe.
 */
async function recordOneOffPayment(event: Stripe.Event, session: Stripe.Checkout.Session) {
  try {
    const amount = session.amount_total ?? 0
    if (!amount) return

    const lookupKey = (session.metadata?.lookup_key as string | undefined)
      ?? (session.metadata?.preorder_sku as string | undefined)
      ?? null
    const nickname = (session.metadata?.constitution_nickname as string | undefined) ?? null
    const description = lookupKey === "deep_dive_guide"
      ? `Deep-Dive Guide${nickname ? `: ${nickname}` : ""}`
      : (lookupKey ?? "One-off purchase")

    const { error } = await adminClient.from("payments").insert({
      stripe_event_id: event.id,
      stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
      stripe_customer_id: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
      customer_email: (session.customer_details?.email ?? session.customer_email ?? "").toLowerCase() || null,
      kind: "one_off",
      description,
      lookup_key: lookupKey,
      amount_cents: amount,
      currency: session.currency ?? "usd",
      status: "paid",
      occurred_at: new Date(event.created * 1000).toISOString(),
      raw: session,
    })
    // deno-lint-ignore no-explicit-any
    if (error && (error as any).code !== "23505") {
      console.error(`payments insert failed for session ${session.id}: ${error.message}`)
    }
  } catch (err) {
    console.error("recordOneOffPayment failed (non-fatal):", err instanceof Error ? err.message : String(err))
  }
}

/**
 * Record a refund in the payments ledger.
 *
 * This was missing, and it made the ledger assert something false. The `payments` table
 * shipped with a `refunded` status and the founder dashboard shipped a "Refunded" tile,
 * but NOTHING ever wrote that status: all three writers hardcode 'paid' or 'failed'. So
 * "Customer revenue" could never go down, and the Refunded tile read $0.00 permanently,
 * actively asserting there had been no refunds. charge.refunded updated `orders` and
 * stopped there.
 *
 * A refund is recorded as its OWN ROW rather than by mutating the original payment. Three
 * reasons:
 *   1. It is what actually happened. We received the money, then returned it. Both are
 *      real events with real dates, and overwriting the first erases the fact that a sale
 *      occurred at all.
 *   2. founder_payments computes net as paid minus refunded. Flipping the original row to
 *      'refunded' would subtract it twice and report NEGATIVE revenue on a clean refund.
 *   3. Partial refunds fall out for free: the paid row stays whole and the refund row
 *      carries only the amount returned.
 *
 * Idempotent on stripe_event_id, so Stripe's retries collide harmlessly.
 */
async function recordRefund(event: Stripe.Event, charge: Stripe.Charge) {
  try {
    const refunded = charge.amount_refunded ?? 0
    if (!refunded) return

    const pi = typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id ?? null

    // Inherit kind/description/lookup_key from the payment being refunded so the refund
    // row groups with it in revenue reporting. Absent for a charge that predates the
    // ledger, which is fine: the refund is still recorded, just less richly labelled.
    let original: {
      kind?: string; description?: string | null; lookup_key?: string | null
      customer_email?: string | null; user_id?: string | null; currency?: string | null
    } | null = null
    if (pi) {
      const { data } = await adminClient
        .from("payments")
        .select("kind, description, lookup_key, customer_email, user_id, currency")
        .eq("stripe_payment_intent_id", pi)
        .eq("status", "paid")
        .maybeSingle()
      original = data ?? null
    }

    const isPartial = !charge.refunded
    const { error } = await adminClient.from("payments").insert({
      stripe_event_id: event.id,
      stripe_payment_intent_id: pi,
      stripe_charge_id: charge.id,
      stripe_customer_id: typeof charge.customer === "string" ? charge.customer : charge.customer?.id ?? null,
      user_id: original?.user_id ?? null,
      customer_email: (original?.customer_email ?? charge.billing_details?.email ?? "").toLowerCase() || null,
      kind: original?.kind ?? "one_off",
      description: `${isPartial ? "Partial refund" : "Refund"}${original?.description ? `: ${original.description}` : ""}`,
      lookup_key: original?.lookup_key ?? null,
      amount_cents: refunded,
      currency: charge.currency ?? original?.currency ?? "usd",
      status: "refunded",
      occurred_at: new Date(event.created * 1000).toISOString(),
      raw: charge,
    })
    // deno-lint-ignore no-explicit-any
    if (error && (error as any).code !== "23505") {
      console.error(`refund insert failed for charge ${charge.id}: ${error.message}`)
      return
    }
    console.log(
      `payments: recorded ${isPartial ? "partial " : ""}refund of ${refunded} (charge=${charge.id})`,
    )
  } catch (err) {
    console.error("recordRefund failed (non-fatal):", err instanceof Error ? err.message : String(err))
  }
}


/**
 * Append the raw event to subscription_events.
 *
 * That table has existed with the right columns since early on and had ZERO rows:
 * it was built and never wired. Without it, a tier change is unexplainable after the
 * fact, because profiles only ever shows the latest state.
 *
 * Best effort. An audit-log failure must never fail the webhook and make Stripe retry
 * a subscription reconcile that already succeeded.
 */
async function logSubscriptionEvent(event: Stripe.Event, subscription: Stripe.Subscription) {
  try {
    const userId = await resolveSupabaseUserId(subscription)
    const { error } = await adminClient.from("subscription_events").insert({
      user_id: userId,
      stripe_event_id: event.id,
      stripe_event_type: event.type,
      payload: event as unknown as Record<string, unknown>,
      received_at: new Date(event.created * 1000).toISOString(),
    })
    if (error) console.error(`subscription_events insert failed for ${event.id}: ${error.message}`)
  } catch (err) {
    console.error("logSubscriptionEvent failed (non-fatal):", err instanceof Error ? err.message : String(err))
  }
}

/**
 * Record an invoice payment in the payments ledger.
 *
 * This is the row that makes revenue countable: amount, currency, billing period, and
 * the subscription it belongs to. Idempotent twice over, because Stripe retries and a
 * backfill may cover the same invoice:
 *   - UNIQUE(stripe_event_id)
 *   - partial UNIQUE(stripe_invoice_id) WHERE status='paid'
 *
 * Throws on a genuine DB error so Stripe retries. A duplicate is not an error.
 */
async function recordInvoicePayment(event: Stripe.Event, status: "paid" | "failed") {
  // deno-lint-ignore no-explicit-any
  const inv = event.data.object as any

  const amount = status === "paid"
    ? (inv.amount_paid ?? inv.amount_due ?? 0)
    : (inv.amount_due ?? 0)

  // A $0 invoice (100% coupon, trial conversion) is a real state change but not money.
  if (status === "paid" && !amount) {
    console.log(`invoice ${inv.id} paid for 0; not recording a payment row`)
    return
  }

  const line = inv.lines?.data?.[0]
  const subscriptionId = typeof inv.subscription === "string"
    ? inv.subscription
    : inv.subscription?.id ?? line?.subscription ?? null

  const lookupKey = line?.price?.lookup_key ?? null
  const tier = tierFromLookupKey(lookupKey)

  const customerId = typeof inv.customer === "string" ? inv.customer : inv.customer?.id ?? null
  let userId: string | null = null
  if (customerId) {
    const { data } = await adminClient.from("profiles").select("user_id")
      .eq("stripe_customer_id", customerId).maybeSingle()
    userId = data?.user_id ?? null
  }

  const period = line?.period ?? null

  const { error } = await adminClient.from("payments").insert({
    stripe_event_id: event.id,
    stripe_invoice_id: inv.id ?? null,
    stripe_payment_intent_id: typeof inv.payment_intent === "string" ? inv.payment_intent : null,
    stripe_charge_id: typeof inv.charge === "string" ? inv.charge : null,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    user_id: userId,
    customer_email: (inv.customer_email ?? "").toLowerCase() || null,
    kind: "subscription",
    description: tier !== "free" ? `${tier} subscription` : (line?.description ?? "Subscription"),
    lookup_key: lookupKey,
    amount_cents: amount,
    currency: inv.currency ?? "usd",
    status,
    period_start: period?.start ? new Date(period.start * 1000).toISOString() : null,
    period_end: period?.end ? new Date(period.end * 1000).toISOString() : null,
    occurred_at: new Date((inv.status_transitions?.paid_at ?? inv.created ?? event.created) * 1000).toISOString(),
    raw: inv,
  })

  // 23505 = already recorded by a retry or the backfill. Expected, not a failure.
  // deno-lint-ignore no-explicit-any
  if (error && (error as any).code !== "23505") {
    throw new Error(`payments insert failed for invoice ${inv.id}: ${error.message}`)
  }

  console.log(
    `Recorded ${status} subscription payment: ${amount} ${inv.currency ?? "usd"} ` +
      `invoice=${inv.id} sub=${subscriptionId ?? "n/a"}`,
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
