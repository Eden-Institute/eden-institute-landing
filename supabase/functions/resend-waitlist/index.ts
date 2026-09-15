// At-signup email builders come from the canonical shared email library.
// resend-waitlist previously inlined a verbatim, collision-renamed copy of
// _shared/nurture-email-templates.ts; that duplicate has been removed so
// _shared is the single source of truth for these templates.
import { buildNurtureEmail1 } from '../_shared/nurture-email-templates.ts';
import { shopApothecaryCard } from '../_shared/shop-cta.ts';
import { applyUnsub, type EmailList } from '../_shared/email-unsubscribe.ts';
import { setContactProperties, type ContactProperties } from '../_shared/resend-contacts.ts';
import { escapeHtml } from '../_shared/html-escape.ts';
import { bumpRateBucket, clientIp } from '../_shared/rate-bucket.ts';
import { pgrstFetch } from '../_shared/pgrst-retry.ts';
import { sendMetaCapiLead } from '../_shared/meta-capi.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const RESEND_CONTACTS_KEY = Deno.env.get('RESEND_CONTACTS_KEY');
// Master audience UUID — single destination for all contact writes post-Stage 2.
// Falls back to legacy RESEND_AUDIENCE_ID during rollout (same UUID today).
const RESEND_MASTER_AUDIENCE_ID =
  Deno.env.get('RESEND_MASTER_AUDIENCE_ID') ?? Deno.env.get('RESEND_AUDIENCE_ID');

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// ── Entry funnel resolution ──
// Canonical taxonomy matches the public.entry_funnel Postgres enum.
type EntryFunnel =
  | 'app_beta'
  | 'course_tier2'
  | 'edens_table'
  | 'homeschool'
  | 'community'
  | 'quiz_funnel';

const VALID_FUNNELS = new Set<EntryFunnel>([
  'app_beta',
  'course_tier2',
  'edens_table',
  'homeschool',
  'community',
  'quiz_funnel',
]);

// Legacy frontend sends audienceId; map to the entry_funnel taxonomy.
// Compatibility layer retained through Lane C Stage 3; drop once the
// frontend sends entry_funnel directly.
const LEGACY_AUDIENCE_TO_FUNNEL: Record<string, EntryFunnel> = {
  '4860c1c5-8e2b-4d02-838a-60ef09b789bf': 'course_tier2',
  'cebd3478-b344-41b7-98c8-8bcf0e0108da': 'app_beta',
  'a48cb66e-b2a9-461d-98a6-bb1b12f72693': 'edens_table',
};

const CONSTITUTION_SLUG_MAP: Record<string, { slug: string; name: string }> = {
  "Hot / Dry / Tense": { slug: "burning-bowstring", name: "The Burning Bowstring" },
  "Hot / Dry / Relaxed": { slug: "open-flame", name: "The Open Flame" },
  "Hot / Damp / Tense": { slug: "pressure-cooker", name: "The Pressure Cooker" },
  "Hot / Damp / Relaxed": { slug: "overflowing-cup", name: "The Overflowing Cup" },
  "Cold / Dry / Tense": { slug: "drawn-bowstring", name: "The Drawn Bowstring" },
  "Cold / Dry / Relaxed": { slug: "spent-candle", name: "The Spent Candle" },
  "Cold / Damp / Tense": { slug: "frozen-knot", name: "The Frozen Knot" },
  "Cold / Damp / Relaxed": { slug: "still-water", name: "The Still Water" },
};

// Name and slug come ONLY from the server-side map. The caller's own
// constitutionName/Nickname/Slug used to win here, which let any POST put
// arbitrary text into the Email 1 subject and body and into the stored queue rows.
function getSlugInfo(constitutionType: string): { slug: string; name: string } | null {
  return CONSTITUTION_SLUG_MAP[constitutionType] ?? null;
}

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
${shopApothecaryCard()}
</td></tr>
<!-- FOOTER -->
<tr><td style="background-color:#F5F0E8;padding:30px 20px;text-align:center;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-family:Georgia,serif;font-size:13px;color:#1C3A2E;text-align:center;">The Eden Institute | edeninstitute.health</td></tr>
<tr><td style="font-family:Georgia,serif;font-size:12px;color:#1C3A2E;text-align:center;padding-top:8px;">You're receiving this because you signed up at edeninstitute.health. No spam, ever.</td></tr>
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

function goldDivider(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #C9A84C;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr></table>`;
}

function goldLabel(text: string): string {
  return `<p style="font-family:Georgia,serif;font-size:12px;font-weight:bold;letter-spacing:3px;color:#C9A84C;text-transform:uppercase;margin:0 0 16px 0;">${text}</p>`;
}

function ctaButton(label: string, href: string, variant: 'primary' | 'secondary' = 'primary'): string {
  const bg = variant === 'primary' ? '#1C3A2E' : '#F5F0E8';
  const color = variant === 'primary' ? '#F5F0E8' : '#1C3A2E';
  const border = variant === 'secondary' ? 'border:2px solid #1C3A2E;' : '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0;">
<a href="${href}" target="_blank" style="display:inline-block;background-color:${bg};color:${color};${border}font-family:Georgia,serif;font-size:14px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;text-decoration:none;padding:16px 32px;">${label}</a>
</td></tr></table>`;
}

function closingBlock(): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:24px 0 4px 0;">We'll be in touch soon.</p>
<p style="font-family:Georgia,serif;font-size:16px;color:#1C3A2E;font-weight:bold;margin:0;">Camila Johnson</p>
<p style="font-family:Georgia,serif;font-size:14px;color:#C9A84C;margin:4px 0 0 0;">The Eden Institute</p>`;
}

// ── Email builders ──

