// ============================================================
// [INLINED FROM] supabase/functions/_shared/nurture-email-templates.ts
// Collisions renamed: emailWrapper → __shared_emailWrapper, goldDivider → __shared_goldDivider
// ============================================================

// ── Brand constants (Eden Institute) ──
const BRAND = {
  bgOuter: '#F5F0E8',
  bgBody: '#FFFFFF',
  forest: '#2C3E2D',
  text: '#3D3832',
  gold: '#C5A44E',
  sage: '#5C7A5C',
  footerText: '#6B6560',
};

// ── Slug helper ──
export function toSlug(nickname: string): string {
  return nickname.replace(/^The /, '').toLowerCase().replace(/\s+/g, '-');
}

// ── Data mappings ──
const TOP_HERBS: Record<string, { name: string; note: string }[]> = {
  'burning-bowstring': [
    { name: 'Chamomile', note: 'Cools heat and calms digestive tension.' },
    { name: 'California Poppy', note: 'Relaxes nervous tension without sedation.' },
    { name: 'Marshmallow Root', note: 'Soothes and moistens dry, irritated tissue.' },
  ],
  'open-flame': [
    { name: 'Witch Hazel', note: 'Tones lax blood vessels and reduces inflammation.' },
    { name: 'Yarrow', note: 'Tightens loose tissue and cools heat.' },
    { name: 'Red Raspberry Leaf', note: 'Gently restores muscle tone throughout the body.' },
  ],
  'pressure-cooker': [
    { name: 'Dandelion', note: 'Supports liver and kidney drainage to release pressure.' },
    { name: 'Linden', note: 'Relaxes tension AND lowers blood pressure AND opens pores.' },
    { name: 'Calendula', note: 'Moves lymph and heals inflamed tissue.' },
  ],
  'overflowing-cup': [
    { name: 'Calendula', note: 'Moves sluggish lymph and promotes tissue healing.' },
    { name: 'Sage', note: 'Dries and tones where tissues are too open.' },
    { name: 'Oregon Grape Root', note: 'Cools damp heat and supports liver function.' },
  ],
  'drawn-bowstring': [
    { name: 'Ashwagandha', note: 'Deeply restorative — calms anxiety while building strength.' },
    { name: 'Valerian', note: 'Releases the tension your body cannot let go of on its own.' },
    { name: 'Milky Oats', note: 'Slowly rebuilds an exhausted nervous system.' },
  ],
  'spent-candle': [
    { name: 'Ashwagandha', note: 'Rebuilds depleted reserves without overstimulating.' },
    { name: 'Nettle', note: 'Mineral-rich nourishment that rebuilds from the ground up.' },
    { name: 'Astragalus', note: 'Builds deep immune strength and protective energy over time.' },
  ],
  'frozen-knot': [
    { name: 'Ginger', note: 'Warms the core and moves stagnant fluids.' },
    { name: 'Valerian', note: 'Releases the tension so warming herbs can penetrate.' },
    { name: 'Prickly Ash', note: 'Powerfully moves blood and lymph to break through stagnation.' },
  ],
  'still-water': [
    { name: 'Ginger', note: 'Warms and stimulates sluggish digestion and circulation.' },
    { name: 'Rosemary', note: 'Clears mental fog and lifts depressed spirits.' },
    { name: 'Astragalus', note: 'Builds deep energy reserves and immune function.' },
  ],
};

const AMAZON_URLS: Record<string, string> = {
  'burning-bowstring': 'https://www.amazon.com/hz/wishlist/ls/3SVZB0BRV2IE3?ref_=wl_share',
  'open-flame': 'https://www.amazon.com/hz/wishlist/ls/1ELQEQ7OEN6V6?ref_=wl_share',
  'pressure-cooker': 'https://www.amazon.com/hz/wishlist/ls/QR7IKCJ9S89E?ref_=wl_share',
  'overflowing-cup': 'https://www.amazon.com/hz/wishlist/ls/23IQ93Z31QB8Z?ref_=wl_share',
  'drawn-bowstring': 'https://www.amazon.com/hz/wishlist/ls/2TK1B0LX1VFPS?ref_=wl_share',
  'spent-candle': 'https://www.amazon.com/hz/wishlist/ls/2Q5D53CU2ZW1L?ref_=wl_share',
  'frozen-knot': 'https://www.amazon.com/hz/wishlist/ls/7NTDELHCTNMO?ref_=wl_share',
  'still-water': 'https://www.amazon.com/hz/wishlist/ls/2OV04T0L7C1FA?ref_=wl_share',
};

