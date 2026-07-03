// supabase/functions/_shared/launch-sequence-templates.ts
//
// "The Table Is Being Set" — the 7-email Sprouts preorder launch sequence
// (July 2026). A progressive-reveal arc sent to the homeschool list:
//
//   1  Jul 9   The Vision: something is being planted        (Deut 6:6-7)
//   2  Jul 11  Meet Sprouts (and the Eden family)            (Psalm 127:3)
//   3  Jul 13  Why this is not like anything else            (Psalm 139:14)  + shop
//   4  Jul 15  Behind the Table: what's being built          (Col 3:23)      reveals Seedlings
//   5  Jul 17  A look up the path: Cultivators               (Hosea 4:6)     + shop
//   6  Jul 20  The full journey: Practitioners → Sprouts     (Daniel 1:17)
//   7  Jul 22  The doors are about to open                   (Esther 4:14)   + shop
//
// Sprouts stays the hero throughout; the other bands are the horizon, never
// the offer. Rows live in public.launch_email_queue and are drained by the
// nurture-emails EF (Vercel cron, every 15 min): the FIXED-DATE cohort is
// backfilled by scripts/launch-sequence-backfill.sql, and post-July-9 signups
// get the same arc on a 2-day drip via the enqueue_launch_sequence_on_signup
// trigger (migration 20260702190000).
//
// Like homeschool-followup-templates.ts, this file is intentionally
// self-contained: it has its OWN wrapper (launchWrapper) instead of the
// canonical emailWrapper because (a) the launch footer block replaces the
// per-email shop card, and the Mountain Rose button must appear in emails
// 3/5/7 ONLY, while emailWrapper appends shopApothecaryCard to everything;
// and (b) the chrome footer's "you're receiving this" line is quiz-specific
// there. The small HTML helpers are copied verbatim so rendering matches.
// Voice rules: no em dashes (feedback_no_em_dashes); Scripture is NASB and
// woven into the copy, never appended.

// ── ACTIVATION CHECKLIST — fill these before the July 9 send ─────────────
// [MOUNTAIN_ROSE_AFFILIATE_URL]: Camila's Mountain Rose Herbs affiliate link.
//   Until it is filled in, the shop button safely falls back to the existing
//   monetized herb-ordering page at /homeschool/herbs (PR #222), so an
//   unfilled placeholder can never ship a dead link.
const MOUNTAIN_ROSE_AFFILIATE_URL = '[MOUNTAIN_ROSE_AFFILIATE_URL]';
// [WEBSITE_URL]: canonical marketing site. Live value already correct.
const WEBSITE_URL = 'https://edeninstitute.health';
// Social links (same values the canonical emailWrapper chrome uses).
const FACEBOOK_URL = 'https://www.facebook.com/TheEdenInstituteBiblicalHerbalism';
const INSTAGRAM_URL = 'https://instagram.com/the_eden_institute';
const PINTEREST_URL = 'https://pin.it/6AuiXypgA';
// Primary CTA target for Email 7: the live founders-price capture page.
const FOUNDERS_URL = 'https://edeninstitute.health/sprouts-founders.html';
// ──────────────────────────────────────────────────────────────────────────

const SHOP_FALLBACK_URL = 'https://edeninstitute.health/homeschool/herbs';

function shopUrl(): string {
  return MOUNTAIN_ROSE_AFFILIATE_URL.startsWith('[')
    ? SHOP_FALLBACK_URL
    : MOUNTAIN_ROSE_AFFILIATE_URL;
}

const BRAND = {
  bgOuter: '#F5F0E8',
  bgBody: '#FFFFFF',
  forest: '#2C3E2D',
  text: '#3D3832',
  gold: '#C5A44E',
  sage: '#5C7A5C',
  footerText: '#6B6560',
};

// ── Helpers (verbatim from nurture-email-templates.ts so output matches) ──
function p(text: string, extra = ''): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${BRAND.text};margin:0 0 16px 0;${extra}">${text}</p>`;
}

function heading(text: string): string {
  return `<h2 style="font-family:Georgia,serif;font-size:22px;line-height:1.3;color:${BRAND.forest};margin:0 0 16px 0;font-weight:bold;">${text}</h2>`;
}

function bullet(text: string): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${BRAND.text};margin:0 0 8px 0;padding-left:16px;">&middot; ${text}</p>`;
}