function buildFoundationsEmail(firstName: string): { subject: string; html: string } {
  const body = `
<p style="font-family:Georgia,serif;font-size:18px;color:#1C3A2E;margin:0 0 24px 0;">Hi ${firstName},</p>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 8px 0;">Welcome to the Eden Institute. You're officially on the Foundations Course waitlist, and you'll be among the first to know when enrollment opens.</p>
${goldDivider()}
${goldLabel('WHILE YOU WAIT')}
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 16px 0;">The Foundations Course is built on one conviction: that God did not design the body to be dependent on a system. He designed it to be stewarded. The course teaches you the constitutional framework, the energetic language of plants, and how to match the two, from a scriptural foundation outward.</p>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 24px 0;">Start here. Grab Book One and read the first three chapters. Everything the course teaches grows out of what that book establishes.</p>
${ctaButton('→ PURCHASE BOOK ONE', 'https://www.amazon.com/dp/B0GPW5BZ32')}
${goldDivider()}
${closingBlock()}`;
  return { subject: "You're on the list. Here's what's coming", html: emailWrapper(body) };
}

function buildAppBetaEmail(firstName: string): { subject: string; html: string } {
  const body = `
<p style="font-family:Georgia,serif;font-size:18px;color:#1C3A2E;margin:0 0 24px 0;">Hi ${firstName},</p>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 8px 0;">You're on the Eden Apothecary beta waitlist. That means first access when we launch on July 7, 2026, and founding pricing locked in for the life of your subscription.</p>
${goldDivider()}
${goldLabel('FOUNDING PRICING, LOCKED IN')}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
<tr><td style="background-color:#F5F0E8;padding:20px;text-align:center;border-bottom:1px solid #FFFFFF;">
<p style="font-family:Georgia,serif;font-size:16px;font-weight:bold;color:#1C3A2E;margin:0 0 8px 0;">Seed</p>
<p style="font-family:Georgia,serif;font-size:20px;font-weight:bold;color:#C9A84C;margin:0 0 4px 0;">$7.99 / month &nbsp;·&nbsp; $79.99 / year</p>
<p style="font-family:Georgia,serif;font-size:13px;line-height:1.5;color:#1C3A2E;margin:0;">Full herb library, constitutional profile, 1–3 system assessments. Designed for your household.</p>
</td></tr>
<tr><td style="background-color:#F5F0E8;padding:20px;text-align:center;border-bottom:1px solid #FFFFFF;">
<p style="font-family:Georgia,serif;font-size:16px;font-weight:bold;color:#1C3A2E;margin:0 0 8px 0;">Root</p>
<p style="font-family:Georgia,serif;font-size:20px;font-weight:bold;color:#C9A84C;margin:0 0 4px 0;">$24.99 / month &nbsp;·&nbsp; $249.99 / year</p>
<p style="font-family:Georgia,serif;font-size:13px;line-height:1.5;color:#1C3A2E;margin:0;">All 12 system assessments, full materia medica, pattern tracking, lifestyle protocols.</p>
</td></tr>
<tr><td style="background-color:#F5F0E8;padding:20px;text-align:center;">
<p style="font-family:Georgia,serif;font-size:16px;font-weight:bold;color:#1C3A2E;margin:0 0 8px 0;">Practitioner</p>
<p style="font-family:Georgia,serif;font-size:20px;font-weight:bold;color:#C9A84C;margin:0 0 4px 0;">$49.99 / month &nbsp;·&nbsp; $499 / year</p>
<p style="font-family:Georgia,serif;font-size:13px;line-height:1.5;color:#1C3A2E;margin:0 0 8px 0;">Formula builder, multi-system analysis, session notes, exportable PDFs.</p>
<p style="font-family:Georgia,serif;font-size:13px;line-height:1.5;color:#1C3A2E;margin:0;">Now open at the founding rate. <a href="https://edeninstitute.health/apothecary/pricing#tier-practitioner" style="color:#C9A84C;text-decoration:underline;">See the Practitioner tier.</a></p>
</td></tr>
</table>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 16px 0;">The Eden Apothecary is a terrain-based clinical decision-support tool built on the Eclectic, Physiomedical, and Vitalist traditions, grounded in Scripture. From home herbalist to working practitioner, every tier is designed to meet you where you are.</p>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 24px 0;">While you wait, get the foundation in place.</p>
${ctaButton('→ START WITH BOOK ONE', 'https://www.amazon.com/dp/B0GPW5BZ32')}
${goldDivider()}
${closingBlock()}`;
  return { subject: "You're in: Eden Apothecary beta access secured", html: emailWrapper(body) };
}

function buildHomeschoolEmail(firstName: string): { subject: string; html: string } {
  const body = `
    <p style="font-family:Georgia,serif;font-size:18px;color:#1C3A2E;margin:0 0 24px 0;">Hi ${firstName},</p>
    <p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 8px 0;">You're on the list.</p>
    <p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 24px 0;">
      Eden's Table is a K–12 Biblical herbalism curriculum being built for families who believe the earth was created with purpose, and that stewarding it well begins at home. You'll be among the first to see it, price it, and shape it.
    </p>
    <p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 24px 0;">
      While we finish building, consider starting with our adult foundations course. Most of our homeschool families tell us it changed how they teach, because it changed how they understand.
    </p>
    ${ctaButton("Explore the Foundations Course", "https://learn.edeninstitute.health/course/back-to-eden1")}
    ${goldDivider()}
    ${closingBlock()}
  `;
  const footer = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:1px solid #E8E3DA;">
    <tr><td style="text-align:center;padding-top:16px;">
    <p style="font-family:Georgia,serif;font-size:11px;color:#6B6560;margin:0 0 6px 0;">You're receiving this because you signed up at edeninstitute.health.</p>
    <p style="font-family:Georgia,serif;font-size:11px;color:#6B6560;margin:0 0 6px 0;">Rooted in Faith Ventures LLC &middot; 303 Holly Cir, Unit 3262, Clarksville, TN 37043</p>
    <a href="{{UNSUB_URL}}" style="font-family:Georgia,serif;font-size:11px;color:#6B6560;text-decoration:underline;">Unsubscribe</a>
    </td></tr></table>`;
  return {
    subject: "You're on the Eden's Table Waitlist: Here's What's Coming",
    html: `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#FAF8F3;">${body}${footer}</body></html>`
  };
}

