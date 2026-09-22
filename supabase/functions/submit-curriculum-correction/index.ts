// submit-curriculum-correction — durable capture for corrections reported by
// families from /homeschool/updates. public.curriculum_corrections is the source
// of truth; the email to hello@ is best-effort enrichment and never blocks
// success. Mirrors submit-partner-inquiry, which mirrors submit-feedback (Lock #15).
//
// verify_jwt is OFF intentionally: called from an anonymous marketing page.
//
// Not routed through submit-feedback on purpose: that rail's areas are Apothecary
// app surfaces and its notification is branded "Eden Apothecary Feedback".

import { bumpRateBucket, clientIp } from "../_shared/rate-bucket.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const CORRECTION_TO = "hello@edeninstitute.health";
const CORRECTION_FROM = "Eden's Table Corrections <hello@edeninstitute.health>";

// Each accepted POST emails hello@, so an unthrottled endpoint is an inbox flood.
// Own bucket, not the checkout one.
const CORRECTIONS_PER_WINDOW = 5;
const CORRECTION_WINDOW_SECONDS = 600;

const BAND_LABELS: Record<string, string> = {
  sprouts: "Sprouts (Grades K-2)",
  seedlings: "Seedlings (Grades 3-5)",
};

const BOOK_LABELS: Record<string, string> = {
  tg: "Teacher's Guide",
  nb: "Student Notebook",
  ra: "Read-Aloud Storybook",
};

// Page structure verified against the Lulu print files on 2026-09-22: the TG runs
// Week at a Glance then Monday to Friday, the NB runs Monday to Friday then My
// Wonder Pages, and the Read-Aloud is reported by page number.
const LOCATION_LABELS: Record<string, string> = {
  wag: "Week at a Glance",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  wonder: "My Wonder Pages",
  page: "Page number",
  front: "Front of the book",
  back: "Back of the book",
  cover: "Cover",
  other: "Somewhere else",
};

// Which locations each book can legitimately report, so a Notebook report cannot
// arrive claiming a Week at a Glance page that book does not have.
const BOOK_LOCATIONS: Record<string, string[]> = {
  tg: ["wag", "mon", "tue", "wed", "thu", "fri", "front", "back", "cover", "other"],
  nb: ["mon", "tue", "wed", "thu", "fri", "wonder", "front", "back", "cover", "other"],
  ra: ["page", "front", "back", "cover", "other"],
};

interface Parsed {
  band: string;
  book: string;
  week: number | null;
  location: string;
  pageNumber: number | null;
  description: string;
  reporterName: string | null;
  reporterEmail: string | null;
  pageUrl: string | null;
  userAgent: string | null;
}

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

