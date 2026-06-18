// submit-partner-inquiry — durable capture for partner / collaborator / co-op /
// investor inquiries from the public marketing site (homepage "Get Involved"
// and /homeschool group licensing). Supabase partner_inquiries is the source
// of truth; the email to hello@ is best-effort enrichment and never blocks
// success. Mirrors the submit-feedback pattern (Lock #15).
//
// verify_jwt is OFF intentionally: called from anonymous marketing pages.
//
// Investor handling (capture-then-approve): investor inquiries are saved and
// flagged in the email subject/body, AND auto-create a founder_punch_list
// follow-up item so they ride the daily digest until handled. Camila reviews
// and sends the booking link manually — investors never receive an inline link.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const INQUIRY_TO = "hello@edeninstitute.health";
const INQUIRY_FROM = "Eden Institute Partnerships <hello@edeninstitute.health>";

const TYPE_LABELS: Record<string, string> = {
  brand: "Aligned brand / business",
  creator: "Podcaster / creator",
  venture: "Strategic venture",
  investor: "Investor",
  coop: "Homeschool co-op",
  pod: "Homeschool pod / microschool",
  ministry: "Church / ministry program",
  program: "Educational program",
  other: "Other",
};

interface Parsed {
  inquiryType: string;
  sourcePage: string | null;
  name: string;
  email: string;
  orgName: string | null;
  website: string | null;
  audienceSize: string | null;
  groupSize: number | null;
  message: string | null;
}

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

function validate(input: unknown): { ok: true; value: Parsed } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "Invalid request body" };
  const o = input as Record<string, unknown>;

  const inquiryType = typeof o.inquiryType === "string" ? o.inquiryType.trim().toLowerCase() : "";
  if (!TYPE_LABELS[inquiryType]) return { ok: false, error: "Please choose how you'd like to get involved" };

  const name = str(o.name, 200);
  if (!name) return { ok: false, error: "Your name is required" };

  const rawEmail = typeof o.email === "string" ? o.email.trim().toLowerCase() : "";
  if (!rawEmail) return { ok: false, error: "Email is required" };
  if (rawEmail.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
    return { ok: false, error: "Please enter a valid email address" };
  }

  let groupSize: number | null = null;
  if (o.groupSize !== undefined && o.groupSize !== null && o.groupSize !== "") {
    const n = Number(o.groupSize);
    if (Number.isFinite(n) && n >= 0 && n < 100000) groupSize = Math.round(n);
  }

  return {
    ok: true,
    value: {
      inquiryType,
      sourcePage: str(o.sourcePage, 50),
      name,
      email: rawEmail,
      orgName: str(o.orgName, 300),
      website: str(o.website, 500),
      audienceSize: str(o.audienceSize, 200),
      groupSize,
      message: str(o.message, 5000),
    },
  };
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function row(label: string, value: string | null): string {
  return `<tr><td style="padding:4px 0;color:#6B6560;width:150px;">${label}</td><td>${value ? escapeHtml(value) : "<em>(none)</em>"}</td></tr>`;
}

