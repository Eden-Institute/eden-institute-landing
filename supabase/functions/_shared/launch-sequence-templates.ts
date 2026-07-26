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
// ── PREORDER CONVERSION SERIES (positions 8-17, ships with PR #227) ──
// Ten persistence emails that begin the moment preorder opens and STOP for a
// recipient as soon as they preorder (drain-time suppression against
// public.orders + the cancel_launch_emails_on_order trigger). Enqueued for
// the whole list by scripts/launch-day-blast.sql at day offsets
// 0/2/4/7/10/13/16/20/24/28 from the go-live moment:
//
//    8  Day 0   The first 500 kits are on the table           (launch blast)
//    9  Day 2   Open the box with me                          (Prov 22:6)
//   10  Day 4   You don't have to be an herbalist             (James 1:5)
//   11  Day 7   What founding families are really buying      (Neh 2:18)
//   12  Day 10  The story under the table                     (Psalm 78:4)
//   13  Day 13  Is Sprouts right for your crew?               (Eccl 3:1)
//   14  Day 16  What they'll still remember in December       (Prov 24:3-4)
//   15  Day 20  Your questions, answered around the table     (Luke 14:28)
//   16  Day 24  Before the founding 500 fill                  (Gen 1:29)
//   17  Day 28  As for your house                             (Josh 24:15)
//
// One CTA per email (Preorder → /preorder). No Mountain Rose button in 8-17:
// nothing competes with the kit. Offer facts: $249 founding for the first 500
// kits, then $349 (confirmed by founder 2026-07-03; the $239 in the original
// copy brief was a typo).
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
const FACEBOOK_URL = 'https://www.facebook.com/EdensTableHomeschoolCurriculum';
// Handle changed 2026-07-26 (the_eden_institute -> edenstablehomeschoolcurriculum) as part of the
// Eden's Table social rebrand. Instagram does NOT redirect old usernames; the old URL 404s, verified
// in-browser. Any template still carrying the old handle ships a dead link.
const INSTAGRAM_URL = 'https://instagram.com/edenstablehomeschoolcurriculum';
const PINTEREST_URL = 'https://pin.it/6AuiXypgA';
// Primary CTA target for Email 7 is the founders-price capture page, but that
// page REQUIRES a signed `?t=` token or it disables its own Reserve button. The
// bare URL constant that used to live here shipped a dead button to 1,382
// families on 2026-07-25 (the 1,149 first recorded was a mid-incident count;
// the queue kept draining afterwards, final figure verified against
// launch_email_queue). The signed URL is now built per recipient by the
// caller via _shared/founders-link.ts and passed into buildLaunchEmail7.
// Primary CTA target for the conversion series (8-17): the preorder page
// shipped by PR #227 (web/pages/preorder.astro).
const PREORDER_URL = 'https://edeninstitute.health/preorder';
// Ship dates, kept as literals here so this module stays self-contained (it
// imports nothing). These MUST match SHIP_TARGET / SHIP_GUARANTEE_TEXT in
// _shared/order-config.ts, which is the authoritative source the checkout
// disclaimer and confirmation email use. If the ship window ever moves, change
// it there and mirror it here. Email 15 states both because that FAQ asks
// "when do kits arrive?" by name, and under 16 CFR 435 the answer must carry
// the guaranteed date, not just a promise of a shipping-confirmation email.
const EMAIL_SHIP_TARGET = 'early November 2026';
const EMAIL_SHIP_GUARANTEE = 'December 31, 2026';
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
<tr><td style="font-family:Georgia,serif;font-size:11px;color:${BRAND.footerText};text-align:center;padding-top:6px;">Rooted in Faith Ventures LLC &middot; 303 Holly Cir, Unit 3262, Clarksville, TN 37043</td></tr>
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
// EMAIL 7 — Jul 25 — The Doors Are About to Open
// Scripture anchor: Esther 4:14 · Mountain Rose shop button
// Preorder open date locked 2026-07-16: July 29.
// ══════════════════════════════════════════════════════════════
// `foundersUrl` MUST be a signed founders-page URL from foundersFormUrl() in
// _shared/founders-link.ts. Passing a bare page URL renders a disabled button.
export function buildLaunchEmail7(
  firstName: string,
  foundersUrl: string,
): { subject: string; html: string } {
  if (!foundersUrl || !foundersUrl.includes('?t=')) {
    // Fail loudly. The 2026-07-25 incident was a SILENT dead link; a thrown
    // error marks the queue row failed and surfaces in logs instead.
    throw new Error('buildLaunchEmail7: signed foundersUrl (with ?t=) is required');
  }
  const body =
    `${p(`Hi ${firstName},`)}` +
    `${p(`Two weeks ago I told you something was being planted. You have seen the vision, walked through Sprouts, met the method, looked up the whole path from kindergarten to graduation. Today I get to say the words I have been holding back all month:`)}` +
    `${p(`<strong>Preorder opens July 29.</strong>`, 'text-align:center;font-size:18px;')}` +
    `${p(`In the coming weeks, the very first Sprouts kits will be claimed, and the families who claim them will hold a particular place in this story.`)}` +
    `${goldDivider()}` +
    `${heading(`WHAT FOUNDING FAMILIES RECEIVE`)}` +
    `${bullet(`<strong>First access.</strong> Founding families order before the doors open wide, from the first kits made.`)}` +
    `${bullet(`<strong>Founding status.</strong> You are not a customer; you are one of the homes this was built with. That standing stays with your family as every future band opens.`)}` +
    `${bullet(`<strong>A seat at the beginning.</strong> Your children will be among the very first in the country to learn this way, and your feedback will shape every band that follows them up the path.`)}` +
    `${goldDivider()}` +
    `${p(`I keep coming back to Mordecai&rsquo;s words to Esther at her own threshold moment: &ldquo;And who knows whether you have not attained royalty for such a time as this?&rdquo; (Esther 4:14, NASB). I do not think it is an accident that you are homeschooling now, in a generation hungry to recover what was lost, with tools in reach that our grandmothers could only pass down by memory. Perhaps your family is at this table for such a time as this.`)}` +
    `${p(`Reserve your founding spot below, and you will be the first to know the moment the doors open.`)}` +
    `${brandButton('Reserve Your Founding Spot', foundersUrl)}` +
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

// ══════════════════════════════════════════════════════════════
// EMAIL 7 RESEND (queue position 18) — the Jul 25 make-good
// ══════════════════════════════════════════════════════════════
// WHY THIS EXISTS. Email 7 reached 1,382 families on 2026-07-25 with a Reserve
// button that pointed at the bare founders page URL. That page disables its own
// submit button without a signed `?t=` token, so the CTA was 100% dead and ZERO
// reservations were captured. 232 of those families opened it and 12 clicked the
// dead button. A deploy cannot repair mail that has already sent, so this is a
// second, honest send to exactly that cohort.
//
// It carries the FULL Email 7 offer rather than a bare apology, because 1,150 of
// the 1,382 never opened Email 7 at all: a note that only says "the link was
// broken" would be meaningless to 83% of the audience. Founder-approved
// 2026-07-25.
//
// Same signed-URL contract as buildLaunchEmail7: it THROWS rather than ship a
// second dead button, which is the whole point of this email.
// SUBJECT LINE SPLIT TEST. The body is byte-identical in both variants; only
// the subject and the preheader differ. The point is not this email: it is
// Wednesday's launch blast to the full list, the largest send of the year,
// whose subject is currently chosen by taste alone. 1,375 recipients split
// evenly is enough to tell a 15% open rate from a 22% one, and the answer lands
// two days before it is needed.
//   a = personal + curiosity gap   ("Sarah, this was my fault")
//   b = loss aversion + the number ("Don't lose your $249 founding price ...")
export type ResendSubjectVariant = 'a' | 'b';

// FNV-1a over the lowercased address. Deterministic and synchronous on purpose:
// the same address always lands in the same arm, so a retry after a send
// failure cannot flip someone between variants and corrupt the measurement,
// and the assignment can be reproduced later from the address alone.
export function variantForEmail(email: string): ResendSubjectVariant {
  let h = 0x811c9dc5;
  const s = (email || '').trim().toLowerCase();
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 2 === 0 ? 'a' : 'b';
}

export function buildLaunchEmail7Resend(
  firstName: string,
  foundersUrl: string,
  variant: ResendSubjectVariant = 'a',
): { subject: string; html: string } {
  if (!foundersUrl || !foundersUrl.includes('?t=')) {
    throw new Error('buildLaunchEmail7Resend: signed foundersUrl (with ?t=) is required');
  }
  // Every recipient in the incident cohort has a real first name on file, but
  // the drainer defaults a missing one to 'friend', and "friend, this was my
  // fault" would undo the whole point of variant a.
  const named =
    !!firstName && firstName.trim() !== '' && firstName.trim().toLowerCase() !== 'friend';
  const subject =
    variant === 'b'
      ? `Don't lose your $249 founding price over my mistake`
      : named
      ? `${firstName}, this was my fault`
      : `This was my fault`;
  const preview =
    variant === 'b'
      ? `The button was broken. It is fixed, and your spot is open until July 29.`
      : `The Reserve button in my last email did not work. Here is one that does.`;
  const body =
    `${preheader(preview)}` +
    `${p(`Hi ${firstName},`)}` +
    `${p(`I owe you a quick apology. The email I sent about founding families and the July 29 preorder had a Reserve button that did not work. It was broken on our end, not yours. If you clicked it and nothing happened, that is why, and I am sorry.`)}` +
    `${p(`Here is the working link.`)}` +
    `${brandButton('Reserve Your Founding Spot', foundersUrl)}` +
    `${p(`In case that first email never reached you, here is what it said.`)}` +
    `${p(`<strong>Preorder opens July 29.</strong>`, 'text-align:center;font-size:18px;')}` +
    `${goldDivider()}` +
    `${heading(`WHAT FOUNDING FAMILIES RECEIVE`)}` +
    `${bullet(`<strong>First access.</strong> Founding families order before the doors open wide, from the first kits made.`)}` +
    `${bullet(`<strong>Founding status.</strong> You are not a customer; you are one of the homes this was built with. That standing stays with your family as every future band opens.`)}` +
    `${bullet(`<strong>A seat at the beginning.</strong> Your children will be among the very first in the country to learn this way, and your feedback will shape every band that follows them up the path.`)}` +
    `${goldDivider()}` +
    `${p(`Reserving costs nothing today. It holds your place and your founding price, and it means you hear from me the moment the doors open, before we announce it anywhere else.`)}` +
    `${brandButton('Reserve Your Founding Spot', foundersUrl)}` +
    `${p(`Thank you for your patience with a small team building something new for your table.`)}` +
    `${signature()}`;
  return {
    subject,
    html: launchWrapper(
      body,
      `While you wait for your kit, begin your family apothecary. Your first herbs can be on the shelf before Sprouts arrives.`,
    ),
  };
}

// ══════════════════════════════════════════════════════════════
// PREORDER CONVERSION SERIES (8-17)
// ══════════════════════════════════════════════════════════════

// Hidden preheader: the inbox preview line under the subject. Kept invisible
// in the rendered email. Used by the conversion emails (8-17) and by the
// Email 7 make-good resend; emails 1-7 themselves predate this helper, which is
// why Gmail showed "Hi Sarah, I owe you a quick apology" as their preview line.
// Declared here but hoisted, so the resend builder above can call it.
function preheader(text: string): string {
  return `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${text}</div>`;
}

function preorderButton(label = 'Preorder Your Kit'): string {
  return brandButton(label, PREORDER_URL);
}

// ── Founding-window copy variants ──
// Every conversion builder takes `founding` (default true). While the first
// 500 kits last, copy carries the founding offer ($249, founding standing).
// The moment the checkout's founding gate closes (the one-way
// founding_closed_at latch stamped by the founding_gate RPC, migration
// 20260717170000: the SAME latch create-checkout enforces; refunds can drop
// the net count back under 500 but never reopen the window), the drainer
// passes founding=false and the copy drops the word "founding" entirely: the
// price is simply $349.
// The two variants must never drift: post-founding copy may not mention
// $249, the 500, or founding standing anywhere, including subject and
// preheader (enforced by the render QA script).

// ── EMAIL 8 — Day 0 — launch blast (founder-approved copy, $249) ──
export function buildLaunchEmail8(firstName: string, founding = true): { subject: string; html: string } {
  const offer = founding
    ? `${goldDivider()}` +
      `${p(`Here is what founding looks like. The complete kit will sell for <strong>$349</strong>. The first 500 founding families preorder it for <strong>$249</strong>, and that founding standing stays with your family as every older grade band opens.`)}` +
      `${p(`When the 500 are claimed, the founding price is gone for good.`)}`
    : `${goldDivider()}` +
      `${p(`The complete kit is <strong>$349</strong>: a full year of curriculum, every component, one box on your doorstep. Preorder now and yours will be among the first to ship.`)}`;
  const body =
    `${preheader(founding
      ? `Founding families preorder Eden's Table for $249 before it becomes $349.`
      : `Eden's Table preorder is open. Bring the whole year home.`)}` +
    `${p(`Hi ${firstName},`)}` +
    `${p(`Some morning soon, your kitchen could smell like lavender while your six-year-old tells you what it does, and where God planted it first.`)}` +
    `${p(`That is the whole dream. And the doors are open: it is on the table.`)}` +
    `${p(`If you have homeschooled longer than a season, you know the ache. Science in one book, history in another, faith tacked on at the end, and you stitching it all together at ten o&rsquo;clock at night. Meanwhile the world keeps teaching our children that their bodies are machines and health comes from a bottle.`)}` +
    `${p(`Eden&rsquo;s Table was built to mend that. One herb each week becomes the doorway to every subject: the science of how it serves the body God designed, the history of the grandmothers and physicians who trusted it, the geography of where He planted it, all of it woven through Scripture at your own table. Thirty-six herbs. A full year of project-based learning your children do with their hands, not just their pencils.`)}` +
    `${p(`And you do not need to be an herbalist to teach it. The Teacher&rsquo;s Guide lays out your week day by day. You open it, and you teach.`)}` +
    `${p(`More than a thousand homeschool families have already pulled up a chair through the free preview weeks. Their kitchens, and their kids, are why we kept building.`)}` +
    offer +
    `${preorderButton()}` +
    `${signature()}`;
  return {
    subject: founding ? `The first 500 kits are on the table` : `The kits are on the table`,
    html: launchWrapper(body),
  };
}

// ── EMAIL 9 — Day 2 — inside the box ──
export function buildLaunchEmail9(firstName: string, founding = true): { subject: string; html: string } {
  const body =
    `${preheader(`A look inside the Sprouts kit, piece by piece.`)}` +
    `${p(`Hi ${firstName},`)}` +
    `${p(`Before you decide anything, I want you to see exactly what arrives at your door. So open the box with me.`)}` +
    `${bullet(`<strong>The Teacher&rsquo;s Guide</strong>: your entire year, laid out day by day. Monday you meet the herb in a story. By Friday your crew is chanting a rhyme they will keep for life.`)}` +
    `${bullet(`<strong>The Student Notebook</strong>: five gentle pages a week, sized for K-2 hands.`)}` +
    `${bullet(`<strong>Field Cards</strong>: the herb in hand. Taste, smell, where God planted it.`)}` +
    `${bullet(`<strong>Recipe Cards</strong>: Wednesday in the kitchen, making something real together.`)}` +
    `${bullet(`<strong>Around the Table Cards</strong>: dinner questions that need zero prep.`)}` +
    `${bullet(`<strong>The Read-Aloud Storybook</strong>: the Eden family, week after week, carrying it all.`)}` +
    `${spacer(8)}` +
    `${p(`Thirty-six herbs. Thirty-six weeks. Science, history, geography, language, and Scripture, all gathered around one living thing your child can hold. Solomon wrote, &ldquo;Train up a child in the way he should go, even when he is old he will not depart from it&rdquo; (Proverbs 22:6, NASB). That is what a year of this rhythm builds: a way, not just a workbook.`)}` +
    `${p(founding
      ? `Founding families bring the whole kit home for $249 while the first 500 last. Then it is $349.`
      : `The whole kit, the whole year, comes home for $349.`)}` +
    `${preorderButton()}` +
    `${signature()}`;
  return { subject: `Open the box with me`, html: launchWrapper(body) };
}

// ── EMAIL 10 — Day 4 — "I'm not an herbalist" objection ──
export function buildLaunchEmail10(firstName: string, founding = true): { subject: string; html: string } {
  const body =
    `${preheader(`The Teacher's Guide does the heavy lifting. You just open it.`)}` +
    `${p(`Hi ${firstName},`)}` +
    `${p(`The most common question I hear, by far: &ldquo;I love this, but I don&rsquo;t know anything about herbs. Can I really teach it?&rdquo;`)}` +
    `${p(`Sweet friend, yes. Eden&rsquo;s Table was written for the mama who has never dried a flower in her life.`)}` +
    `${p(`Every week of the Teacher&rsquo;s Guide is laid out day by day: what to read, what to ask, what to prepare (almost nothing), and exactly what to say when little voices ask why. You are not the expert at the table. You are the guide reading the map, and the map is very good. Most days take about half an hour.`)}` +
    `${p(`And here is the quiet gift nobody tells you about: you will learn it alongside them. By spring you will know 36 herbs, their stories, and their uses, not because you studied, but because you sat at the table with your kids.`)}` +
    `${p(`James wrote that if any of us lacks wisdom, we should &ldquo;ask of God, who gives to all generously and without reproach&rdquo; (James 1:5, NASB). He did not say ask the credentialed. Generously, to the asking mama, is how this knowledge has always been given.`)}` +
    `${p(founding
      ? `The first 500 kits are $249 founding. After that, $349.`
      : `The complete kit is $349, and it teaches you both.`)}` +
    `${preorderButton()}` +
    `${signature()}`;
  return { subject: `You don't have to be an herbalist`, html: launchWrapper(body) };
}

