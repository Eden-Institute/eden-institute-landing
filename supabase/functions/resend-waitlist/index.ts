// At-signup email builders come from the canonical shared email library.
// resend-waitlist previously inlined a verbatim, collision-renamed copy of
// _shared/nurture-email-templates.ts; that duplicate has been removed so
// _shared is the single source of truth for these templates.
import { buildNurtureEmail1, toSlug } from '../_shared/nurture-email-templates.ts';
import { applyUnsub, type EmailList } from '../_shared/email-unsubscribe.ts';


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

function getSlugInfo(
  constitutionType?: string,
  constitutionSlug?: string,
  constitutionName?: string,
  constitutionNickname?: string,
): { slug: string; name: string } {
  const mapMatch = constitutionType ? CONSTITUTION_SLUG_MAP[constitutionType] : undefined;
  const resolvedName = constitutionName || constitutionNickname || mapMatch?.name || 'Unknown';
  const resolvedSlug = constitutionSlug || mapMatch?.slug || (resolvedName !== 'Unknown' ? toSlug(resolvedName) : 'unknown');
  return { slug: resolvedSlug, name: resolvedName };
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
</td></tr>
<!-- FOOTER -->
<tr><td style="background-color:#F5F0E8;padding:30px 20px;text-align:center;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-family:Georgia,serif;font-size:13px;color:#1C3A2E;text-align:center;">The Eden Institute | edeninstitute.health</td></tr>
<tr><td style="font-family:Georgia,serif;font-size:12px;color:#1C3A2E;text-align:center;padding-top:8px;">You're receiving this because you signed up at edeninstitute.health. No spam, ever.</td></tr>
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
<p style="font-family:Georgia,serif;font-size:16px;color:#1C3A2E;font-weight:bold;margin:0;">— Camila Johnson</p>
<p style="font-family:Georgia,serif;font-size:14px;color:#C9A84C;margin:4px 0 0 0;">The Eden Institute</p>`;
}

// ── Email builders ──

function buildFoundationsEmail(firstName: string): { subject: string; html: string } {
  const body = `
<p style="font-family:Georgia,serif;font-size:18px;color:#1C3A2E;margin:0 0 24px 0;">Hi ${firstName},</p>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 8px 0;">Welcome to the Eden Institute. You're officially on the Foundations Course waitlist — and you'll be among the first to know when enrollment opens.</p>
${goldDivider()}
${goldLabel('WHILE YOU WAIT')}
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 16px 0;">The Foundations Course is built on one conviction: that God did not design the body to be dependent on a system. He designed it to be stewarded. The course teaches you the constitutional framework, the energetic language of plants, and how to match the two — from a scriptural foundation outward.</p>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 24px 0;">Start here. Grab Book One and read the first three chapters. Everything the course teaches grows out of what that book establishes.</p>
${ctaButton('→ PURCHASE BOOK ONE', 'https://www.amazon.com/dp/B0GPW5BZ32')}
${goldDivider()}
${closingBlock()}`;
  return { subject: "You're on the list — here's what's coming", html: emailWrapper(body) };
}

function buildAppBetaEmail(firstName: string): { subject: string; html: string } {
  const body = `
<p style="font-family:Georgia,serif;font-size:18px;color:#1C3A2E;margin:0 0 24px 0;">Hi ${firstName},</p>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 8px 0;">You're on the Eden Apothecary beta waitlist. That means first access when we launch on July 7, 2026 — and founding pricing locked in for the life of your subscription.</p>
${goldDivider()}
${goldLabel('FOUNDING PRICING — LOCKED IN')}
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
<p style="font-family:Georgia,serif;font-size:14px;font-style:italic;color:#C9A84C;margin:0 0 4px 0;">Unlocks with Tier 3 of the Institute — end of 2027</p>
<p style="font-family:Georgia,serif;font-size:13px;line-height:1.5;color:#1C3A2E;margin:0;">Formula builder, multi-system analysis, session notes, exportable PDFs.</p>
</td></tr>
</table>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 16px 0;">The Eden Apothecary is a terrain-based clinical decision-support tool built on the Eclectic, Physiomedical, and Vitalist traditions — grounded in Scripture. From home herbalist to working practitioner, every tier is designed to meet you where you are.</p>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 24px 0;">While you wait, get the foundation in place.</p>
${ctaButton('→ START WITH BOOK ONE', 'https://www.amazon.com/dp/B0GPW5BZ32')}
${goldDivider()}
${closingBlock()}`;
  return { subject: "You're in — Eden Apothecary beta access secured", html: emailWrapper(body) };
}

function buildHomeschoolEmail(firstName: string): { subject: string; html: string } {
  const body = `
    <p style="font-family:Georgia,serif;font-size:18px;color:#1C3A2E;margin:0 0 24px 0;">Hi ${firstName},</p>
    <p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 8px 0;">You're on the list.</p>
    <p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 24px 0;">
      Eden's Table is a K–12 Biblical herbalism curriculum being built for families who believe the earth was created with purpose — and that stewarding it well begins at home. You'll be among the first to see it, price it, and shape it.
    </p>
    <p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 24px 0;">
      While we finish building, consider starting with our adult foundations course. Most of our homeschool families tell us it changed how they teach — because it changed how they understand.
    </p>
    ${ctaButton("Explore the Foundations Course", "https://learn.edeninstitute.health/course/back-to-eden1")}
    ${goldDivider()}
    ${closingBlock()}
  `;
  const footer = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:1px solid #E8E3DA;">
    <tr><td style="text-align:center;padding-top:16px;">
    <p style="font-family:Georgia,serif;font-size:11px;color:#6B6560;margin:0 0 6px 0;">You're receiving this because you signed up at edeninstitute.health.</p>
    <a href="{{UNSUB_URL}}" style="font-family:Georgia,serif;font-size:11px;color:#6B6560;text-decoration:underline;">Unsubscribe</a>
    </td></tr></table>`;
  return {
    subject: "You're on the Eden's Table Waitlist — Here's What's Coming",
    html: `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#FAF8F3;">${body}${footer}</body></html>`
  };
}