function goldDivider(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:2px solid ${BRAND.gold};font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr></table>`;
}

function spacer(h = 8): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:${h}px;font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
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

function signature(): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${BRAND.text};margin:24px 0 4px 0;">Grace and health,</p>
<p style="font-family:Georgia,serif;font-size:16px;color:${BRAND.text};font-weight:bold;margin:0;">Camila</p>
<p style="font-family:Georgia,serif;font-size:14px;color:${BRAND.text};margin:4px 0 0 0;">The Eden Institute</p>
<p style="font-family:Georgia,serif;font-size:14px;margin:4px 0 0 0;"><a href="${WEBSITE_URL}" style="color:${BRAND.sage};text-decoration:underline;">edeninstitute.health</a></p>`;
}

// A quoted-Scripture card: bgOuter panel with a gold left rule. Used where an
// email lingers on its anchor verse; shorter quotes stay inline in the prose.
function verseCard(quote: string, ref: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;">
<tr><td style="background-color:${BRAND.bgOuter};padding:18px 22px;border-left:3px solid ${BRAND.gold};">
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.65;color:${BRAND.forest};margin:0 0 6px 0;font-style:italic;">&ldquo;${quote}&rdquo;</p>
<p style="font-family:Georgia,serif;font-size:13px;color:${BRAND.footerText};margin:0;letter-spacing:1px;">${ref} (NASB)</p>
</td></tr>
</table>`;
}

// ── The standard launch footer: ONE component, rendered identically in all
// seven emails. Optional Mountain Rose shop block (emails 3, 5, 7 only) sits
// above it; the per-email framing line is the only thing that varies there.
function shopHerbsBlock(framing: string): string {
  return `${goldDivider()}
<p style="font-family:Georgia,serif;font-size:15px;line-height:1.6;color:${BRAND.text};margin:0 0 4px 0;font-style:italic;text-align:center;">${framing}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 8px 0;">
<tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
<tr><td align="center" style="background-color:${BRAND.bgBody};border:2px solid ${BRAND.forest};border-radius:8px;">
<a href="${shopUrl()}" target="_blank" style="display:inline-block;color:${BRAND.forest};font-family:Georgia,serif;font-size:15px;font-weight:bold;text-decoration:none;text-align:center;padding:12px 36px;border-radius:8px;line-height:22px;mso-line-height-rule:exactly;">Shop Herbs for Your Apothecary</a>
</td></tr>
</table>
<p style="font-family:Georgia,serif;font-size:12px;color:${BRAND.footerText};margin:8px 0 0 0;font-style:italic;">Affiliate link. Eden Institute earns a small commission at no extra cost to you.</p>
</td></tr>
</table>`;
}

export function launchFooter(shopFraming?: string): string {
  const shop = shopFraming ? shopHerbsBlock(shopFraming) : '';
  return `${shop}
${goldDivider()}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 8px 0;">
<tr><td align="center">
<p style="font-family:Georgia,serif;font-size:15px;line-height:1.6;color:${BRAND.text};margin:0 0 14px 0;text-align:center;">I&rsquo;m building all of this in real time, and I share the journey as it happens.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
<tr><td align="center" style="background-color:${BRAND.gold};border-radius:10px;">
<a href="${FACEBOOK_URL}" target="_blank" style="display:inline-block;background-color:${BRAND.gold};color:${BRAND.forest};font-family:Georgia,serif;font-size:17px;font-weight:bold;text-decoration:none;text-align:center;padding:16px 44px;border-radius:10px;line-height:24px;mso-line-height-rule:exactly;letter-spacing:0.3px;">Follow along on Facebook &nbsp;&rarr;</a>
</td></tr>
</table>
<p style="font-family:Georgia,serif;font-size:13px;color:${BRAND.footerText};margin:14px 0 0 0;text-align:center;">
<a href="${INSTAGRAM_URL}" target="_blank" style="color:${BRAND.sage};text-decoration:underline;">Instagram</a>
&nbsp;&middot;&nbsp;
<a href="${PINTEREST_URL}" target="_blank" style="color:${BRAND.sage};text-decoration:underline;">Pinterest</a>
&nbsp;&middot;&nbsp;
<a href="${WEBSITE_URL}" target="_blank" style="color:${BRAND.sage};text-decoration:underline;">edeninstitute.health</a>
</p>
</td></tr>
</table>`;
}

// ── Wrapper: same chrome as the canonical emailWrapper, minus the automatic
// shop card, with a homeschool-list "why you're receiving this" line. The
// launchFooter is injected after the body so all seven render it identically.
export function launchWrapper(bodyContent: string, shopFraming?: string): string {
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
${launchFooter(shopFraming)}
</td></tr>
<!-- GOLD RULE -->
<tr><td style="background-color:${BRAND.bgBody};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:2px solid ${BRAND.gold};font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>
<!-- FOOTER -->
<tr><td style="background-color:${BRAND.forest};padding:30px 20px;text-align:center;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-family:Georgia,serif;font-size:14px;font-weight:bold;color:#FFFFFF;text-align:center;">The Eden Institute</td></tr>
<tr><td style="text-align:center;padding-top:6px;"><a href="${WEBSITE_URL}" style="font-family:Georgia,serif;font-size:13px;color:#FFFFFF;text-decoration:underline;">edeninstitute.health</a></td></tr>
<tr><td style="text-align:center;padding-top:14px;">
<a href="${FACEBOOK_URL}" style="font-family:Georgia,serif;font-size:12px;color:#FFFFFF;text-decoration:underline;">Facebook</a>
&nbsp;|&nbsp;
<a href="${INSTAGRAM_URL}" style="font-family:Georgia,serif;font-size:12px;color:#FFFFFF;text-decoration:underline;">Instagram</a>
&nbsp;|&nbsp;
<a href="${PINTEREST_URL}" style="font-family:Georgia,serif;font-size:12px;color:#FFFFFF;text-decoration:underline;">Pinterest</a>
</td></tr>
<tr><td style="text-align:center;padding-top:14px;font-family:Georgia,serif;font-size:13px;color:${BRAND.gold};font-style:italic;">Back to Eden. Back to Truth.</td></tr>
<tr><td style="font-family:Georgia,serif;font-size:11px;color:${BRAND.footerText};text-align:center;padding-top:16px;">You&rsquo;re receiving this because you requested Eden&rsquo;s Table homeschool resources from The Eden Institute.</td></tr>
<tr><td style="text-align:center;padding-top:8px;"><a href="{{UNSUB_URL}}" style="font-family:Georgia,serif;font-size:11px;color:${BRAND.footerText};text-decoration:underline;">Unsubscribe</a></td></tr>
</table>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// ══════════════════════════════════════════════════════════════
// EMAIL 1 — Jul 9 — The Vision: Something Is Being Planted
// Scripture anchor: Deuteronomy 6:6-7
// ══════════════════════════════════════════════════════════════
export function buildLaunchEmail1(firstName: string): { subject: string; html: string } {
  const body =
    `${p(`Hi ${firstName},`)}` +
    `${p(`Can I tell you what has been weighing on my heart?`)}` +
    `${p(`Almost everything our children are handed about their bodies, in textbooks, in health class, even in well-meaning homeschool science, teaches them one quiet lesson underneath all the facts: <em>the body is a machine.</em> Parts to memorize. Systems to manage. Symptoms to switch off.`)}` +
    `${p(`But that is not what your child is. And it is not what Scripture says about them.`)}` +
    `${p(`At Eden&rsquo;s Table, we are building something different: a way of teaching children to see the body, and all of creation, as the intentional design of a masterful Creator. Not a machine to be managed. A garden to be tended. When a child learns what chamomile does and why, they are not memorizing trivia. They are learning to read a little more of the language God wrote into the world.`)}` +
    `${goldDivider()}` +
    `${p(`This is the kind of teaching God had in mind when He gave His people their instructions, long before there were classrooms:`)}` +
    `${verseCard(`These words, which I am commanding you today, shall be on your heart. You shall teach them diligently to your sons and shall talk of them when you sit in your house and when you walk by the way and when you lie down and when you rise up.`, 'Deuteronomy 6:6-7')}` +
    `${p(`Notice where that teaching happens. Not at a desk. At the table, on the walk, at bedtime, in the morning. Faith and knowledge handed down inside the ordinary rhythms of a home. That one passage is the blueprint for everything we are building.`)}` +
    `${goldDivider()}` +
    `${p(`It begins with <strong>Sprouts</strong>, our curriculum for kindergarten through 2nd grade, where little hands meet God&rsquo;s garden for the first time. And it does not end there. The full path runs from Sprouts through <strong>Seedlings</strong>, <strong>Cultivators</strong>, and <strong>Practitioners</strong>: one unbroken journey from the first read-aloud to graduation. But I am getting ahead of myself.`)}` +
    `${p(`Over the next two weeks I want to pull back the curtain on all of it: what is actually inside Sprouts, the method underneath it, what is being built right now, and where the whole journey leads.`)}` +
    `${p(`Something is being planted. I am so glad you are here for it.`)}` +
    `${signature()}`;
  return {
    subject: `Something is being planted at Eden's Table`,
    html: launchWrapper(body),
  };
}