// ── EMAIL 11 — Day 7 — what you're really buying (founding-centric email,
// so the post-founding variant re-frames around joining the build itself) ──
export function buildLaunchEmail11(firstName: string, founding = true): { subject: string; html: string } {
  const opener = founding
    ? `${p(`I want to be honest about what the founding 500 are actually buying, because it is more than $100 off.`)}` +
      `${p(`Yes, the math is real: the kit will sell for $349, and founding families preorder it for $249. But the deeper thing is this. Eden&rsquo;s Table is a K-12 journey being built band by band, and the first 500 homes are not customers at the end of it. They are builders at the beginning of it. Your children&rsquo;s questions, your kitchen&rsquo;s discoveries, your feedback after week 9, all of it shapes Seedlings, Cultivators, and Practitioners before they reach anyone else&rsquo;s table.`)}`
    : `${p(`I want to be honest about what a $349 Sprouts kit is actually buying, because it is more than a box of beautiful materials.`)}` +
      `${p(`Eden&rsquo;s Table is a K-12 journey being built band by band, and the families walking it now are not customers at the end of something. They are builders at the beginning of it. Your children&rsquo;s questions, your kitchen&rsquo;s discoveries, your feedback after week 9, all of it shapes Seedlings, Cultivators, and Practitioners before they reach anyone else&rsquo;s table.`)}`;
  const nehemiah = founding
    ? `${p(`When Nehemiah stood before a wall in ruins, the people did not wait for it to be finished before they joined. &ldquo;Let us arise and build&rdquo; (Nehemiah 2:18, NASB), they said, and the ones who built first were named in the record forever. Founding standing works like that here: it stays with your family as every older band opens.`)}`
    : `${p(`When Nehemiah stood before a wall in ruins, the people did not wait for it to be finished before they joined. &ldquo;Let us arise and build&rdquo; (Nehemiah 2:18, NASB), they said. The families who join while the wall is rising get to leave their fingerprints on it, and this wall has eleven more grades to go.`)}`;
  const body =
    `${preheader(founding
      ? `Founding standing follows your family up every band.`
      : `One kit is year one of a K-12 journey your family helps shape.`)}` +
    `${p(`Hi ${firstName},`)}` +
    opener +
    nehemiah +
    `${p(`If you have been waiting for a sign that it is your moment to join, this is the week the wall is going up.`)}` +
    `${preorderButton(founding ? 'Claim a Founding Kit' : 'Preorder Your Kit')}` +
    `${signature()}`;
  return {
    subject: founding ? `What founding families are really buying` : `What one kit is really buying`,
    html: launchWrapper(body),
  };
}