function buildCommunityEmail(firstName: string): { subject: string; html: string } {
  const body = `
    <p style="font-family:Georgia,serif;font-size:18px;color:#1C3A2E;margin:0 0 24px 0;">Hi ${firstName},</p>
    <p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 8px 0;">Welcome to the circle.</p>
    <p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 24px 0;">
      The Eden Institute Community is being built for serious students of Biblical herbalism — people who want to go deeper, ask hard questions, and practice together. You'll hear from us as soon as the doors open.
    </p>
    <p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 24px 0;">
      In the meantime, take our free Constitutional Assessment. Knowing your body type is the foundation of everything we teach — and it will make community conversations far richer.
    </p>
    ${ctaButton("Take the Free Constitutional Assessment", "https://edeninstitute.health/assessment")}
    ${goldDivider()}
    ${closingBlock()}
  `;
  return {
    subject: "You're on the Community Waitlist — We're Building Something Worth Waiting For",
    html: `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#FAF8F3;">${body}</body></html>`
  };
}


// ── Phase 3.1 Day-1: source-branched email builders for edens_table funnel ──
// One welcome email per /homeschool CTA. Day-7 Week-2 send is Phase 3.1.2.

function buildFoundersClubEmail(firstName: string): { subject: string; html: string } {
  const body = `
<p style="font-family:Georgia,serif;font-size:18px;color:#1C3A2E;margin:0 0 24px 0;">Hi ${firstName},</p>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 16px 0;">You're in. Your seat at the Eden's Table Founders Club is reserved.</p>
${goldDivider()}
${goldLabel('HOW FOUNDERS PRICING WORKS')}
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 16px 0;">Before launch in 2027, we'll email you your <strong>Founders Code</strong>. Use it at checkout to lock in Founders pricing &mdash; <strong>$249 per band ($249 Sprouts, $249 Seedlings) or $449 for the two-band bundle</strong>. Retail begins at launch: $349 / $349 / $699.</p>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 24px 0;">Until then, you'll hear from us once a month with progress notes &mdash; what's being built, what's being tested, what we're learning.</p>
${goldDivider()}
${goldLabel('WANT LESSONS IN HAND TODAY?')}
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 16px 0;">You don't have to wait until 2027 to start. Download a free sample week &mdash; five real, open-and-go lessons per band (Teacher Guide, Student Notebook, Field Cards, Recipe Cards, and the Around-the-Table deck), yours to print and teach this week. We'll email the downloads the moment you choose a band.</p>
${ctaButton('GET FREE CURRICULUM SAMPLES', 'https://edeninstitute.health/homeschool#early-access')}
${goldDivider()}
${goldLabel('WHILE WE BUILD')}
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 16px 0;">Eden's Table is the children's curriculum. The Eden Institute's adult Tier 1 Course &mdash; the Biblical Framework &mdash; is the soil it grew from. Most parents who go through it tell us their reading of Scripture changes.</p>
${ctaButton('EXPLORE TIER 1 COURSE', 'https://edeninstitute.health/courses', 'secondary')}
${goldDivider()}
${closingBlock()}`;
  return { subject: "You're in the Founders Club — Eden's Table 2027", html: emailWrapper(body) };
}

