const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// ── Brand constants ──
const BRAND = {
  bgOuter: '#F5F0EB',
  bgBody: '#FFFFFF',
  headerFooter: '#2D3B2D',
  text: '#333333',
  heading: '#2D3B2D',
  button: '#5C7A5C',
  buttonText: '#FFFFFF',
  gold: '#C4943D',
  link: '#5C7A5C',
  footerText: '#FFFFFF',
};

// ── Shared HTML components ──

function emailWrapper(bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>The Eden Institute</title>
<style>
@media only screen and (max-width: 620px) {
  .email-body-cell { padding: 24px 20px !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.bgOuter};font-family:Georgia,'Times New Roman',serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.bgOuter};">
<tr><td align="center" style="padding:20px 10px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:${BRAND.bgBody};">
<!-- HEADER -->
<tr><td style="background-color:${BRAND.headerFooter};padding:40px 20px;text-align:center;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="text-align:center;font-family:Georgia,serif;font-size:13px;font-weight:bold;letter-spacing:4px;color:${BRAND.gold};text-transform:uppercase;">THE EDEN INSTITUTE</td></tr>
<tr><td align="center" style="padding:16px 0;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="width:60px;border-top:1px solid ${BRAND.gold};font-size:0;line-height:0;">&nbsp;</td></tr></table>
</td></tr>
<tr><td style="text-align:center;font-family:Georgia,serif;font-size:14px;color:${BRAND.footerText};font-style:italic;">Back to Eden. Back to Truth.</td></tr>
</table>
</td></tr>
<!-- AMBER RULE BELOW HEADER -->
<tr><td style="background-color:${BRAND.bgBody};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:2px solid ${BRAND.gold};font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>
<!-- BODY -->
<tr><td class="email-body-cell" style="background-color:${BRAND.bgBody};padding:32px 40px;">
${bodyContent}
</td></tr>
<!-- AMBER RULE ABOVE FOOTER -->
<tr><td style="background-color:${BRAND.bgBody};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:2px solid ${BRAND.gold};font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>
<!-- FOOTER -->
<tr><td style="background-color:${BRAND.headerFooter};padding:30px 20px;text-align:center;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-family:Georgia,serif;font-size:14px;font-weight:bold;color:${BRAND.footerText};text-align:center;">The Eden Institute</td></tr>
<tr><td style="text-align:center;padding-top:6px;"><a href="https://edeninstitute.health" style="font-family:Georgia,serif;font-size:13px;color:${BRAND.footerText};text-decoration:underline;">edeninstitute.health</a></td></tr>
<tr><td style="text-align:center;padding-top:14px;">
<a href="https://www.facebook.com/share/1CRzWj7wmz/?mibextid=wwXIfr" style="font-family:Georgia,serif;font-size:12px;color:${BRAND.footerText};text-decoration:underline;margin:0 6px;">Facebook</a>
&nbsp;|&nbsp;
<a href="https://instagram.com/the_eden_institute" style="font-family:Georgia,serif;font-size:12px;color:${BRAND.footerText};text-decoration:underline;margin:0 6px;">Instagram</a>
&nbsp;|&nbsp;
<a href="https://pin.it/6AuiXypgA" style="font-family:Georgia,serif;font-size:12px;color:${BRAND.footerText};text-decoration:underline;margin:0 6px;">Pinterest</a>
</td></tr>
<tr><td style="text-align:center;padding-top:14px;font-family:Georgia,serif;font-size:13px;color:${BRAND.gold};font-style:italic;">Back to Eden. Back to Truth.</td></tr>
<tr><td style="font-family:Georgia,serif;font-size:11px;color:${BRAND.footerText};text-align:center;padding-top:16px;opacity:0.7;">You're receiving this because you completed the Constitutional Assessment at edeninstitute.health.</td></tr>
</table>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function goldDivider(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:2px solid ${BRAND.gold};font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr></table>`;
}

function p(text: string, extra = ''): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.5;color:${BRAND.text};margin:0 0 16px 0;${extra}">${text}</p>`;
}

function heading(text: string): string {
  return `<h2 style="font-family:Georgia,serif;font-size:22px;line-height:1.3;color:${BRAND.heading};margin:0 0 16px 0;font-weight:bold;">${text}</h2>`;
}

function arrow(text: string): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.5;color:${BRAND.text};margin:0 0 8px 0;padding-left:16px;">→ ${text}</p>`;
}

function bullet(text: string): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.5;color:${BRAND.text};margin:0 0 8px 0;padding-left:16px;">· ${text}</p>`;
}

function brandButton(label: string, url: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
<tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
<tr><td align="center" style="background-color:${BRAND.button};border-radius:8px;">
<a href="${url}" target="_blank" style="display:inline-block;background-color:${BRAND.button};color:${BRAND.buttonText};font-family:Georgia,serif;font-size:16px;font-weight:bold;text-decoration:none;text-align:center;padding:14px 40px;border-radius:8px;line-height:24px;mso-line-height-rule:exactly;">${label}</a>
</td></tr>
</table>
</td></tr>
</table>`;
}

function signature(): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.5;color:${BRAND.text};margin:24px 0 4px 0;">More soon.</p>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.5;color:${BRAND.text};margin:16px 0 0 0;font-weight:bold;">Camila Johnson</p>
<p style="font-family:Georgia,serif;font-size:14px;color:${BRAND.text};margin:4px 0 0 0;">Founder, The Eden Institute</p>
<p style="font-family:Georgia,serif;font-size:14px;margin:4px 0 0 0;"><a href="https://edeninstitute.health" style="color:${BRAND.link};text-decoration:underline;">edeninstitute.health</a></p>`;
}