function buildCommunityEmail(firstName: string): { subject: string; html: string } {
  const body = `
    <p style="font-family:Georgia,serif;font-size:18px;color:#1C3A2E;margin:0 0 24px 0;">Hi ${firstName},</p>
    <p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 8px 0;">Welcome to the circle.</p>
    <p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 24px 0;">
      The Eden Institute Community is being built for serious students of Biblical herbalism: people who want to go deeper, ask hard questions, and practice together. You'll hear from us as soon as the doors open.
    </p>
    <p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 24px 0;">
      In the meantime, take our free Constitutional Assessment. Knowing your body type is the foundation of everything we teach, and it will make community conversations far richer.
    </p>
    ${ctaButton("Take the Free Constitutional Assessment", "https://edeninstitute.health/assessment")}
    ${goldDivider()}
    ${closingBlock()}
  `;
  return {
    subject: "You're on the Community Waitlist: We're Building Something Worth Waiting For",
    html: `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#FAF8F3;">${body}</body></html>`
  };
}


// ── Phase 3.1 Day-1: source-branched email builders for edens_table funnel ──
// One welcome email per /homeschool CTA. Day-7 Week-2 send is Phase 3.1.2.

// The Founders Club welcome ("Preorders are open now ... $249") and its
// founding-window check lived here until 2026-09-12. Deleted with the
// print-first pivot; recover from git history (f0d7399) for phase two.

function buildSproutsMagnetEmail(firstName: string): { subject: string; html: string } {
  const body = `
<p style="font-family:Georgia,serif;font-size:18px;color:#1C3A2E;margin:0 0 24px 0;">Hi ${firstName},</p>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 16px 0;">Thank you for stepping into this work with us. What follows is a real week of curriculum: Week 1 of Sprouts, the band built for kindergarten through second grade. Not a sample stripped of substance. Five days with Lavender, a story your child will remember, and the small daily rhythms that turn a kitchen counter into a place of formation.</p>
${goldDivider()}
${goldLabel('YOUR THREE DOWNLOADS: SPROUTS WEEK 1 (LAVENDER)')}
${ctaButton('MEET THE FAMILY (READ-ALOUD)', 'https://edeninstitute.health/lead-magnets/hs-sprouts-w1-ra-lavender.pdf')}
${ctaButton("TEACHER'S GUIDE", 'https://edeninstitute.health/lead-magnets/hs-sprouts-w1-tg-lavender.pdf')}
${ctaButton('STUDENT NOTEBOOK', 'https://edeninstitute.health/lead-magnets/hs-sprouts-w1-nb-lavender.pdf')}
${goldDivider()}
${goldLabel('THIS IS A WHOLE WEEK')}
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 16px 0;">Lavender is Week 1 of the curriculum exactly as it is taught. Five full days, the same pages families teach from all year, and it stands on its own. The printed card decks are not part of the free week; everything you need to teach these five days is in the guide and the notebook. Teach it whenever the week suits you. In about a week I will write again about the weeks that follow it, and there is nothing you need to do before then.</p>
${closingBlock()}`;
  return { subject: 'Your Sprouts Week 1 (Lavender) is ready', html: emailWrapper(body) };
}

function buildSeedlingsMagnetEmail(firstName: string): { subject: string; html: string } {
  const body = `
<p style="font-family:Georgia,serif;font-size:18px;color:#1C3A2E;margin:0 0 24px 0;">Hi ${firstName},</p>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 16px 0;">Thank you for stepping into this work with us. What follows is a real week of curriculum from Seedlings, our band for third through fifth graders. Seedlings is built for the child who has begun to ask <em>why</em> and <em>how</em>, the one who has outgrown a worksheet and is ready to track a hypothesis across a week. Week 1 starts with Elderberry.</p>
${goldDivider()}
${goldLabel('YOUR TWO DOWNLOADS: SEEDLINGS WEEK 1 (ELDERBERRY)')}
${ctaButton("TEACHER'S GUIDE", 'https://edeninstitute.health/lead-magnets/hs-seedlings-w1-tg-elderberry.pdf')}
${ctaButton('STUDENT NOTEBOOK', 'https://edeninstitute.health/lead-magnets/hs-seedlings-w1-nb-elderberry.pdf')}
${goldDivider()}
${goldLabel('THIS IS A WHOLE WEEK')}
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 16px 0;">Elderberry is Week 1 of the curriculum exactly as it is taught. Five full days, the same pages families teach from all year, and it stands on its own. The printed card decks are not part of the free week; everything you need to teach these five days is in the guide and the notebook. Teach it whenever the week suits you. In about a week I will write again with what comes next, and there is nothing you need to do before then.</p>
${closingBlock()}`;
  return { subject: 'Your Seedlings Week 1 (Elderberry) is ready', html: emailWrapper(body) };
}


// The retired at-signup assessment email (constitutionProfiles + buildAssessmentEmail:
// per-Pattern intro/patterns/needs/herbs/Biblical anchor and the $4.99 guide CTA) lived
// here until 2026-09-15. It had no caller since Email 1 moved to _shared
// buildNurtureEmail1. Its copy differs from src/lib/constitution-data.ts; recover it
// from git history (last commit before this removal) if it is ever wanted.

// ── Send email helper ──