function buildSproutsMagnetEmail(firstName: string): { subject: string; html: string } {
  const body = `
<p style="font-family:Georgia,serif;font-size:18px;color:#1C3A2E;margin:0 0 24px 0;">Hi ${firstName},</p>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 16px 0;">Thank you for stepping into this work with us. What follows is a real week of curriculum &mdash; Week 1 of Sprouts, the band built for kindergarten through second grade. Not a sample stripped of substance. Five days with Lavender, a story your child will remember, and the small daily rhythms that turn a kitchen counter into a place of formation.</p>
${goldDivider()}
${goldLabel('YOUR FIVE DOWNLOADS &mdash; SPROUTS WEEK 1 (LAVENDER)')}
${ctaButton("TEACHER'S GUIDE", 'https://edeninstitute.health/lead-magnets/hs-sprouts-w1-tg-lavender.pdf')}
${ctaButton('STUDENT NOTEBOOK', 'https://edeninstitute.health/lead-magnets/hs-sprouts-w1-nb-lavender.pdf')}
${ctaButton('FIELD CARDS', 'https://edeninstitute.health/lead-magnets/hs-sprouts-w1-fc-lavender.pdf')}
${ctaButton('RECIPE CARDS', 'https://edeninstitute.health/lead-magnets/hs-sprouts-w1-rc-lavender.pdf')}
${ctaButton('AROUND THE TABLE CARDS', 'https://edeninstitute.health/lead-magnets/hs-sprouts-w1-att-lavender.pdf')}
${goldDivider()}
${goldLabel('WEEK 2 ARRIVES IN ONE WEEK')}
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 16px 0;">Seven days from today, you'll receive Week 2 &mdash; Chamomile, more downloads, the same Sprouts rhythm. If it hasn't arrived by Day 8, just reply to this email and I'll send it manually.</p>
${closingBlock()}`;
  return { subject: 'Sprouts Week 1 (Lavender) — Your Free Preview', html: emailWrapper(body) };
}

function buildSeedlingsMagnetEmail(firstName: string): { subject: string; html: string } {
  const body = `
<p style="font-family:Georgia,serif;font-size:18px;color:#1C3A2E;margin:0 0 24px 0;">Hi ${firstName},</p>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 16px 0;">Thank you for stepping into this work with us. What follows is a real week of curriculum from Seedlings, our band for third through fifth graders. Seedlings is built for the child who has begun to ask <em>why</em> and <em>how</em> &mdash; the one who has outgrown a worksheet and is ready to track a hypothesis across a week. Week 1 starts with Elderberry.</p>
${goldDivider()}
${goldLabel('YOUR FIVE DOWNLOADS &mdash; SEEDLINGS WEEK 1 (ELDERBERRY)')}
${ctaButton("TEACHER'S GUIDE", 'https://edeninstitute.health/lead-magnets/hs-seedlings-w1-tg-elderberry.pdf')}
${ctaButton('STUDENT NOTEBOOK', 'https://edeninstitute.health/lead-magnets/hs-seedlings-w1-nb-elderberry.pdf')}
${ctaButton('FIELD CARDS', 'https://edeninstitute.health/lead-magnets/hs-seedlings-w1-fc-elderberry.pdf')}
${ctaButton('RECIPE CARDS', 'https://edeninstitute.health/lead-magnets/hs-seedlings-w1-rc-elderberry.pdf')}
${ctaButton('AROUND THE TABLE CARDS', 'https://edeninstitute.health/lead-magnets/hs-seedlings-w1-att-elderberry.pdf')}
${goldDivider()}
${goldLabel('WEEK 2 ARRIVES IN ONE WEEK')}
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 16px 0;">Seven days from today, you'll receive Week 2 &mdash; Tulsi, more downloads, the same Seedlings depth. If it hasn't arrived by Day 8, just reply to this email and I'll send it manually.</p>
${closingBlock()}`;
  return { subject: 'Seedlings Week 1 (Elderberry) — Your Free Preview', html: emailWrapper(body) };
}