// ── EMAIL 12 — Day 10 — founder story ──
export function buildLaunchEmail12(firstName: string, founding = true): { subject: string; html: string } {
  const body =
    `${preheader(`Why a mama built a curriculum around a kitchen table.`)}` +
    `${p(`Hi ${firstName},`)}` +
    `${p(`Can I tell you where this actually came from?`)}` +
    `${p(`Not a publishing house. A kitchen table, with real children around it, in a home that wanted health and faith to live in the same conversation. The Eden family in the storybooks, Vov&oacute; and PopPop, Levi and Ruthie, Manny, Evie, and Gracie, they are woven from our real family: real scraped knees, real garden rows, real prayers over little fevers in the night.`)}` +
    `${p(`I built Eden&rsquo;s Table because I could not find it. I wanted my children to know that the God who made their bodies also planted their healing in the ground, and I wanted them to learn it the way faith is actually passed down: &ldquo;telling to the generation to come the praises of the LORD, and His strength and His wondrous works&rdquo; (Psalm 78:4, NASB). Not a unit study. An inheritance.`)}` +
    `${p(founding
      ? `Every kit that reaches a founding family&rsquo;s table carries that intention with it. It would be an honor for it to reach yours.`
      : `Every kit that reaches a family&rsquo;s table carries that intention with it. It would be an honor for it to reach yours.`)}` +
    `${p(founding ? `Founding price is $249 while the first 500 last.` : `The complete kit is $349.`)}` +
    `${preorderButton()}` +
    `${signature()}`;
  return { subject: `The story under the table`, html: launchWrapper(body) };
}