function signatureShort(): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.5;color:${BRAND.text};font-style:italic;margin:24px 0 4px 0;">In His design,</p>
<p style="font-family:Georgia,serif;font-size:16px;color:${BRAND.text};font-weight:bold;margin:0;">Camila Johnson</p>
<p style="font-family:Georgia,serif;font-size:14px;color:${BRAND.text};margin:4px 0 0 0;">Founder, The Eden Institute</p>
<p style="font-family:Georgia,serif;font-size:14px;margin:4px 0 0 0;"><a href="https://edeninstitute.health" style="color:${BRAND.link};text-decoration:underline;">edeninstitute.health</a></p>`;
}

// ── Email 1: Welcome (1hr after quiz) ──

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
${arrow("An invitation, on June 9th, to go much deeper together in <strong>Back to Eden: Foundations of Biblical Herbalism</strong> — our first cohort.")}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:8px;"></td></tr></table>
${p("You should already have your constitutional type quiz result in your inbox — along with a short guide on what your type means and how to begin working with it. If you don't see it, check your spam folder and add hello@edeninstitute.health to your contacts.")}
${p("I'm glad you're here.")}
${signatureShort()}`;

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
${p(`Scripture tells us that God formed each person with intention — <em>"For you created my inmost being; you knit me together in my mother's womb"</em> (Psalm 139:13). That means your body has a design. A direction. A constitutional pattern that shows up in how you respond to stress, to seasons, to food, and to illness.`)}
${p("This is not a new idea. Physicians across centuries — from the Greek humoral tradition to the Western Physiomedicalists — observed that people differ in consistent, clinically meaningful ways. What they lacked was the right framework for <em>why</em>. Scripture supplies what clinical observation alone cannot: the truth that these patterns are not accidents of nature. They are features of intentional design.")}
${goldDivider()}
${p("Your quiz result identified your constitutional pattern — the physiological baseline toward which your body tends to drift. Here is what that means practically:")}
${bullet("The herbs that cool and moisten serve the person who runs hot and dry.")}
${bullet("The herbs that warm and move serve the person who tends cold and stagnant.")}
${bullet("The herbs that tone and dry serve the person who tends toward laxity and dampness.")}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:8px;"></td></tr></table>
${p("This is not complicated. But it requires reading the person before reaching for the plant.")}
${p("That is what <strong>Back to Eden: Foundations of Biblical Herbalism</strong> teaches — a framework where clinical observation and Biblical truth work together, not in tension.")}
${p("More on that soon.")}
${signatureShort()}`;

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
${p("You took the Constitutional Quiz. You've started seeing your body differently — not as a problem to fix, but as a design to understand.")}
${p("That's exactly where this begins.")}
${p(`On <strong>June 9th</strong>, The Eden Institute opens enrollment for <strong>Back to Eden: Foundations of Biblical Herbalism</strong> — a 10-lesson foundational course built for Christian families who want to reclaim God's original design for health and healing.`)}
${p("This is not a wellness trend. It is a structured, academically rigorous curriculum that teaches:")}
${goldDivider()}
${heading("Part I — The Foundation")}
${p("The Biblical and historical framework for plant medicine — why herbs belong in the Christian tradition, and what was lost when we forgot.")}
${heading("Part II — The Person")}
${p("How to understand the human body through constitution, tissue states, and terrain — so you stop guessing and start discerning.")}
${heading("Part III — The Practice")}
${p("How to match people to plants with precision, using the energetic and constitutional framework that makes herbalism actually work.")}
${goldDivider()}
${p(`<strong>What's included:</strong> 10 video lessons · 10 companion PDFs · 10 activity worksheets · 100 quiz questions · 1 capstone integration project · Certificate of completion`)}
${p(`<strong>Pricing:</strong> $197 standard enrollment<br>Early bird and founding cohort discounts will be available — if you're on this list, you'll hear about them first.`)}
${brandButton("Learn More at edeninstitute.health", "https://edeninstitute.health")}
${p("This course was built for the woman who wants depth, not decoration. Who wants to steward her family's health with conviction — not anxiety. Who believes God was intentional in what He made.")}
${p("If that's you, you're in the right place.")}
${signature()}`;

  return {
    subject: "What we're building — and why it's different",
    previewText: "You took the quiz. Here's what comes next.",
    html: emailWrapper(body),
  };
}

// ── Send email helper ──

async function sendEmail(to: string, subject: string, html: string, previewText?: string): Promise<boolean> {
  let finalHtml = html;
  if (previewText) {
    const preheader = `<div style="display:none;font-size:1px;color:${BRAND.bgOuter};line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${previewText}</div>`;
    finalHtml = html.replace('><table', `>${preheader}<table`);
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
        await new Promise(r => setTimeout(r, 300));
      }

      // Email 2: Send after 72 hours (3 days)
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

      // Email 3: Send after 168 hours (7 days)
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
