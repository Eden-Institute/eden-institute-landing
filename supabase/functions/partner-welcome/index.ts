// Partner welcome email — founding-partner gifting flow (2026-07).
//
// Sends the one-to-one welcome email to a vetted founding partner with the
// digital sample attached. COPY (founder decisions 2026-09-24): the sample is
// THREE WEEKS OF EACH BAND, Sprouts (K-2) weeks 1-3 + Seedlings (grades 3-5)
// weeks 1-3, "so they can compare", with no card decks; the at-cost printed set
// is never advertised here (Camila offers it by hand only); no kit, preorder or
// kit-credit wording anywhere. Matches Templates PKG-01 in the Outreach Bible.
//
// Admin-only: every request must carry the
// FOUNDERS_ADMIN_TOKEN in `x-partner-admin`. One recipient per call, by design —
// this is personal correspondence, not a blast.
//
// Request (POST JSON):
//   { action: "testsend" }                                  → sends to hello@ with [TEST] subject
//   { action: "send", to, first_name }                      → sends to one partner
//
// SAMPLE DELIVERY: six DOWNLOAD BUTTONS (three per band), matching the lead-magnet emails
// (founder preference 2026-07-22) rather than one large attachment. Each
// component lives in the PRIVATE partner-assets bucket under sample/, and this
// function mints a fresh 1-year signed URL per component at send time. Private
// + signed keeps the files off public URLs, which is the point given the
// do-not-share line in the copy. To swap a component: upload over the same
// Storage path (x-upsert) — no redeploy, and future sends sign the new file.
//
// 🔴 SAMPLE_BANDS points at the NEW 3+3 files (paths supplied by the sample
// build, 2026-09-24). Do NOT deploy until all six are uploaded to partner-assets
// and each one signs and downloads, or every button in the email 404s.
//
// The old `partner_link` P.S. (a private at-cost kit Payment Link) was REMOVED
// 2026-09-24: no kit, and the at-cost offer is never advertised. The field is
// now ignored if a caller still sends it.

import { applyUnsub } from '../_shared/email-unsubscribe.ts';
import { escapeHtml } from '../_shared/html-escape.ts';
import { timingSafeEqual } from '../_shared/timing-safe-equal.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const ADMIN_TOKEN = Deno.env.get('FOUNDERS_ADMIN_TOKEN') ?? '';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SAMPLE_BUCKET = 'partner-assets';
const SIGNED_URL_TTL_SECONDS = 31536000; // 1 year, so a link never dies mid-review
// Band -> button label -> Storage object path. Three weeks of each band
// (founder 2026-09-24), no card decks. Order within a band is the reading order
// of a week, matching /partner-sample's {sprouts,seedlings}-{read-aloud,
// teachers-guide,student-notebook} slugs.
const SAMPLE_BANDS: Array<{ band: string; components: Array<{ label: string; path: string }> }> = [
  {
    band: 'Sprouts, K-2',
    components: [
      { label: 'SPROUTS K-2 READ-ALOUD', path: 'sample/edens-table-sample-sprouts-3wk-read-aloud.pdf' },
      { label: "SPROUTS K-2 TEACHER'S GUIDE", path: 'sample/edens-table-sample-sprouts-3wk-teachers-guide.pdf' },
      { label: 'SPROUTS K-2 STUDENT NOTEBOOK', path: 'sample/edens-table-sample-sprouts-3wk-student-notebook.pdf' },
    ],
  },
  {
    band: 'Seedlings, grades 3-5',
    components: [
      { label: 'SEEDLINGS 3-5 READ-ALOUD', path: 'sample/edens-table-sample-seedlings-3wk-read-aloud.pdf' },
      { label: "SEEDLINGS 3-5 TEACHER'S GUIDE", path: 'sample/edens-table-sample-seedlings-3wk-teachers-guide.pdf' },
      { label: 'SEEDLINGS 3-5 STUDENT NOTEBOOK', path: 'sample/edens-table-sample-seedlings-3wk-student-notebook.pdf' },
    ],
  },
];
const TEST_RECIPIENT = 'hello@edeninstitute.health';
const FROM = 'Camila at The Eden Institute <hello@edeninstitute.health>';
const REPLY_TO = 'hello@edeninstitute.health';
const SUBJECT = 'A gift, and an invitation to build this with us \u{1F33F}';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-partner-admin',
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function para(text: string): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 16px 0;">${text}</p>`;
}