// ── Constitutional profiles ──

const constitutionProfiles: Record<string, { nickname: string; intro: string; patterns: string; needs: string; herbs: string; anchor: string }> = {
  "Hot / Dry / Tense": {
    nickname: "The Burning Bowstring",
    intro: "You are intense, driven, and finely tuned — and your body runs hot. You were designed with a metabolism that generates heat and a nervous system that doesn't easily let go. This is a gift: your energy, passion, and focus are expressions of that fire. But when that fire isn't tended, it consumes.",
    patterns: "You likely run warm, sleep lightly, and find it difficult to fully relax. Tension lives in your muscles — your jaw, your neck, your shoulders. You may be prone to headaches, skin inflammation, or digestive heat. Emotionally, you feel things sharply and deeply.",
    needs: "Cooling, moistening, and releasing. Herbs that calm the heat without extinguishing your fire.",
    herbs: "Chamomile, Feverfew, California Poppy, Lavender, American Ginseng.",
    anchor: "'A hot-tempered person stirs up conflict, but the one who is patient calms a quarrel.' — Proverbs 15:18. Your constitution understands this tension personally. The work is not to suppress your fire — it is to steward it.",
  },
  "Hot / Dry / Relaxed": {
    nickname: "The Open Flame",
    intro: "You carry genuine warmth — people feel it when they're around you. Your metabolism runs on the warmer side, but your tissue has a softness and laxity to it. You are warm-hearted, open, and generous, but that openness can sometimes mean poor boundaries — physically and emotionally.",
    patterns: "Heat symptoms with poor tissue tone. You may experience varicose veins, hemorrhoids, or a tendency toward prolapse. Loose stools with heat. You absorb warmth from your environment and from people.",
    needs: "Cooling and toning. Herbs that reduce heat while firming and toning lax tissue.",
    herbs: "Yarrow, Witch Hazel, Raspberry Leaf, Goldenrod, Bayberry.",
    anchor: "'Like a city whose walls are broken through is a person who lacks self-control.' — Proverbs 25:28. The work of your constitution is to tend your warmth while building strong walls.",
  },
  "Hot / Damp / Tense": {
    nickname: "The Pressure Cooker",
    intro: "You hold heat and dampness simultaneously — a combination that produces pressure. There is real fire here, but it has nowhere to go.",
    patterns: "Damp-heat patterns throughout. Acne, eczema with oozing, urinary tract infections, liver heat, congested lymphatics. Tension in the body that compounds the congestion.",
    needs: "Cooling, drying, and moving. Herbs that drain heat and dampness while encouraging lymphatic circulation.",
    herbs: "Dandelion, Burdock, Calendula, Cleavers, Chickweed.",
    anchor: "'He who tends a fig tree will eat its fruit.' — Proverbs 27:18. The congestion in your constitution is often the result of neglected tending. Regular, consistent care transforms the pattern.",
  },
  "Hot / Damp / Relaxed": {
    nickname: "The Overflowing Cup",
    intro: "Your constitution generates heat and holds moisture — a full, generous pattern. You are likely warm and welcoming by nature. But when out of balance, that fullness tips into excess.",
    patterns: "Congested lymphatics, sluggish liver, skin eruptions with heat. Prone to weight gain with warmth. Social and generous, but boundaries can be unclear.",
    needs: "Cooling, drying, and moving stagnation. Herbs that clear damp heat and encourage drainage.",
    herbs: "Elder, Cleavers, Red Clover, Calendula, Dandelion.",
    anchor: "'My cup overflows.' — Psalm 23:5. Overflow is a blessing — but only when the cup is regularly poured out. Your work is circulation, generosity, and release.",
  },
  "Cold / Dry / Tense": {
    nickname: "The Drawn Bowstring",
    intro: "You are wound tightly and running on empty. Cold from depletion, dry from exhaustion, tense from the nervous system trying to hold everything together with insufficient resources. You may identify as anxious, hypersensitive, or prone to overthinking.",
    patterns: "Poor circulation, cold extremities, dry skin, constipation, tension headaches, insomnia, anxiety, and chronic pain that is tight and cramping.",
    needs: "Warming, moistening, and nourishing. Herbs that feed the depleted reserves while gently releasing the tension.",
    herbs: "Ashwagandha, Ginger, Cinnamon, Asian Ginseng, Valerian, Hawthorn.",
    anchor: "'He gives strength to the weary and increases the power of the weak.' — Isaiah 40:29. Your constitution is not a character flaw. It is a call to receive.",
  },
  "Cold / Dry / Relaxed": {
    nickname: "The Spent Candle",
    intro: "Your reserves have been drawn down. Cold, dry, and without the tone to pull things back up — this constitution speaks of genuine depletion. You may have given much, rested little, and now find that your body simply doesn't have the same resilience it once did.",
    patterns: "Deep fatigue, poor immunity, tendency toward atrophy or prolapse, thin tissue, dry mucous membranes, poor wound healing.",
    needs: "Deep, slow nourishment. Warming, moistening, tonic herbs that rebuild rather than stimulate.",
    herbs: "Astragalus, Asian Ginseng, Eleuthero, Marshmallow Root, Ashwagandha, Ginger.",
    anchor: "'He restores my soul.' — Psalm 23:3. Restoration is not earned. It is received. Your work is to stop, be still, and let the restoration come.",
  },
  "Cold / Damp / Tense": {
    nickname: "The Frozen Knot",
    intro: "Cold and damp with nowhere to move — the pressure builds inside while the exterior is stiff and bound. The tension here is not wired or anxious. It is cold, heavy, and immovable.",
    patterns: "Chronic mucus, phlegm, stiff and cold joints, slow digestion, bloating, cold hands and feet with tension headaches. Tends toward melancholy or feeling unmotivated.",
    needs: "Warming and moving. Herbs that ignite the cold and get things circulating again.",
    herbs: "Cayenne, Ginger, Fennel, Garlic, Thyme, Horseradish.",
    anchor: "'There is a time for everything, and a season for every activity under the heavens.' — Ecclesiastes 3:1. The frozen knot needs one thing: the return of warmth. Your season of movement is coming.",
  },
  "Cold / Damp / Relaxed": {
    nickname: "The Still Water",
    intro: "Slow, cool, and full — this is the most common constitution in the modern Western world. The pattern of metabolic slowdown, fluid retention, easy weight gain, chronic fatigue, and a sluggish immune system is epidemic. It is not a moral failure or a lack of willpower. It is a constitutional pattern — and it responds beautifully to constitutional care.",
    patterns: "Sluggish metabolism, weight gain, fluid retention, brain fog, chronic fatigue, frequent illness, low thyroid signs. Often presents as 'I just can't get going.'",
    needs: "Warming, drying, and stimulating. Herbs that ignite the metabolism, move the lymphatics, and restore the body's thermostat.",
    herbs: "Cayenne, Ginger, Cinnamon, Garlic, Eleuthero, Astragalus, Fennel.",
    anchor: "'Wake up, sleeper, rise from the dead, and Christ will shine on you.' — Ephesians 5:14. This is not a judgment — it is an invitation. Still water can move. The body was designed to wake up.",
  },
};

