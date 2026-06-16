// supabase/functions/learnworlds-webhook/index.ts
// Eden Institute — LearnWorlds purchase webhook handler.
//
// Purpose
//   The Foundations Course ($97) sells on LearnWorlds (learn.edeninstitute.health),
//   which Stripe/Supabase never see. LearnWorlds fires a POST webhook on each
//   purchase; this EF verifies it and records the sale in public.course_sales so
//   the founder dashboard's Revenue tab can finally show course revenue.
//
// Auth
//   verify_jwt = false (declared in supabase/config.toml) — LearnWorlds does not
//   send a Supabase JWT. Authenticity comes from the Learnworlds-Webhook-Signature
//   header, an HMAC-SHA256 of the raw request body keyed by LEARNWORLDS_WEBHOOK_SECRET.
//   Write authority is SUPABASE_SERVICE_ROLE_KEY.
//
//   ⚠️ The exact signature semantics (encoding, whether a timestamp is prefixed)
//   should be confirmed against current LearnWorlds docs / a real delivery before
//   this is trusted in production. This implementation accepts the common cases:
//   the header equals the hex OR base64 HMAC-SHA256 of the raw body. If
//   verification fails for legitimate deliveries, inspect the header vs. the
//   computed values logged below and adjust.
//
// Setup (operator, one-time)
//   1. LearnWorlds → Settings → Developers → Webhooks: add a webhook for the
//      purchase/order event, pointing at this function's URL, with a signing secret.
//   2. Set that secret as the LEARNWORLDS_WEBHOOK_SECRET Edge Function secret.
//   3. Deploy this function (verify_jwt=false) + apply the course_sales migration.

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

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifySignature(rawBody: string, header: string, secret: string): Promise<boolean> {
  if (!header || !secret) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = toHex(sig);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  // LearnWorlds may send "sha256=<hex>" or a bare hex/base64 value.
  const candidate = header.replace(/^sha256=/i, "").trim();
  return constantTimeEq(candidate, hex) || constantTimeEq(candidate, b64);
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

// LearnWorlds amounts may arrive as dollars (float/string) or already in cents.
// Heuristic: if there's a decimal point or the value is small, treat as dollars.
function toCents(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.]/g, ""));
  if (Number.isNaN(n)) return null;
  const looksLikeDollars = String(v).includes(".") || n < 1000;
  return Math.round(looksLikeDollars ? n * 100 : n);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const rawBody = await req.text();
  const signature =
    req.headers.get("Learnworlds-Webhook-Signature") ??
    req.headers.get("learnworlds-webhook-signature") ??
    "";

  const ok = await verifySignature(rawBody, signature, LEARNWORLDS_WEBHOOK_SECRET);
  if (!ok) {
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

  // Defensive extraction across LearnWorlds field shapes. Store raw regardless.
  const eventId = asString(pick(payload, ["id", "event_id", "data.id", "data.order.id", "order.id"]));
  const email = (asString(pick(payload, ["data.user.email", "user.email", "data.email", "email"])) ?? "")
    .toLowerCase().trim() || null;
  const productId = asString(pick(payload, ["data.product.id", "product.id", "data.course.id", "course.id", "data.product_id"]));
  const productTitle = asString(pick(payload, ["data.product.title", "product.title", "data.course.title", "course.title", "data.product_title"]));
  const amountCents = toCents(pick(payload, ["data.price", "price", "data.amount", "amount", "data.total", "total"]));
  const currency = (asString(pick(payload, ["data.currency", "currency"])) ?? "usd").toLowerCase();
  const occurredAt =
    asString(pick(payload, ["created", "data.created", "timestamp", "data.date"])) ??
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
    return json({ error: "insert_failed", detail: error.message }, 500);
  }

  return json({ received: true, recorded: !error, event_id: eventId, email });
});