// ── EMAIL 13 — Day 13 — ages objection ──
export function buildLaunchEmail13(firstName: string, founding = true): { subject: string; html: string } {
  const body =
    `${preheader(`K-2 hearts first. The ladder is coming for the rest.`)}` +
    `${p(`Hi ${firstName},`)}` +
    `${p(`&ldquo;My kids are 4 and 9. Is Sprouts even right for us?&rdquo; I get this one a lot, so let me answer it plainly.`)}` +
    `${p(`Sprouts is written for kindergarten through 2nd grade hearts. That said, families are already telling me their preschoolers sit for the stories and their older kids drift to the table for the kitchen days, because nobody walks past something simmering on the stove. The read-alouds, the recipes, and the dinner cards are genuinely whole-family; the notebook pages are where the K-2 targeting lives.`)}` +
    `${p(founding
      ? `And for your older ones, the ladder is coming. Seedlings (grades 3-5) is deep in production now, with Cultivators and Practitioners behind it. A family that starts at Sprouts grows up the path together, and founding standing follows you the whole way.`
      : `And for your older ones, the ladder is coming. Seedlings (grades 3-5) is deep in production now, with Cultivators and Practitioners behind it. A family that starts at Sprouts grows up the path together.`)}` +
    `${p(founding
      ? `&ldquo;There is an appointed time for everything,&rdquo; the Preacher wrote, &ldquo;and there is a time for every event under heaven&rdquo; (Ecclesiastes 3:1, NASB). A planting season only comes around once a year. For this curriculum, and this founding price, it is now.`
      : `&ldquo;There is an appointed time for everything,&rdquo; the Preacher wrote, &ldquo;and there is a time for every event under heaven&rdquo; (Ecclesiastes 3:1, NASB). A planting season only comes around once a year, and for a family starting this fall, it is now.`)}` +
    `${p(founding
      ? `Founding kits are $249 while the first 500 last, then $349.`
      : `The complete kit is $349.`)}` +
    `${preorderButton()}` +
    `${signature()}`;
  return { subject: `Is Sprouts right for your crew?`, html: launchWrapper(body) };
}