function buildAssessmentEmail(firstName: string, constitutionType: string, slugInfo: { slug: string; name: string }): { subject: string; html: string } {
  const profile = constitutionProfiles[constitutionType];
  if (!profile) {
    const fallback = `<p style="font-family:Georgia,serif;font-size:16px;color:#1C3A2E;">Hi ${firstName},</p><p style="font-family:Georgia,serif;font-size:16px;color:#1C3A2E;">Your constitutional assessment is complete. Your type is: ${constitutionType}.</p>`;
    return { subject: `Your constitutional type: ${constitutionType}`, html: emailWrapper(fallback) };
  }

  const body = `
<p style="font-family:Georgia,serif;font-size:18px;color:#1C3A2E;margin:0 0 24px 0;">Hi ${firstName},</p>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 8px 0;">Your constitutional assessment is complete. Here is your profile snapshot.</p>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 8px 0;">Want the full deep-dive? Your complete guide — all 10 herbs, preparation methods, lifestyle protocols, and Biblical framework — is available for just $14.</p>
${goldDivider()}
<!-- Constitutional Type Display Block -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #C9A84C;background-color:#F5F0E8;margin-bottom:24px;">
<tr><td style="padding:30px;text-align:center;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-family:Georgia,serif;font-size:12px;font-weight:bold;letter-spacing:3px;color:#C9A84C;text-transform:uppercase;text-align:center;padding-bottom:12px;">YOUR CONSTITUTIONAL TYPE</td></tr>
<tr><td style="font-family:Georgia,serif;font-size:28px;font-weight:bold;color:#1C3A2E;text-align:center;padding-bottom:8px;">${constitutionType}</td></tr>
<tr><td style="font-family:Georgia,serif;font-size:18px;font-style:italic;color:#C9A84C;text-align:center;">${profile.nickname}</td></tr>
</table>
</td></tr>
</table>
${ctaButton('→ GET YOUR FULL DEEP-DIVE GUIDE — $14', `https://edeninstitute.health/guide/${slugInfo.slug}`)}
${goldDivider()}
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 20px 0;">${profile.intro}</p>
<p style="font-family:Georgia,serif;font-size:16px;font-weight:bold;color:#1C3A2E;margin:0 0 8px 0;">Your body's patterns:</p>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 20px 0;">${profile.patterns}</p>
<p style="font-family:Georgia,serif;font-size:16px;font-weight:bold;color:#1C3A2E;margin:0 0 8px 0;">What your body needs:</p>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 20px 0;">${profile.needs}</p>
<p style="font-family:Georgia,serif;font-size:16px;font-weight:bold;color:#1C3A2E;margin:0 0 8px 0;">Your primary herbs:</p>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 20px 0;">${profile.herbs}</p>
<!-- Biblical Anchor Block -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
<tr>
<td style="width:4px;background-color:#C9A84C;"></td>
<td style="background-color:#F5F0E8;padding:20px;">
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;font-style:italic;margin:0;"><strong>Biblical anchor:</strong> ${profile.anchor}</p>
</td>
</tr>
</table>
${goldDivider()}
${goldLabel('WHAT THIS MEANS FOR YOU')}
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 16px 0;">Understanding your constitution is the beginning — not the end. The Foundations Course teaches you how to read your constitution in real time, how to track it as it shifts with seasons and stress, and how to match it precisely to God's provision in the plant world.</p>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;font-weight:bold;margin:0 0 24px 0;">You were not designed to guess. You were designed to know.</p>
${ctaButton('→ JOIN THE FOUNDATIONS COURSE WAITLIST', 'https://edeninstitute.health/#foundation')}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:12px;font-size:0;line-height:0;">&nbsp;</td></tr></table>
${ctaButton('→ PURCHASE BOOK ONE', 'https://www.amazon.com/dp/B0GPW5BZ32', 'secondary')}
${goldDivider()}
<p style="font-family:Georgia,serif;font-size:16px;color:#1C3A2E;font-weight:bold;margin:0;">— Camila Johnson</p>
<p style="font-family:Georgia,serif;font-size:14px;color:#C9A84C;margin:4px 0 0 0;">The Eden Institute</p>`;

  return {
    subject: `Your constitutional type: ${constitutionType} — ${profile.nickname}`,
    html: emailWrapper(body),
  };
}

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
      source,
      constitutionType,
      constitutionSlug,
      constitutionName,
      constitutionNickname,
      entry_funnel: providedFunnel,
      consents,
      source_url,
      referrer,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_term,
      utm_content,
      fbEventId,
      marketingConsent,
    } = body;

    if (!email) {
      return json(400, { error: 'Email is required' });
    }

    // v3.34: tolerate empty firstName for auto-submit logged-in path (Phase 5
    // fix #3 / launch-blocker #57). Logged-in user_metadata.first_name may be
    // null and profiles.display_name may not yet be populated. Default to a
    // personable fallback rather than 400-ing the request — nurture email
    // greetings render "Hi Friend," in this edge case, which is acceptable.
    const firstNameRaw = typeof firstName === 'string' ? firstName.trim() : '';
    const firstNameSafe = firstNameRaw || 'Friend';

    const normalizedEmail = String(email).trim().toLowerCase();

    // Reject clearly-undeliverable / mistyped domains (e.g. gmail.con,
    // gmail.co, live.con, passmail.ner) before creating a Resend contact
    // that can only hard-bounce. Mirrors client-side src/lib/emailTypos.ts.
    const emailTypoSuggestion = detectEmailTypo(normalizedEmail);
    if (emailTypoSuggestion) {
      return json(400, { error: `That email address looks misspelled. Did you mean ${emailTypoSuggestion}?`, suggestion: emailTypoSuggestion });
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
          console.log('Resend contact created:', resendContactId);
        } else if (contactRes.status === 409) {
          // Contact already exists in this audience. Not an error, just means
          // the signup came through a path where we don't yet know the prior
          // resend_contact_id. A follow-up GET can retrieve it; for now we
          // leave resend_contact_id null and let reconciliation fill it in.
          console.log('Resend contact already exists for', normalizedEmail);
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
    if (source === 'constitution_assessment' && constitutionType) {
      const slugInfo = getSlugInfo(
        constitutionType,
        constitutionSlug,
        constitutionName,
        constitutionNickname,
      );
      const name = slugInfo.name;
      const slug = slugInfo.slug;

      const checkRes = await fetch(
        `${SUPABASE_URL}/rest/v1/quiz_completions?email=eq.${encodeURIComponent(normalizedEmail)}&select=id,email_1_sent_at&limit=1`,
        {
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const existing = await checkRes.json();
      const alreadyNurtured =
        Array.isArray(existing) && existing.length > 0 && existing[0].email_1_sent_at;

      if (alreadyNurtured) {
        // Retake. Update constitution fields; the AFTER UPDATE trigger refreshes
        // waitlist_signups.metadata to the latest result while preserving entered_at.
        console.log(`Existing nurture sequence for ${normalizedEmail} — updating constitution info only`);
        await fetch(
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
          await fetch(
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
          await fetch(`${SUPABASE_URL}/rest/v1/quiz_completions`, {
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

            // Email 1: synchronous send (unchanged)
            const e1 = buildNurtureEmail1(firstNameSafe, name, slug);
            const e1u = await applyUnsub(e1.html, normalizedEmail, 'constitution');
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: sendHeaders,
              body: JSON.stringify({ from, reply_to: replyTo, to: [normalizedEmail], subject: e1.subject, html: e1u.html, headers: e1u.headers }),
            });
            console.log('Nurture Email 1 sent to', normalizedEmail);

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
              console.error('nurture_email_queue UPSERT failed', { status: queueRes.status, body: errText, email: normalizedEmail });
            } else {
              console.log('Nurture Emails 2-4 enqueued for', normalizedEmail, '(days 2/4/6)');
            }
          } catch (nurtureErr) {
            console.error('Nurture enqueue error:', String(nurtureErr));
          }
        };

        enqueueNurture().catch((err) =>
          console.error('Nurture enqueueing failed:', String(err))
        );
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
      emailContent = buildFoundationsEmail(firstNameSafe);
    } else if (entry_funnel === 'app_beta') {
      emailContent = buildAppBetaEmail(firstNameSafe);
    } else if (entry_funnel === 'homeschool') {
      emailContent = buildHomeschoolEmail(firstNameSafe);
    } else if (entry_funnel === 'community') {
      emailContent = buildCommunityEmail(firstNameSafe);
    } else if (entry_funnel === 'edens_table') {
      // Phase 3.1 Day-1: source-branched routing for /homeschool CTAs.
      //   'reserve'           → Founders Club welcome (no PDFs)
      //   'sprouts_magnet'    → Sprouts W1 (Lavender) with 6 PDF download buttons
      //   'seedlings_magnet'  → Seedlings W1 (Elderberry) with 6 PDF download buttons
      // Day-7 Week-2 send is Phase 3.1.2 (nurture_email_queue + Vercel cron sender);
      // for now the email tells recipients to reply if Week 2 doesn't arrive by Day 8.
      if (source === 'sprouts_magnet') {
        emailContent = buildSproutsMagnetEmail(firstNameSafe);
      } else if (source === 'seedlings_magnet') {
        emailContent = buildSeedlingsMagnetEmail(firstNameSafe);
      } else if (source === 'reserve') {
        emailContent = buildFoundersClubEmail(firstNameSafe);
      } else {
        // Unknown source on edens_table funnel → legacy Homeschool welcome email
        // (the "Early Access" copy currently deployed; safest fallback for any
        // signups that hit this EF without a source we recognize).
        emailContent = buildHomeschoolEmail(firstNameSafe);
      }
    }
    // quiz_funnel is handled by the nurture sequence above.

    let welcomeSent = false;
    if (emailContent) {
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

    // Phase 3.1.2: enqueue the magnet Day-7 (Week 2) + Day-14 (Facebook) sends into
    // public.magnet_email_queue (NOT nurture_email_queue, which is the quiz drip).
    // Drained by the nurture-emails cron. Non-fatal: a failure here never blocks signup.
    if (welcomeSent && entry_funnel === 'edens_table' && (source === 'sprouts_magnet' || source === 'seedlings_magnet')) {
      try {
        const band = source === 'sprouts_magnet' ? 'sprouts' : 'seedlings';
        const nowMs = Date.now();
        const day7 = new Date(nowMs + 7 * 24 * 60 * 60 * 1000).toISOString();
        const day14 = new Date(nowMs + 14 * 24 * 60 * 60 * 1000).toISOString();
        const magnetRows = [
          { recipient_email: normalizedEmail, first_name: firstNameSafe, band, sequence_position: 2, scheduled_for: day7, status: 'pending' },
          { recipient_email: normalizedEmail, first_name: firstNameSafe, band, sequence_position: 3, scheduled_for: day14, status: 'pending' },
        ];
        const mqRes = await fetch(`${SUPABASE_URL}/rest/v1/magnet_email_queue?on_conflict=recipient_email,band,sequence_position`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY!,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal,resolution=merge-duplicates',
          },
          body: JSON.stringify(magnetRows),
        });
        if (!mqRes.ok) {
          const t = await mqRes.text().catch(() => '<unreadable>');
          console.error('magnet_email_queue UPSERT failed', { status: mqRes.status, body: t, email: normalizedEmail });
        } else {
          console.log('Magnet Week 2 + Facebook emails enqueued for', normalizedEmail, `(${band}, days 7/14)`);
        }
      } catch (mqErr) {
        console.error('Magnet enqueue error:', String(mqErr));
      }
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
    return json(500, { error: unhandledMessage });
  }
});

// ── Helpers ──

// Detect a definitely-undeliverable / mistyped email domain. Returns a suggested
// correction, or null if the domain looks fine. Conservative: only flags
// guaranteed-bad domains (dead TLDs, single-domain providers on the wrong TLD)
// so it never hard-blocks an unusual-but-valid address. Mirrors src/lib/emailTypos.ts.
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

function json(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ── Meta Conversions API (server-side, deduped with the client Pixel) ──
const META_PIXEL_ID = '1535058498232762';
const META_CAPI_ACCESS_TOKEN = Deno.env.get('META_CAPI_ACCESS_TOKEN') ?? '';

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input.trim().toLowerCase());
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Sends a server-side "Lead" to Meta. No-op when the access token isn't set, so
// the integration is inert until configured. Email is SHA-256 hashed (Meta
// requirement); IP + UA are forwarded for match quality but never stored by us.
async function sendMetaCapiLead(opts: {
  email: string;
  eventId?: string;
  sourceUrl?: string | null;
  headers: Headers;
}): Promise<void> {
  if (!META_CAPI_ACCESS_TOKEN) return;
  try {
    const emHash = await sha256Hex(opts.email);
    const ip = (opts.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
    const ua = opts.headers.get('user-agent') ?? '';
    const payload = {
      data: [
        {
          event_name: 'Lead',
          event_time: Math.floor(Date.now() / 1000),
          event_id: opts.eventId || crypto.randomUUID(),
          action_source: 'website',
          event_source_url:
            opts.sourceUrl || opts.headers.get('referer') || 'https://edeninstitute.health/',
          user_data: {
            em: [emHash],
            ...(ip ? { client_ip_address: ip } : {}),
            ...(ua ? { client_user_agent: ua } : {}),
          },
        },
      ],
    };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    try {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(META_CAPI_ACCESS_TOKEN)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: ctrl.signal },
      );
      if (!res.ok) console.error('Meta CAPI Lead failed', res.status, await res.text().catch(() => ''));
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    // Never throw — a signup must not depend on Meta being reachable.
    console.error('Meta CAPI Lead error', String(e));
  }
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
