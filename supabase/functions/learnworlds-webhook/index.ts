// supabase/functions/learnworlds-webhook/index.ts
// Eden Institute — LearnWorlds webhook handler.
//
// Purpose
//   The Foundations Course ($97) sells on LearnWorlds (learn.edeninstitute.health),
//   which Stripe/Supabase never see. LearnWorlds fires a POST webhook on each
//   purchase; this EF verifies it and records the sale in public.course_sales so
//   the founder dashboard's Revenue tab can show course revenue, and so the
//   course funnel (site clicks → email clicks → sales) has a bottom.
//
// Auth (rewritten 2026-09-10 against the published LearnWorlds spec,
// https://www.learnworlds.dev/docs/api/ZG9jOjExMTkxNg-webhooks)
//   verify_jwt = false (declared in supabase/config.toml) — LearnWorlds does not
//   send a Supabase JWT. Every delivery carries the header
//       Learnworlds-Webhook-Signature: v1=<pre-shared value>
//   It is a STATIC pre-shared string shown in the LearnWorlds admin under
//   Settings > Developers > Webhooks, NOT an HMAC of the body. The first version
//   of this file computed HMAC-SHA256(body) and would have rejected every real
//   delivery with 401. Verification is now a constant-time comparison of the
//   header value (with or without the "v1=" prefix) against the
//   LEARNWORLDS_WEBHOOK_SECRET Edge Function secret (also accepted with or
//   without the prefix). Write authority is SUPABASE_SERVICE_ROLE_KEY.
//
// Payload (LearnWorlds "version": 2)
//   type "productBought" / trigger "new_purchase":
//     data.payment.id, data.payment.price (dollars), data.payment.paid_at (unix
//     seconds), data.payment.product.{id,name,final_price,type},
//     data.payment.transaction_id, data.user.email
//   Other types (userUpdated, enrolledFreeCourse, leadCreated,
//   awardedCertificate) are acknowledged with 200 and not stored.
//
// Setup (operator, one-time)
//   1. LearnWorlds → Settings → Developers → Webhooks: add a webhook for
//      "When products are bought" pointing at this function's URL; copy the
//      signature value shown there.
//   2. Set it as the LEARNWORLDS_WEBHOOK_SECRET Edge Function secret.
//   3. Deploy this function (verify_jwt=false). course_sales already exists
//      (migration 20260616130000).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const LEARNWORLDS_WEBHOOK_SECRET = Deno.env.get("LEARNWORLDS_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, learnworlds-webhook-signature",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function stripV1(v: string): string {
  return v.trim().replace(/^v1=/i, "");
}

// Static pre-shared signature, per the LearnWorlds spec (see header comment).
function verifySignature(header: string, secret: string): boolean {
  if (!header || !secret) return false;
  return constantTimeEq(stripV1(header), stripV1(secret));
}

// Pull a nested value by trying several dotted paths; returns the first hit.
function pick(obj: Record<string, unknown>, paths: string[]): unknown {
  for (const path of paths) {
    let cur: unknown = obj;
    let ok = true;
    for (const part of path.split(".")) {
      if (cur && typeof cur === "object" && part in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[part];
      } else {
        ok = false;
        break;
      }
    }
    if (ok && cur != null) return cur;
  }
  return null;
}

function asString(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return null;
}

// LearnWorlds sends prices in currency units (e.g. 97 or "97.00"), never cents.
function dollarsToCents(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.]/g, ""));
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100);
}

// LearnWorlds timestamps are unix seconds (float). Accept ISO strings too.
function toIso(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "number") return new Date(v * 1000).toISOString();
  if (typeof v === "string") {
    if (/^\d{4}-/.test(v)) return v;
    const n = Number(v);
    if (!Number.isNaN(n) && n > 0) return new Date(n * 1000).toISOString();
  }
  return null;
}

// Stable fallback id for payloads with no event id: the signed raw body is byte-identical on redelivery.
async function bodyHash(raw: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return "sha256:" + Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const rawBody = await req.text();
  const signature =
    req.headers.get("Learnworlds-Webhook-Signature") ??
    req.headers.get("learnworlds-webhook-signature") ??
    "";

  if (!verifySignature(signature, LEARNWORLDS_WEBHOOK_SECRET)) {
    console.warn("learnworlds-webhook: signature verification failed", {
      hasHeader: !!signature,
      hasSecret: !!LEARNWORLDS_WEBHOOK_SECRET,
    });
    return json({ error: "signature_verification_failed" }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const type = asString(pick(payload, ["type", "trigger"])) ?? "unknown";
  if (type !== "productBought" && type !== "new_purchase") {
    // Signups, free enrolments, leads and certificates: acknowledged, not stored.
    console.log("learnworlds-webhook: ignored event", { type });
    return json({ received: true, recorded: false, ignored: type });
  }

  // v2 "productBought" shape first, legacy/flat shapes as fallbacks.
  const eventId =
    asString(pick(payload, ["data.payment.id", "id", "event_id", "data.id", "data.order.id", "order.id"])) ??
    (await bodyHash(rawBody));
  const email = (asString(pick(payload, ["data.user.email", "user.email", "data.email", "email"])) ?? "")
    .toLowerCase().trim() || null;
  const productId = asString(pick(payload, ["data.payment.product.id", "data.product.id", "product.id", "data.course.id", "course.id", "data.product_id"]));
  const productTitle = asString(pick(payload, ["data.payment.product.name", "data.product.title", "product.title", "data.course.title", "course.title", "data.product_title"]));
  const amountCents = dollarsToCents(pick(payload, ["data.payment.price", "data.payment.product.final_price", "data.price", "price", "data.amount", "amount", "data.total", "total"]));
  const currency = (asString(pick(payload, ["data.payment.currency", "data.currency", "currency"])) ?? "usd").toLowerCase();
  const occurredAt =
    toIso(pick(payload, ["data.payment.paid_at", "data.payment.created", "created", "data.created", "timestamp", "data.date"])) ??
    new Date().toISOString();

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supabase.from("course_sales").insert({
    lw_event_id: eventId,
    product_id: productId,
    product_title: productTitle,
    email,
    amount_cents: amountCents,
    currency,
    occurred_at: occurredAt,
    raw: payload,
  });

  // 23505 = unique_violation on lw_event_id → already recorded (redelivery).
  if (error && (error as { code?: string }).code !== "23505") {
    console.error("learnworlds-webhook: course_sales insert failed", error);
    return json({ error: "insert_failed" }, 500);
  }

  return json({ received: true, recorded: !error, event_id: eventId, email, amount_cents: amountCents });
});