// ── HTML helpers ──

export function __shared_emailWrapper(bodyContent: string): string {
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
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:${BRAND.bgBody};border:1px solid #E8E3DA;">
<!-- HEADER -->
<tr><td style="background-color:${BRAND.forest};padding:40px 20px;text-align:center;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="text-align:center;font-family:Georgia,serif;font-size:13px;font-weight:bold;letter-spacing:4px;color:${BRAND.gold};text-transform:uppercase;">THE EDEN INSTITUTE</td></tr>
<tr><td align="center" style="padding:16px 0;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="width:60px;border-top:1px solid ${BRAND.gold};font-size:0;line-height:0;">&nbsp;</td></tr></table>
</td></tr>
<tr><td style="text-align:center;font-family:Georgia,serif;font-size:14px;color:#FFFFFF;font-style:italic;">Back to Eden. Back to Truth.</td></tr>
</table>
</td></tr>
<!-- GOLD RULE -->
<tr><td style="background-color:${BRAND.bgBody};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:2px solid ${BRAND.gold};font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>
<!-- BODY -->
<tr><td class="email-body-cell" style="background-color:${BRAND.bgBody};padding:32px 40px;">
${bodyContent}
</td></tr>
<!-- GOLD RULE -->
<tr><td style="background-color:${BRAND.bgBody};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:2px solid ${BRAND.gold};font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>
<!-- FOOTER -->
<tr><td style="background-color:${BRAND.forest};padding:30px 20px;text-align:center;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-family:Georgia,serif;font-size:14px;font-weight:bold;color:#FFFFFF;text-align:center;">The Eden Institute</td></tr>
<tr><td style="text-align:center;padding-top:6px;"><a href="https://edeninstitute.health" style="font-family:Georgia,serif;font-size:13px;color:#FFFFFF;text-decoration:underline;">edeninstitute.health</a></td></tr>
<tr><td style="text-align:center;padding-top:14px;">
<a href="https://www.facebook.com/share/1CRzWj7wmz/?mibextid=wwXIfr" style="font-family:Georgia,serif;font-size:12px;color:#FFFFFF;text-decoration:underline;">Facebook</a>
&nbsp;|&nbsp;
<a href="https://instagram.com/the_eden_institute" style="font-family:Georgia,serif;font-size:12px;color:#FFFFFF;text-decoration:underline;">Instagram</a>
&nbsp;|&nbsp;
<a href="https://pin.it/6AuiXypgA" style="font-family:Georgia,serif;font-size:12px;color:#FFFFFF;text-decoration:underline;">Pinterest</a>
</td></tr>
<tr><td style="text-align:center;padding-top:14px;font-family:Georgia,serif;font-size:13px;color:${BRAND.gold};font-style:italic;">Back to Eden. Back to Truth.</td></tr>
<tr><td style="font-family:Georgia,serif;font-size:11px;color:${BRAND.footerText};text-align:center;padding-top:16px;">You're receiving this because you completed the Constitutional Assessment at edeninstitute.health.</td></tr>
<tr><td style="text-align:center;padding-top:8px;"><a href="https://edeninstitute.health/unsubscribe" style="font-family:Georgia,serif;font-size:11px;color:${BRAND.footerText};text-decoration:underline;">Unsubscribe</a></td></tr>
</table>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function __shared_goldDivider(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:2px solid ${BRAND.gold};font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr></table>`;
}

function p(text: string, extra = ''): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${BRAND.text};margin:0 0 16px 0;${extra}">${text}</p>`;
}

function heading(text: string): string {
  return `<h2 style="font-family:Georgia,serif;font-size:22px;line-height:1.3;color:${BRAND.forest};margin:0 0 16px 0;font-weight:bold;">${text}</h2>`;
}

function subheading(text: string): string {
  return `<h3 style="font-family:Georgia,serif;font-size:18px;line-height:1.3;color:${BRAND.forest};margin:0 0 12px 0;font-weight:bold;">${text}</h3>`;
}

function bullet(text: string): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${BRAND.text};margin:0 0 8px 0;padding-left:16px;">· ${text}</p>`;
}

