// supabase/functions/resend-webhook/index.ts
// Eden Apothecary — Resend outbound webhook handler.
// Launch-blocker #45 · Stage 2 follow-up · Manual §20.18 Supabase-as-SoT Waitlist.
//
// Purpose
//   Receives Resend events and syncs state back to public.waitlist_signups via the
//   public.waitlist_apply_resend_event RPC (see migration 20260424000000).
//
// Events subscribed at the Resend endpoint
//   contact.deleted
//   contact.updated   (Resend has NO contact.unsubscribed event — unsubscribes
//                      arrive as contact.updated with data.unsubscribed === true)
//   email.bounced
//   email.complained
//
// Internal action taxonomy passed to the RPC
//   contact.unsubscribed   ← synthesized from contact.updated when data.unsubscribed=true
//   contact.deleted
//   email.bounced          (hard bounces auto-unsubscribe; soft logged only)
//   email.complained
//
// Security
//   svix-standard HMAC-SHA256 signature verification with ±5 minute replay window.
//   Signing secret lives in RESEND_WEBHOOK_SECRET (Supabase Edge Function secret).
//
// Auth
//   verify_jwt = false declared in supabase/config.toml — Resend does not send a
//   Supabase JWT. Write authority comes from SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { decodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const RESEND_WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MAX_SKEW_MS = 5 * 60 * 1000;

interface ResendEvent {
  type: string;
  created_at?: string;
  data: Record<string, unknown>;
}

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
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

async function verifySvix(
  rawBody: string,
  id: string,
  timestamp: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  if (!id || !timestamp || !signatureHeader || !secret) return false;

  const tsMs = Number(timestamp) * 1000;
  if (Number.isNaN(tsMs)) return false;
  if (Math.abs(Date.now() - tsMs) > MAX_SKEW_MS) return false;

  const keyB64 = secret.startsWith("whsec_")
    ? secret.slice("whsec_".length)
    : secret;
  let keyBytes: Uint8Array;
  try {
    keyBytes = decodeBase64(keyB64);
  } catch {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const toSign = new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`);
  const sigBuf = await crypto.subtle.sign("HMAC", key, toSign);
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));

  const candidates = signatureHeader
    .split(" ")
    .map((s) => s.trim())
    .filter((s) => s.startsWith("v1,"))
    .map((s) => s.slice("v1,".length));

  return candidates.some((c) => constantTimeEq(c, sigB64));
}

function extractEmails(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return [];
}

// Map a raw Resend event to our internal action taxonomy.
// Returns null if the event carries no waitlist-state transition.
function normalizeEvent(event: ResendEvent):
  | { action: "contact.unsubscribed" | "contact.deleted" | "email.bounced" | "email.complained"; reason?: string }
  | null {
  const data = event.data ?? {};
  switch (event.type) {
    case "contact.deleted":
      return { action: "contact.deleted" };
    case "contact.updated":
      if ((data as { unsubscribed?: unknown }).unsubscribed === true) {
        return { action: "contact.unsubscribed", reason: "contact.updated_with_unsubscribed_true" };
      }
      return null; // profile change without unsubscribe — no action
    case "email.bounced":
      return { action: "email.bounced" };
    case "email.complained":
      return { action: "email.complained" };
    default:
      return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const rawBody = await req.text();
  const svixId = req.headers.get("svix-id") ?? "";
  const svixTimestamp = req.headers.get("svix-timestamp") ?? "";
  const svixSignature = req.headers.get("svix-signature") ?? "";

  const verified = await verifySvix(
    rawBody,
    svixId,
    svixTimestamp,
    svixSignature,
    RESEND_WEBHOOK_SECRET,
  );
  if (!verified) {
    console.warn("resend-webhook: signature verification failed", { svixId });
    return json({ error: "signature_verification_failed" }, 401);
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const normalized = normalizeEvent(event);
  if (!normalized) {
    console.log("resend-webhook: no waitlist action", { type: event.type });
    return json({ received: true, ignored: event.type });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const data = event.data ?? {};
  const contactId = typeof (data as { id?: unknown }).id === "string"
    ? String((data as { id: string }).id)
    : null;

  const rawEmailField =
    (data as { email?: unknown }).email ??
    (data as { to?: unknown }).to ??
    null;
  const emails = extractEmails(rawEmailField);

  const metadataPatch: Record<string, unknown> = {
    resend_event_type: event.type,
    resend_action: normalized.action,
    resend_event_received_at: new Date().toISOString(),
  };
  if (normalized.reason) metadataPatch.resend_normalization_reason = normalized.reason;

  if (normalized.action === "email.bounced") {
    const bounce = (data as { bounce?: { type?: string; message?: string } }).bounce ?? {};
    metadataPatch.bounce_type = bounce.type ?? "unknown";
    if (bounce.message) metadataPatch.bounce_message = bounce.message;
  }
  if (normalized.action === "email.complained") {
    metadataPatch.complaint_received = true;
  }
  if (normalized.action === "contact.deleted") {
    metadataPatch.resend_contact_deleted = true;
  }

  try {
    // Email-keyed events may carry multiple recipients.
    if (normalized.action === "email.bounced" || normalized.action === "email.complained") {
      let totalRows = 0;
      for (const em of emails) {
        const { data: rows, error } = await supabase.rpc("waitlist_apply_resend_event", {
          p_event_type: normalized.action,
          p_contact_id: null,
          p_email: em,
          p_metadata_patch: metadataPatch,
        });
        if (error) throw error;
        totalRows += Number(rows ?? 0);
      }
      return json({
        received: true,
        action: normalized.action,
        source_type: event.type,
        emails: emails.length,
        rows: totalRows,
      });
    }

    // Contact-keyed actions (contact.unsubscribed, contact.deleted) — match by contact_id with email fallback.
    const primaryEmail = emails[0] ?? null;
    const { data: rows, error } = await supabase.rpc("waitlist_apply_resend_event", {
      p_event_type: normalized.action,
      p_contact_id: contactId,
      p_email: primaryEmail,
      p_metadata_patch: metadataPatch,
    });
    if (error) throw error;
    return json({
      received: true,
      action: normalized.action,
      source_type: event.type,
      contact_id: contactId,
      rows,
    });
  } catch (e) {
    console.error("resend-webhook: handler error", e);
    return json({ error: "handler_error", detail: String(e) }, 500);
  }
});