function validate(input: unknown): { ok: true; value: Parsed } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "Invalid request body" };
  const o = input as Record<string, unknown>;

  const band = typeof o.band === "string" ? o.band.trim().toLowerCase() : "";
  if (!BAND_LABELS[band]) return { ok: false, error: "Please choose which level the book is from" };

  const book = typeof o.book === "string" ? o.book.trim().toLowerCase() : "";
  if (!BOOK_LABELS[book]) return { ok: false, error: "Please choose which book it is" };

  const location = typeof o.location === "string" ? o.location.trim().toLowerCase() : "";
  if (!LOCATION_LABELS[location]) return { ok: false, error: "Please choose where in the book it is" };
  if (!BOOK_LOCATIONS[book].includes(location)) {
    return { ok: false, error: `That page choice does not belong to the ${BOOK_LABELS[book]}` };
  }

  // A week is required for the in-week pages and meaningless for the rest.
  const inWeek = ["wag", "mon", "tue", "wed", "thu", "fri", "wonder"].includes(location);
  let week: number | null = null;
  if (o.week !== undefined && o.week !== null && o.week !== "") {
    const n = Number(o.week);
    if (!Number.isFinite(n) || n < 1 || n > 36) return { ok: false, error: "Week must be between 1 and 36" };
    week = Math.round(n);
  }
  if (inWeek && week === null) return { ok: false, error: "Please choose the week" };
  if (!inWeek) week = null;

  let pageNumber: number | null = null;
  if (o.pageNumber !== undefined && o.pageNumber !== null && o.pageNumber !== "") {
    const n = Number(o.pageNumber);
    if (!Number.isFinite(n) || n < 1 || n > 999) return { ok: false, error: "Page number must be between 1 and 999" };
    pageNumber = Math.round(n);
  }
  if (location === "page" && pageNumber === null) return { ok: false, error: "Please give the page number" };

  const description = str(o.description, 5000);
  if (!description) return { ok: false, error: "Please tell us what looks wrong" };
  if (description.length < 10) return { ok: false, error: "Please add a little more detail so we can find it" };

  let reporterEmail: string | null = null;
  const rawEmail = typeof o.reporterEmail === "string" ? o.reporterEmail.trim().toLowerCase() : "";
  if (rawEmail) {
    if (rawEmail.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      return { ok: false, error: "Please enter a valid email address, or leave it blank" };
    }
    reporterEmail = rawEmail;
  }

  return {
    ok: true,
    value: {
      band,
      book,
      week,
      location,
      pageNumber,
      description,
      reporterName: str(o.reporterName, 200),
      reporterEmail,
      pageUrl: str(o.pageUrl, 500),
      userAgent: str(o.userAgent, 500),
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

/** "Week 12 · Thursday" / "Page 47" / "Back of the book" */
function whereLabel(v: Parsed): string {
  if (v.location === "page") return `Page ${v.pageNumber}`;
  const loc = LOCATION_LABELS[v.location];
  if (v.week !== null) return `Week ${v.week} · ${loc}`;
  return v.pageNumber !== null ? `${loc} (page ${v.pageNumber})` : loc;
}

function buildEmail(v: Parsed, id: string, createdAt: string): { subject: string; html: string } {
  const subject = `[Correction] ${BAND_LABELS[v.band]} ${BOOK_LABELS[v.book]} — ${whereLabel(v)}`;
  const descHtml = escapeHtml(v.description).replace(/\n/g, "<br>");
  const html = `<!DOCTYPE html>
<html><body style="font-family:Georgia,serif;background:#F5F0E8;padding:24px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #E8E3DA;">
    <tr><td style="background:#2C3E2D;color:#fff;padding:20px 24px;">
      <p style="margin:0;font-size:13px;letter-spacing:3px;color:#C5A44E;text-transform:uppercase;font-weight:bold;">EDEN'S TABLE</p>
      <p style="margin:6px 0 0 0;font-size:18px;">A family reported a correction</p>
    </td></tr>
    <tr><td style="padding:24px;">
      <table role="presentation" width="100%" style="font-size:13px;color:#3D3832;">
        ${row("Level", BAND_LABELS[v.band])}
        ${row("Book", BOOK_LABELS[v.book])}
        ${row("Where", whereLabel(v))}
        ${row("Name", v.reporterName)}
        ${row("Email", v.reporterEmail)}
        ${row("Submitted", createdAt)}
        ${row("Report ID", id)}
      </table>
      <p style="font-size:13px;color:#6B6560;margin:20px 0 4px 0;text-transform:uppercase;letter-spacing:1px;">What they are seeing</p>
      <div style="font-size:15px;color:#3D3832;line-height:1.6;background:#F5F0E8;border-left:3px solid #C5A44E;padding:16px 20px;">${descHtml}</div>
      <p style="font-size:12px;color:#6B6560;margin:20px 0 0 0;">Nothing is published from this report until you mark it published.</p>
    </td></tr>
  </table>
</body></html>`;
  return { subject, html };
}

async function sendEmail(args: { subject: string; html: string; replyTo: string | null }): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY missing — skipping email mirror");
    return;
  }
  try {
    const payload: Record<string, unknown> = {
      from: CORRECTION_FROM,
      to: [CORRECTION_TO],
      subject: args.subject,
      html: args.html,
    };
    if (args.replyTo) payload.reply_to = args.replyTo;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error("Correction email send failed:", res.status, JSON.stringify(data));
    }
  } catch (err) {
    console.error("Correction email send error:", err instanceof Error ? err.message : String(err));
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

    // Fails open: no IP or a limiter error (null) lets the report through.
    const ip = clientIp(req);
    if (ip) {
      const count = await bumpRateBucket({
        supabaseUrl: SUPABASE_URL,
        serviceKey: SUPABASE_SERVICE_ROLE_KEY,
        key: `correction_ip:${ip}`,
        windowSeconds: CORRECTION_WINDOW_SECONDS,
      });
      if (count !== null && count > CORRECTIONS_PER_WINDOW) {
        // Wording approved by the founder 2026-09-15 (same line on every public form).
        return new Response(JSON.stringify({ error: "We have received several forms from you in the last few minutes. Please wait a few minutes and try again, or email us at hello@edeninstitute.health.", code: "RATE_LIMITED" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // STEP 1 — DURABLE WRITE (source of truth, must succeed)
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/curriculum_corrections`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        band: v.band,
        book: v.book,
        week: v.week,
        location: v.location,
        page_number: v.pageNumber,
        description: v.description,
        reporter_name: v.reporterName,
        reporter_email: v.reporterEmail,
        page_url: v.pageUrl,
        user_agent: v.userAgent,
      }),
    });
    if (!insertRes.ok) {
      const errorText = await insertRes.text().catch(() => "");
      console.error("Correction insert failed:", insertRes.status, errorText);
      return new Response(JSON.stringify({ error: "Could not save your report. Please try again, or email hello@edeninstitute.health." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const inserted = await insertRes.json().catch(() => null);
    const record = Array.isArray(inserted) ? inserted[0] : inserted;
    const id = record?.id ?? "unknown";
    const createdAt = record?.created_at ?? new Date().toISOString();

    // STEP 2 — BEST-EFFORT MIRROR to hello@
    const email = buildEmail(v, id, createdAt);
    await sendEmail({ subject: email.subject, html: email.html, replyTo: v.reporterEmail });

    return new Response(JSON.stringify({ success: true, id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("submit-curriculum-correction error:", message);
    return new Response(JSON.stringify({ error: "Unexpected error. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