function brandButton(label: string, url: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
<tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
<tr><td align="center" style="background-color:${BRAND.forest};border-radius:8px;">
<a href="${url}" target="_blank" style="display:inline-block;background-color:${BRAND.forest};color:${BRAND.gold};font-family:Georgia,serif;font-size:16px;font-weight:bold;text-decoration:none;text-align:center;padding:14px 40px;border-radius:8px;line-height:24px;mso-line-height-rule:exactly;">${label}</a>
</td></tr>
</table>
</td></tr>
</table>`;
}

function link(text: string, url: string): string {
  return `<a href="${url}" style="color:${BRAND.sage};text-decoration:underline;">${text}</a>`;
}

function signature(): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${BRAND.text};margin:24px 0 4px 0;">Grace and health,</p>
<p style="font-family:Georgia,serif;font-size:16px;color:${BRAND.text};font-weight:bold;margin:0;">Camila</p>
<p style="font-family:Georgia,serif;font-size:14px;color:${BRAND.text};margin:4px 0 0 0;">The Eden Institute</p>
<p style="font-family:Georgia,serif;font-size:14px;margin:4px 0 0 0;"><a href="https://edeninstitute.health" style="color:${BRAND.sage};text-decoration:underline;">edeninstitute.health</a></p>`;
}

function spacer(h = 8): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:${h}px;font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
}

