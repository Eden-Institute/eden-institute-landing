// ───────────────────────────────────────────────────────────────────────────
// ONE-TIME operational broadcast — Founders-Pricing freebie apology (2026-06).
//
// Audience: people who clicked "Reserve Founders Pricing" on /homeschool
// (waitlist_signups.entry_funnel='edens_table' AND source='reserve') but who,
// per analysis, never downloaded a free sample — many of them meant to grab the
// freebie and tapped the Reserve button by mistake. This email apologises for
// the confusion and hands them the free Week-1 sample downloads directly.
//
// Safe to DELETE after the send. Idempotent via public.email_oneoff_log.
// Invoke with POST { "guard": "<GUARD>", "dryRun": true|false, "limit"?: n }.
// Respects per-list (homeschool) opt-out and global unsubscribes.
// ───────────────────────────────────────────────────────────────────────────
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CAMPAIGN = "founders_freebie_2026_06";
const GUARD = "EDEN-FOUNDERS-FREEBIE-7Q2X9";
const FROM = "Camila at The Eden Institute <hello@edeninstitute.health>";
const REPLY_TO = "hello@edeninstitute.health";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

// ── Per-list unsubscribe (mirrors _shared/email-unsubscribe.ts token format so
// the existing public `unsubscribe` function verifies these links) ──
function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function hmac(message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SERVICE_ROLE),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return new Uint8Array(sig);
}
async function unsubUrl(email: string): Promise<string> {
  const payload = JSON.stringify({ e: email.trim().toLowerCase(), l: "homeschool" });
  const token = `${b64url(new TextEncoder().encode(payload))}.${b64url(await hmac(payload))}`;
  return `${SUPABASE_URL}/functions/v1/unsubscribe?token=${encodeURIComponent(token)}`;
}

// ── Brand email helpers ──
function ctaButton(label: string, href: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:6px 0;">
<a href="${href}" target="_blank" style="display:inline-block;background-color:#1C3A2E;color:#F5F0E8;font-family:Georgia,serif;font-size:14px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;text-decoration:none;padding:14px 28px;">${label}</a>
</td></tr></table>`;
}
function goldLabel(text: string): string {
  return `<p style="font-family:Georgia,serif;font-size:12px;font-weight:bold;letter-spacing:3px;color:#C9A84C;text-transform:uppercase;margin:0 0 12px 0;">${text}</p>`;
}
function goldDivider(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:20px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #C9A84C;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr></table>`;
}
function para(text: string): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 16px 0;">${text}</p>`;
}
const PDF = (slug: string) => `https://edeninstitute.health/lead-magnets/${slug}`;

