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
// Revised 2026-08-26. Mirrors _shared/order-config.ts; this file keeps its own copy.
const EMAIL_SHIP_TARGET = 'July 31, 2027';
const EMAIL_SHIP_GUARANTEE = 'September 30, 2027';
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

// A customer testimonial card. Same panel as verseCard so the two read as one
// system, but the attribution line carries a name and who the person is rather
// than a Scripture reference.
//
// EVERY quote passed to this helper must be a real, attributed thing a real
// family actually wrote, copied verbatim from web/pages/homeschool.astro where
// it is already published. Trimming to a shorter span is fine; rewording,
// merging two people, or inventing an attribution is not.
function quoteCard(quote: string, attribution: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;">
<tr><td style="background-color:${BRAND.bgOuter};padding:18px 22px;border-left:3px solid ${BRAND.gold};">
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.65;color:${BRAND.forest};margin:0 0 8px 0;font-style:italic;">&ldquo;${quote}&rdquo;</p>
<p style="font-family:Georgia,serif;font-size:13px;color:${BRAND.footerText};margin:0;">${attribution}</p>
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
  // Two SEPARATE claims, and they must stay separate (founder decision
  // 2026-07-25, mirrored in PreorderBuyBox.tsx): Founding Family status is the
  // first 50 PAID orders, the founding PRICE runs to 500 kits. Rank is not known
  // until payment clears, so this may never tell a reader they ARE one of the
  // fifty.
  //
  // ⚠️ It also must not say the CONFIRMATION email will tell them. That email is
  // one fixed template (buildPreorderConfirmationEmail) with no Founding Family
  // logic in it, so as of 2026-07-28 that promise had nothing behind it and the
  // first buyers would have waited for a message that never came. Reworded to a
  // promise the founder can keep by hand: sort orders by created_at, take the
  // first 50. If confirmation-time detection is built later, this line can name
  // the confirmation email again.
  const offer = founding
    ? `${goldDivider()}` +
      `${p(`<strong>The first 50 families to order</strong> become our Founding Families: the private group, a seat at Coffee and Curriculum, and a vote on what we build next. That standing stays with your family as every later grade band opens. If you are one of the fifty, I will tell you.`)}` +
      `${p(`<strong>The first 500 kits</strong> are <strong>$249</strong> instead of <strong>$349</strong>. That is $100 off. When the 500 are claimed, the founding price is gone for good.`)}`
    : `${goldDivider()}` +
      `${p(`The complete kit is <strong>$349</strong>: a full year of curriculum, every component, one box on your doorstep.`)}`;
  const body =
    `${preheader(founding
      ? `$249 for the first 500 kits. Limited print run, first come, first served.`
      : `Limited print run, first come, first served.`)}` +
    `${heading(`Preorders are open!!`)}` +
    `${p(`Hi ${firstName},`)}` +
    `${p(`Preorders for Eden&rsquo;s Table Sprouts are open right now.`)}` +
    `${p(`This is a limited print run. Kits ship in the order they are paid for, first come, first served.`)}` +
    offer +
    `${goldDivider()}` +
    `${p(`Six components, 36 weeks, 180 daily lessons. Kits ship ${EMAIL_SHIP_TARGET}.`)}` +
    `${preorderButton(`Preorder Now`)}` +
    `${signature()}`;
  return {
    subject: `Preorders are open!!`,
    html: launchWrapper(body),
  };
}