function buildEmail(v: Parsed, id: string, createdAt: string): { subject: string; html: string } {
  const label = TYPE_LABELS[v.inquiryType];
  const isInvestor = v.inquiryType === "investor";
  const subject = isInvestor
    ? `[INVESTOR — review before sending link] ${v.name}${v.orgName ? " · " + v.orgName : ""}`
    : `[Partner inquiry] ${label} — ${v.name}${v.orgName ? " · " + v.orgName : ""}`;
  const banner = isInvestor
    ? `<div style="background:#7A2E2E;color:#fff;padding:12px 16px;font-size:13px;">Investor inquiry — capture-then-approve. Review, then send the booking link manually if it's a fit. (Also added to your punch list.)</div>`
    : "";
  const msgHtml = v.message ? escapeHtml(v.message).replace(/\n/g, "<br>") : null;
  const html = `<!DOCTYPE html>
<html><body style="font-family:Georgia,serif;background:#F5F0E8;padding:24px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #E8E3DA;">
    <tr><td style="background:#2C3E2D;color:#fff;padding:20px 24px;">
      <p style="margin:0;font-size:13px;letter-spacing:3px;color:#C5A44E;text-transform:uppercase;font-weight:bold;">EDEN INSTITUTE</p>
      <p style="margin:6px 0 0 0;font-size:18px;">New ${escapeHtml(label)} inquiry</p>
    </td></tr>
    ${banner}
    <tr><td style="padding:24px;">
      <table role="presentation" width="100%" style="font-size:13px;color:#3D3832;">
        ${row("Type", label)}
        ${row("Name", v.name)}
        ${row("Email", v.email)}
        ${row("Organization", v.orgName)}
        ${row("Website / social", v.website)}
        ${row("Audience size", v.audienceSize)}
        ${row("Group size (children)", v.groupSize !== null ? String(v.groupSize) : null)}
        ${row("Source page", v.sourcePage)}
        ${row("Submitted", createdAt)}
        ${row("Inquiry ID", id)}
      </table>
      ${msgHtml ? `<p style="font-size:13px;color:#6B6560;margin:20px 0 4px 0;text-transform:uppercase;letter-spacing:1px;">Message</p><div style="font-size:15px;color:#3D3832;line-height:1.6;background:#F5F0E8;border-left:3px solid #C5A44E;padding:16px 20px;">${msgHtml}</div>` : ""}
    </td></tr>
  </table>
</body></html>`;
  return { subject, html };
}

async function sendEmail(args: { subject: string; html: string; replyTo: string }): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY missing — skipping email mirror");
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: INQUIRY_FROM,
        to: [INQUIRY_TO],
        subject: args.subject,
        html: args.html,
        reply_to: args.replyTo,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error("Partner inquiry email send failed:", res.status, JSON.stringify(data));
    }
  } catch (err) {
    console.error("Partner inquiry email send error:", err instanceof Error ? err.message : String(err));
  }
}

// Investor inquiries auto-create a founder follow-up item so they ride the
// daily digest until handled. Best-effort — never blocks the inquiry.
async function addInvestorFollowUp(v: Parsed): Promise<void> {
  try {
    const orgBit = v.orgName ? ` (${v.orgName})` : "";
    const detailBits = [
      `Email: ${v.email}`,
      v.website ? `Site: ${v.website}` : "",
      v.message ? `Note: ${v.message.slice(0, 300)}` : "",
    ].filter(Boolean).join(" · ");
    const res = await fetch(`${SUPABASE_URL}/rest/v1/founder_punch_list`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: `Follow up with investor: ${v.name}${orgBit}`,
        detail: `Capture-then-approve — review and send the booking link if it's a fit. ${detailBits}`,
        owner: "C",
        status: "open",
        sort_order: 15,
      }),
    });
    if (!res.ok) {
      console.error("Investor follow-up punch-list insert failed:", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    console.error("Investor follow-up punch-list insert error:", err instanceof Error ? err.message : String(err));
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
    const v = parsed.value;

    // STEP 1 — DURABLE WRITE (source of truth, must succeed)
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/partner_inquiries`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        inquiry_type: v.inquiryType,
        source_page: v.sourcePage,
        name: v.name,
        email: v.email,
        org_name: v.orgName,
        website: v.website,
        audience_size: v.audienceSize,
        group_size: v.groupSize,
        message: v.message,
      }),
    });
    if (!insertRes.ok) {
      const errorText = await insertRes.text().catch(() => "");
      console.error("Partner inquiry insert failed:", insertRes.status, errorText);
      return new Response(JSON.stringify({ error: "Could not save your inquiry. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const inserted = await insertRes.json().catch(() => null);
    const record = Array.isArray(inserted) ? inserted[0] : inserted;
    const id = record?.id ?? "unknown";
    const createdAt = record?.created_at ?? new Date().toISOString();

    // STEP 1b — investor inquiries auto-create a founder follow-up (best-effort)
    if (v.inquiryType === "investor") {
      await addInvestorFollowUp(v);
    }

    // STEP 2 — BEST-EFFORT MIRROR to hello@
    const email = buildEmail(v, id, createdAt);
    await sendEmail({ subject: email.subject, html: email.html, replyTo: v.email });

    return new Response(JSON.stringify({ success: true, id, inquiryType: v.inquiryType }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("submit-partner-inquiry error:", message);
    return new Response(JSON.stringify({ error: "Unexpected error. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