function buildEmail(firstName: string): { subject: string; html: string } {
  const name = firstName && firstName.trim() ? firstName.trim() : "there";
  const body = `
<p style="font-family:Georgia,serif;font-size:18px;color:#1C3A2E;margin:0 0 24px 0;">Hi ${name},</p>
${para("When you reserved Founders pricing for Eden's Table, you raised your hand for this curriculum &mdash; thank you. Your reservation is safe, and your Founders Code is still coming to you before launch.")}
${para("We also want to make something right. A lot of families came to that page hoping to download our <strong>free sample weeks</strong> first &mdash; and the &ldquo;Reserve Founders Pricing&rdquo; button sat right at the top, easy to tap by mistake. If the free curriculum is what you were really after, here it is, no strings attached.")}
${goldDivider()}
${goldLabel("Sprouts (K-2) &mdash; Week 1 (Lavender)")}
${ctaButton("Teacher's Guide", PDF("hs-sprouts-w1-tg-lavender.pdf"))}
${ctaButton("Student Notebook", PDF("hs-sprouts-w1-nb-lavender.pdf"))}
${ctaButton("Field Cards", PDF("hs-sprouts-w1-fc-lavender.pdf"))}
${ctaButton("Recipe Cards", PDF("hs-sprouts-w1-rc-lavender.pdf"))}
${ctaButton("Around the Table Cards", PDF("hs-sprouts-w1-att-lavender.pdf"))}
${goldDivider()}
${goldLabel("Seedlings (3-5) &mdash; Week 1 (Elderberry)")}
${ctaButton("Teacher's Guide", PDF("hs-seedlings-w1-tg-elderberry.pdf"))}
${ctaButton("Student Notebook", PDF("hs-seedlings-w1-nb-elderberry.pdf"))}
${ctaButton("Field Cards", PDF("hs-seedlings-w1-fc-elderberry.pdf"))}
${ctaButton("Recipe Cards", PDF("hs-seedlings-w1-rc-elderberry.pdf"))}
${ctaButton("Around the Table Cards", PDF("hs-seedlings-w1-att-elderberry.pdf"))}
${goldDivider()}
${para("Print them, teach them, and see whether Eden's Table belongs in your home. Want the next week too? Grab any sample at <a href=\"https://edeninstitute.health/homeschool#early-access\" style=\"color:#5C7A5C;\">edeninstitute.health/homeschool</a> and Week 2 follows by email. Your Founders pricing stays locked in either way.")}
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:24px 0 4px 0;">Grace and health,</p>
<p style="font-family:Georgia,serif;font-size:16px;color:#1C3A2E;font-weight:bold;margin:0;">Camila</p>
<p style="font-family:Georgia,serif;font-size:14px;color:#C9A84C;margin:4px 0 0 0;">The Eden Institute</p>`;

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>The Eden Institute</title></head>
<body style="margin:0;padding:0;background-color:#F5F0E8;font-family:Georgia,serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F0E8;"><tr><td align="center" style="padding:20px 10px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#FFFFFF;">
<tr><td style="background-color:#1C3A2E;padding:36px 20px;text-align:center;">
<p style="margin:0;font-family:Georgia,serif;font-size:13px;font-weight:bold;letter-spacing:4px;color:#C9A84C;text-transform:uppercase;">THE EDEN INSTITUTE</p>
<p style="margin:14px 0 0 0;font-family:Georgia,serif;font-size:14px;color:#F5F0E8;font-style:italic;">Back to Eden. Back to Truth.</p>
</td></tr>
<tr><td style="background-color:#FFFFFF;padding:32px 40px;">${body}</td></tr>
<tr><td style="background-color:#F5F0E8;padding:24px 20px;text-align:center;">
<p style="font-family:Georgia,serif;font-size:13px;color:#1C3A2E;margin:0 0 8px 0;">The Eden Institute | edeninstitute.health</p>
<p style="font-family:Georgia,serif;font-size:11px;color:#6B6560;margin:0 0 6px 0;">You're receiving this because you reserved Founders pricing for Eden's Table at edeninstitute.health.</p>
<a href="{{UNSUB_URL}}" style="font-family:Georgia,serif;font-size:11px;color:#6B6560;text-decoration:underline;">Unsubscribe from homeschool emails</a>
</td></tr>
</table></td></tr></table></body></html>`;

  return { subject: "Your free Eden's Table sample weeks (in case you missed them)", html };
}

// ── Supabase REST helper ──
async function rest(path: string): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" },
  });
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { guard, dryRun = true, limit } = await req.json().catch(() => ({}));
    if (guard !== GUARD) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. Founders-pricing reservers, not globally unsubscribed
    const reservers: { email: string; first_name: string | null }[] = await rest(
      "waitlist_signups?entry_funnel=eq.edens_table&source=eq.reserve&unsubscribed_at=is.null&select=email,first_name",
    );
    // 2. Per-list (homeschool) opt-outs
    const optouts: { email: string }[] = await rest("email_list_unsubscribes?list=eq.homeschool&select=email");
    const optoutSet = new Set(optouts.map((o) => o.email.toLowerCase()));
    // 3. Already sent this campaign
    const already: { email: string }[] = await rest(`email_oneoff_log?campaign=eq.${CAMPAIGN}&select=email`);
    const alreadySet = new Set(already.map((a) => a.email.toLowerCase()));

    // Dedupe by lowercased email, prefer a non-empty first_name
    const byEmail = new Map<string, string | null>();
    for (const r of reservers) {
      if (!r.email) continue;
      const key = r.email.trim().toLowerCase();
      if (optoutSet.has(key) || alreadySet.has(key)) continue;
      const existing = byEmail.get(key);
      if (existing === undefined || (!existing && r.first_name)) byEmail.set(key, r.first_name ?? null);
    }
    let recipients = [...byEmail.entries()].map(([email, first_name]) => ({ email, first_name }));
    if (typeof limit === "number" && limit > 0) recipients = recipients.slice(0, limit);

    if (dryRun) {
      return new Response(
        JSON.stringify({
          dryRun: true,
          campaign: CAMPAIGN,
          eligible: recipients.length,
          sampleSubject: buildEmail("Friend").subject,
          sampleRecipients: recipients.slice(0, 8).map((r) => r.email),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let sent = 0;
    const failures: { email: string; error: string }[] = [];
    for (const r of recipients) {
      try {
        const { subject, html } = buildEmail(r.first_name ?? "");
        const url = await unsubUrl(r.email);
        const finalHtml = html.split("{{UNSUB_URL}}").join(url);
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: FROM,
            reply_to: REPLY_TO,
            to: [r.email],
            subject,
            html: finalHtml,
            headers: { "List-Unsubscribe": `<${url}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(data)}`);
        await fetch(`${SUPABASE_URL}/rest/v1/email_oneoff_log`, {
          method: "POST",
          headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates" },
          body: JSON.stringify({ campaign: CAMPAIGN, email: r.email, status: "sent" }),
        });
        sent++;
        await new Promise((res2) => setTimeout(res2, 250));
      } catch (e) {
        failures.push({ email: r.email, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return new Response(JSON.stringify({ dryRun: false, campaign: CAMPAIGN, sent, failed: failures.length, failures }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
