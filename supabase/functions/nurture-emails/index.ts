const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// ── Shared HTML components ──

function emailWrapper(bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>The Eden Institute</title></head>
<body style="margin:0;padding:0;background-color:#F5F0E8;font-family:Georgia,serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F0E8;">
<tr><td align="center" style="padding:20px 10px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#FFFFFF;">
<!-- HEADER -->
<tr><td style="background-color:#1C3A2E;padding:40px 20px;text-align:center;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="text-align:center;font-family:Georgia,serif;font-size:13px;font-weight:bold;letter-spacing:4px;color:#C9A84C;text-transform:uppercase;">THE EDEN INSTITUTE</td></tr>
<tr><td align="center" style="padding:16px 0;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="width:60px;border-top:1px solid #C9A84C;font-size:0;line-height:0;">&nbsp;</td></tr></table>
</td></tr>
<tr><td style="text-align:center;font-family:Georgia,serif;font-size:14px;color:#F5F0E8;font-style:italic;">Back to Eden. Back to Truth.</td></tr>
</table>
</td></tr>
<!-- BODY -->
<tr><td style="background-color:#FFFFFF;padding:32px 40px;">
${bodyContent}
</td></tr>
<!-- FOOTER -->
<tr><td style="background-color:#F5F0E8;padding:30px 20px;text-align:center;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-family:Georgia,serif;font-size:13px;color:#1C3A2E;text-align:center;">The Eden Institute | edeninstitute.health</td></tr>
<tr><td style="font-family:Georgia,serif;font-size:12px;color:#1C3A2E;text-align:center;padding-top:8px;">You're receiving this because you completed the Constitutional Assessment at edeninstitute.health.</td></tr>
<tr><td style="text-align:center;padding-top:8px;"><a href="https://edeninstitute.health/unsubscribe" style="font-family:Georgia,serif;font-size:12px;color:#C9A84C;text-decoration:underline;">Unsubscribe</a></td></tr>
</table>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function goldDivider(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #C9A84C;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr></table>`;
}

function p(text: string, extra = ''): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 16px 0;${extra}">${text}</p>`;
}

function arrow(text: string): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 8px 0;padding-left:16px;">→ ${text}</p>`;
}

function bullet(text: string): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 8px 0;padding-left:16px;">· ${text}</p>`;
}

function signature(): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;font-style:italic;margin:24px 0 4px 0;">In His design,</p>
<p style="font-family:Georgia,serif;font-size:16px;color:#1C3A2E;font-weight:bold;margin:0;">Camila</p>
<p style="font-family:Georgia,serif;font-size:14px;color:#1C3A2E;margin:4px 0 0 0;">Founder, The Eden Institute</p>
<p style="font-family:Georgia,serif;font-size:14px;color:#C9A84C;margin:4px 0 0 0;">EdenInstitute.health</p>`;
}

// ── Email 1: Welcome (immediate / 1hr) ──

function buildNurtureEmail1(firstName: string): { subject: string; previewText: string; html: string } {
  const body = `
${p(`${firstName},`)}
${p("You just did something most people never do — you paused and asked a real question about how God designed your body.")}
${p("That's why I built The Eden Institute.")}
${p("My name is Camila. I'm a former educator, an herbalist, and a Reformed Christian who spent years searching for a framework that took both Scripture and the body seriously. Most of what I found either ignored God entirely — or treated herbs like spiritual accessories without clinical grounding.")}
${p("<em>Back to Eden</em> is the book I wish I'd had at the beginning. The Eden Institute is the school I wish had existed.")}
${goldDivider()}
${p("Here's what to expect from me:")}
${arrow("Short teachings on biblical herbalism, human constitution, and how God designed the body to heal.")}
${arrow("Honest, rigorous content — no wellness trends, no fear-based messaging.")}
${arrow("An invitation, in July, to go much deeper together in our first Tier 1 cohort.")}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:8px;"></td></tr></table>
${p("Your constitutional type quiz result is on its way in a separate email — along with a short guide on what your type means and how to begin working with it.")}
${p("I'm glad you're here.")}
${signature()}`;

  return {
    subject: "You took the first step. Here's what comes next.",
    previewText: "Welcome to Eden Institute — and something I've been building for years.",
    html: emailWrapper(body),
  };
}

// ── Email 2: Constitution Explained (Day 3) ──

function buildNurtureEmail2(firstName: string): { subject: string; previewText: string; html: string } {
  const body = `
${p(`${firstName},`)}
${p("If you've spent any time in the herbal world, you've probably encountered lists. Take elderberry for immunity. Take ashwagandha for stress. Take turmeric for inflammation.")}
${p("Here's what those lists leave out: <strong>you</strong>.")}
${p("Constitutional medicine — found in Ayurveda, Traditional Chinese Medicine, Greek medicine, and Western herbalism — arrived at the same insight independently: people differ in ways that are consistent and clinically meaningful. The body has a direction. Good herbal medicine honors that direction.")}
${goldDivider()}
${p("Your quiz result identified your constitutional pattern. This isn't a personality type. It's a physiological tendency — the baseline toward which your body tends to drift under stress, in illness, and across your life.")}
${p("Here's what this means practically:")}
${bullet("The herbs that cool and moisten help the person who runs hot and dry.")}
${bullet("The herbs that warm and move help the person who tends cold and stagnant.")}
${bullet("The herbs that tone and dry help the person who tends toward laxity and dampness.")}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:8px;"></td></tr></table>
${p("This is not complicated. But it requires reading the person before reaching for the plant. That's what <em>Back to Eden</em> teaches — and what Tier 1 of the Eden Institute builds into a full clinical framework.")}
${p("More on that soon.")}
${signature()}`;

  return {
    subject: "What your constitutional type actually means (and what to do with it)",
    previewText: "This is where most herbal education skips the most important step.",
    html: emailWrapper(body),
  };
}

// ── Email 3: Course Preview (Day 7) ──

function buildNurtureEmail3(firstName: string): { subject: string; previewText: string; html: string } {
  const body = `
