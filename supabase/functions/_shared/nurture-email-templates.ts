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

// ── Amazon affiliate tag ──
//
// Mirror of the React-side helper in src/lib/amazonKitUrls.ts. The Deno
// EF runtime can't share imports with the React app, so the tag value
// and the append helper are duplicated here. When Camila swaps to a
// custom Associates tag (post-tax-interview), update the constant in
// BOTH files in lockstep.
//
// Rationale for keeping AMAZON_URLS as a bare-URL constant: the
// canonical mapping documented in src/lib/amazonKitUrls.ts asks the EF
// mirror to stay byte-identical so the two tables can be diff-checked
// for drift. Applying the tag at consumption (rather than at
// constant-definition) preserves that property.
const AMAZON_AFFILIATE_TAG = 'mobile088c05e-20';

function withAffiliateTag(url: string): string {
  if (!url) return url;
  if (/[?&]tag=/.test(url)) return url; // idempotent
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}tag=${AMAZON_AFFILIATE_TAG}`;
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

// Bare URLs — MUST stay in lockstep with src/lib/amazonKitUrls.ts.
// Affiliate tag is applied at consumption via withAffiliateTag().
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

export function emailWrapper(bodyContent: string): string {
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
<tr><td style="text-align:center;padding-top:8px;"><a href="{{UNSUB_URL}}" style="font-family:Georgia,serif;font-size:11px;color:${BRAND.footerText};text-decoration:underline;">Unsubscribe</a></td></tr>
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
${goldDivider()}
${heading("YOUR TOP 3 HERBS")}
${p("These are the herbs most aligned with your constitutional pattern. Your full guide has all 10 with clinical preparation methods.")}
${herbCards}
${spacer(8)}
${p(`${link("See your full quiz results anytime →", `https://edeninstitute.health/results/${constitutionSlug}`)}`)}
${goldDivider()}
${heading("WANT THE FULL PICTURE?")}
${p("Your Deep-Dive Guide includes all 10 matched herbs with actions, preparation methods, dosages, and safety notes — plus a caution list, lifestyle and nutrition guidance, and a Biblical framework for your constitutional pattern.")}
${brandButton(`Get Your ${constitutionName.replace(/^The /i, '')} Deep-Dive Guide — $4.99`, `https://edeninstitute.health/go/deep-dive/${constitutionSlug}`)}
${signature()}`;

  return {
    subject: `Your body type is ${constitutionName} — here's what that means`,
    html: emailWrapper(body),
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
${goldDivider()}
${heading("THE 3 AXES OF YOUR CONSTITUTION")}
${subheading("1. TEMPERATURE — Do you run hot or cold?")}
${p("This determines whether warming or cooling herbs serve you. Get it wrong and you add fuel to a fire — or ice to a glacier.")}
${subheading("2. FLUID BALANCE — Do you run dry or damp?")}
${p("This determines whether moistening or drying herbs are appropriate. A dry body given a drying herb becomes brittle. A damp body given a moistening herb becomes waterlogged.")}
${subheading("3. TISSUE TONE — Are you tense or relaxed?")}
${p("This determines whether relaxing or toning herbs are needed. Tension needs release. Laxity needs structure.")}
${goldDivider()}
${p(`Your quiz result — <strong>${constitutionName}</strong> — reflects your specific combination of these three axes. And that combination is why certain herbs work brilliantly for you and others backfire.`)}
${p("This is the foundation of constitutional herbalism. Practitioners have been reading these patterns for 3,000 years in the Western clinical tradition. We've translated it into a framework that makes sense for modern Christian families.")}
${spacer(8)}
${p("<em>This is exactly what Tier 1 of the Foundations Course covers in depth.</em>")}
${brandButton("Learn More About the Foundations Course", "https://learn.edeninstitute.health/course/back-to-eden1")}
${p(`${link("Your full quiz results →", `https://edeninstitute.health/results/${constitutionSlug}`)}`)}
${signature()}`;

  return {
    subject: "Why the same herb relaxes her and wires you",
    html: emailWrapper(body),
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
${goldDivider()}
${heading("THE DISCOVERY")}
${p("She was running hot, dry, and tense. Turmeric was adding fuel to a fire. Valerian was the right idea — nervous system support — but the wrong execution for her pattern. Elderberry wasn't addressing her actual imbalance.")}
${p("<strong>When she matched herbs to her constitution instead of her symptoms, the results were immediate.</strong>")}
${spacer(8)}
${p(`You already know yours: <strong>${constitutionName}</strong>. The Foundations Course teaches you how to go deeper — how to read your constitution in real time, how to match it precisely to herbs, and how to build protocols that actually work.`)}
${goldDivider()}
${heading("\"BUT I DON'T HAVE TIME FOR A COURSE.\"")}
${p("The course is self-paced. No deadlines, no live sessions. Most students spend 2-3 hours per week. The knowledge lasts a lifetime.")}
${brandButton("See What's Inside the Foundations Course", "https://learn.edeninstitute.health/course/back-to-eden1")}
${signature()}`;

  return {
    subject: "What changed when she finally understood her body",
    html: emailWrapper(body),
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
  // 2026-04-30 (revenue-loss bug fix): the FIRSTFRUITS coupon previously
  // promoted in this email body STACKED on top of LearnWorlds'
  // already-applied $100 founding-student discount, dropping the $97
  // course to $0 at checkout. Remediation: remove the explicit price
  // and the FIRSTFRUITS coupon copy from the email body. The
  // LearnWorlds enrollment page becomes the single source of truth for
  // the live price; the email no longer asserts a number that could
  // double-discount. The button label also drops the "($97)" so the
  // email's price assertion is fully retired.
  const body = `
${p(`Six days ago, you discovered your constitutional type: <strong>${constitutionName}</strong>. Since then, you've learned why herbs work differently in different bodies. Now it's time to go deeper.`)}
${goldDivider()}
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
${goldDivider()}
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
<p style="font-family:Georgia,serif;font-size:22px;font-weight:bold;color:${BRAND.forest};margin:0 0 8px 0;">Founding student pricing</p>
<p style="font-family:Georgia,serif;font-size:15px;color:${BRAND.text};margin:0 0 8px 0;">The Foundations Course (Tier 1) is $97 for the first 100 founding students — then it returns to $197. The founding price is applied automatically at checkout; no code needed.</p>
<p style="font-family:Georgia,serif;font-size:14px;color:${BRAND.gold};font-weight:bold;margin:0;">Only the first 100 seats are $97.</p>
</td></tr>
</table>
${goldDivider()}
${heading("FREQUENTLY ASKED")}
${subheading("\"Do I need prior herbal knowledge?\"")}
${p("No. This course was built for beginners. If you already practice, it will deepen your framework.")}
${subheading("\"Is this faith-based?\"")}
${p("Yes. Grounded in Scripture, with Yahweh as healer. Clinical rigor within a Biblical worldview.")}
${subheading("\"What if I can't finish in time?\"")}
${p("The course is entirely self-paced with lifetime access. There is no deadline.")}
${brandButton("ENROLL NOW — THE FOUNDATIONS COURSE", "https://learn.edeninstitute.health/course/back-to-eden1")}
${goldDivider()}
${p("<strong>P.S.</strong> Tier 2 — Body Systems & Clinical Literacy — is coming. Tier 1 students are first to hear when it opens, so finishing Foundations puts you at the front of the line.")}
${signature()}`;

  return {
    subject: `Enrollment is open — your ${constitutionName} guide to herbs starts here`,
    html: emailWrapper(body),
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
  // Apply Camila's Amazon Associates affiliate tag at the consumption point.
  // AMAZON_URLS stays bare (lockstep with src/lib/amazonKitUrls.ts table);
  // withAffiliateTag() appends ?tag=mobile088c05e-20 idempotently.
  const amazonUrl = withAffiliateTag(
    AMAZON_URLS[constitutionSlug] || AMAZON_URLS['frozen-knot'],
  );

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
${goldDivider()}
${p("<strong>P.S.</strong> Ready to go deeper than the kit? The Foundations Course (Tier 1) is $97 for the first 100 founding students — then $197. " + link("Start the Foundations Course →", "https://learn.edeninstitute.health/course/back-to-eden1"))}
${signature()}`;

  return {
    subject: `Your ${constitutionName} starter herb kit — curated just for you`,
    html: emailWrapper(body),
  };
}


// ── Sprouts/Seedlings lead-magnet nurture (Phase 3.1.2) ──
const FACEBOOK_URL = 'https://www.facebook.com/TheEdenInstituteBiblicalHerbalism';

function facebookButton(label: string, url: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;"><tr><td align="center"><table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td align="center" style="background-color:${BRAND.gold};border-radius:10px;"><a href="${url}" target="_blank" style="display:inline-block;background-color:${BRAND.gold};color:${BRAND.forest};font-family:Georgia,serif;font-size:17px;font-weight:bold;text-decoration:none;text-align:center;padding:16px 44px;border-radius:10px;line-height:24px;mso-line-height-rule:exactly;letter-spacing:0.3px;">&#9826;&nbsp; ${label} &nbsp;&rarr;</a></td></tr></table><p style="font-family:Georgia,serif;font-size:13px;color:${BRAND.footerText};margin:10px 0 0 0;font-style:italic;">@TheEdenInstituteBiblicalHerbalism</p></td></tr></table>`;
}

// Day 7: Week 2 downloads (Sprouts→Chamomile, Seedlings→Tulsi). Links the PDFs
// already hosted in public/lead-magnets/.
export function buildMagnetWeek2Email(firstName: string, band: 'sprouts' | 'seedlings', includeStory = false): { subject: string; html: string } {
  const isSprouts = band === 'sprouts';
  const herb = isSprouts ? 'Chamomile' : 'Tulsi';
  const label = isSprouts ? 'SPROUTS' : 'SEEDLINGS';
  const slugHerb = isSprouts ? 'chamomile' : 'tulsi';
  const prefix = isSprouts ? 'hs-sprouts-w2' : 'hs-seedlings-w2';
  const base = 'https://edeninstitute.health/lead-magnets';
  const dl = (kind: string) => `${base}/${prefix}-${kind}-${slugHerb}.pdf`;
  const downloads: [string, string][] = [
    ["TEACHER'S GUIDE", dl('tg')],
    ['STUDENT NOTEBOOK', dl('nb')],
    ['FIELD CARDS', dl('fc')],
    ['RECIPE CARDS', dl('rc')],
    ['AROUND THE TABLE CARDS', dl('att')],
  ];
  // The read-aloud story pairs with Week 2 curriculum, so it ships here (not Week 1).
  // Gated by the sender so leads who already received it in Week 1 aren't re-sent it.
  if (includeStory) {
    const storyUrl = isSprouts
      ? `${base}/hs-sprouts-story-1.pdf`
      : `${base}/hs-seedlings-story-7.pdf`;
    downloads.push([isSprouts ? 'STORY 1 (READ-ALOUD)' : 'STORY 7 (READ-ALOUD)', storyUrl]);
  }
  const buttons = downloads.map(([t, u]) => brandButton(t, u)).join('');
  const countWord = includeStory ? 'six' : 'five';
  const countLabel = includeStory ? 'SIX' : 'FIVE';
  const body = `${p(`Hi ${firstName},`)}${p(`Welcome to Week 2. This week&rsquo;s herb is <strong>${herb}</strong> &mdash; the same gentle rhythm, ${countWord} more downloads to print and teach.`)}${goldDivider()}${heading(`YOUR ${countLabel} DOWNLOADS &mdash; ${label} WEEK 2 (${herb.toUpperCase()})`)}${buttons}${goldDivider()}${p(`That wraps your free two-week preview. In about a week I&rsquo;ll share a little of the story behind this whole project &mdash; I hope you&rsquo;ll come along for the ride.`)}${signature()}`;
  return { subject: `${isSprouts ? 'Sprouts' : 'Seedlings'} Week 2 (${herb}) — Your Free Preview`, html: emailWrapper(body) };
}

// ── Quiz 3-arc (runs AFTER the constitution drip; queue positions 5/6/7 at
// days 11/14/17). Bridges quiz-takers to: Deep Dive + class, app + book,
// homeschool + Facebook. No coupon codes — the Tier-1 founding price is
// applied on the LearnWorlds enrollment page.
const ARC_COURSE_URL = 'https://learn.edeninstitute.health/course/back-to-eden1';
const ARC_BOOK_ONE_URL = 'https://www.amazon.com/dp/B0GPW5BZ32';
const ARC_APP_URL = 'https://edeninstitute.health/apothecary/start';
const ARC_HOMESCHOOL_URL = 'https://edeninstitute.health/homeschool';

// Day 11: Deep-Dive Guide + the Foundations class.
export function buildNurtureArc1(firstName: string, constitutionName: string, constitutionSlug: string): { subject: string; html: string } {
  const patternShort = constitutionName.replace(/^The /i, '');
  const body = `${p(`Hi ${firstName},`)}${p(`You&rsquo;ve spent two weeks getting to know your pattern, <strong>${constitutionName}</strong>. If you&rsquo;re ready to go further, there are two doors.`)}${goldDivider()}${heading('1 &mdash; Your Deep-Dive Guide')}${p(`Your ${patternShort} pattern in full: all 10 matched herbs with actions, preparation methods, dosages, and safety notes &mdash; plus a caution list, lifestyle and nutrition guidance, and the Biblical framework for your constitution.`)}${brandButton(`Get Your ${patternShort} Deep-Dive Guide &mdash; $4.99`, `https://edeninstitute.health/go/deep-dive/${constitutionSlug}`)}${goldDivider()}${heading('2 &mdash; The Foundations Class')}${p(`The guide hands you your pattern. The Foundations Course (Tier 1) teaches you to read and work with <em>any</em> constitution &mdash; yours, your children&rsquo;s, your whole household&rsquo;s.`)}${p(`It&rsquo;s <strong>$97 for the first 100 founding students</strong>, then $197. The founding price is applied at checkout &mdash; no code needed.`)}${brandButton('Start the Foundations Class', ARC_COURSE_URL)}${p(`If you&rsquo;ve already begun &mdash; wonderful. Keep going.`)}${signature()}`;
  return { subject: 'Now you know your pattern — go deeper', html: emailWrapper(body) };
}

// Day 14: the app + the book.
export function buildNurtureArc2(firstName: string, constitutionName: string, _constitutionSlug: string): { subject: string; html: string } {
  const patternShort = constitutionName.replace(/^The /i, '');
  const body = `${p(`Hi ${firstName},`)}${p(`Your pattern doesn&rsquo;t have to live in an inbox. Two ways to keep it close.`)}${goldDivider()}${heading('The Eden Apothecary app')}${p(`Pattern-aware herb guidance in your pocket &mdash; your ${patternShort} matched herbs, the full library, energetics and safety, all tied to your constitution. Free to start; Seed and Root unlock more depth when you want it.`)}${brandButton('Start Free in the App', ARC_APP_URL)}${goldDivider()}${heading('The book for your shelf')}${p(`When you&rsquo;d rather hold it in your hands, Book One is the companion to everything we teach.`)}${brandButton('Get the Book', withAffiliateTag(ARC_BOOK_ONE_URL))}${p(`<em>Affiliate link &mdash; Eden Institute earns a small commission at no extra cost to you.</em>`)}${signature()}`;
  return { subject: 'Carry your pattern with you', html: emailWrapper(body) };
}

// Day 17: homeschool curriculum + Facebook.
export function buildNurtureArc3(firstName: string, _constitutionName: string, _constitutionSlug: string): { subject: string; html: string } {
  const body = `${p(`Hi ${firstName},`)}${p(`One last door &mdash; this one&rsquo;s for your family.`)}${goldDivider()}${heading('Eden&rsquo;s Table &mdash; for your children')}${p(`Our K&ndash;12 Biblical-herbalism curriculum teaches children the bodies God designed and the plants He gave to tend them &mdash; woven through Scripture, science, and the rhythms of your own kitchen table.`)}${brandButton('Explore Eden&rsquo;s Table', ARC_HOMESCHOOL_URL)}${goldDivider()}${heading('Come along for the ride')}${p(`I&rsquo;m building all of this in real time. Follow along on Facebook for the progress, the roadblocks, and the launch news &mdash; it&rsquo;s sweeter with you walking it alongside me.`)}${facebookButton('Follow the Journey on Facebook', FACEBOOK_URL)}${signature()}`;
  return { subject: 'For your table and your family', html: emailWrapper(body) };
}

// Day 14: the "come along for the ride" Facebook pitch. Band-agnostic.
export function buildMagnetWeek3FacebookEmail(firstName: string): { subject: string; html: string } {
  const body = `${p(`Hi ${firstName},`)}${p(`By now you&rsquo;ve walked through your first two weeks of Eden&rsquo;s Table around your own kitchen table. Before you go further, I wanted to step out from behind the curriculum for a moment and tell you the story underneath it.`)}${p(`For as long as I can remember, I&rsquo;ve wanted to build something of my own. But it wasn&rsquo;t until late last year that God finally made it clear <em>what</em> that something should be &mdash; this. A Christ-centered way to teach our children the bodies He designed and the plants He gave to tend them.`)}${p(`This is a true passion project for me, and watching it come to life has been humbling in the best way. The encouragement and the sheer number of families asking for this curriculum have been such a blessing &mdash; far more than I expected.`)}${goldDivider()}${heading('Come along for the ride.')}${p(`I&rsquo;d love for you to follow the journey as I build this in real time. I&rsquo;ll be posting often on our Facebook page &mdash; the progress, the roadblocks, the honest struggles, and the praise reports along the way. It&rsquo;s the behind-the-scenes of a dream being built, and it&rsquo;s so much sweeter with you walking it alongside me.`)}${facebookButton('Follow the Journey on Facebook', FACEBOOK_URL)}${goldDivider()}${heading('Know a family who&rsquo;d love this?')}${p(`If a friend comes to mind &mdash; another homeschool mom, a family at church, someone who wants to raise their children close to God&rsquo;s creation &mdash; would you forward this email to them, or share the page? Word of mouth from families like yours is how Eden&rsquo;s Table grows.`)}${p(`<strong>And keep an eye out:</strong> pre-orders open soon. The moment I lock in the right print partner I&rsquo;ll open the doors &mdash; and the families following along will be first to know.`)}${signature()}`;
  return { subject: 'Come along for the ride — the story behind Eden’s Table', html: emailWrapper(body) };
}