// OUTLINED buttons, deliberately background-independent.
// Gmail's COMPOSE editor strips `background-color` from pasted HTML but keeps
// `color` and `border`. A solid-fill button therefore renders as invisible
// cream-on-white in a Gmail draft (caught 2026-07-22 before a partner send).
// Dark text + a border reads correctly in a draft AND in a sent email, and it
// is the lighter look the founder chose. Do not reintroduce background-color
// as the only thing carrying contrast.
function ctaButton(label: string, url: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:7px 0;">
<a href="${url}" target="_blank" style="display:inline-block;border:2px solid #1C3A2E;color:#1C3A2E;font-family:Georgia,serif;font-size:14px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;text-decoration:none;padding:14px 30px;">${label}</a>
</td></tr></table>`;
}

function rule(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #C9A84C;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr></table>`;
}

function sectionLabel(text: string): string {
  return `<p style="font-family:Georgia,serif;font-size:12px;font-weight:bold;letter-spacing:3px;color:#8A6D1F;text-transform:uppercase;margin:0 0 18px 0;">${text}</p>`;
}

/** Mint a fresh signed URL for one private Storage object. */
async function signedUrl(path: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${SAMPLE_BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS }),
  });
  if (!res.ok) {
    throw new Error(`signing ${path} failed: ${res.status} ${await res.text().catch(() => '')}`);
  }
  const { signedURL } = await res.json() as { signedURL: string };
  return `${SUPABASE_URL}/storage/v1${signedURL}`;
}

async function buildDownloadButtons(): Promise<string> {
  const groups = await Promise.all(
    SAMPLE_BANDS.map(async (b) => {
      const buttons = await Promise.all(
        b.components.map(async (c) => ctaButton(c.label, await signedUrl(c.path))),
      );
      return [sectionLabel(b.band), ...buttons].join('\n');
    }),
  );
  return groups.join('\n');
}