// ── EMAIL 14 — Day 16 — retention and method proof ──
export function buildLaunchEmail14(firstName: string, founding = true): { subject: string; html: string } {
  const body =
    `${preheader(`Chants, stories, and herbs their hands have held.`)}` +
    `${p(`Hi ${firstName},`)}` +
    `${p(`Here is a question worth asking of any curriculum: what will my child still carry in December? Not finish. Carry.`)}` +
    `${p(`Sprouts was engineered around how young children actually keep things. Stories, because facts fade and the Eden family does not. Chants, four little lines each Friday that lodge an herb&rsquo;s gift in a child&rsquo;s memory for good. And hands, because a child who has rolled lavender between her fingers and stirred the Wednesday recipe owns that knowledge in a way no worksheet can give her.`)}` +
    `${p(`Underneath it all runs the framework: the body as God&rsquo;s design, the Five Tenets of health, terrain instead of &ldquo;take this for that.&rdquo; By spring your child is not reciting trivia. They are seeing the world differently.`)}` +
    `${p(`&ldquo;By wisdom a house is built, and by understanding it is established; and by knowledge the rooms are filled with all precious and pleasant riches&rdquo; (Proverbs 24:3-4, NASB). That is the December picture: rooms quietly filling.`)}` +
    `${p(founding
      ? `Founding kits are $249 until the first 500 are claimed.`
      : `A year of rooms quietly filling is $349.`)}` +
    `${preorderButton()}` +
    `${signature()}`;
  return { subject: `What they'll still remember in December`, html: launchWrapper(body) };
}