// ══════════════════════════════════════════════════════════════
// EMAIL 2 — Jul 11 — Meet Sprouts (and the Family)
// Scripture anchor: Psalm 127:3
// ══════════════════════════════════════════════════════════════
export function buildLaunchEmail2(firstName: string): { subject: string; html: string } {
  const body =
    `${p(`Hi ${firstName},`)}` +
    `${p(`Last time I told you something was being planted. Today I want to set it on the table where you can see it.`)}` +
    `${p(`<strong>Sprouts</strong> is our kindergarten through 2nd grade curriculum, and it is built on one simple rhythm: one herb, one week, with every part of learning gathered around that herb like family around a table. Thirty-six herbs across the year, each one a small world your child gets to explore with all five senses.`)}` +
    `${p(`Picture a morning. The kettle is on. There is a little dish of dried lavender in the middle of the table, and small fingers are rolling the buds to release the smell. You read a story aloud. Someone giggles at the dog. By Wednesday you are in the kitchen together making something real with the week&rsquo;s herb, and by Friday the whole crew is chanting a four-line rhyme they will still remember at Christmas. That is Sprouts. It smells like something, every single week.`)}` +
    `${goldDivider()}` +
    `${heading(`WHAT COMES TO YOUR TABLE`)}` +
    `${bullet(`<strong>The Teacher&rsquo;s Guide</strong>: your whole week laid out day by day. Open it and teach. No prep marathon the night before.`)}` +
    `${bullet(`<strong>The Student Notebook</strong>: five gentle pages a week, sized for K-2 hands, where drawing counts as much as writing.`)}` +
    `${bullet(`<strong>Field Cards</strong>: the herb itself in hand. What it looks like, how it tastes, where it grows.`)}` +
    `${bullet(`<strong>Recipe Cards</strong>: Wednesday&rsquo;s kitchen lab. A real recipe, made together, eaten together.`)}` +
    `${bullet(`<strong>Around the Table Cards</strong>: dinner conversation starters that need no prep at all. Pull a card, read it aloud, let the answers wander.`)}` +
    `${bullet(`<strong>The Read-Aloud Storybook</strong>: where the Eden family lives.`)}` +
    `${goldDivider()}` +
    `${heading(`AND OH, THE FAMILY`)}` +
    `${p(`Facts fade. Stories stay. So the worldview of Sprouts is carried by a family your children will come to know by name: Vov&oacute; and PopPop, Levi and Ruthie, Manny, Evie, and Gracie. (And Bear. There is always Bear.) Week by week your kids walk beside them, through scraped knees and garden rows and kitchen mishaps, and the lessons soak in the way lessons always have: wrapped in people we love.`)}` +
    `${p(`Scripture says children are &ldquo;a gift of the LORD&rdquo; (Psalm 127:3, NASB), and we built Sprouts like we actually believe that. Gift-worthy mornings. Wonder treated as something sacred. A curriculum that ends with your child closer to you, not parked in front of something.`)}` +
    `${p(`Next time: the method underneath it all, and why there is nothing else quite like it on your shelf.`)}` +
    `${signature()}`;
  return {
    subject: `Meet Sprouts: where the journey begins`,
    html: launchWrapper(body),
  };
}