// ── EMAIL 9 — Day 2 — inside the box, then the case for buying now ──
// Conversion rebuild 2026-07-28 (founder direction: "push the sale"). The box
// walkthrough stays, because knowing what arrives is what makes the price
// legible, and three things are added behind it:
//   1. the one-purchase-instead-of-six argument, lifted from the /homeschool
//      objections section so the site and the emails make the SAME case
//   2. two real testimonials, verbatim from that page
//   3. the fact that both families taught it before anything was printed, which
//      is the honest answer to "why would I pay months ahead"
// No research or statistics: none exist on the site, and none will be invented.
export function buildLaunchEmail9(firstName: string, founding = true): { subject: string; html: string } {
  const body =
    `${preheader(`Six components, 180 lessons, and what it replaces.`)}` +
    `${p(`Hi ${firstName},`)}` +
    `${p(`Before you decide anything, I want you to see exactly what arrives at your door. So open the box with me.`)}` +
    `${bullet(`<strong>The Teacher&rsquo;s Guide</strong>: your entire year, laid out day by day. Monday you meet the herb in a story. By Friday your crew is chanting a rhyme they will keep for life.`)}` +
    `${bullet(`<strong>The Student Notebook</strong>: five gentle pages a week, sized for K-2 hands.`)}` +
    `${bullet(`<strong>Field Cards</strong>: the herb in hand. Taste, smell, where God planted it.`)}` +
    `${bullet(`<strong>Recipe Cards</strong>: Wednesday in the kitchen, making something real together.`)}` +
    `${bullet(`<strong>Around the Table Cards</strong>: dinner questions that need zero prep.`)}` +
    `${bullet(`<strong>The Read-Aloud Storybook</strong>: the Eden family, week after week, carrying it all.`)}` +
    `${spacer(8)}` +
    `${p(`Thirty-six weeks. 180 daily lessons. Six components built together, week by week, as one year rather than six things you have to make agree with each other.`)}` +
    `${goldDivider()}` +
    `${heading(`One purchase instead of six`)}` +
    `${p(`A typical year assembled from separate curricula means a science program, a nature study, a Bible curriculum, a copywork book, an art component, and a read-aloud list. Six purchases, six teacher&rsquo;s guides written by six people who never spoke to each other, and a stack of evenings spent making them line up.`)}` +
    `${p(`Eden&rsquo;s Table is one box. Bible, science, language arts, math, art, history, geography, Latin, health, and character are already woven in, already scheduled, already telling you which day carries which.`)}` +
    `${p(founding
      ? `At the founding price that is <strong>$249 for the year</strong>. Across 36 weeks, under $7 a week for your entire core. One decision, made once, instead of six decisions you are still second-guessing later.`
      : `That is <strong>$349 for the year</strong>. Across 36 weeks, under $10 a week for your entire core. One decision, made once, instead of six you are still second-guessing later.`)}` +
    `${p(`What you are not also buying: a separate science curriculum. A separate nature study. A separate Bible curriculum. A separate art plan. A separate read-aloud list. A second evening of your week spent making all of them agree with each other.`)}` +
    `${goldDivider()}` +
    `${heading(`They taught it before anyone printed a thing`)}` +
    `${p(`I know what it is to be asked for money months before a box arrives. So I would rather you hear from families who already sat down and taught this at their own tables, using the free weeks. Nobody below is reviewing a box. They are telling you what happened in their kitchen.`)}` +
    `${quoteCard(`This curriculum is truly amazing! I have numerous herbal books from all sorts of authors, and this curriculum truly puts it into bite-size chunks of information while still incorporating incredible vocabulary, concepts, and quality stories. The fact that you are incorporating all these other topics beyond just herbal information is truly incredible as well.`, `Kendria Scriver, curriculum writer`)}` +
    `${quoteCard(`Ahhhhhh I just spent the last few hours poring over the free sample you sent us. This curriculum is absolutely fantastic. I cannot wait to buy this in the fall. This will be our kids favourite curriculum to explore.`, `Coralee, who read the free sample cover to cover`)}` +
    `${p(`Solomon wrote, &ldquo;Train up a child in the way he should go, even when he is old he will not depart from it&rdquo; (Proverbs 22:6, NASB). That is what a year of this rhythm builds: a way, not just a workbook.`)}` +
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
    `${p(`And here is the quiet gift nobody tells you about: you will learn it alongside them. By the end of the year you will know 36 herbs, their stories, and their uses, not because you studied, but because you sat at the table with your kids.`)}` +
    `${p(`Teaching this way is also not a hunch. Researchers tried it with second graders, the very ages Sprouts is written for. They split the classrooms by chance so nobody could stack the deck, taught one group through hands-on projects and the other the usual way, and then measured what the children actually knew a year later. The project children came out about <strong>five to six months ahead in social studies and two months ahead in reading</strong>.`)}` +
    `${p(`Eden&rsquo;s Table was not one of the curricula in that study, and I will not pretend otherwise. What they were testing is the way it teaches: one real thing in the middle of the week, and every subject gathered around it.`)}` +
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
    `${p(`If you are wondering whether this way of learning holds up for the older ones too: a study of more than 2,300 third graders across 46 schools found the ones learning science through hands-on projects scored about <strong>8 points higher</strong> on their science test than classmates taught the usual way. The federal office that reviews education research gave that study its highest rating. Once again, not our curriculum. The method our curriculum is built on.`)}` +
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
    `${p(`There is a reason the week ends with a chant instead of a worksheet. Memory researchers keep landing on the same finding: when a child pulls something back out of her own head, it sticks. Far better than reading it one more time. And it sticks best when the remembering is spread across days rather than crammed into one. That is what Monday&rsquo;s story, Wednesday&rsquo;s kitchen, and Friday&rsquo;s four little lines are quietly doing all week.`)}` +
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

// ── EMAIL 19 — Mon Aug 31 2026 — "You are not an herbalist": the podcast
// answer, and the $39 Starter Unit ──
// First of three. It ships four days after the 2026-08-27 list announcement so
// the delay email is no longer the top unread message, and it does NOT repeat
// that email: these readers already know the print run moved to July 2027, and
// they already know why. The move is touched exactly once, obliquely ("what
// moved last week was paper"), with no reason and no second apology, and it is
// never mentioned again in emails two and three.
//
// WHAT IT DOES. On 2026-08-20 Camila recorded with Felice Gerwitz of Media
// Angels. She went in braced for the question she most expects to be asked:
// is this safe, and what business does a woman who is not a practicing
// herbalist have handing plants to a six year old. The email answers it in
// full, at more length than air time allows. The credential reframe is the
// load-bearing beat: no, she is not an herbalist, she is a credentialed
// teacher who arrived at plants backwards, through a curriculum problem.
//
// ⚠️ CORRECTION 2026-08-27, do not reintroduce. An earlier version of this
// draft opened on Camila asking Felice Gerwitz, before recording, to put the
// hardest question to her. CAMILA HAS CONFIRMED THAT NEVER HAPPENED. It was
// invented by a previous drafter and it put words and an arrangement onto a
// real, named person. The opening now rests on her own nerves and her own
// preparation, which are hers to describe. Never rebuild the email on an
// interaction with a host that was not verified with Camila first.
//
// FOUNDER FACTS CONFIRMED BY CAMILA AND SAFE TO STATE: the M.Ed.; that she is
// Brazilian; that she did undertake formal herbalism training and found the
// spirituality either absent or resolved into Far Eastern metaphysics, which
// is the origin of the worldview rule. All three stay.
//
// WHAT IS DELIBERATELY NOT HERE.
//   · Any episode link, air date, episode number, listener count, or estimate
//     of when anything publishes. As of the send date NOTHING has aired.
//     Recorded so far: Southern Appalachian Herbs (Judson, 07-16), Media
//     Angels (Felice Gerwitz, 08-20), Home(school) with Steph (Stephany,
//     08-20), Hearty Homemaker (Brianne, 08-24). Still upcoming at send:
//     Planted on Purpose (Aurie Riley, 08-28), Minimalist Moms (Diane Boden,
//     09-10), Nature Cure Family Health (Dr Lauren Deville, 09-18), The
//     Homeschool How To (Cheryl, 2027-01-06). The email may promise links when
//     they air, and does. It may not imply anything is listenable yet, and it
//     carries NO COUNT of recordings, because Aurie Riley records 08-28, three
//     days before this sends, and any number written today goes stale.
//   · The Ultimate Homeschool Podcast Network, and any show of Camila's own.
//     Not settled. Not mentioned.
//   · Any words attributed to Felice Gerwitz. No transcript has been read. The
//     question in the third paragraph is carried explicitly as the question
//     CAMILA EXPECTS, in her own words, never as something a host said.
//   · The Southern Appalachian Herbs paragraph (Judson, 07-16). Cut rather
//     than written: no verified detail of what he pressed her on is in hand,
//     and a real man does not get an invented quote.
//   · Week 6 hands-on work. The exhibit stops at find it, name it, draw it
//     labeled, because nobody has read the live Teacher's Guide this week.
//   · Any per-week Safety note as evidence. Those live on the RECIPE CARD
//     deck, and the $39 Starter Unit contains ONLY the Teacher's Guide, the
//     Student Notebook and the Read-Aloud. The safety argument is grounded
//     instead in the ten same-day preparation families, in the absence of any
//     published pediatric dosing formula, and in the Teacher's Guide, which
//     the buyer does receive.
//   · "No garden." FALSE and deleted. Friday is Garden & Review every week,
//     Unit 1 (weeks 1-6) is titled "In the Garden God Made", and Week 5 Friday
//     plants calendula seeds. Do not reintroduce a softer version of it.
//   · "The one way we use it." FALSE. Weeks 3, 4, 5 and 6 are each two-prep,
//     so four of the six Starter Unit weeks use more than one preparation.
//     The copy says "how we use it".
//   · The word Wednesday. The announcement went out Thursday 2026-08-27 and
//     this sends the following Monday, so the copy says last week.
//   · Any founding-500 benefit or perk. PRICE ONLY. No manufacturer, freight,
//     customs or printer name; no funding or investment talk.
//   · The words terrain, tissue state and constitution. Not taught in the
//     first six weeks, so the email cannot promise them.
//
// AVAILABLE BUT NOT USED: Kati's testimonial (emailed 2026-06-29 about week 1,
// written permission 2026-07-12). It is about engagement, not credibility or
// safety, so it does not serve this email's argument. It belongs in email two
// or three. If it is ever used here, quote it verbatim and attribute it as
// "Kati, whose children did week 1 in June". June, not July.
//
// SCRIPTURE. Genesis 1:29, which Email 16 also anchors on. Reused on purpose:
// it is the verse the "given" argument is built from, and the two sends are far
// apart. The quoted span is copied verbatim from Email 16 rather than retyped,
// so the NASB wording stays verified. It gets the verseCard rather than an
// inline quote because the email lingers on the one word given.
//
// CTA. One button, to the Starter Unit at /starter, NOT preorderButton(): the
// ask in all three emails is the $39 digital six weeks, not the printed kit.
// Same label and same URL in all three. If a second builder needs it, promote
// the literal to a STARTER_URL const beside PREORDER_URL. No PS, no second
// link, no countdown, no scarcity.
//
// `founding` touches ONE sentence, the last line of the price paragraph. The
// post-founding variant states $349 and says nothing about $249, the 500 or
// founding standing, in body, subject or preheader. Note that the KIT price
// does move, $249 to $349, so no "the price does not move" line may appear
// anywhere near it; any such reassurance is scoped to the $39 explicitly.
//
// WIRING. 🔴 Add `19: buildLaunchEmail19` to LAUNCH_BUILDERS. Exporting the
// function is NOT enough: buildLaunchEmail() dispatches through that map and
// returns null for an unregistered position, so an exported-but-unregistered
// builder fails silently at send time. PRE-SEND: run the render QA script
// (zero em dashes, en dash and middot only) and suppress the five refund-bound
// preorder buyers.
export function buildLaunchEmail19(firstName: string, founding = true): { subject: string; html: string } {
  const body =
    `${preheader(`The question I am always ready for. Here is the whole answer.`)}` +
    `${p(`Hi ${firstName},`)}` +
    `${p(`On August 20 I recorded with Felice Gerwitz of Media Angels. There is one question I am always ready for, and no interview is ever long enough to answer it properly.`)}` +
    `${p(`It is the question I expect from every careful mother who finds us, and I would rather answer it here, in full, than hope nobody asks it: what business does a woman who is not a practicing herbalist have handing plants to a six year old, and is it safe?`)}` +
    `${p(`Here is the whole answer. Eden&rsquo;s Table is not a remedy guide. There are no protocols in it, and there is no best-herb-for-anxiety list, because those already exist in abundance and I think they are part of the problem.`)}` +
    `${p(`And no, I am not an herbalist. I am a teacher. I hold an M.Ed., I know how to build a scope and sequence, and I came to the plants backwards: this was a curriculum problem before it was ever a plant problem.`)}` +
    `${p(`When I enrolled in formal herbalism training, the spirituality was either absent or it resolved into Far Eastern metaphysics. I did not want to throw out the plants along with the framework, because the observations were sound and the attribution was not. So the rule for all thirty-six weeks became: keep every observation, discard the spiritual attribution. No cosmic energy, no meridian metaphysics, no borrowed mysticism.`)}` +
    `${p(`Most herb material written for families is a table: symptom on the left, plant on the right. A child who memorizes that has learned a list, not a plant. Weeks 1 through 6 teach one plant known five ways: what it is, how to tell it from the thing growing beside it, which part is used, how we use it, and where the line is.`)}` +
    `${p(`And the safety answer is in the design rather than in a disclaimer. There are ten families of preparation in the whole year and every one of them is same day: tea, decoction, cold infusion, poultice, compress, syrup, honey infusion, honegar, culinary work, and the fresh leaf itself. No tinctures, no infused oils, no salves, nothing curing on a shelf for six weeks. And there is no dosing formula published anywhere in thirty-six weeks, because dosing a child is not what this is. The Teacher&rsquo;s Guide is one of the three things in the $39, and it is where those boundaries live.`)}` +
    `${p(`So the honest description of the work is botany, plant identification, nature study, kitchen work and stewardship. A mother teaching her child to name a plant, draw it and cook with it is not practicing medicine. She is doing what mothers did for most of history.`)}` +
    `${p(`What moved last week was paper. The curriculum itself is finished, thirty-six weeks, one plant a week.`)}` +
    `${p(`Week 6 is plantain, <em>Plantago major</em>. It is likely growing in your yard right now, in the patch you have been pulling it out of for years without knowing its name. Your child finds it, names it, and draws it labeled.`)}` +
    `${verseCard(`Behold, I have given you every plant yielding seed that is on the surface of all the earth`, `Genesis 1:29`)}` +
    `${p(`Given. That one word does all the theological work, and it is why the week opens in Scripture rather than in a remedy.`)}` +
    `${p(`I have been recording these conversations all summer and not one of them has aired yet. When each one does, the link comes to this list the same day. You are hearing the answers before the audience does, which is the right order after what I asked of you last week.`)}` +
    `${goldDivider()}` +
    `${p(founding
      ? `Weeks 1 through 6 are $39, digital, instant download: the Teacher&rsquo;s Guide, the Student Notebook and the Read-Aloud storybook for those six weeks. The full $39 comes off the printed kit if you buy it later. The printed Sprouts Complete Kit is $249 for the founding 500 families and $349 after that.`
      : `Weeks 1 through 6 are $39, digital, instant download: the Teacher&rsquo;s Guide, the Student Notebook and the Read-Aloud storybook for those six weeks. The full $39 comes off the printed kit if you buy it later. The printed Sprouts Complete Kit is $349.`)}` +
    `${brandButton('Start with Weeks 1 through 6', 'https://edeninstitute.health/starter')}` +
    `${signature()}`;
  return { subject: `"You are not an herbalist"`, html: launchWrapper(body) };
}

// ── EMAIL 20 — Post-announcement arc, #2 — the multi-age objection ──
//
// Answers the one question that lands in the inbox most weeks: "aren't my kids
// too old (or too young) for a K-2 curriculum?" It does not recap the 8/27
// announcement and does not re-argue the print delay; those readers already
// know the kit moved to July 2027. The whole email earns the $39 Starter Unit
// by showing the mechanism, not by adding urgency. No new offer, no scarcity.
//
// SEND: Friday 2026-09-04 by default. Camila may move it to Tuesday 2026-09-01
// so it also serves the first-of-the-month update she promises on /preorder.
// Either date is now safe. The podcast paragraph carries EXPLICIT DATES instead
// of "next week / the week after", so nothing in it breaks if the send slips.
//
// ⚠️ CORRECTION 2026-08-27, do not reintroduce, three of them.
//   1. THE TESTIMONIAL WAS INVENTED. The previous draft said "A mother wrote in
//      July to say it was the week that stayed with her children." No such note
//      exists, and the month was wrong on top of it. It is replaced below with
//      Kati's actual words, emailed 2026-06-29 about WEEK 1, copied verbatim,
//      in quoteCard. Written permission, Kati, 2026-07-12: "Yes I'm happy for
//      you to use my comments, they are genuine!" The month is JUNE. Do not
//      paraphrase this quote into different words, do not trim it into a
//      different sentence, and do not add a second testimonial beside it.
//      There is exactly one real testimonial and this is it.
//   2. THE SCHEDULE WAS WRONG. The previous draft called Minimalist Moms with
//      Diane Boden "next week". It records 2026-09-10, two weeks out from
//      drafting. Both remaining shows now carry their real dates.
//   3. THE OPENING WAS UNVERIFIED. It attributed the multi-age question to a
//      host asking it on air in August. Nothing in hand verifies that, and the
//      related "I asked Felice Gerwitz, before recording, to put the hardest
//      question to me" framing that reached email 19 was invented outright and
//      has been confirmed by Camila as something that never happened. The
//      question is now sourced where it is actually true: her inbox.
//
// VERIFIED, with sources, because several of these have been written wrong before:
//   · No overlap between bands. Edens_Table_Product_Copy.md:54, verbatim: "Each
//     band covers a different thirty-six plants, so a family that works through
//     both ends with seventy-two named and usable species." Confirmed again in
//     the week-1 guide itself: Sprouts W1 is Lavender, Seedlings W1 is
//     Elderberry (Elevated_Teacher_Guide_W1.md:10 and :68). The sentence "both
//     bands cover all 72 herbs" is FALSE and must never reach a draft. This
//     argument and the sensory-observation argument below are both
//     founder-sourced and verified; neither may be cut for length.
//   · Support / Stretch rails run per day through week 1
//     (Elevated_Teacher_Guide_W1.md:23, :31, :39, :47, :59), and the "younger
//     sprouts" down-curation is Camila's own wording to Caroline on 2026-08-17
//     (Partner Program/influencer_outreach_templates.md:19).
//   · The week shape in the integration paragraph is the real one: Mon
//     read-aloud, Tue discovery, Wed kitchen lab, Thu history and art, Fri
//     GARDEN and review (Elevated_Teacher_Guide_W1.md:15-51). Friday is
//     "Garden & Review" in EVERY week, Unit 1 (weeks 1-6) is titled "In the
//     Garden God Made", and week 5 Friday plants calendula seeds. Any draft
//     that says or implies "no garden" is FALSE. This revision names the Friday
//     garden out loud so that false claim cannot creep back in here.
//   · Week 1 is Lavender. Week 4 is Peppermint, week 6 is Plantain
//     (Plantago major). Thirty-six weeks, one plant a week.
//
// NOTE for the reviewer on quoteCard: its own doc comment says every quote must
// be copied from web/pages/homeschool.astro, where the published testimonials
// live. Kati is not on that page yet. The quote here is still verbatim and
// still permissioned, so quoteCard is the right helper, but either publish Kati
// to homeschool.astro before send or widen that comment. Do NOT resolve it by
// swapping in a different quote.
//
// PODCASTS: no episode has aired anywhere yet, so this email links to nothing,
// never says "listen", never estimates when anything will air, and promises
// links on publish instead. Only shows with a RECORDED date are described as
// done: Home(school) with Steph (Stephany, 2026-08-20) and the Hearty
// Homemaker (Brianne, 2026-08-24). Planted on Purpose with Aurie Riley records
// 2026-08-28, which is after this was drafted and before this sends, so its
// status at send time is unknown and it is deliberately NOT in the copy; see
// gate 3. Media Angels / Felice Gerwitz is not named here because email 19
// carries that thread. The Ultimate Homeschool Podcast Network and any show of
// Camila's own are unsettled and are not mentioned. Do not add an episode
// number, an air date, or a download figure.
//
// FOUNDER GATES, open at time of writing:
//   1. The shipped Starter Unit PDFs have outlined fonts and no text layer, so
//      the Support/Stretch and younger-sprouts rails are verified in the week-1
//      guide but NOT page-confirmed across weeks 1-6. Weeks 1-6 is the product
//      being sold here, not the full kit. Confirm before send.
//   2. If Camila confirms a real on-air moment where a host put the multi-age
//      question to her, the opening can name it. Until then it stays the inbox.
//   3. If the 2026-08-28 Planted on Purpose recording happens as booked, Camila
//      may add "and Aurie Riley on Planted on Purpose" to the recorded-shows
//      sentence before send. Add it only after it has actually recorded.
//
// The 224-page Student Notebook figure is deliberately absent: that is the full
// 36-week notebook, not the six weeks being sold here. No salve, balm, wash,
// tincture, infused oil or dosing guidance is claimed anywhere: the curriculum
// teaches ten same-day preparation families and publishes no pediatric dosing
// formula. No per-week Safety note is cited as evidence either, because those
// live on the RECIPE CARD deck and the $39 Starter Unit contains only the
// Teacher's Guide, the Student Notebook and the Read-Aloud.
//
// The price paragraph is meant to be word for word identical across emails 19,
// 20 and 21. Diff it before merge; do not improve it here in isolation. As of
// this revision it is NOT identical: email 19 states both kit prices in one
// sentence and omits the ship dates, while this one splits them and carries
// EMAIL_SHIP_TARGET / EMAIL_SHIP_GUARANTEE. Reconcile all three in one pass.
// `founding` touches the printed-kit line only. Note that the KIT price DOES
// move, $249 to $349, so no "the price does not move" reassurance may appear
// near it; any such line is scoped to the $39 explicitly. Founding-500 PRICE
// only, never the perk. No manufacturer, freight, customs or printer name, and
// no funding or investment talk. The CTA points at /starter, not PREORDER_URL,
// so it calls brandButton directly rather than preorderButton().
//
// WIRING. 🔴 Add `20: buildLaunchEmail20` to LAUNCH_BUILDERS. Exporting the
// function is NOT enough: buildLaunchEmail() dispatches through that map and
// returns null for an unregistered position, so an exported-but-unregistered
// builder fails silently at send time. PRE-SEND: run the render QA script
// (zero em dashes, en dash and middot only) and suppress the five refund-bound
// preorder buyers.
export function buildLaunchEmail20(firstName: string, founding = true): { subject: string; html: string } {
  const body =
    `${preheader(`Sprouts and Seedlings share no plants. Starting here repeats nothing.`)}` +
    `${p(`Hi ${firstName},`)}` +
    `${p(`The question that reaches my inbox most weeks is this one: what does a week look like when you have a four year old and a nine year old at the same table?`)}` +
    `${p(`One plant. One week. One kitchen table, at three depths. A younger sprouts section curates the week down so a four year old can take part, and stretch notes take it up for an older child. Nobody is sent off to do something separate.`)}` +
    `${p(`Sprouts and Seedlings do not share a single plant. Each band covers a different thirty-six, so a family that does both ends with seventy-two named species, and a child who starts here repeats nothing when she moves up.`)}` +
    `${p(`Sprouts does not teach a list of plants. It teaches how to look at one: form first, then touch, then smell, then taste, with the science coming out of what she just sensed rather than announced to her first. A nine year old who can name a plant but cannot tell you its smell, the edge of its leaf, or the ground it chooses has not outgrown week one. She skipped it, and there is no higher.`)}` +
    `${p(`Here is my test. If you removed the plant, the whole week would collapse: the read-aloud and its vocabulary, the kitchen lab, how families used this plant before there were pharmacies, a drawing she labels herself, Friday in the garden, and the patience a growing thing requires. Integrated, not decorated.`)}` +
    `${p(`Week 1 is lavender. Kati wrote to me in June, while her children were in the middle of it:`)}` +
    `${quoteCard(`I just wanted you to see how in to it they are! No complaining and actually asking to do their &lsquo;learning&rsquo;!! Yahoo`, `Kati, whose children did week 1 in June`)}` +
    `${p(`It is digital, so an older child can move at her own speed, and the Read-Aloud storybook keeps a nine year old and a five year old at the same table without one bored and the other lost.`)}` +
    `${p(`Stephany had me on Home(school) with Steph in August, and Brianne on the Hearty Homemaker a few days later. Both are homeschooling mothers with mixed-age tables of their own.`)}` +
    `${p(`Minimalist Moms with Diane Boden records on September 10, and Nature Cure Family Health with Dr Lauren Deville on September 18. Nothing has aired yet. Every link comes to you the day it publishes.`)}` +
    `${verseCard(`O taste and see that the LORD is good; How blessed is the man who takes refuge in Him!`, `Psalm 34:8`)}` +
    `${p(`Teaching a child to taste and see before she is taught to conclude is not a method I invented. It is older than I am, and the goodness is the Giver&rsquo;s.`)}` +
    `${goldDivider()}` +
    `${p(`The Sprouts Starter Unit is <strong>$39</strong>, digital, instant download: weeks 1 through 6, with the Teacher&rsquo;s Guide, the Student Notebook and the Read-Aloud storybook. The full $39 comes off the printed kit if you buy it later.`)}` +
    `${p(founding
      ? `The printed kit is <strong>$249</strong> while the first 500 last, then $349. Kits ship ${EMAIL_SHIP_TARGET}, guaranteed on or before ${EMAIL_SHIP_GUARANTEE}.`
      : `The printed kit is <strong>$349</strong>. Kits ship ${EMAIL_SHIP_TARGET}, guaranteed on or before ${EMAIL_SHIP_GUARANTEE}.`)}` +
    `${brandButton('Start with Weeks 1 through 6', 'https://edeninstitute.health/starter')}` +
    `${signature()}`;
  return { subject: `Aren't my kids too old for this?`, html: launchWrapper(body) };
}

// -- EMAIL 21, the safety question, answered here before a host asks it --
//
// Third and last of the post-delay Starter Unit notes (19, 20, 21). The reader
// already knows the print run moved to July 2027: that was the 2026-08-27
// announcement, and this sequence builds on it rather than restating it.
//
// The hook is the one piece of leverage this email has that 19 and 20 did not:
// the question has NOT been asked yet. Camila records with Dr Lauren Deville of
// Nature Cure Family Health on 2026-09-18, and she answers the safety question
// here first, in writing, for the list that gave her its patience. That is the
// repayment for 8/27, and it is why this must send BEFORE 2026-09-18 while the
// hook is still unspent.
//
// REGISTRATION: this builder MUST be added to the LAUNCH_BUILDERS map as
// `21: buildLaunchEmail21,`. An earlier draft of this email was exported but
// never registered, and buildLaunchEmail(21, ...) would have returned null,
// which the caller treats as "no such position" and skips silently. Exporting
// is not shipping.
//
// SEND-MORNING GATES, before this is queued:
//   1. PODCAST STATE. As of 2026-08-27 the recorded set is exactly four:
//      Southern Appalachian Herbs (7/16), Media Angels (8/20), Home(school)
//      with Steph (8/20), Hearty Homemaker (8/24). Planted on Purpose with
//      Aurie Riley records 2026-08-28 and is NOT yet recorded, so it sits in
//      the booked line below. If it has happened by send morning, move it up
//      into the recorded sentence. Minimalist Moms with Diane Boden is
//      2026-09-10, NOT "tomorrow"; The Homeschool How To with Cheryl is
//      2027-01-06.
//   2. Suppress the five preorder-hold buyers.
//   3. FOUNDER VERIFY the safety paragraph against the live Teacher's Guide.
//      The ten same-day preparation families and the absence claims are read
//      off Eden_Table_Sprouts_Content_Manual_v1_4.md and are safe.
//   4. Confirm the Read-Aloud title. Story 2 sits at week 4, peppermint, and
//      the title carries an accented o: it renders here as
//      Vov&oacute;&rsquo;s Lineage and must never ship without the accent.
//
// CORRECTIONS APPLIED to the prior draft, each one a factual error:
//   - "No garden." DELETED. It is false for exactly the six weeks being sold.
//     Friday is "Garden & Review" every week, Unit 1 (weeks 1 to 6) is titled
//     "In the Garden God Made", and week 5 Friday plants calendula seeds. The
//     line is replaced by the TRUE garden facts, not by a softer false version.
//   - "the one way we use it" -> "how we use it". Weeks 3, 4, 5 and 6 are each
//     two-prep, so four of the six weeks on offer use more than one.
//   - The safety argument no longer leans on per-week Safety notes. Those live
//     on the Recipe Card deck, which the $39 Starter Unit does NOT contain. It
//     is grounded in the Teacher's Guide and the ten same-day preparations.
//   - "No equipment" CUT and "most weeks use a plant you can buy dried" CUT.
//     Both were unquantified claims across all 36 weeks and neither is verified
//     for weeks 1 to 6. Steam-juicer syrup is one of the ten families.
//   - "in six weeks" CUT. Nothing has aired. No air date, no estimate of one,
//     no "listen here". The only podcast promise is that the link comes to this
//     list the same day each episode publishes.
//   - "the price does not move" REWRITTEN and scoped explicitly to the $39
//     Starter Unit. The KIT price does move, $249 to $349 once the founding 500
//     fill, so an unscoped reassurance sitting one paragraph below the kit
//     prices reads as a promise Eden cannot keep. If emails 19 and 20 carry the
//     same unscoped line, fix it there in the same session.
//
// DELIBERATELY NOT SAID, each one a recorded decision:
//   - No per-plant caution for weeks 1 to 6. The email makes absence claims
//     instead, which hold across the whole book.
//   - No hint of any 2027 network show. Terms are unsettled.
//   - No episode links, no air dates, no "listen here". Nothing has aired.
//   - Dr Lauren Deville is "of Nature Cure Family Health" and nothing else. No
//     degree, no specialty, no practice, no location, and no claim about what
//     she will ask, only what Camila is preparing for.
//   - No claim that Camila asked any host to put the hardest question to her.
//     That interaction was invented by an earlier drafter and is now denied.
//
// Scripture anchor: Isaiah 40:11, aimed at the mother's own slow year with her
// own child, NOT at the print schedule. Galatians 6:9 was the alternate and was
// rejected: "do not grow weary" this close to a delay notice reads as a hint
// about the print run.
//
// The price paragraph is carried word for word from emails 19 and 20. If it
// changes in one, it changes in all three. The founding branch obeys the
// standing rule: post-founding copy names neither $249, the 500, nor founding
// standing, in body, subject or preheader.
//
// STARTER_URL is declared locally because this module deliberately imports
// nothing (see the file header). It mirrors STARTER_PAGE_URL in
// _shared/starter-config.ts, which is the authoritative value. When emails 19
// and 20 land in this file, lift it to a module const beside PREORDER_URL.
export function buildLaunchEmail21(firstName: string, founding = true): { subject: string; html: string } {
  const STARTER_URL = 'https://edeninstitute.health/starter';
  const body =
    `${preheader(`I sit down with Dr Lauren Deville on the 18th. Here is my answer, in writing, first.`)}` +
    `${p(`Hi ${firstName},`)}` +
    `${p(`On September 18 I sit down with Dr Lauren Deville of Nature Cure Family Health. The question I am bracing for is whether any of this belongs in the hands of a six year old. It is the right question, and I am glad someone is finally going to ask it out loud.`)}` +
    `${p(`I would rather answer it here first, in writing, for the people who already gave me their patience, than have you hear it secondhand on somebody else&rsquo;s show.`)}` +
    `${goldDivider()}` +
    `${p(`Safety is not a warning box at the back of the book. It is written into the Teacher&rsquo;s Guide, inside the lesson itself, where a mother actually reads it. Every week names the plant, the part we use, and how we use it.`)}` +
    `${p(`Everything a child makes comes from ten same-day kitchen preparations: tea, decoction, cold infusion, spit-poultice, compress, steam-juicer syrup, honegar, same-day honey infusion, culinary and fresh leaf. No salves, no balms, no washes, no tinctures, no infused oils, no dropper bottles, nothing that needs a shelf to cure on. Nothing a child makes has to sit and wait. No dosing formula for children is printed anywhere in it.`)}` +
    `${p(`You do not need to know any of it before you teach it. That is not a consolation prize for nervous mothers, it is the pedagogy: a child learns more watching her mother learn than watching her perform an expertise she does not have.`)}` +
    `${p(`And there is a garden in it. Friday is Garden and Review every single week, the first unit is called <em>In the Garden God Made</em>, and in week 5 you go outside and plant calendula seeds.`)}` +
    `${p(`Week 4 is peppermint, and week 4 is where the read-aloud is <em>Vov&oacute;&rsquo;s Lineage</em>, about what a grandmother hands down. I am Brazilian. That one is my own grandmother.`)}` +
    `${goldDivider()}` +
    `${p(`Since July I have recorded with Southern Appalachian Herbs, Media Angels, Home(school) with Steph, Hearty Homemaker and Planted on Purpose with Aurie Riley. Still ahead of me: Diane Boden at Minimalist Moms on the tenth, Dr Lauren Deville on the eighteenth, and Cheryl at The Homeschool How To in January.`)}` +
    `${p(`Not one of them has aired. When each does, the link comes to this list the same day. That is the only promise I am making about any of it.`)}` +
    `${p(`None of it puts one thing in your child&rsquo;s hands this autumn. Weeks 1 through 6 do.`)}` +
    `${goldDivider()}` +
    `${p(`Isaiah watched God come in strength, then said how He moves through a field:`)}` +
    `${verseCard(`Like a shepherd He will tend His flock, in His arm He will gather the lambs and carry them in His bosom; He will gently lead the nursing ewes.`, 'Isaiah 40:11')}` +
    `${p(`That is the pace I want for your year, and the one I am still learning for mine.`)}` +
    `${p(`The Sprouts Starter Unit is <strong>$39</strong>: weeks 1 through 6, digital, instant download, with the Teacher&rsquo;s Guide, the Student Notebook and the Read-Aloud storybook for those six weeks. Buy the printed kit later and the whole $39 comes off it.`)}` +
    `${p(founding
      ? `The printed kit is <strong>$249</strong> for the founding 500 families and <strong>$349</strong> after.`
      : `The printed kit is <strong>$349</strong>.`)}` +
    `${p(`This is the third and last of these notes. The <strong>$39</strong> Starter Unit is not going anywhere and there is no deadline on it. If this is not the year for it, I will still be here when it is.`)}` +
    `${brandButton(`Start with Weeks 1 through 6`, STARTER_URL)}` +
    `${signature()}`;
  return { subject: `Would you hand this to a six year old?`, html: launchWrapper(body) };
}

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
  // Post-delay Starter Unit arc, added 2026-08-27. Registration is NOT optional:
  // buildLaunchEmail() dispatches through this map and returns null for an
  // unregistered position, so an exported-but-unregistered builder fails
  // SILENTLY at send time rather than at compile time.
  19: buildLaunchEmail19,
  20: buildLaunchEmail20,
  21: buildLaunchEmail21,
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
