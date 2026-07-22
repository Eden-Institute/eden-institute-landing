// Partner welcome email — founding-partner gifting flow (2026-07).
//
// Sends the one-to-one welcome email to a vetted founding partner with the
// six-week digital sample attached. Admin-only: every request must carry the
// FOUNDERS_ADMIN_TOKEN in `x-partner-admin`. One recipient per call, by design —
// this is personal correspondence, not a blast.
//
// Request (POST JSON):
//   { action: "testsend" }                                  → sends to hello@ with [TEST] subject
//   { action: "send", to, first_name, partner_link? }       → sends to one partner
//
// ATTACHMENT SLOT: private Storage object partner-assets/edens-table-6-week-sample.pdf
// — the compressed email edition of the 6-week sample (from Canva folder
// FAHQJC-JvlU, merged TG → Read-Aloud → Notebook → Field → Recipe → ATT,
// rasterized to fit under recipient inbound limits). To swap the sample:
// upload the new file to the same Storage path (x-upsert). NO redeploy needed.
// (Bundling the PDF as a static_files asset 413'd the deploy at 12.4 MB.)
//
// PARTNER LINK SLOT: `partner_link` renders a P.S. with the partner's private
// at-cost Stripe Payment Link. Held out of the welcome send until fulfillment
// (founder decision 2026-07-22) — omit the field and no P.S. renders.

import { applyUnsub } from '../_shared/email-unsubscribe.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const ADMIN_TOKEN = Deno.env.get('FOUNDERS_ADMIN_TOKEN') ?? '';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SAMPLE_PDF_STORAGE_PATH = 'partner-assets/edens-table-6-week-sample.pdf';
const SAMPLE_PDF_FILENAME = 'Edens_Table_Sprouts_6_Week_Sample.pdf';
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