// ══════════════════════════════════════════════════════════════
// EMAIL 3 — Jul 13 — Why This Is Not Like Anything Else
// Scripture anchor: Psalm 139:14 · Mountain Rose shop button
// ══════════════════════════════════════════════════════════════
export function buildLaunchEmail3(firstName: string): { subject: string; html: string } {
  const body =
    `${p(`Hi ${firstName},`)}` +
    `${p(`There is a phrase you will never find anywhere in Eden&rsquo;s Table: <em>&ldquo;take this for that.&rdquo;</em>`)}` +
    `${p(`Open most natural-health resources and that is the whole method. Headache? Peppermint. Can&rsquo;t sleep? Valerian. It is herbalism taught like a vending machine, and here is the irony: it quietly teaches children the very same lesson conventional medicine does. The body is a machine, and health is finding the right input to shut a symptom off.`)}` +
    `${p(`We teach differently, and we do it on conviction. Three commitments run through every band of Eden&rsquo;s Table, from kindergarten to senior year.`)}` +
    `${goldDivider()}` +
    `${heading(`1. ONE HERB OPENS EVERYTHING`)}` +
    `${p(`When your child meets chamomile, chamomile becomes the doorway to the whole week: the science of how a plant calms a body, the history of the grandmothers and physicians who used it, the language to describe it, and the Scripture that frames it. One herb, every subject gathered around it. That is not just efficient. It teaches a child that knowledge holds together because creation has one Author.`)}` +
    `${heading(`2. TERRAIN, NOT SYMPTOM-CHASING`)}` +
    `${p(`A wise gardener does not paint brown leaves green. She tends the soil. Eden&rsquo;s Table teaches children to think about the whole body the same way: not &ldquo;what silences this symptom,&rdquo; but &ldquo;what does this body need to flourish?&rdquo; Whole-person thinking, planted early enough to become instinct.`)}` +
    `${heading(`3. THE FIVE TENETS`)}` +
    `${p(`Underneath every lesson sits our framework for health: <strong>Nutrition, Elimination, Rest, Hydration, and Spiritual Alignment</strong>. Simple enough for a six-year-old to recite. Sturdy enough to carry them for life.`)}` +
    `${goldDivider()}` +
    `${p(`All of it flows from one verse we want written on our children&rsquo;s hearts before the world offers them a cheaper story: &ldquo;I will give thanks to You, for I am fearfully and wonderfully made; wonderful are Your works, and my soul knows it very well&rdquo; (Psalm 139:14, NASB).`)}` +
    `${p(`A child raised on that verse learns their body as something designed, not an accident to be medicated. That is the difference, and it changes everything downstream: how they eat, how they rest, how they treat the bodies of the people they love.`)}` +
    `${p(`Next time I will take you behind the scenes of this exact season, because there is more being built right now than I have told you.`)}` +
    `${signature()}`;
  return {
    subject: `Why we don't teach "take this for that"`,
    html: launchWrapper(
      body,
      `As your family begins learning, begin stocking your home apothecary. A few well-chosen jars are all it takes to start.`,
    ),
  };
}

