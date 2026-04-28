// submit-feedback — durable inbox for in-app FeedbackButton submissions.
// Lock #15: Supabase feedback_submissions is source of truth. Email to
// hello@edeninstitute.health is best-effort enrichment, never blocks success.
// Lock #45: informational ingestion only — no clinical surface.
//
// JWT verification is OFF intentionally: the widget must work for anonymous
// visitors too. Authenticated callers' user.id is captured from the
// Authorization bearer (best-effort) for correlation in the table.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const FEEDBACK_TO = "hello@edeninstitute.health";
const FEEDBACK_FROM = "Eden Apothecary Feedback <hello@edeninstitute.health>";

function validate(input: unknown):
  | { ok: true; message: string; email: string | null; pageUrl: string | null; userAgent: string | null; context: Record<string, unknown> }
  | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "Invalid request body" };
  const { message, email, pageUrl, userAgent, context } = input as Record<string, unknown>;
  if (typeof message !== "string" || !message.trim()) {
    return { ok: false, error: "Feedback message is required" };
  }
  const trimmedMessage = message.trim();
  if (trimmedMessage.length > 5000) return { ok: false, error: "Feedback is too long (5000 char max)" };

  let trimmedEmail: string | null = null;
  if (typeof email === "string" && email.trim()) {
    const candidate = email.trim().toLowerCase();
    if (candidate.length > 255) return { ok: false, error: "Email is too long" };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) return { ok: false, error: "Please enter a valid email address" };
    trimmedEmail = candidate;
  }

  const trimmedPageUrl = typeof pageUrl === "string" && pageUrl.trim() ? pageUrl.trim().slice(0, 2000) : null;
  const trimmedUserAgent = typeof userAgent === "string" && userAgent.trim() ? userAgent.trim().slice(0, 500) : null;
  const safeContext = (context && typeof context === "object" && !Array.isArray(context))
    ? (context as Record<string, unknown>)
    : {};

  return { ok: true, message: trimmedMessage, email: trimmedEmail, pageUrl: trimmedPageUrl, userAgent: trimmedUserAgent, context: safeContext };
}

async function resolveAuthUserId(req: Request): Promise<{ userId: string | null; userEmail: string | null }> {
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return { userId: null, userEmail: null };
  const token = authHeader.slice(7).trim();
  if (!token || token === "undefined" || token === "null") return { userId: null, userEmail: null };

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return { userId: null, userEmail: null };
    return { userId: data.user.id, userEmail: data.user.email ?? null };
  } catch (_err) {
    return { userId: null, userEmail: null };
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildEmail(args: {
  message: string;
  reporterEmail: string | null;
  authUserEmail: string | null;
  pageUrl: string | null;
  userAgent: string | null;
  feedbackId: string;
  createdAt: string;
}): { subject: string; html: string; replyTo: string | null } {
  const reporter = args.reporterEmail || args.authUserEmail || null;
  const subject = `[Apothecary feedback] ${args.message.slice(0, 60)}${args.message.length > 60 ? "…" : ""}`;
  const messageHtml = escapeHtml(args.message).replace(/\n/g, "<br>");
  const html = `<!DOCTYPE html>
<html><body style="font-family:Georgia,serif;background:#F5F0E8;padding:24px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #E8E3DA;">
    <tr><td style="background:#2C3E2D;color:#fff;padding:20px 24px;">
      <p style="margin:0;font-size:13px;letter-spacing:3px;color:#C5A44E;text-transform:uppercase;font-weight:bold;">EDEN APOTHECARY</p>
      <p style="margin:6px 0 0 0;font-size:18px;">In-app feedback received</p>
    </td></tr>
    <tr><td style="padding:24px;">
      <p style="font-size:13px;color:#6B6560;margin:0 0 4px 0;text-transform:uppercase;letter-spacing:1px;">Message</p>
      <div style="font-size:15px;color:#3D3832;line-height:1.6;background:#F5F0E8;border-left:3px solid #C5A44E;padding:16px 20px;margin:0 0 20px 0;">${messageHtml}</div>
      <table role="presentation" width="100%" style="font-size:13px;color:#3D3832;border-top:1px solid #E8E3DA;padding-top:16px;">
        <tr><td style="padding:4px 0;color:#6B6560;width:140px;">Reporter email</td><td>${reporter ? escapeHtml(reporter) : "<em>(anonymous)</em>"}</td></tr>
        ${args.authUserEmail && args.authUserEmail !== args.reporterEmail ? `<tr><td style="padding:4px 0;color:#6B6560;">Auth user email</td><td>${escapeHtml(args.authUserEmail)}</td></tr>` : ""}
        <tr><td style="padding:4px 0;color:#6B6560;">Page URL</td><td>${args.pageUrl ? escapeHtml(args.pageUrl) : "<em>(none)</em>"}</td></tr>
        <tr><td style="padding:4px 0;color:#6B6560;">User agent</td><td style="font-family:monospace;font-size:11px;">${args.userAgent ? escapeHtml(args.userAgent) : "<em>(none)</em>"}</td></tr>
        <tr><td style="padding:4px 0;color:#6B6560;">Submitted</td><td>${escapeHtml(args.createdAt)}</td></tr>
        <tr><td style="padding:4px 0;color:#6B6560;">Feedback ID</td><td style="font-family:monospace;font-size:11px;">${escapeHtml(args.feedbackId)}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  return { subject, html, replyTo: reporter };
}

async function sendEmail(args: ReturnType<typeof buildEmail>): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY missing — skipping email mirror");
    return;
  }
  try {
    const body: Record<string, unknown> = {
      from: FEEDBACK_FROM,
      to: [FEEDBACK_TO],
      subject: args.subject,
      html: args.html,
    };
    if (args.replyTo) body.reply_to = args.replyTo;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error("Feedback email send failed:", res.status, JSON.stringify(data));
    }
  } catch (err) {
    console.error("Feedback email send error:", err instanceof Error ? err.message : String(err));
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return new Response(JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => null);
    const parsed = validate(body);
    if (!parsed.ok) {
      return new Response(JSON.stringify({ error: parsed.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { userId, userEmail } = await resolveAuthUserId(req);

    // STEP 1 — DURABLE WRITE (source of truth, must succeed)
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/feedback_submissions`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        message: parsed.message,
        email: parsed.email,
        page_url: parsed.pageUrl,
        user_agent: parsed.userAgent,
        auth_user_id: userId,
        context: { ...parsed.context, auth_user_email: userEmail },
      }),
    });
    if (!insertRes.ok) {
      const errorText = await insertRes.text().catch(() => "");
      console.error("Feedback insert failed:", insertRes.status, errorText);
      return new Response(JSON.stringify({ error: "Could not save feedback. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const inserted = await insertRes.json().catch(() => null);
    const row = Array.isArray(inserted) ? inserted[0] : inserted;
    const feedbackId = row?.id ?? "unknown";
    const createdAt = row?.created_at ?? new Date().toISOString();

    // STEP 2 — BEST-EFFORT MIRROR to hello@
    const emailArgs = buildEmail({
      message: parsed.message,
      reporterEmail: parsed.email,
      authUserEmail: userEmail,
      pageUrl: parsed.pageUrl,
      userAgent: parsed.userAgent,
      feedbackId,
      createdAt,
    });
    await sendEmail(emailArgs);

    return new Response(JSON.stringify({ success: true, id: feedbackId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("submit-feedback error:", message);
    return new Response(JSON.stringify({ error: "Unexpected error. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