function buildPartnerWelcomeHtml(firstName: string, downloadButtons: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>The Eden Institute</title></head>
<body style="margin:0;padding:0;background-color:#F5F0E8;font-family:Georgia,serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F0E8;">
<tr><td align="center" style="padding:20px 10px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#FFFFFF;">
<tr><td style="padding:40px 20px 32px 20px;text-align:center;border-top:3px solid #1C3A2E;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="text-align:center;font-family:Georgia,serif;font-size:13px;font-weight:bold;letter-spacing:4px;color:#8A6D1F;text-transform:uppercase;">THE EDEN INSTITUTE</td></tr>
<tr><td align="center" style="padding:16px 0;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="width:60px;border-top:1px solid #C9A84C;font-size:0;line-height:0;">&nbsp;</td></tr></table>
</td></tr>
<tr><td style="text-align:center;font-family:Georgia,serif;font-size:14px;color:#4A5D4E;font-style:italic;">Back to Eden. Back to Truth.</td></tr>
</table>
</td></tr>
<tr><td style="background-color:#FFFFFF;padding:32px 40px;">
<p style="font-family:Georgia,serif;font-size:18px;color:#1C3A2E;margin:0 0 24px 0;">Hi ${escapeHtml(firstName)},</p>
${para(`Thank you for saying yes. It means more than you know. Below is a digital sample of Eden's Table, our Scripture-rooted herbalism curriculum for children: three weeks of each of our two bands, Sprouts for K-2 and Seedlings for grades 3 to 5, so you can compare them, try it with your family at your own pace and share your honest thoughts, good or bad.`)}
${rule()}
${sectionLabel('Your sample, three weeks of each band')}
${downloadButtons}
${rule()}
${para(`Each band is a complete 36-week school year with its own 36 plants, a new herb on the table each week.`)}
${para(`A little honesty about where we are: both years, Sprouts and Seedlings, are finished and in print now, and we are only just getting started. That is exactly why partners like you matter so much. You are not a name on a list, you are one of the very first people helping us build this, and I will not forget it.`)}
${para(`For now, take your time with the sample. If it resonates, an honest word to your community whenever it feels natural is the greatest gift you could give us, and a simple &quot;gifted&quot; note keeps everything above board.`)}
${para(`And when you do share, tag us so we can cheer you on and send people your way: <a href="https://www.instagram.com/edenstablehomeschoolcurriculum/" style="color:#1C3A2E;">@edenstablehomeschoolcurriculum</a> on Instagram and <a href="https://www.facebook.com/EdensTableHomeschoolCurriculum/" style="color:#1C3A2E;">Eden's Table Homeschool Curriculum</a> on Facebook.`)}
${para(`One small note as you explore: these sample files are for your family, so please keep them within your own family rather than sharing or forwarding them. Thank you for guarding that with us.`)}
${para(`Grateful for you.`)}
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:24px 0 0 0;">In Him,</p>
<p style="font-family:Georgia,serif;font-size:16px;color:#1C3A2E;font-weight:bold;margin:0;">Camila Johnson</p>
<p style="font-family:Georgia,serif;font-size:14px;color:#C9A84C;margin:4px 0 16px 0;">Founder and Executive Director, The Eden Institute</p>
</td></tr>
<tr><td style="background-color:#F5F0E8;padding:30px 20px;text-align:center;border-top:1px solid #C9A84C;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-family:Georgia,serif;font-size:13px;color:#1C3A2E;text-align:center;">The Eden Institute | edeninstitute.health</td></tr>
<tr><td style="font-family:Georgia,serif;font-size:12px;color:#1C3A2E;text-align:center;padding-top:8px;">You're receiving this because we invited you to partner with Eden's Table.</td></tr>
<tr><td style="font-family:Georgia,serif;font-size:11px;color:#1C3A2E;text-align:center;padding-top:8px;">Rooted in Faith Ventures LLC &middot; 303 Holly Cir, Unit 3262, Clarksville, TN 37043</td></tr>
<tr><td style="text-align:center;padding-top:8px;"><a href="{{UNSUB_URL}}" style="font-family:Georgia,serif;font-size:12px;color:#6B6560;text-decoration:underline;">Unsubscribe</a></td></tr>
</table>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'POST only' });
  }
  if (!ADMIN_TOKEN || !timingSafeEqual(req.headers.get('x-partner-admin') ?? '', ADMIN_TOKEN)) {
    return json(401, { error: 'Unauthorized' });
  }
  if (!RESEND_API_KEY) {
    return json(500, { error: 'RESEND_API_KEY not configured' });
  }

  try {
    const body = await req.json();
    const action = body.action;
    if (action !== 'testsend' && action !== 'send') {
      return json(400, { error: "action must be 'testsend' or 'send'" });
    }

    let to: string;
    let firstName: string;
    if (action === 'testsend') {
      to = typeof body.to === 'string' && body.to ? body.to : TEST_RECIPIENT;
      firstName = typeof body.first_name === 'string' && body.first_name ? body.first_name : 'Camila';
    } else {
      if (typeof body.to !== 'string' || !body.to.includes('@')) {
        return json(400, { error: "'to' (single email) is required for send" });
      }
      if (typeof body.first_name !== 'string' || !body.first_name.trim()) {
        return json(400, { error: "'first_name' is required for send" });
      }
      to = body.to.trim();
      firstName = body.first_name.trim();
    }
    const downloadButtons = await buildDownloadButtons();
    const html = buildPartnerWelcomeHtml(firstName, downloadButtons);
    const { html: finalHtml, headers: unsubHeaders } = await applyUnsub(html, to, 'homeschool');

    const payload = {
      from: FROM,
      reply_to: REPLY_TO,
      to: [to],
      subject: action === 'testsend' ? `[TEST] ${SUBJECT}` : SUBJECT,
      html: finalHtml,
      headers: unsubHeaders,
      // Resend tags -> resend-webhook -> public.email_events.campaign / .email_key.
      // Without these, partner sends land in email_events with NULL email_key, which
      // makes them invisible to founder_email_engagement (it filters `email_key is not
      // null`). Untagged partner mail was therefore missing from the Emails tab
      // entirely, and only reachable by matching on the raw recipient address.
      // Resend restricts tag values to ASCII letters, numbers, underscore and dash.
      tags: [
        { name: 'campaign', value: 'partner_program' },
        { name: 'email_key', value: action === 'testsend' ? 'partner_welcome_test' : 'partner_welcome' },
      ],
    };

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('partner-welcome send failed:', res.status, JSON.stringify(data));
      return json(502, { error: 'Resend send failed', detail: data });
    }

    console.log(`partner-welcome ${action} sent to ${to} (resend id ${data?.id ?? 'unknown'})`);
    return json(200, { ok: true, action, to, resend_id: data?.id ?? null });
  } catch (err) {
    console.error('partner-welcome error:', String(err));
    return json(500, { error: 'Internal error', detail: String(err) });
  }
});