// ── EMAIL 15 — Day 20 — FAQ ──
export function buildLaunchEmail15(firstName: string, founding = true): { subject: string; html: string } {
  const body =
    `${preheader(`How long each day takes, what you need, and when kits ship.`)}` +
    `${p(`Hi ${firstName},`)}` +
    `${p(`&ldquo;For which one of you, when he wants to build a tower, does not first sit down and calculate the cost?&rdquo; (Luke 14:28, NASB). Wise building starts with plain answers, so today, just the questions from my inbox.`)}` +
    `${p(`<strong>How long is a lesson?</strong> About half an hour most days. Monday and Wednesday run longer if the story or the recipe catches fire, and that is the good kind of longer.`)}` +
    `${p(`<strong>How much prep?</strong> Nearly none. Open the Teacher&rsquo;s Guide, follow the day. The kitchen day uses simple ingredients plus the week&rsquo;s herb.`)}` +
    `${p(`<strong>Do I need to buy herbs separately?</strong> Yes, and we make it easy: a family sourcing guide points you to trusted, affordable options for every week.`)}` +
    `${p(founding
      ? `<strong>When do kits arrive?</strong> We are aiming to ship in ${EMAIL_SHIP_TARGET}, and every kit is guaranteed to ship on or before ${EMAIL_SHIP_GUARANTEE}. Founding kits are the first off the press, and you will get shipping confirmation by email the moment yours moves.`
      : `<strong>When do kits arrive?</strong> We are aiming to ship in ${EMAIL_SHIP_TARGET}, and every kit is guaranteed to ship on or before ${EMAIL_SHIP_GUARANTEE}. You will get shipping confirmation by email the moment yours moves.`)}` +
    `${p(`<strong>What if it is not a fit?</strong> Write me. You will reach a real person at a real table, and I will make it right.`)}` +
    `${p(founding
      ? `Counted the cost and ready? The founding price is $249 while the first 500 last, then $349.`
      : `Counted the cost and ready? The complete kit is $349.`)}` +
    `${preorderButton()}` +
    `${signature()}`;
  return { subject: `Your questions, answered around the table`, html: launchWrapper(body) };
}

