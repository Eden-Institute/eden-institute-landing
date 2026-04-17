// nurture-emails — handles ONLY Email 5 (Day 8, conditional on !purchased_course AND !purchased_guide)
// Emails 1-4 are scheduled via Resend scheduled_at in resend-waitlist

import { buildNurtureEmail5, toSlug } from '../_shared/nurture-email-templates.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// ── Supabase REST helper ──

async function supabaseQuery(path: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY!,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': options.method === 'PATCH' ? 'return=minimal' : 'return=representation',
      ...options.headers,
    },
  });
  if (options.method === 'PATCH') return { ok: res.ok, status: res.status };
  return res.json();
}

// ── Send email helper ──

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Camila at The Eden Institute <hello@edeninstitute.health>',
      reply_to: 'hello@edeninstitute.health',
      to: [to],
      subject,
      html,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('Email 5 send failed:', res.status, JSON.stringify(data));
    return false;
  }
  console.log('Email 5 sent to', to);
  return true;
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
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();
    let sent = 0;

    // Find users who completed quiz 8+ days ago, haven't received Email 5,
    // and have NOT purchased the course AND NOT purchased the guide
    const rows = await supabaseQuery(
      'quiz_completions?email_5_sent_at=is.null&email_4_sent_at=not.is.null&purchased_course=eq.false&purchased_guide=eq.false&limit=50'
    );

    if (!Array.isArray(rows)) {
      console.error('Unexpected query result:', JSON.stringify(rows));
      return new Response(
        JSON.stringify({ error: 'Query failed', detail: rows }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${rows.length} candidates for Email 5`);

    for (const row of rows) {
      const completedAt = new Date(row.completed_at);
      const hoursSince = (now.getTime() - completedAt.getTime()) / (1000 * 60 * 60);

      // Only send if 8+ days (192 hours) have passed
      if (hoursSince < 192) continue;

      // Skip if purchased_course OR purchased_guide is true (double-check)
      if (row.purchased_course) continue;
      if (row.purchased_guide) continue;

      const nickname = row.constitution_name || row.constitution_nickname || 'Your Constitutional Type';
      const slug = row.constitution_type || toSlug(nickname);
      const { subject, html } = buildNurtureEmail5(row.first_name, nickname, slug);

      const ok = await sendEmail(row.email, subject, html);
      if (ok) {
        await supabaseQuery(`quiz_completions?id=eq.${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ email_5_sent_at: now.toISOString() }),
        });
        sent++;
      }
      await new Promise(r => setTimeout(r, 300));
    }

    console.log(`Email 5 run complete: ${sent} sent`);
    return new Response(
      JSON.stringify({ success: true, processed: rows.length, sent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('Nurture email 5 error:', message, stack);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