async function sendEmail(to: string, subject: string, html: string, list: EmailList): Promise<void> {
  const { html: finalHtml, headers: unsubHeaders } = await applyUnsub(html, to, list);
  const payload = {
    from: 'The Eden Institute <hello@edeninstitute.health>',
    reply_to: 'hello@edeninstitute.health',
    to: [to],
    subject,
    html: finalHtml,
    headers: unsubHeaders,
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
    console.error('Email send failed:', res.status, JSON.stringify(data));
  } else {
    console.log('Email sent successfully:', JSON.stringify(data));
  }
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (
      !RESEND_API_KEY
      || !RESEND_CONTACTS_KEY
      || !RESEND_MASTER_AUDIENCE_ID
      || !SUPABASE_URL
      || !SUPABASE_SERVICE_ROLE_KEY
    ) {
      console.error('Missing env vars:', {
        hasSendKey: !!RESEND_API_KEY,
        hasContactsKey: !!RESEND_CONTACTS_KEY,
        hasMasterAudience: !!RESEND_MASTER_AUDIENCE_ID,
        hasSupabaseUrl: !!SUPABASE_URL,
        hasServiceRoleKey: !!SUPABASE_SERVICE_ROLE_KEY,
      });
      return json(500, { error: 'Server configuration error' });
    }

    const body = await req.json();
    const {
      firstName,
      email,
      audienceId,
      source: sourceRaw,
      constitutionType,
      entry_funnel: providedFunnel,
      consents: consentsRaw,
      source_url: sourceUrlRaw,
      referrer: referrerRaw,
      utm_source: utmSourceRaw,
      utm_medium: utmMediumRaw,
      utm_campaign: utmCampaignRaw,
      utm_term: utmTermRaw,
      utm_content: utmContentRaw,
      fbEventId,
      marketingConsent,
    } = body;

    // Attribution fields go straight into waitlist_signups (plain text / jsonb
    // columns, no length checks), so they are bounded here. Oversized or
    // non-string values are truncated or dropped, never rejected, so a real
    // signup is not blocked by a long tracking URL.
    const source = str(sourceRaw, 100);
    const source_url = str(sourceUrlRaw, 2048);
    const referrer = str(referrerRaw, 2048);
    const utm_source = str(utmSourceRaw, 256);
    const utm_medium = str(utmMediumRaw, 256);
    const utm_campaign = str(utmCampaignRaw, 256);
    const utm_term = str(utmTermRaw, 256);
    const utm_content = str(utmContentRaw, 256);
    const consents: Record<string, unknown> =
      consentsRaw && typeof consentsRaw === 'object' && !Array.isArray(consentsRaw) &&
        JSON.stringify(consentsRaw).length <= 2000
        ? consentsRaw as Record<string, unknown>
        : {};

    if (!email || typeof email !== 'string' || email.length > 254) {
      return json(400, { error: 'Email is required' });
    }

    // v3.34: tolerate empty firstName for auto-submit logged-in path (Phase 5
    // fix #3 / launch-blocker #57). Logged-in user_metadata.first_name may be
    // null and profiles.display_name may not yet be populated. Default to a
    // personable fallback rather than 400-ing the request — nurture email
    // greetings render "Hi Friend," in this edge case, which is acceptable.
    // Markup characters are stripped at intake because the stored name is
    // re-rendered later by other templates (magnet day 7, list-announce, launch
    // sequence). Real names never contain them; apostrophes and ampersands stay.
    const firstNameRaw = typeof firstName === 'string' ? firstName.replace(/[<>"`]/g, '').trim().slice(0, 100) : '';
    const firstNameSafe = firstNameRaw || 'Friend';
    const firstNameHtml = escapeHtml(firstNameSafe);

    const normalizedEmail = String(email).trim().toLowerCase();

    // Reject clearly-undeliverable / mistyped domains (e.g. gmail.con,
    // gmail.co, live.con, passmail.ner) before creating a Resend contact
    // that can only hard-bounce. Mirrors client-side src/lib/emailTypos.ts.
    if (!hasDeliverableShape(normalizedEmail)) {
      return json(400, { error: 'That email address does not look complete. Please check it and try again.' });
    }

    const emailTypoSuggestion = detectEmailTypo(normalizedEmail);
    if (emailTypoSuggestion) {
      return json(400, { error: `That email address looks misspelled. Did you mean ${emailTypoSuggestion}?`, suggestion: emailTypoSuggestion });
    }

    // Per-connection throttle. This endpoint is public (verify_jwt=false) and
    // sends email, so unthrottled it is an email bomb and a Resend quota drain.
    // Fails open (null) so a limiter outage never blocks lead capture.
    const ip = clientIp(req);
    if (ip) {
      const n = await bumpRateBucket({
        supabaseUrl: SUPABASE_URL,
        serviceKey: SUPABASE_SERVICE_ROLE_KEY,
        key: `waitlist_ip:${ip}`,
        windowSeconds: 600,
      });
      if (n !== null && n > 20) {
        // WORDING: pending founder approval (audit 2026-09-15)
        return json(429, { error: 'Too many signups from this connection. Please wait a few minutes and try again.' });
      }
    }

    // ── Resolve entry_funnel ──
    // Precedence: explicit entry_funnel → constitution_assessment source →
    // legacy audienceId mapping → homeschool/community source keywords.
    let entry_funnel: EntryFunnel | null = null;
    if (providedFunnel && VALID_FUNNELS.has(providedFunnel as EntryFunnel)) {
      entry_funnel = providedFunnel as EntryFunnel;
    } else if (source === 'constitution_assessment') {
      entry_funnel = 'quiz_funnel';
    } else if (audienceId && LEGACY_AUDIENCE_TO_FUNNEL[audienceId]) {
      entry_funnel = LEGACY_AUDIENCE_TO_FUNNEL[audienceId];
    } else if (source === 'homeschool') {
      entry_funnel = 'homeschool';
    } else if (source === 'community') {
      entry_funnel = 'community';
    }

    if (!entry_funnel) {
      return json(400, {
        error: 'Could not resolve entry_funnel; provide entry_funnel or a known audienceId',
      });
    }

    // ── Step 1: Supabase-first waitlist_signups UPSERT (non-quiz paths) ──
    // For entry_funnel='quiz_funnel', the quiz_completions AFTER INSERT and
    // AFTER UPDATE triggers maintain the waitlist_signups row. Skip explicit
    // upsert here to keep the trigger as single owner of that row.
    let waitlistId: string | null = null;
    let existingResendContactId: string | null = null;
    if (entry_funnel !== 'quiz_funnel') {
      const upsertResult = await waitlistUpsert({
        email: normalizedEmail,
        first_name: firstNameSafe,
        entry_funnel,
        source: source ?? null,
        source_url: source_url ?? null,
        referrer: referrer ?? null,
        utm_source: utm_source ?? null,
        utm_medium: utm_medium ?? null,
        utm_campaign: utm_campaign ?? null,
        utm_term: utm_term ?? null,
        utm_content: utm_content ?? null,
        consents: consents ?? {},
      });
      if (upsertResult) {
        waitlistId = upsertResult.id;
        existingResendContactId = upsertResult.resend_contact_id;
      }
    }

    // ── Step 2: Resend contact create in master audience ──
    // Idempotent at the Resend level (existing email in audience returns 409;
    // we handle that as success). Skipped if the Supabase row already has a
    // resend_contact_id from a prior sync.
    let resendContactId: string | null = existingResendContactId;
    let createdContactNow = false;
    if (!resendContactId) {
      try {
        const contactRes = await fetch(
          `https://api.resend.com/audiences/${RESEND_MASTER_AUDIENCE_ID}/contacts`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_CONTACTS_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: normalizedEmail,
              first_name: firstNameSafe,
              unsubscribed: false,
            }),
          }
        );
        if (contactRes.ok) {
          const contactData = await contactRes.json();
          resendContactId = contactData?.id ?? null;
          createdContactNow = true;
          console.log('Resend contact created:', resendContactId);
        } else if (contactRes.status === 409) {
          // Contact already exists in this audience. Not an error, just means
          // the signup came through a path where we don't yet know the prior
          // resend_contact_id. A follow-up GET can retrieve it; for now we
          // leave resend_contact_id null and let reconciliation fill it in.
          console.log('Resend contact already exists (409)');
        } else {
          const errText = await contactRes.text().catch(() => '');
          console.warn('Resend contact create failed:', contactRes.status, errText);
          // Non-fatal. The waitlist_signups row exists; the needs_sync partial
          // index lets a reconciliation worker pick it up on a later pass.
        }
      } catch (resendErr) {
        console.warn('Resend contact create exception:', String(resendErr));
      }
    }

    // ── Step 3: Mark waitlist_signups synced (non-quiz paths) ──
    if (waitlistId && resendContactId) {
      await waitlistMarkSyncedById(waitlistId, resendContactId).catch((e) =>
        console.warn('waitlist_signups sync update failed:', String(e))
      );
    }

    // ── Step 4: Quiz completion path (behavior preserved) ──
    // quiz_completions INSERT/UPDATE triggers (migrations 20260423232500 and
    // 20260423235500) maintain the waitlist_signups row for entry_funnel='quiz_funnel'.
    const slugInfo = source === 'constitution_assessment' && typeof constitutionType === 'string'
      ? getSlugInfo(constitutionType)
      : null;
    if (source === 'constitution_assessment' && constitutionType && !slugInfo) {
      // Same outcome as the balanced path, which sends no constitutionType.
      console.warn('constitution_assessment with unrecognised constitutionType; skipping drip');
    }
    if (slugInfo) {
      const name = slugInfo.name;
      const slug = slugInfo.slug;

      const checkRes = await pgrstFetch(
        `${SUPABASE_URL}/rest/v1/quiz_completions?email=eq.${encodeURIComponent(normalizedEmail)}&select=id,email_1_sent_at&limit=1`,
        {
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );
      // A failed lookup must not fall into the first-time branch: that re-sends
      // Email 1 to a retaker and re-arms their already-sent drip rows.
      if (!checkRes.ok) {
        console.error('quiz_completions lookup failed', checkRes.status);
        return json(503, { error: 'Something went wrong. Please try again.' });
      }
      const existing = await checkRes.json();
      const alreadyNurtured =
        Array.isArray(existing) && existing.length > 0 && existing[0].email_1_sent_at;

      if (alreadyNurtured) {
        // Retake. Update constitution fields; the AFTER UPDATE trigger refreshes
        // waitlist_signups.metadata to the latest result while preserving entered_at.
        console.log('Existing nurture sequence — updating constitution info only');
        await pgrstFetch(
          `${SUPABASE_URL}/rest/v1/quiz_completions?email=eq.${encodeURIComponent(normalizedEmail)}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify({
              constitution_type: slug,
              constitution_name: name,
              constitution_nickname: name,
            }),
          }
        );
      } else {
        // First-time completion. Insert the row (AFTER INSERT trigger creates
        // the waitlist_signups row) and schedule the 4-email nurture drip.
        const now = new Date();
        const nowIso = now.toISOString();

        if (Array.isArray(existing) && existing.length > 0) {
          await pgrstFetch(
            `${SUPABASE_URL}/rest/v1/quiz_completions?email=eq.${encodeURIComponent(normalizedEmail)}`,
            {
              method: 'PATCH',
              headers: {
                'apikey': SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal',
              },
              body: JSON.stringify({
                constitution_type: slug,
                constitution_name: name,
                constitution_nickname: name,
                email_1_sent_at: nowIso,
                email_2_sent_at: nowIso,
                email_3_sent_at: nowIso,
                email_4_sent_at: nowIso,
              }),
            }
          );
        } else {
          const insRes = await fetch(`${SUPABASE_URL}/rest/v1/quiz_completions`, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify({
              email: normalizedEmail,
              first_name: firstNameSafe,
              constitution_type: slug,
              constitution_name: name,
              constitution_nickname: name,
              email_1_sent_at: nowIso,
              email_2_sent_at: nowIso,
              email_3_sent_at: nowIso,
              email_4_sent_at: nowIso,
            }),
          });
          if (!insRes.ok && insRes.status !== 409) console.error('quiz_completions insert failed', insRes.status);
        }
        console.log('Quiz completion recorded, scheduling nurture emails');

        // Producer side of Lock #48 (v3.34 Item A): Email 1 ships synchronously
        // via Resend (immediate user-facing signal). Emails 2-4 are enqueued
        // into public.nurture_email_queue; the cron-driven nurture-emails EF
        // (consumer) drains the queue and sends synchronously using the CURRENT
        // Sending API key. Replaces Resend `scheduled_at` which binds each
        // pre-scheduled send to the originating API key — see
        // feedback_resend_scheduled_at_brittle.md and the coliveira77 incident.
        const enqueueNurture = async () => {
          try {
            const sendHeaders = {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            };
            const from = 'Camila at The Eden Institute <hello@edeninstitute.health>';
            const replyTo = 'hello@edeninstitute.health';

            // Email 1: synchronous send. Tagged so the founder dashboard's
            // engagement view attributes opens/clicks to this first touch,
            // matching the campaign/email_key tags the nurture-emails EF sets
            // on Emails 2-7 (see public.email_events + resend-webhook).
            const e1 = buildNurtureEmail1(name, slug);
            const e1u = await applyUnsub(e1.html, normalizedEmail, 'constitution');
            const e1Res = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: sendHeaders,
              body: JSON.stringify({
                from,
                reply_to: replyTo,
                to: [normalizedEmail],
                subject: e1.subject,
                html: e1u.html,
                headers: e1u.headers,
                tags: [
                  { name: 'campaign', value: 'constitution' },
                  { name: 'email_key', value: 'constitution_1' },
                ],
              }),
            });
            if (!e1Res.ok) console.error('Nurture Email 1 send failed', e1Res.status);
            else console.log('Nurture Email 1 sent');

            // Emails 2/3/4: UPSERT into nurture_email_queue
            const day2 = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
            const day4 = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString();
            const day6 = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString();
            // 3-arc (post-drip): Deep Dive + class / app + book / homeschool + FB.
            // Positions 5/6/7 are free — E5 is tracked on quiz_completions, not
            // the queue. Scheduled day 11/14/17, after the day-8 E5.
            const day11 = new Date(now.getTime() + 11 * 24 * 60 * 60 * 1000).toISOString();
            const day14 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
            const day17 = new Date(now.getTime() + 17 * 24 * 60 * 60 * 1000).toISOString();
            const queueRows = [
              { recipient_email: normalizedEmail, sequence_position: 2, constitution_pattern: name, scheduled_for: day2, status: 'pending' },
              { recipient_email: normalizedEmail, sequence_position: 3, constitution_pattern: name, scheduled_for: day4, status: 'pending' },
              { recipient_email: normalizedEmail, sequence_position: 4, constitution_pattern: name, scheduled_for: day6, status: 'pending' },
              { recipient_email: normalizedEmail, sequence_position: 5, constitution_pattern: name, scheduled_for: day11, status: 'pending' },
              { recipient_email: normalizedEmail, sequence_position: 6, constitution_pattern: name, scheduled_for: day14, status: 'pending' },
              { recipient_email: normalizedEmail, sequence_position: 7, constitution_pattern: name, scheduled_for: day17, status: 'pending' },
            ];
            const queueRes = await fetch(`${SUPABASE_URL}/rest/v1/nurture_email_queue`, {
              method: 'POST',
              headers: {
                'apikey': SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal,resolution=merge-duplicates',
              },
              body: JSON.stringify(queueRows),
            });
            if (!queueRes.ok) {
              const errText = await queueRes.text().catch(() => '<unreadable>');
              console.error('nurture_email_queue UPSERT failed', { status: queueRes.status, body: errText });
            } else {
              console.log('Nurture Emails 2-4 enqueued (days 2/4/6)');
            }
          } catch (nurtureErr) {
            console.error('Nurture enqueue error:', String(nurtureErr));
          }
        };

        // Awaited: the isolate can be torn down once the response is returned,
        // and quiz_completions is already stamped email_1..4_sent_at, so a lost
        // send or enqueue would never be retried. enqueueNurture never throws.
        await enqueueNurture();
      }

      // Backfill resend_contact_id on the quiz_funnel waitlist_signups row
      // (which the trigger created/refreshed above).
      if (resendContactId) {
        await waitlistMarkSyncedByFunnel(normalizedEmail, 'quiz_funnel', resendContactId).catch((e) =>
          console.warn('quiz_funnel waitlist sync update failed:', String(e))
        );
      }
    }

    // ── Step 5: Welcome email dispatch (non-quiz paths) ──
    let emailContent: { subject: string; html: string } | null = null;
    if (entry_funnel === 'course_tier2') {
      emailContent = buildFoundationsEmail(firstNameHtml);
    } else if (entry_funnel === 'app_beta') {
      emailContent = buildAppBetaEmail(firstNameHtml);
    } else if (entry_funnel === 'homeschool') {
      emailContent = buildHomeschoolEmail(firstNameHtml);
    } else if (entry_funnel === 'community') {
      emailContent = buildCommunityEmail(firstNameHtml);
    } else if (entry_funnel === 'edens_table') {
      // Phase 3.1 Day-1: source-branched routing for /homeschool CTAs.
      //   'reserve'           → Founders Club welcome (no PDFs)
      //   'sprouts_magnet'    → Sprouts W1 (Lavender) with 6 PDF download buttons
      //   'seedlings_magnet'  → Seedlings W1 (Elderberry) with 6 PDF download buttons
      // Day-7 Week-2 send is Phase 3.1.2 (nurture_email_queue + Vercel cron sender);
      // The Day 0 email no longer promises a Week 2, so there is nothing for a
      // recipient to chase if this enqueue fails. Position 2 now carries the paid
      // Starter Unit offer (founder decision 2026-08-27, one free week per band).
      if (source === 'sprouts_magnet') {
        emailContent = buildSproutsMagnetEmail(firstNameHtml);
      } else if (source === 'seedlings_magnet') {
        emailContent = buildSeedlingsMagnetEmail(firstNameHtml);
      } else {
        // 'reserve' used to route to the Founders Club welcome ("Preorders are
        // open now, the first 500 kits sell at $249"). Preorders closed on
        // 2026-09-12 (print-first pivot), so that email and its founding-window
        // check were deleted; the source now falls through here like any other.
        // Unknown source on edens_table funnel → legacy Homeschool welcome email
        // (the "Early Access" copy currently deployed; safest fallback for any
        // signups that hit this EF without a source we recognize).
        emailContent = buildHomeschoolEmail(firstNameHtml);
      }
    }
    // quiz_funnel is handled by the nurture sequence above.

    // Per-recipient cap on the welcome send: a repeat POST for the same address
    // re-sends it, so without a cap anyone can flood one inbox. Signup itself
    // (row, Resend contact, 200) is unaffected. Fails open on a limiter error.
    let sendAllowed = true;
    if (emailContent) {
      const sendCount = await bumpRateBucket({
        supabaseUrl: SUPABASE_URL,
        serviceKey: SUPABASE_SERVICE_ROLE_KEY,
        key: `waitlist_send:${normalizedEmail}`,
        windowSeconds: 86400,
      });
      sendAllowed = sendCount === null || sendCount <= 3;
      if (!sendAllowed) console.warn('welcome send throttled (per-recipient cap)');
    }

    let welcomeSent = false;
    if (emailContent && sendAllowed) {
      try {
        // All non-quiz welcome emails belong to the homeschool list (the live
        // edens_table/homeschool funnels; retired funnels fall through here too
        // but no longer receive signups).
        await sendEmail(normalizedEmail, emailContent.subject, emailContent.html, 'homeschool');
        welcomeSent = true;
      } catch (emailErr) {
        console.error('Welcome email send error:', String(emailErr));
      }
    }

    // Enqueue the magnet Day-7 send into
    // public.magnet_email_queue (NOT nurture_email_queue, which is the quiz drip).
    // Drained by the nurture-emails cron. Non-fatal: a failure here never blocks signup.
    //
    // 2026-07-28: position 3 (Day-14 Facebook) is NO LONGER enqueued. A new lead
    // now gets free week 1 inline, free week 2 on day 7, and then the preorder
    // series from day 9 (enqueue_launch_sequence_on_signup, migration
    // 20260728233000). Positions 4-7 chain off 3 via MAGNET_CHAIN_NEXT in
    // nurture-emails, so dropping 3 ends the whole W3-W7 tail without touching
    // the chain map, and without stranding anyone already partway through it.
    if (welcomeSent && entry_funnel === 'edens_table' && (source === 'sprouts_magnet' || source === 'seedlings_magnet')) {
      try {
        const band = source === 'sprouts_magnet' ? 'sprouts' : 'seedlings';
        const nowMs = Date.now();
        const day7 = new Date(nowMs + 7 * 24 * 60 * 60 * 1000).toISOString();
        const magnetRows = [
          { recipient_email: normalizedEmail, first_name: firstNameSafe, band, sequence_position: 2, scheduled_for: day7, status: 'pending' },
        ];
        // ignore-duplicates, not merge: merging would flip an already 'sent'
        // row back to pending with a new date and re-send the day-7 offer to a
        // repeat signup. The first schedule stands.
        const mqRes = await pgrstFetch(`${SUPABASE_URL}/rest/v1/magnet_email_queue?on_conflict=recipient_email,band,sequence_position`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY!,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal,resolution=ignore-duplicates',
          },
          body: JSON.stringify(magnetRows),
        });
        if (!mqRes.ok) {
          const t = await mqRes.text().catch(() => '<unreadable>');
          console.error('magnet_email_queue UPSERT failed', { status: mqRes.status, body: t });
        } else {
          console.log(`Magnet day-7 Starter offer enqueued (${band})`);
        }
      } catch (mqErr) {
        console.error('Magnet enqueue error:', String(mqErr));
      }
    }

    // ── Resend contact properties (nurture roadmap Phase 1, 2026-09-03) ──
    // Point write of what THIS signup tells us: funnel, band, quiz_status. The
    // nightly contact-properties-sync recomputes every key from Postgres
    // (view resend_contact_state_computed), so a miss here is repaired later
    // and is never fatal to the signup. funnel is written only when this
    // request created the contact or the funnel is edens_table, so a later
    // quiz signup cannot demote a homeschool lead's funnel value.
    try {
      const props: ContactProperties = {};
      if (createdContactNow || entry_funnel === 'edens_table') props.funnel = entry_funnel;
      if (entry_funnel === 'edens_table' && (source === 'sprouts_magnet' || source === 'seedlings_magnet')) {
        const band = source === 'sprouts_magnet' ? 'sprouts' : 'seedlings';
        const otherBand = band === 'sprouts' ? 'seedlings' : 'sprouts';
        // A both-band family has magnet rows for both bands; the row for THIS
        // band was just enqueued above, so only the other band is checked.
        const otherRes = await fetch(
          `${SUPABASE_URL}/rest/v1/magnet_email_queue?recipient_email=eq.${encodeURIComponent(normalizedEmail)}&band=eq.${otherBand}&select=id&limit=1`,
          {
            headers: {
              apikey: SUPABASE_SERVICE_ROLE_KEY!,
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
          },
        );
        const otherRows = otherRes.ok ? await otherRes.json().catch(() => []) : [];
        props.band = Array.isArray(otherRows) && otherRows.length > 0 ? 'both' : band;
      }
      if (source === 'constitution_assessment') props.quiz_status = 'completed';
      const propWrite = await setContactProperties(normalizedEmail, props, {
        firstName: firstNameSafe,
        createIfMissing: false,
      });
      if (!propWrite.ok) {
        console.warn('Resend contact properties write failed:', propWrite.status, propWrite.error);
      }
    } catch (propErr) {
      console.warn('Resend contact properties exception:', String(propErr));
    }

    // ── Meta Conversions API (server-side Lead) ──
    // Dormant until META_CAPI_ACCESS_TOKEN is set as an EF secret. Deduped
    // against the client Pixel Lead via the shared fbEventId. Wrapped so a Meta
    // outage can never fail a signup.
    // Consent-gated to stay symmetric with the client Pixel (Lock #81): the
    // browser Pixel only fires on cookie-banner Accept, so the server Lead must
    // too. The frontend sends marketingConsent=true only when the visitor
    // granted marketing consent; absent/false means no server-side tracking.
    if (marketingConsent === true) {
      await sendMetaCapiLead({
        email: normalizedEmail,
        eventId: typeof fbEventId === 'string' ? fbEventId : undefined,
        sourceUrl: source_url ?? null,
        headers: req.headers,
      });
    }

    return json(200, {
      success: true,
      waitlist_id: waitlistId,
      entry_funnel,
      resend_contact_id: resendContactId,
      welcome_email_sent: welcomeSent,
      message: "You're on the list. Check your inbox.",
    });
  } catch (err) {
    const unhandledMessage = err instanceof Error ? err.message : String(err);
    const unhandledStack = err instanceof Error ? err.stack : undefined;
    console.error('Unhandled error:', unhandledMessage, unhandledStack);
    // The raw message stays in the log; anonymous callers get the generic line.
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
});

// ── Helpers ──

// Detect a definitely-undeliverable / mistyped email domain. Returns a suggested
// correction, or null if the domain looks fine. Conservative: only flags
// guaranteed-bad domains (dead TLDs, single-domain providers on the wrong TLD)
// so it never hard-blocks an unusual-but-valid address. Mirrors src/lib/emailTypos.ts.
// Structural deliverability check, run BEFORE detectEmailTypo.
//
// detectEmailTypo deliberately returns null when the domain has no dot, and the
// caller read that as "address is fine". That hole let six undeliverable
// addresses into the July 2026 launch sequence, each failing on all six sends:
// four with no dot in the domain (gmail, hotmail), one with a mangled TLD run
// together (hotmailcom, gmailc), and one whose local part ended in a dot.
// A domain with no dot cannot receive mail, so it is rejected outright.
// Mirrors hasDeliverableShape in src/lib/emailTypos.ts.
function hasDeliverableShape(email: string): boolean {
  const at = email.lastIndexOf('@');
  if (at < 1 || at === email.length - 1) return false;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!/^[^\s@]+$/.test(local)) return false;
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  if (!/^[^\s@.]+(\.[^\s@.]+)+$/.test(domain)) return false;
  return domain.slice(domain.lastIndexOf('.') + 1).length >= 2;
}

function detectEmailTypo(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 1) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1).toLowerCase();
  if (!domain.includes('.') || domain.endsWith('.')) return null;
  const parts = domain.split('.');
  const ccSld = new Set(['com.au', 'co.uk', 'co.nz', 'com.br', 'co.za', 'com.mx', 'co.in', 'com.sg']);
  let tld: string;
  let sld: string;
  if (parts.length >= 3 && ccSld.has(parts.slice(-2).join('.'))) {
    tld = parts.slice(-2).join('.');
    sld = parts[parts.length - 3];
  } else {
    tld = parts[parts.length - 1];
    sld = parts[parts.length - 2];
  }
  const providerCanonical: Record<string, string> = { gmail: 'gmail.com', googlemail: 'googlemail.com', icloud: 'icloud.com', aol: 'aol.com' };
  if (providerCanonical[sld] && domain !== providerCanonical[sld]) return `${local}@${providerCanonical[sld]}`;
  const badTld: Record<string, string> = { con: 'com', cm: 'com', cmo: 'com', ocm: 'com', vom: 'com', xom: 'com', coom: 'com', comm: 'com', comn: 'com', cim: 'com', clm: 'com', ner: 'net', nett: 'net', ogr: 'org', orgg: 'org' };
  if (badTld[tld]) return `${local}@${sld}.${badTld[tld]}`;
  return null;
}

function str(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

function json(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Insert a waitlist_signups row; on (email, entry_funnel) conflict return
// the existing row. Returns null on unexpected failure.
async function waitlistUpsert(row: {
  email: string;
  first_name: string;
  entry_funnel: EntryFunnel;
  source: string | null;
  source_url: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  consents: Record<string, unknown>;
}): Promise<{ id: string; resend_contact_id: string | null } | null> {
  const insertRes = await fetch(
    `${SUPABASE_URL}/rest/v1/waitlist_signups?select=id,resend_contact_id`,
    {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY!,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY!}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(row),
    }
  );

  if (insertRes.ok) {
    const data = await insertRes.json();
    if (Array.isArray(data) && data.length > 0) {
      return { id: data[0].id, resend_contact_id: data[0].resend_contact_id ?? null };
    }
  }

  // Unique violation (409) → row exists → fetch and return it.
  if (insertRes.status === 409) {
    const fetchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/waitlist_signups?email=eq.${encodeURIComponent(row.email)}&entry_funnel=eq.${row.entry_funnel}&select=id,resend_contact_id&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY!,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY!}`,
        },
      }
    );
    if (fetchRes.ok) {
      const existing = await fetchRes.json();
      if (Array.isArray(existing) && existing.length > 0) {
        return { id: existing[0].id, resend_contact_id: existing[0].resend_contact_id ?? null };
      }
    }
  }

  const errText = await insertRes.text().catch(() => '');
  console.error('waitlist_signups upsert failed:', insertRes.status, errText);
  return null;
}

async function waitlistMarkSyncedById(id: string, resendContactId: string): Promise<void> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/waitlist_signups?id=eq.${id}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY!,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY!}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        resend_contact_id: resendContactId,
        resend_synced_at: new Date().toISOString(),
      }),
    }
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`PATCH by id failed: ${res.status} ${txt}`);
  }
}

async function waitlistMarkSyncedByFunnel(
  email: string,
  funnel: EntryFunnel,
  resendContactId: string,
): Promise<void> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/waitlist_signups?email=eq.${encodeURIComponent(email)}&entry_funnel=eq.${funnel}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY!,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY!}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        resend_contact_id: resendContactId,
        resend_synced_at: new Date().toISOString(),
      }),
    }
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`PATCH by funnel failed: ${res.status} ${txt}`);
  }
}