// ══════════════════════════════════════════════════════════════
// EMAIL 4 — Jul 15 — Behind the Table: What's Being Built Right Now
// Scripture anchor: Colossians 3:23 · reveals Seedlings
// ══════════════════════════════════════════════════════════════
export function buildLaunchEmail4(firstName: string): { subject: string; html: string } {
  const body =
    `${p(`Hi ${firstName},`)}` +
    `${p(`Today I want to show you what this season actually looks like on my side of the table.`)}` +
    `${p(`Right now, this very week, we are deep in the unglamorous work that decides whether something is worthy of your home. Refining print specifications page by page, because a K-2 notebook should survive a K-2 artist. Choosing the makers and print partners whose work we would be proud to put in your hands. Building a purchasing experience that treats you like a founding family, not a transaction.`)}` +
    `${p(`I will be honest: the slower road is a discipline. Every week of care is a week you wait, and I feel that. But there is a verse taped over this whole project: &ldquo;Whatever you do, do your work heartily, as for the Lord rather than for men&rdquo; (Colossians 3:23, NASB). This curriculum will sit at your family&rsquo;s table, next to your Bible, in front of your children. It gets built <em>heartily</em>, or it does not ship. Stewardship over speed, every time.`)}` +
    `${goldDivider()}` +
    `${heading(`AND HERE IS WHAT I HAVEN&rsquo;T TOLD YOU`)}` +
    `${p(`While Sprouts is being finished, the next band is already coming together beautifully. <strong>Seedlings</strong>, for grades 3 through 5, takes the same herb-centered rhythm and grows it up: deeper science, richer history, real discovery-day experiments, the same Scripture-rooted spine. Watching it take shape alongside Sprouts has been one of the joys of this year.`)}` +
    `${p(`I tell you that because I want you to see what you are actually joining. This is not one product. It is a full journey being built one careful band at a time, so that the curriculum grows up exactly as your children do.`)}` +
    `${p(`In the next email I will take you further up that path than I ever have publicly, into middle school, where the story turns serious.`)}` +
    `${signature()}`;
  return {
    subject: `Sprouts is almost ready. Seedlings is close behind.`,
    html: launchWrapper(body),
  };
}