// ── EMAIL 16 — Day 24 — provision (+ honest scarcity while founding lasts;
// the post-founding variant is pure provision, no countdown) ──
export function buildLaunchEmail16(firstName: string, founding = true): { subject: string; html: string } {
  const closer = founding
    ? `${p(`The founding 500 kits are being claimed now, and I will not pretend otherwise: when they are gone, the $249 founding price goes with them, permanently. The kit will be worth every bit of $349. But I would love for your family to be inside the founding circle, not just because of the price, but because of what the founding families get to build with us.`)}`
    : `${p(`The kit is $349, and what it carries is the handoff itself: a year of provision placed back into your children&rsquo;s hands, one herb and one story at a time. I would love for it to be your table where the gap closes.`)}`;
  const body =
    `${preheader(founding
      ? `When the 500 are claimed, $249 is gone for good.`
      : `A gift that was always meant for your family's table.`)}` +
    `${p(`Hi ${firstName},`)}` +
    `${p(`On the very first page of Scripture, God looks at everything He planted and hands it to a family: &ldquo;Behold, I have given you every plant yielding seed that is on the surface of all the earth&rdquo; (Genesis 1:29, NASB).`)}` +
    `${p(`Given. Before medicine was an industry, provision was a gift, and the knowledge of it was passed from mother to child like a family heirloom. That handoff is what broke in the last hundred years. And that handoff is what your kitchen table can quietly repair this fall.`)}` +
    `${p(`Picture the first Monday of your school year. A story is read. A small dish of lavender goes around the table. Someone giggles. And a generation-long gap starts to close in your own home.`)}` +
    closer +
    `${preorderButton(founding ? 'Join the Founding 500' : 'Preorder Your Kit')}` +
    `${signature()}`;
  return {
    subject: founding ? `Before the founding 500 fill` : `A gift that was always on the table`,
    html: launchWrapper(body),
  };
}