// ══════════════════════════════════════════════════════════════
// EMAIL 1 — Immediate
// ══════════════════════════════════════════════════════════════
export function buildNurtureEmail1(
  firstName: string,
  constitutionName: string,
  constitutionSlug: string,
): { subject: string; html: string } {
  const herbs = TOP_HERBS[constitutionSlug] || TOP_HERBS['frozen-knot'];
  const herbCards = herbs.map(h => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
<tr><td style="background-color:${BRAND.bgOuter};padding:16px 20px;border-left:3px solid ${BRAND.gold};">
<p style="font-family:Georgia,serif;font-size:17px;font-weight:bold;color:${BRAND.forest};margin:0 0 4px 0;">${h.name}</p>
<p style="font-family:Georgia,serif;font-size:15px;color:${BRAND.text};margin:0;">${h.note}</p>
</td></tr>
</table>`).join('');

  const body = `
${p(`You just took the Constitutional Assessment — and your result is in.`)}
${spacer(4)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid ${BRAND.gold};background-color:${BRAND.bgOuter};">
<tr><td style="padding:24px;text-align:center;">
<p style="font-family:Georgia,serif;font-size:12px;font-weight:bold;letter-spacing:3px;color:${BRAND.gold};text-transform:uppercase;margin:0 0 8px 0;">YOUR TYPE</p>
<p style="font-family:Georgia,serif;font-size:24px;font-weight:bold;color:${BRAND.forest};margin:0;">${constitutionName}</p>
</td></tr>
</table>
${p("This isn't a personality quiz or a horoscope. It's a pattern — one that shows up in your digestion, your energy, your skin, your sleep, and even in the herbs that work for you (and the ones that don't).")}
${p("Here's the short version: your body has a specific combination of temperature tendency, fluid balance, and tissue tone. That combination determines how you respond to herbs, food, stress, and seasons. When you work WITH the pattern instead of against it, everything changes.")}
${__shared_goldDivider()}
${heading("YOUR TOP 3 HERBS")}
${p("These are the herbs most aligned with your constitutional pattern. Your full guide has all 10 with clinical preparation methods.")}
${herbCards}
${spacer(8)}
${p(`${link("See your full quiz results anytime →", `https://edeninstitute.health/results/${constitutionSlug}`)}`)}
${__shared_goldDivider()}
${heading("WANT THE FULL PICTURE?")}
${p("Your Deep-Dive Guide includes all 10 matched herbs with actions, preparation methods, dosages, and safety notes — plus a caution list, lifestyle and nutrition guidance, and a Biblical framework for your constitutional pattern.")}
${brandButton(`Get Your ${constitutionName.replace(/^The /i, '')} Deep-Dive Guide — $14`, `https://edeninstitute.health/guide/${constitutionSlug}`)}
${signature()}`;

  return {
    subject: `Your body type is ${constitutionName} — here's what that means`,
    html: __shared_emailWrapper(body),
  };
}

// ══════════════════════════════════════════════════════════════
// EMAIL 2 — Day 2
// ══════════════════════════════════════════════════════════════
export function buildNurtureEmail2(
  firstName: string,
  constitutionName: string,
  constitutionSlug: string,
): { subject: string; html: string } {
  const body = `
${p("Have you ever tried an herb that everyone swore by — and it did nothing? Or worse, it made things worse?")}
${spacer(4)}
${bullet("<strong>Chamomile</strong> makes some people jittery instead of calm.")}
${bullet("<strong>Ginger</strong> causes acid reflux in people who already run hot.")}
${bullet("<strong>Lavender</strong> triggers headaches in certain constitutions.")}
${spacer(8)}
${p("This isn't random. It's constitutional.")}
${__shared_goldDivider()}
${heading("THE 3 AXES OF YOUR CONSTITUTION")}
${subheading("1. TEMPERATURE — Do you run hot or cold?")}
${p("This determines whether warming or cooling herbs serve you. Get it wrong and you add fuel to a fire — or ice to a glacier.")}
${subheading("2. FLUID BALANCE — Do you run dry or damp?")}
${p("This determines whether moistening or drying herbs are appropriate. A dry body given a drying herb becomes brittle. A damp body given a moistening herb becomes waterlogged.")}
${subheading("3. TISSUE TONE — Are you tense or relaxed?")}
${p("This determines whether relaxing or toning herbs are needed. Tension needs release. Laxity needs structure.")}
${__shared_goldDivider()}
${p(`Your quiz result — <strong>${constitutionName}</strong> — reflects your specific combination of these three axes. And that combination is why certain herbs work brilliantly for you and others backfire.`)}
${p("This is the foundation of constitutional herbalism. Practitioners have been reading these patterns for 3,000 years in the Western clinical tradition. We've translated it into a framework that makes sense for modern Christian families.")}
${spacer(8)}
${p("<em>This is exactly what Tier 1 of the Foundations Course covers in depth.</em>")}
${brandButton("Learn More About the Foundations Course", "https://learn.edeninstitute.health/course/back-to-eden1")}
${p(`${link("Your full quiz results →", `https://edeninstitute.health/results/${constitutionSlug}`)}`)}
${signature()}`;

  return {
    subject: "Why the same herb relaxes her and wires you",
    html: __shared_emailWrapper(body),
  };
}

// ══════════════════════════════════════════════════════════════
// EMAIL 3 — Day 4
// ══════════════════════════════════════════════════════════════
export function buildNurtureEmail3(
  firstName: string,
  constitutionName: string,
  constitutionSlug: string,
): { subject: string; html: string } {
  const body = `
${p("She tried turmeric — it made her stomach burn. She tried valerian — it made her wired. She took elderberry every winter — and it did nothing.")}
${p("She wasn't doing anything wrong. She was asking the wrong question.")}
${p(`She wasn't asking <em>"What herb fixes this symptom?"</em> She was asking <em>"What kind of body do I have — and what does IT need?"</em>`)}
${__shared_goldDivider()}
${heading("THE DISCOVERY")}
${p("She was running hot, dry, and tense. Turmeric was adding fuel to a fire. Valerian was the right idea — nervous system support — but the wrong execution for her pattern. Elderberry wasn't addressing her actual imbalance.")}
${p("<strong>When she matched herbs to her constitution instead of her symptoms, the results were immediate.</strong>")}
${spacer(8)}
${p(`You already know yours: <strong>${constitutionName}</strong>. The Foundations Course teaches you how to go deeper — how to read your constitution in real time, how to match it precisely to herbs, and how to build protocols that actually work.`)}
${__shared_goldDivider()}
${heading("\"BUT I DON'T HAVE TIME FOR A COURSE.\"")}
${p("The course is self-paced. No deadlines, no live sessions. Most students spend 2-3 hours per week. The knowledge lasts a lifetime.")}
${brandButton("See What's Inside the Foundations Course", "https://learn.edeninstitute.health/course/back-to-eden1")}
${signature()}`;

  return {
    subject: "What changed when she finally understood her body",
    html: __shared_emailWrapper(body),
  };
}

// ══════════════════════════════════════════════════════════════
// EMAIL 4 — Day 6
// ══════════════════════════════════════════════════════════════
export function buildNurtureEmail4(
  firstName: string,
  constitutionName: string,
  constitutionSlug: string,
): { subject: string; html: string } {
  const body = `
${p(`Six days ago, you discovered your constitutional type: <strong>${constitutionName}</strong>. Since then, you've learned why herbs work differently in different bodies. Now it's time to go deeper.`)}
${__shared_goldDivider()}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;background-color:${BRAND.bgOuter};border:1px solid ${BRAND.gold};">
<tr><td style="padding:24px;text-align:center;">
<p style="font-family:Georgia,serif;font-size:12px;font-weight:bold;letter-spacing:3px;color:${BRAND.gold};text-transform:uppercase;margin:0 0 8px 0;">NOW ENROLLING</p>
<p style="font-family:Georgia,serif;font-size:22px;font-weight:bold;color:${BRAND.forest};margin:0;">THE FOUNDATIONS OF CONSTITUTIONAL HERBALISM — TIER 1</p>
</td></tr>
</table>
${heading("Part I: The Foundation")}
${p("God's design, the 5 Tenets of Health, and terrain thinking — the Biblical and historical framework for plant medicine.")}
${heading("Part II: The Body Was Designed to Heal")}
${p("The 3 axes, 8 constitutional types, and tissue states — how to understand the human body through constitution.")}
${heading("Part III: Reading the Person")}
${p("Constitutional assessment, herb matching, and protocols — how to match people to plants with precision.")}
${__shared_goldDivider()}
${subheading("WHAT'S INCLUDED")}
${bullet("10 video lessons")}
${bullet("10 companion guides")}
${bullet("10 application activities")}
${bullet("100 quiz questions")}
${bullet("Certificate of Completion")}
${bullet("Lifetime access")}
${spacer(12)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;background-color:${BRAND.bgOuter};padding:20px;text-align:center;">
<tr><td style="padding:20px;">
<p style="font-family:Georgia,serif;font-size:28px;font-weight:bold;color:${BRAND.forest};margin:0 0 8px 0;">$97 founding student pricing</p>
<p style="font-family:Georgia,serif;font-size:15px;color:${BRAND.text};margin:0 0 8px 0;">Use code <strong>FIRSTFRUITS</strong> at checkout for early enrollment pricing.</p>
<p style="font-family:Georgia,serif;font-size:14px;color:${BRAND.gold};font-weight:bold;margin:0;">Price raises to $147 on July 7, 2026</p>
</td></tr>
</table>
${__shared_goldDivider()}
${heading("FREQUENTLY ASKED")}
${subheading("\"Do I need prior herbal knowledge?\"")}
${p("No. This course was built for beginners. If you already practice, it will deepen your framework.")}
${subheading("\"Is this faith-based?\"")}
${p("Yes. Grounded in Scripture, with Yahweh as healer. Clinical rigor within a Biblical worldview.")}
${subheading("\"What if I can't finish in time?\"")}
${p("The course is entirely self-paced with lifetime access. There is no deadline.")}
${brandButton("ENROLL NOW — THE FOUNDATIONS COURSE ($97)", "https://learn.edeninstitute.health/course/back-to-eden1")}
${__shared_goldDivider()}
${p("<strong>P.S.</strong> Tier 2 — Body Systems & Clinical Literacy — opens to the public October 8, 2026 at $1,497. Join the free waitlist now and you'll receive a founding access code for $497 (valid 14 days) when Tier 2 launches July 7. " + link("Join the waitlist →", "https://edeninstitute.health/tier-2-waitlist"))}
${signature()}`;

  return {
    subject: `Enrollment is open — your ${constitutionName} guide to herbs starts here`,
    html: __shared_emailWrapper(body),
  };
}

// ══════════════════════════════════════════════════════════════
// EMAIL 5 — Day 8 (conditional — only if NOT purchased course AND NOT purchased guide)
// ══════════════════════════════════════════════════════════════
export function buildNurtureEmail5(
  firstName: string,
  constitutionName: string,
  constitutionSlug: string,
): { subject: string; html: string } {
  const amazonUrl = AMAZON_URLS[constitutionSlug] || AMAZON_URLS['frozen-knot'];

  const body = `
${p("No pressure. Truly. Not everyone is ready for a full course — and that's okay. Herbs meet you where you are.")}
${p(`Based on your constitutional type (<strong>${constitutionName}</strong>), I've put together a curated herb kit on Amazon. These are the specific herbs that match your body's pattern.`)}
${brandButton(`Shop Your ${constitutionName} Starter Kit`, amazonUrl)}
${spacer(8)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;background-color:${BRAND.bgOuter};border-left:3px solid ${BRAND.gold};">
<tr><td style="padding:16px 20px;">
<p style="font-family:Georgia,serif;font-size:13px;color:${BRAND.footerText};margin:0;line-height:1.6;"><em>These are affiliate links — I earn a small commission if you purchase through them. It costs you nothing extra. It helps me keep building Eden Institute.</em></p>
</td></tr>
</table>
${p("If and when you're ready to go deeper, the Foundations Course is always available.")}
${p(`${link("Learn about the Foundations Course →", "https://learn.edeninstitute.health/course/back-to-eden1")}`)}
${__shared_goldDivider()}
${p("<strong>P.S.</strong> Tier 2 — Body Systems & Clinical Literacy — opens to the public October 8, 2026 at $1,497. Join the free waitlist now and you'll receive a founding access code for $497 (valid 14 days) when Tier 2 launches July 7. " + link("Join the waitlist →", "https://edeninstitute.health/tier-2-waitlist"))}
${signature()}`;

  return {
    subject: `Your ${constitutionName} starter herb kit — curated just for you`,
    html: __shared_emailWrapper(body),
  };
}


// ============================================================
// [END INLINED] — resend-waitlist/index.ts follows
// ============================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const RESEND_CONTACTS_KEY = Deno.env.get('RESEND_CONTACTS_KEY');
const RESEND_AUDIENCE_ID = Deno.env.get('RESEND_AUDIENCE_ID');

const TOPIC_IDS = [
  '89e7bfad-5e08-44c6-9a5c-ff8e9cf8ee1d',
  '0ed1f4b6-1b8c-4ef2-b9ca-7a7f67d3f2e6',
  'b87ee1ad-8592-495c-aa1d-1ddbbb7d0afd',
];

const COURSE_AUDIENCE_ID = "4860c1c5-8e2b-4d02-838a-60ef09b789bf";
const APP_AUDIENCE_ID = "cebd3478-b344-41b7-98c8-8bcf0e0108da";
const HOMESCHOOL_AUDIENCE_ID = "a48cb66e-b2a9-461d-98a6-bb1b12f72693";
const COMMUNITY_AUDIENCE_ID = "a48cb66e-b2a9-461d-98a6-bb1b12f72693";

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
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 8px 0;">You're on the Eden Apothecary beta waitlist. That means first access when we launch in 2026 — and your pricing locked in for life.</p>
${goldDivider()}
${goldLabel('YOUR BETA PRICING — LOCKED IN FOR LIFE')}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
<tr><td style="background-color:#F5F0E8;padding:20px;text-align:center;border-bottom:1px solid #FFFFFF;">
<p style="font-family:Georgia,serif;font-size:16px;font-weight:bold;color:#1C3A2E;margin:0 0 8px 0;">Full Access Tier</p>
<p style="font-family:Georgia,serif;font-size:20px;font-weight:bold;color:#C9A84C;margin:0 0 4px 0;">$4.99/month during beta</p>
<p style="font-family:Georgia,serif;font-size:13px;color:#999999;margin:0;"><s>Regular price: $19.99/month</s></p>
</td></tr>
<tr><td style="background-color:#F5F0E8;padding:20px;text-align:center;">
<p style="font-family:Georgia,serif;font-size:16px;font-weight:bold;color:#1C3A2E;margin:0 0 8px 0;">Practitioner Tier</p>
<p style="font-family:Georgia,serif;font-size:20px;font-weight:bold;color:#C9A84C;margin:0 0 4px 0;">$19.99/month during beta</p>
<p style="font-family:Georgia,serif;font-size:13px;color:#999999;margin:0;"><s>Regular price: $99.99/month</s></p>
</td></tr>
</table>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#1C3A2E;margin:0 0 16px 0;">The Eden Apothecary App is a constitutional assessment and herb matching system built on the Eclectic, Physiomedical, and Vitalist traditions — grounded in Scripture. From home herbalist to clinical practitioner, every tier is designed to meet you where you are.</p>
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
  return {
    subject: "You're on the Eden's Table Waitlist — Here's What's Coming",
    html: `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#FAF8F3;">${body}</body></html>`
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
    ${ctaButton("Take the Free Constitutional Assessment", "https://edeninstitute.health/#assessment")}
    ${goldDivider()}
    ${closingBlock()}
  `;
  return {
    subject: "You're on the Community Waitlist — We're Building Something Worth Waiting For",
    html: `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#FAF8F3;">${body}</body></html>`
  };
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
${ctaButton('→ GET YOUR FULL DEEP-DIVE GUIDE — $14', `https://edeninstitute.health/results/${slugInfo.slug}`)}
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

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const payload = {
    from: 'The Eden Institute <hello@edeninstitute.health>',
    reply_to: 'hello@edeninstitute.health',
    to: [to],
    subject,
    html,
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
    if (!RESEND_API_KEY || !RESEND_CONTACTS_KEY || !RESEND_AUDIENCE_ID) {
      console.error('Missing env vars:', { hasKey: !!RESEND_API_KEY, hasContactsKey: !!RESEND_CONTACTS_KEY, hasAudience: !!RESEND_AUDIENCE_ID });
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { firstName, email, audienceId, constitutionType, constitutionSlug, constitutionName, constitutionNickname, source } = await req.json();

    if (!firstName || !email) {
      return new Response(
        JSON.stringify({ error: 'Name and email are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Create/update contact in the audience
    const baseContactPayload: Record<string, any> = { email, first_name: firstName, unsubscribed: false, contact_properties: { waitlist_source: source || audienceId || "unknown" } };

    let contactRes = await fetch(`https://api.resend.com/audiences/${RESEND_AUDIENCE_ID}/contacts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_CONTACTS_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(baseContactPayload),
    });

    let contactData = await contactRes.json();
    console.log('Contact creation response:', contactRes.status, JSON.stringify(contactData));

    if (!contactRes.ok && contactRes.status !== 409) {
      return new Response(
        JSON.stringify({ error: contactData.message || 'Failed to add contact' }),
        { status: contactRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Subscribe to each topic separately with delays
    const topicResults = [];
    for (let i = 0; i < TOPIC_IDS.length; i++) {
      const topicId = TOPIC_IDS[i];
      if (i > 0) await new Promise(r => setTimeout(r, 500));
      try {
        const topicRes = await fetch(`https://api.resend.com/audiences/${RESEND_AUDIENCE_ID}/contacts`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_CONTACTS_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            first_name: firstName,
            unsubscribed: false,
          }),
        });
        const topicData = await topicRes.json();
        console.log(`Topic ${topicId} response:`, topicRes.status, JSON.stringify(topicData));
        topicResults.push({ topicId, status: topicRes.status, ok: topicRes.ok });
      } catch (topicErr) {
        const topicErrorMessage = topicErr instanceof Error ? topicErr.message : String(topicErr);
        console.error(`Topic ${topicId} error:`, topicErrorMessage);
        topicResults.push({ topicId, error: topicErrorMessage });
      }
    }

    // Step 3: Send welcome/results email (non-assessment sources only)
    // Assessment emails are handled by the nurture sequence (Email 1 sends immediately)
    let emailContent: { subject: string; html: string } | null = null;

    if (source === 'constitution_assessment' && constitutionType) {
      // Quiz completion — nurture Email 1 handles the welcome email
      // Record quiz completion and schedule nurture emails 1-4
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      if (serviceRoleKey && supabaseUrl) {
        const slugInfo = getSlugInfo(constitutionType, constitutionSlug, constitutionName, constitutionNickname);
        const name = slugInfo.name;
        const slug = slugInfo.slug;

        // Check for existing quiz completion (duplicate prevention)
        const checkRes = await fetch(
          `${supabaseUrl}/rest/v1/quiz_completions?email=eq.${encodeURIComponent(email)}&select=id,email_1_sent_at&limit=1`,
          {
            headers: {
              'apikey': serviceRoleKey,
              'Authorization': `Bearer ${serviceRoleKey}`,
              'Content-Type': 'application/json',
            },
          }
        );
        const existing = await checkRes.json();
        const alreadyNurtured = Array.isArray(existing) && existing.length > 0 && existing[0].email_1_sent_at;

        if (alreadyNurtured) {
          // User retook quiz — update constitution info but DON'T re-send nurture sequence
          console.log(`Existing nurture sequence for ${email} — updating constitution info only`);
          await fetch(
            `${supabaseUrl}/rest/v1/quiz_completions?email=eq.${encodeURIComponent(email)}`,
            {
              method: 'PATCH',
              headers: {
                'apikey': serviceRoleKey,
                'Authorization': `Bearer ${serviceRoleKey}`,
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
          // New quiz completion — insert row and schedule nurture emails 1-4
          const now = new Date();
          const nowIso = now.toISOString();

          // Insert or update quiz_completion row
          if (Array.isArray(existing) && existing.length > 0) {
            await fetch(
              `${supabaseUrl}/rest/v1/quiz_completions?email=eq.${encodeURIComponent(email)}`,
              {
                method: 'PATCH',
                headers: {
                  'apikey': serviceRoleKey,
                  'Authorization': `Bearer ${serviceRoleKey}`,
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
            await fetch(`${supabaseUrl}/rest/v1/quiz_completions`, {
              method: 'POST',
              headers: {
                'apikey': serviceRoleKey,
                'Authorization': `Bearer ${serviceRoleKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal',
              },
              body: JSON.stringify({
                email,
                first_name: firstName,
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

          // Schedule nurture emails 1-4 via Resend (fire-and-forget)
          const scheduleNurture = async () => {
            try {
              const sendHeaders = {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
              };
              const from = 'Camila at The Eden Institute <hello@edeninstitute.health>';
              const replyTo = 'hello@edeninstitute.health';

              // Email 1 — immediate
              const e1 = buildNurtureEmail1(firstName, name, slug);
              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: sendHeaders,
                body: JSON.stringify({ from, reply_to: replyTo, to: [email], subject: e1.subject, html: e1.html }),
              });
              console.log('Nurture Email 1 sent to', email);

              // Email 2 — Day 2
              const e2 = buildNurtureEmail2(firstName, name, slug);
              const day2 = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: sendHeaders,
                body: JSON.stringify({ from, reply_to: replyTo, to: [email], subject: e2.subject, html: e2.html, scheduled_at: day2 }),
              });
              console.log('Nurture Email 2 scheduled for', day2);

              // Email 3 — Day 4
              const e3 = buildNurtureEmail3(firstName, name, slug);
              const day4 = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString();
              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: sendHeaders,
                body: JSON.stringify({ from, reply_to: replyTo, to: [email], subject: e3.subject, html: e3.html, scheduled_at: day4 }),
              });
              console.log('Nurture Email 3 scheduled for', day4);

              // Email 4 — Day 6
              const e4 = buildNurtureEmail4(firstName, name, slug);
              const day6 = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString();
              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: sendHeaders,
                body: JSON.stringify({ from, reply_to: replyTo, to: [email], subject: e4.subject, html: e4.html, scheduled_at: day6 }),
              });
              console.log('Nurture Email 4 scheduled for', day6);
            } catch (nurtureErr) {
              const nurtureErrorMessage = nurtureErr instanceof Error ? nurtureErr.message : String(nurtureErr);
              console.error('Nurture scheduling error:', nurtureErrorMessage);
            }
          };

          // Fire-and-forget — don't block the response
          scheduleNurture().catch((err) => {
            const schedulingErrorMessage = err instanceof Error ? err.message : String(err);
            console.error('Nurture scheduling failed:', schedulingErrorMessage);
          });
        }
      }
    } else if (audienceId === COURSE_AUDIENCE_ID) {
      emailContent = buildFoundationsEmail(firstName);
    } else if (audienceId === APP_AUDIENCE_ID) {
      emailContent = buildAppBetaEmail(firstName);
    } else if (audienceId === HOMESCHOOL_AUDIENCE_ID && source === "homeschool") {
      emailContent = buildHomeschoolEmail(firstName);
    } else if (audienceId === COMMUNITY_AUDIENCE_ID && source === "community") {
      emailContent = buildCommunityEmail(firstName);
    }

    if (emailContent) {
      sendEmail(email, emailContent.subject, emailContent.html).catch((err) => {
        const backgroundEmailError = err instanceof Error ? err.message : String(err);
        console.error('Background email send error:', backgroundEmailError);
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Your results are on their way. Check your inbox.', constitutionType, source, topicResults }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const unhandledMessage = err instanceof Error ? err.message : String(err);
    const unhandledStack = err instanceof Error ? err.stack : undefined;
    console.error('Unhandled error:', unhandledMessage, unhandledStack);
    return new Response(
      JSON.stringify({ error: unhandledMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