// ══════════════════════════════════════════════════════════════
// EMAIL 5 — Jul 17 — A Look Up the Path: Cultivators
// Scripture anchor: Hosea 4:6 · Mountain Rose shop button
// ══════════════════════════════════════════════════════════════
export function buildLaunchEmail5(firstName: string): { subject: string; html: string } {
  const body =
    `${p(`Hi ${firstName},`)}` +
    `${p(`There is a question that eventually occurs to every family who starts down this road. Our great-grandmothers knew which plant eased a fever and which tea settled a colicky baby. That knowledge was ordinary, passed down at kitchen tables for a hundred generations. So: <em>how did we forget all of it in one century?</em>`)}` +
    `${p(`That question has an answer. It has names, dates, and documents. And by middle school, children are ready to study it properly.`)}` +
    `${goldDivider()}` +
    `${heading(`CULTIVATORS: GRADES 6-8`)}` +
    `${p(`<strong>The history.</strong> Cultivators traces how Western medicine became what it is, including the 1910 Flexner Report, the reshaping of medical education around pharmaceutical science, and what was gained and what was quietly lost along the way. We handle it as rigorous, primary-source history, not sensationalism. Students learn to weigh evidence and understand how we got here, because discernment is built, not inherited.`)}` +
    `${p(`<strong>The science.</strong> This is where the body opens up: organ systems, the organs within them, and the tissue states that describe how they thrive or struggle, with herbs matched to each. Real physiology, taught at full strength.`)}` +
    `${p(`<strong>The backbone.</strong> Scripture does not decorate these lessons. It structures them. Every system studied becomes another line of evidence for a masterful Creator&rsquo;s intentionality, from the architecture of a kidney to the chemistry of digestion.`)}` +
    `${p(`And the 72 herbs your child met in Sprouts and Seedlings? They all return in Cultivators, this time with far more intent. What was once a story herb becomes a matched tool for a system they now actually understand.`)}` +
    `${goldDivider()}` +
    `${p(`God&rsquo;s lament through the prophet Hosea has always struck me as the epitaph of the century we just studied: &ldquo;My people are destroyed for lack of knowledge&rdquo; (Hosea 4:6, NASB). Recovering that knowledge, carefully, generationally, is much of why Eden&rsquo;s Table exists.`)}` +
    `${p(`Here is what I hope you are starting to see: your child is not getting a workbook. They are beginning a K-12 formation.`)}` +
    `${p(`One band remains, and it is the summit. Next email, I will show you where the whole journey leads.`)}` +
    `${signature()}`;
  return {
    subject: `How did we forget all of this?`,
    html: launchWrapper(
      body,
      `Every stage of this journey assumes a kitchen with real herbs in it. It is never too early to begin stocking the family apothecary.`,
    ),
  };
}

// ══════════════════════════════════════════════════════════════
// EMAIL 6 — Jul 20 — The Full Journey: Practitioners, and Where It Starts
// Scripture anchor: Daniel 1:17
// ══════════════════════════════════════════════════════════════
export function buildLaunchEmail6(firstName: string): { subject: string; html: string } {
  const body =
    `${p(`Hi ${firstName},`)}` +
    `${p(`Two weeks ago I promised to show you the whole path. Today we reach the top of it.`)}` +
    `${goldDivider()}` +
    `${heading(`PRACTITIONERS: GRADES 9-12`)}` +
    `${p(`In the capstone band, all 72 herbs return one final time, now at granular depth: the plant chemistry of what is actually in the jar, and why it does what it does. And then students cross the line that separates knowing about herbs from working with them. They move into remedies, ratios, and real formulation: assessing a whole person, selecting herbs with intention, and preparing something fitted to an actual body, with wisdom and reverence.`)}` +
    `${p(`Think about Daniel and his three friends in Babylon: &ldquo;God gave them knowledge and intelligence in every branch of literature and wisdom&rdquo; (Daniel 1:17, NASB). Mastery was the gift, and God was the giver. That is our picture of a Practitioners graduate: an eighteen-year-old with real, tested competence, who never once had to choose between rigor and reverence.`)}` +
    `${goldDivider()}` +
    `${heading(`THE WHOLE PATH, IN ONE VIEW`)}` +
    `${bullet(`<strong>Sprouts (K-2)</strong>: meet the herbs. Wonder, stories, five senses at the table.`)}` +
    `${bullet(`<strong>Seedlings (3-5)</strong>: understand them. Deeper science, discovery days, growing discernment.`)}` +
    `${bullet(`<strong>Cultivators (6-8)</strong>: the body and the story. Organ systems, tissue states, and how the knowledge was lost.`)}` +
    `${bullet(`<strong>Practitioners (9-12)</strong>: formulate. Chemistry, ratios, remedies, real competence.`)}` +
    `${p(`One arc, thirteen years, that raises a child from meeting an herb to formulating with it, with Scripture as the spine the entire way.`)}` +
    `${goldDivider()}` +
    `${p(`And all of it, every band, every year, begins in the same place: a kindergartner, a story, and a little dish of lavender. It begins with <strong>Sprouts</strong>.`)}` +
    `${p(`Sprouts opens for founding families very soon. In my next email I will tell you exactly what that means and what founding families receive. If this path has stirred something in you, that is the email to watch for.`)}` +
    `${signature()}`;
  return {
    subject: `By the end, they're formulating`,
    html: launchWrapper(body),
  };
}