// ── EMAIL 17 — Day 28 — decision email ──
export function buildLaunchEmail17(firstName: string, founding = true): { subject: string; html: string } {
  const body =
    `${preheader(founding
      ? `The founding window is closing. One last look at what's inside it.`
      : `One last look at everything the kit brings to your table.`)}` +
    `${p(`Hi ${firstName},`)}` +
    `${p(founding
      ? `This is my last note about the founding kits, I promise. Not because the story ends, but because you have everything you need to decide, and I respect your table too much to keep knocking.`
      : `This is my last note about the kits, I promise. Not because the story ends, but because you have everything you need to decide, and I respect your table too much to keep knocking.`)}` +
    `${p(founding
      ? `So, one last look at what is inside the founding window, while it is still open. The complete Sprouts kit: a year of Biblical herbalism that carries science, history, geography, and Scripture through 36 herbs your children will meet with their own hands. $249 as a founding family instead of $349, but only while the first 500 last. When they are claimed, the founding price is gone for good. And founding standing that follows your household up every band we build, Seedlings through Practitioners, stays with the 500 forever.`
      : `So, one last look at what is on the table. The complete Sprouts kit: a year of Biblical herbalism that carries science, history, geography, and Scripture through 36 herbs your children will meet with their own hands, for $349. Year one of a path that will carry your household up every band we build, Seedlings through Practitioners.`)}` +
    `${p(`When Joshua brought Israel to their own threshold, he did not push. He simply set the choice down in front of the households: &ldquo;choose for yourselves today whom you will serve... but as for me and my house, we will serve the LORD&rdquo; (Joshua 24:15, NASB). House by house. That is still how the important things are decided.`)}` +
    `${p(`Whatever you choose, it has been a joy to have you at this table for the last month. If Eden&rsquo;s Table belongs in your house this year, the door is right here.`)}` +
    `${preorderButton(founding ? 'Claim Your Founding Kit' : 'Preorder Your Kit')}` +
    `${signature()}`;
  return {
    subject: founding ? `As for your house, before the 500 fill` : `As for your house`,
    html: launchWrapper(body),
  };
}

// ── Dispatch table for the queue drainer ──
// 1-7: pre-launch vision arc (fixed dates / signup drip).
// 8-17: preorder conversion series (launch-day blast; purchase-suppressed).
// 18:   one-off Email 7 make-good resend (2026-07-25 dead-link incident). It is
//       NOT part of the drip: the signup trigger enqueues 1-17 only, and
//       position 18 rows exist solely for the 1,382 who received the broken E7.
export const LAUNCH_SEQUENCE_LENGTH = 7;
export const CONVERSION_FIRST_POSITION = 8;
export const EMAIL_7_RESEND_POSITION = 18;

const LAUNCH_BUILDERS: Record<number, (firstName: string, founding?: boolean) => { subject: string; html: string }> = {
  1: buildLaunchEmail1,
  2: buildLaunchEmail2,
  3: buildLaunchEmail3,
  4: buildLaunchEmail4,
  5: buildLaunchEmail5,
  6: buildLaunchEmail6,
  // 7 is deliberately absent: buildLaunchEmail7 needs a per-recipient signed
  // founders URL, not `founding`, so buildLaunchEmail() dispatches it directly.
  8: buildLaunchEmail8,
  9: buildLaunchEmail9,
  10: buildLaunchEmail10,
  11: buildLaunchEmail11,
  12: buildLaunchEmail12,
  13: buildLaunchEmail13,
  14: buildLaunchEmail14,
  15: buildLaunchEmail15,
  16: buildLaunchEmail16,
  17: buildLaunchEmail17,
};

// `founding` only affects positions 8-17 (the 1-7 builders ignore it).
// `foundersUrl` is REQUIRED for positions 7 and 18 and must come from
// foundersFormUrl() in _shared/founders-link.ts; every other position ignores it.
// `variant` only affects position 18 (the subject-line split test); pass it from
// variantForEmail(recipientEmail) so the arm is stable across retries.
export function buildLaunchEmail(
  position: number,
  firstName: string,
  founding = true,
  foundersUrl?: string,
  variant: ResendSubjectVariant = 'a',
): { subject: string; html: string } | null {
  if (position === 7) return buildLaunchEmail7(firstName, foundersUrl ?? '');
  if (position === EMAIL_7_RESEND_POSITION) {
    return buildLaunchEmail7Resend(firstName, foundersUrl ?? '', variant);
  }
  const builder = LAUNCH_BUILDERS[position];
  return builder ? builder(firstName, founding) : null;
}