${p(`${firstName},`)}
${p("I want to tell you what's coming — because you've been here from the beginning, and that matters.")}
${p("On <strong>July 7th</strong>, The Eden Institute opens enrollment for <strong>Tier 1: Biblical Framework for Healing</strong>.")}
${p("This is not a wellness course. It is a structured, academically rigorous curriculum that teaches:")}
${bullet("<strong>Module 1: God as Healer</strong> — the theological and philosophical foundation for natural medicine")}
${bullet("<strong>Module 2: Biblical Anthropology</strong> — understanding the whole person: body, soul, and spirit")}
${bullet("<strong>Module 3: Human Constitution and Plant Energetics</strong> — how to read a person before reaching for a plant")}
${bullet("<strong>Module 4: Discernment Principles</strong> — how a Christian herbalist navigates tradition, evidence, and conviction")}
${goldDivider()}
${p("The founding cohort is live and limited. As someone already on this list, you will have access before the public announcement.")}
${p("Between now and July, I'll be sharing short teachings from each module — giving you a real sense of what's inside.")}
${p("If you have questions between now and then — hit reply. I read every one.")}
${signature()}`;

  return {
    subject: "Something is coming July 7th — and I want you to be first to know",
    previewText: "The course I've been building for years opens in four months.",
    html: emailWrapper(body),
  };
}

// ── Send email helper ──

async function sendEmail(to: string, subject: string, html: string, previewText?: string): Promise<boolean> {
  // Inject preview text as hidden preheader if provided
  let finalHtml = html;
  if (previewText) {
    const preheader = `<div style="display:none;font-size:1px;color:#F5F0E8;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${previewText}</div>`;
    finalHtml = html.replace('<body', `<body`).replace('><table', `>${preheader}<table`);
  }

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
      html: finalHtml,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('Email send failed:', res.status, JSON.stringify(data));
    return false;
  }
  console.log('Nurture email sent:', subject, 'to', to);
  return true;
}

// ── Supabase helpers ──

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
    let sent = { email1: 0, email2: 0, email3: 0 };

    // Fetch all pending completions (where at least one email hasn't been sent)
    const rows = await supabaseQuery(
      'quiz_completions?or=(email_1_sent_at.is.null,email_2_sent_at.is.null,email_3_sent_at.is.null)&limit=50'
    );

    if (!Array.isArray(rows)) {
      console.error('Unexpected query result:', JSON.stringify(rows));
      return new Response(
        JSON.stringify({ error: 'Query failed', detail: rows }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${rows.length} pending quiz completions`);

    for (const row of rows) {
      const completedAt = new Date(row.completed_at);
      const hoursSince = (now.getTime() - completedAt.getTime()) / (1000 * 60 * 60);

      // Email 1: Send after 1 hour
      if (!row.email_1_sent_at && hoursSince >= 1) {
        const { subject, previewText, html } = buildNurtureEmail1(row.first_name);
        const ok = await sendEmail(row.email, subject, html, previewText);
        if (ok) {
          await supabaseQuery(`quiz_completions?id=eq.${row.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ email_1_sent_at: now.toISOString() }),
          });
          sent.email1++;
        }
        // Rate limit: small delay between sends
        await new Promise(r => setTimeout(r, 300));
      }

      // Email 2: Send after 3 days (72 hours)
      if (!row.email_2_sent_at && row.email_1_sent_at && hoursSince >= 72) {
        const { subject, previewText, html } = buildNurtureEmail2(row.first_name);
        const ok = await sendEmail(row.email, subject, html, previewText);
        if (ok) {
          await supabaseQuery(`quiz_completions?id=eq.${row.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ email_2_sent_at: now.toISOString() }),
          });
          sent.email2++;
        }
        await new Promise(r => setTimeout(r, 300));
      }

      // Email 3: Send after 7 days (168 hours)
      if (!row.email_3_sent_at && row.email_2_sent_at && hoursSince >= 168) {
        const { subject, previewText, html } = buildNurtureEmail3(row.first_name);
        const ok = await sendEmail(row.email, subject, html, previewText);
        if (ok) {
          await supabaseQuery(`quiz_completions?id=eq.${row.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ email_3_sent_at: now.toISOString() }),
          });
          sent.email3++;
        }
        await new Promise(r => setTimeout(r, 300));
      }
    }

    console.log('Nurture run complete:', JSON.stringify(sent));
    return new Response(
      JSON.stringify({ success: true, processed: rows.length, sent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Nurture error:', err.message, err.stack);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