// ══════════════════════════════════════════════════════════════
// EMAIL 7 — Jul 22 — The Doors Are About to Open
// Scripture anchor: Esther 4:14 · Mountain Rose shop button
// NOTE: preorder timing is deliberately "end of July" / "very soon" so this
// can ship now; tighten the copy once the exact date locks in.
// ══════════════════════════════════════════════════════════════
export function buildLaunchEmail7(firstName: string): { subject: string; html: string } {
  const body =
    `${p(`Hi ${firstName},`)}` +
    `${p(`Two weeks ago I told you something was being planted. You have seen the vision, walked through Sprouts, met the method, looked up the whole path from kindergarten to graduation. Today I get to say the words I have been holding back all month:`)}` +
    `${p(`<strong>Preorder opens at the end of July.</strong>`, 'text-align:center;font-size:18px;')}` +
    `${p(`In the coming weeks, the very first Sprouts kits will be claimed, and the families who claim them will hold a particular place in this story.`)}` +
    `${goldDivider()}` +
    `${heading(`WHAT FOUNDING FAMILIES RECEIVE`)}` +
    `${bullet(`<strong>First access.</strong> Founding families order before the doors open wide, from the first kits made.`)}` +
    `${bullet(`<strong>Founding status.</strong> You are not a customer; you are one of the homes this was built with. That standing stays with your family as every future band opens.`)}` +
    `${bullet(`<strong>A seat at the beginning.</strong> Your children will be among the very first in the country to learn this way, and your feedback will shape every band that follows them up the path.`)}` +
    `${goldDivider()}` +
    `${p(`I keep coming back to Mordecai&rsquo;s words to Esther at her own threshold moment: &ldquo;And who knows whether you have not attained royalty for such a time as this?&rdquo; (Esther 4:14, NASB). I do not think it is an accident that you are homeschooling now, in a generation hungry to recover what was lost, with tools in reach that our grandmothers could only pass down by memory. Perhaps your family is at this table for such a time as this.`)}` +
    `${p(`Reserve your founding spot below, and you will be the first to know the moment the doors open.`)}` +
    `${brandButton('Reserve Your Founding Spot', FOUNDERS_URL)}` +
    `${p(`It begins with Sprouts. It begins very soon. And I could not be more honored to build it alongside your family.`)}` +
    `${signature()}`;
  return {
    subject: `Founding families: this is your moment`,
    html: launchWrapper(
      body,
      `While you wait for your kit, begin your family apothecary. Your first herbs can be on the shelf before Sprouts arrives.`,
    ),
  };
}

// ── Dispatch table for the queue drainer ──
export const LAUNCH_SEQUENCE_LENGTH = 7;

const LAUNCH_BUILDERS: Record<number, (firstName: string) => { subject: string; html: string }> = {
  1: buildLaunchEmail1,
  2: buildLaunchEmail2,
  3: buildLaunchEmail3,
  4: buildLaunchEmail4,
  5: buildLaunchEmail5,
  6: buildLaunchEmail6,
  7: buildLaunchEmail7,
};

export function buildLaunchEmail(
  position: number,
  firstName: string,
): { subject: string; html: string } | null {
  const builder = LAUNCH_BUILDERS[position];
  return builder ? builder(firstName) : null;
}
