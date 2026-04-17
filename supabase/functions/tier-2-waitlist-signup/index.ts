// tier-2-waitlist-signup — captures Tier 2 founding waitlist signups.
// Source of truth: public.tier_2_waitlist (Supabase). Mirror: Resend audience "Tier 2 Waitlist".

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const TIER_2_AUDIENCE_NAME = 'Tier 2 Waitlist';

// ── Resend audience helpers ──

let cachedAudienceId: string | null = null;

async function findOrCreateTier2Audience(): Promise<string | null> {
  if (cachedAudienceId) return cachedAudienceId;
  try {
    // List existing audiences and try to match by name
    const listRes = await fetch('https://api.resend.com/audiences', {
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}` },
    });
    if (listRes.ok) {
      const listData = await listRes.json();
      const audiences = listData?.data || [];
      const existing = audiences.find((a: any) => a?.name === TIER_2_AUDIENCE_NAME);
      if (existing?.id) {
        cachedAudienceId = existing.id;
        return cachedAudienceId;
      }
    } else {
      console.error('Failed to list audiences:', listRes.status);
    }

    // Create the audience if it doesn't exist
    const createRes = await fetch('https://api.resend.com/audiences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: TIER_2_AUDIENCE_NAME }),
    });
    const createData = await createRes.json();
    if (createRes.ok && createData?.id) {
      cachedAudienceId = createData.id;
      return cachedAudienceId;
    }
    console.error('Failed to create Tier 2 audience:', createRes.status, JSON.stringify(createData));
    return null;
  } catch (err) {
    console.error('Audience lookup/create error:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

async function addContactToAudience(audienceId: string, email: string, firstName: string): Promise<void> {
  try {
    const res = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, first_name: firstName, unsubscribed: false }),
    });
    if (!res.ok && res.status !== 409) {
      const data = await res.json().catch(() => ({}));
      console.error('Failed to add contact to Tier 2 audience:', res.status, JSON.stringify(data));
    }
  } catch (err) {
    console.error('Add contact error:', err instanceof Error ? err.message : String(err));
  }
}

// ── Confirmation email ──

function buildConfirmationEmail(firstName: string): { subject: string; html: string } {
  const subject = "You're on the Tier 2 waitlist — your $497 founding code is reserved";
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Tier 2 Waitlist Confirmed</title></head>
<body style="margin:0;padding:0;background-color:#F5F0E8;font-family:Georgia,'Times New Roman',serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F0E8;">
<tr><td align="center" style="padding:20px 10px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border:1px solid #E8E3DA;">
<tr><td style="background-color:#2C3E2D;padding:40px 20px;text-align:center;">
<p style="font-family:Georgia,serif;font-size:13px;font-weight:bold;letter-spacing:4px;color:#C5A44E;text-transform:uppercase;margin:0;">THE EDEN INSTITUTE</p>
<p style="font-family:Georgia,serif;font-size:14px;color:#FFFFFF;font-style:italic;margin:16px 0 0 0;">Back to Eden. Back to Truth.</p>
</td></tr>
<tr><td style="border-top:2px solid #C5A44E;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="background-color:#FFFFFF;padding:32px 40px;">
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:#3D3832;margin:0 0 16px 0;">${firstName ? firstName + ',' : 'Friend,'}</p>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:#3D3832;margin:0 0 16px 0;">You're officially on the Tier 2 founding waitlist. We've reserved your spot — and your <strong>$497 founding access code</strong> is waiting.</p>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:#3D3832;margin:0 0 16px 0;">Tier 2 — <em>Body Systems &amp; Clinical Literacy</em> — is where students stop dabbling and start practicing. Fourteen modules. 127 lessons. Every major body system, studied through a terrain lens with Scripture as the anchor.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background-color:#F5F0E8;border-left:3px solid #C5A44E;">
<tr><td style="padding:20px 24px;">
<p style="font-family:Georgia,serif;font-size:14px;color:#6B6560;margin:0 0 8px 0;text-transform:uppercase;letter-spacing:2px;font-weight:bold;">What happens next</p>
<p style="font-family:Georgia,serif;font-size:15px;line-height:1.6;color:#3D3832;margin:0 0 8px 0;"><strong>July 7, 2026</strong> — Early access opens. Your founding code arrives in your inbox that morning. Valid 14 days.</p>
<p style="font-family:Georgia,serif;font-size:15px;line-height:1.6;color:#3D3832;margin:0;"><strong>October 8, 2026</strong> — Public launch at $1,497.</p>
</td></tr>
</table>
<p style="font-family:Georgia,serif;font-size:15px;line-height:1.6;color:#3D3832;margin:0 0 16px 0;"><em>Using Gmail? Move this email to your Primary inbox so you don't miss your founding code on July 7.</em></p>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:#3D3832;margin:24px 0 4px 0;">Grace and health,</p>
<p style="font-family:Georgia,serif;font-size:16px;color:#3D3832;font-weight:bold;margin:0;">Camila</p>
<p style="font-family:Georgia,serif;font-size:14px;color:#3D3832;margin:4px 0 0 0;">The Eden Institute</p>
</td></tr>
<tr><td style="border-top:2px solid #C5A44E;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="background-color:#2C3E2D;padding:24px 20px;text-align:center;">
<p style="font-family:Georgia,serif;font-size:13px;color:#FFFFFF;margin:0;"><a href="https://edeninstitute.health" style="color:#FFFFFF;text-decoration:underline;">edeninstitute.health</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  return { subject, html };
}

async function sendConfirmationEmail(email: string, firstName: string): Promise<void> {
  try {
    const { subject, html } = buildConfirmationEmail(firstName);
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Camila at The Eden Institute <hello@edeninstitute.health>',
        reply_to: 'hello@edeninstitute.health',
        to: [email],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error('Confirmation email failed:', res.status, JSON.stringify(data));
    }
  } catch (err) {
    console.error('Confirmation email error:', err instanceof Error ? err.message : String(err));
  }
}

// ── Validation ──

function validate(input: unknown): { ok: true; firstName: string; email: string } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Invalid request body' };
  const { firstName, email } = input as Record<string, unknown>;
  if (typeof firstName !== 'string' || !firstName.trim()) return { ok: false, error: 'First name is required' };
  if (typeof email !== 'string' || !email.trim()) return { ok: false, error: 'Email is required' };
  const trimmedName = firstName.trim();
  const trimmedEmail = email.trim().toLowerCase();
  if (trimmedName.length > 100) return { ok: false, error: 'First name is too long' };
  if (trimmedEmail.length > 255) return { ok: false, error: 'Email is too long' };
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) return { ok: false, error: 'Please enter a valid email address' };
  return { ok: true, firstName: trimmedName, email: trimmedEmail };
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing env vars');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = validate(body);
    if (!parsed.ok) {
      return new Response(
        JSON.stringify({ error: parsed.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { firstName, email } = parsed;

    // STEP 1 — Source of truth: insert into Supabase. If row already exists, treat as success.
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/tier_2_waitlist`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal,resolution=merge-duplicates',
      },
      body: JSON.stringify({ email, first_name: firstName }),
    });

    if (!insertRes.ok) {
      const errorText = await insertRes.text().catch(() => '');
      console.error('Supabase insert failed:', insertRes.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Something went wrong saving your spot. Please try again in a moment.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // STEP 2 — Mirror to Resend audience (best-effort; don't fail the whole request).
    const audienceId = await findOrCreateTier2Audience();
    if (audienceId) {
      await addContactToAudience(audienceId, email, firstName);
    }

    // STEP 3 — Send confirmation email (best-effort).
    await sendConfirmationEmail(email, firstName);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('Tier 2 waitlist signup error:', message, stack);
    return new Response(
      JSON.stringify({ error: 'Unexpected error. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