function buildPartnerWelcomeHtml(firstName: string, partnerLink?: string): string {
  const psBlock = partnerLink
    ? para(
        `P.S. Your private at-cost kit link is ready when you are: <a href="${partnerLink}" style="color:#1C3A2E;">${partnerLink}</a>. It is yours alone and covers one kit plus actual shipping.`,
      )
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>The Eden Institute</title></head>
<body style="margin:0;padding:0;background-color:#F5F0E8;font-family:Georgia,serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F0E8;">
<tr><td align="center" style="padding:20px 10px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#FFFFFF;">
<tr><td style="background-color:#1C3A2E;padding:40px 20px;text-align:center;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="text-align:center;font-family:Georgia,serif;font-size:13px;font-weight:bold;letter-spacing:4px;color:#C9A84C;text-transform:uppercase;">THE EDEN INSTITUTE</td></tr>
<tr><td align="center" style="padding:16px 0;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="width:60px;border-top:1px solid #C9A84C;font-size:0;line-height:0;">&nbsp;</td></tr></table>
</td></tr>
<tr><td style="text-align:center;font-family:Georgia,serif;font-size:14px;color:#F5F0E8;font-style:italic;">Back to Eden. Back to Truth.</td></tr>
</table>
</td></tr>
<tr><td style="background-color:#FFFFFF;padding:32px 40px;">
<p style="font-family:Georgia,serif;font-size:18px;color:#1C3A2E;margin:0 0 24px 0;">Hi ${firstName},</p>
${para(`Thank you for saying yes. It means more than you know. Attached is a six-week digital sample of Eden's Table, our Scripture-rooted herbalism curriculum for children, so you and your family can try it at your own pace and share your honest thoughts, good or bad.`)}
${para(`This sample covers six weeks. The full kits carry a family through a complete 36-week school year, with a new herb on the table each week.`)}
${para(`A little honesty about where we are: we are pre-fulfillment right now and taking preorders, so we are still bringing the full physical kits to life. That is exactly why partners like you matter so much. You are not a name on a list, you are one of the very first people helping us build this, and I will not forget it.`)}
${para(`Here is my promise. Once our kits are in hand, if you love what you see, I would love to send you a full kit at our cost, simply what it takes to make it, as a thank-you for being one of our founding partners. And as the Lord grows this, we will keep finding ways to thank the people who believed in it early. Founder perks, for real.`)}
${para(`For now, take your time with the sample. If it resonates, an honest word to your community whenever it feels natural is the greatest gift you could give us, and a simple &quot;gifted&quot; note keeps everything above board.`)}
${para(`And when you do share, tag us so we can cheer you on and send people your way: <a href="https://www.instagram.com/the_eden_institute/" style="color:#1C3A2E;">@the_eden_institute</a> on Instagram and <a href="https://www.facebook.com/TheEdenInstituteBiblicalHerbalism/" style="color:#1C3A2E;">The Eden Institute Biblical Herbalism</a> on Facebook.`)}
${para(`One small note as you explore: these are digital files of a curriculum that will only ever exist in print, so please keep them within your own family rather than sharing or forwarding them. Thank you for guarding that with us.`)}
${para(`Grateful for you.`)}
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:24px 0 0 0;">In Him,</p>
<p style="font-family:Georgia,serif;font-size:16px;color:#1C3A2E;font-weight:bold;margin:0;">Camila Johnson</p>
<p style="font-family:Georgia,serif;font-size:14px;color:#C9A84C;margin:4px 0 16px 0;">Founder and Executive Director, The Eden Institute</p>
${psBlock}
</td></tr>
<tr><td style="background-color:#F5F0E8;padding:30px 20px;text-align:center;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-family:Georgia,serif;font-size:13px;color:#1C3A2E;text-align:center;">The Eden Institute | edeninstitute.health</td></tr>
<tr><td style="font-family:Georgia,serif;font-size:12px;color:#1C3A2E;text-align:center;padding-top:8px;">You're receiving this because we invited you to partner with Eden's Table.</td></tr>
<tr><td style="font-family:Georgia,serif;font-size:11px;color:#1C3A2E;text-align:center;padding-top:8px;">Rooted in Faith Ventures LLC &middot; 303 Holly Cir, Unit 3262, Clarksville, TN 37043</td></tr>
<tr><td style="text-align:center;padding-top:8px;"><a href="{{UNSUB_URL}}" style="font-family:Georgia,serif;font-size:12px;color:#C9A84C;text-decoration:underline;">Unsubscribe</a></td></tr>
</table>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

async function samplePdfBase64(): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${SAMPLE_PDF_STORAGE_PATH}`, {
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY },
  });
  if (!res.ok) {
    throw new Error(`sample PDF fetch failed: ${res.status} ${await res.text().catch(() => '')}`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'POST only' });
  }
  if (!ADMIN_TOKEN || req.headers.get('x-partner-admin') !== ADMIN_TOKEN) {
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
    const partnerLink = typeof body.partner_link === 'string' && body.partner_link ? body.partner_link : undefined;

    const html = buildPartnerWelcomeHtml(firstName, partnerLink);
    const { html: finalHtml, headers: unsubHeaders } = await applyUnsub(html, to, 'homeschool');

    const payload = {
      from: FROM,
      reply_to: REPLY_TO,
      to: [to],
      subject: action === 'testsend' ? `[TEST] ${SUBJECT}` : SUBJECT,
      html: finalHtml,
      headers: unsubHeaders,
      attachments: [
        {
          filename: SAMPLE_PDF_FILENAME,
          content: await samplePdfBase64(),
        },
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

    console.log(`partner-welcome ${action} sent to ${to} (resend id ${data?.id ?? 'unknown'})${partnerLink ? ' with partner link' : ''}`);
    return json(200, { ok: true, action, to, resend_id: data?.id ?? null });
  } catch (err) {
    console.error('partner-welcome error:', String(err));
    return json(500, { error: 'Internal error', detail: String(err) });
  }
});
