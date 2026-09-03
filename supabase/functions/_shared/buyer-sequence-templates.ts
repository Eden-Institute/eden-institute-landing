// supabase/functions/_shared/buyer-sequence-templates.ts
//
// BUYER NURTURE SEQUENCE — six emails across the wait between paying and the
// kit arriving. Rows live in public.buyer_email_queue (migration
// 20260729010000) and are drained by the nurture-emails edge function.
//
// WHY IT EXISTS. A family pays $249 in July for a kit that ships early
// November. Before this, they got one confirmation email and then roughly
// fourteen weeks of silence. Under the FTC Mail Order Rule they can cancel for
// a full refund any time before it ships, so silence after payment is not just
// cold, it is expensive.
//
// WHAT IT DELIBERATELY DOES NOT DO:
//
//   1. It never promises production milestones. As of 2026-07-28 the designs
//      are not final and nothing is at the printer. An automated email claiming
//      "your kit is on the press" would be a lie on a schedule. Email 5 is
//      written to be true whatever production is doing.
//   2. It never tells a reader they are one of the Founding Fifty. That is the
//      first 50 PAID orders and this sequence cannot see rank. The confirmation
//      email already says the founder will write separately, and launch email 8
//      says the same. Three places must not contradict each other.
//   3. It invents no curriculum detail. Component names, 36 weeks and 180
//      daily lessons are taken from copy already published. The Five Tenets are
//      referenced by name only, never enumerated, because their content is not
//      in this repo.
//
// Ship dates are literals here so the module stays self-contained, exactly as
// launch-sequence-templates.ts does. They MUST match SHIP_TARGET and
// SHIP_GUARANTEE_TEXT in _shared/order-config.ts, which is the authoritative
// source the checkout disclaimer and the confirmation email use.
//
// Voice rules, same as every other Eden template: no em dashes, Scripture is
// NASB and woven into the argument rather than appended. Every verse quoted
// here is copied verbatim from launch-sequence-templates.ts, where it was
// already reviewed, rather than typed from memory.

const WEBSITE_URL = 'https://edeninstitute.health';
const HERB_SOURCING_URL = 'https://edeninstitute.health/homeschool/herbs';

// Revised 2026-08-26. Mirrors _shared/order-config.ts; this file keeps its own copy.
const SHIP_TARGET = 'July 31, 2027';
const SHIP_GUARANTEE = 'September 30, 2027';

const BRAND = {
  bgOuter: '#F5F0E8',
  bgBody: '#FFFFFF',
  forest: '#2C3E2D',
  text: '#3D3832',
  gold: '#C5A44E',
  sage: '#5C7A5C',
  footerText: '#6B6560',
};

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

function preheader(text: string): string {
  return `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${text}</div>`;
}

function linkButton(label: string, url: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
<tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
<tr><td align="center" style="background-color:${BRAND.forest};border-radius:8px;">
<a href="${url}" target="_blank" style="display:inline-block;background-color:${BRAND.forest};color:${BRAND.gold};font-family:Georgia,serif;font-size:16px;font-weight:bold;text-decoration:none;text-align:center;padding:14px 40px;border-radius:8px;line-height:24px;mso-line-height-rule:exactly;">${label}</a>
</td></tr></table>
</td></tr></table>`;
}

function signature(): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${BRAND.text};margin:24px 0 4px 0;">Grace and health,</p>
<p style="font-family:Georgia,serif;font-size:16px;color:${BRAND.text};font-weight:bold;margin:0;">Camila</p>
<p style="font-family:Georgia,serif;font-size:14px;color:${BRAND.text};margin:4px 0 0 0;">The Eden Institute</p>
<p style="font-family:Georgia,serif;font-size:14px;margin:4px 0 0 0;"><a href="${WEBSITE_URL}" style="color:${BRAND.sage};text-decoration:underline;">edeninstitute.health</a></p>`;
}

// Buyer chrome. Note the footer line: it says why THEY are getting this, which
// for a buyer is their order, not a mailing list they joined.
function buyerWrapper(bodyContent: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:${BRAND.bgOuter};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.bgOuter};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:${BRAND.bgBody};border-radius:8px;overflow:hidden;">
<tr><td style="background-color:${BRAND.forest};padding:24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="text-align:center;font-family:Georgia,serif;font-size:13px;font-weight:bold;letter-spacing:4px;color:${BRAND.gold};text-transform:uppercase;">THE EDEN INSTITUTE</td></tr>
<tr><td style="height:8px;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="text-align:center;font-family:Georgia,serif;font-size:14px;color:#FFFFFF;font-style:italic;">Back to Eden. Back to Truth.</td></tr>
</table>
</td></tr>
<tr><td style="padding:32px 28px;">${bodyContent}</td></tr>
<tr><td style="background-color:${BRAND.bgOuter};padding:20px 28px;">
<p style="font-family:Georgia,serif;font-size:11px;color:${BRAND.footerText};text-align:center;margin:0 0 8px 0;">You are receiving this because you preordered Eden&rsquo;s Table. You may cancel for a full refund any time before your kit ships.</p>
<p style="font-family:Georgia,serif;font-size:11px;color:${BRAND.footerText};text-align:center;margin:0;">Prefer not to get these updates? <a href="{{UNSUB_URL}}" style="color:${BRAND.footerText};text-decoration:underline;">Unsubscribe</a>. Order and shipping notices are separate and will still reach you.</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

// Shared reassurance block. Repeating the guarantee and the refund right in
// every email is deliberate: it is the single fact most likely to stop a wobble
// turning into a chargeback, and a buyer should never have to go hunting for it.
function shipFooterNote(): string {
  return p(
    `Your kit is aiming to ship <strong>${SHIP_TARGET}</strong>, guaranteed on or before <strong>${SHIP_GUARANTEE}</strong>. You can cancel for a full refund any time before it ships. Just reply to this email.`,
    'font-size:14px;color:#6B6560;',
  );
}

// ══════════════════════════════════════════════════════════════
// 1 — Day 3 — What happens now
// ══════════════════════════════════════════════════════════════
export function buildBuyerEmail1(firstName: string): { subject: string; html: string } {
  const body =
    preheader(`What you bought, what happens next, and how to reach me.`) +
    heading(`What happens now`) +
    p(`Hi ${firstName},`) +
    p(`Your preorder is in, and I wanted to write to you myself rather than let a receipt be the last thing you hear from us.`) +
    p(`Here is exactly what you have coming, and when.`) +
    bullet(`<strong>Six components</strong>: the Teacher&rsquo;s Guide, the Student Notebook, Field Cards, Recipe Cards, Around the Table Cards, and the Read-Aloud Storybook.`) +
    bullet(`<strong>36 weeks, 180 daily lessons</strong>, built together as one year.`) +
    bullet(`<strong>One box</strong>, aiming for ${SHIP_TARGET}.`) +
    goldDivider() +
    p(`Between now and then you will hear from me about six times. Not sales emails. Things that make the kit land in a home that is ready for it: how a week actually runs, how to source your herbs, where this fits in your school year.`) +
    p(`Nehemiah&rsquo;s builders did not wait for the wall to be finished before they joined. &ldquo;Let us arise and build&rdquo; (Nehemiah 2:18, NASB). You did that this week, and I do not take it lightly.`) +
    p(`If anything ever feels unclear, reply. These emails come to a real inbox that I read.`) +
    shipFooterNote() +
    signature();
  return { subject: `What happens now`, html: buyerWrapper(body) };
}

// ══════════════════════════════════════════════════════════════
// 2 — Day 14 — How a week actually runs
// ══════════════════════════════════════════════════════════════
export function buildBuyerEmail2(firstName: string): { subject: string; html: string } {
  const body =
    preheader(`Monday to Friday, so you can picture it before the box lands.`) +
    heading(`What a week actually looks like`) +
    p(`Hi ${firstName},`) +
    p(`The question I get most from families waiting on their kit is simply: what will our days look like? So here is the rhythm, before you ever open the box.`) +
    bullet(`<strong>Monday.</strong> You meet the week&rsquo;s herb in a story. The Eden family carries it, so your child meets a plant the way they meet a character.`) +
    bullet(`<strong>Tuesday.</strong> Discovery. What it is, what it does, where God planted it.`) +
    bullet(`<strong>Wednesday.</strong> The kitchen. You make something real together using that week&rsquo;s herb.`) +
    bullet(`<strong>Thursday.</strong> Hands and notebook. The herb in front of them, and five gentle pages sized for small hands.`) +
    bullet(`<strong>Friday.</strong> A chant. Four lines your crew will still be saying in the car in December.`) +
    goldDivider() +
    p(`Most days run about half an hour. Monday and Wednesday go longer when the story or the recipe catches fire, and that is the good kind of longer.`) +
    p(`You do not need to prepare anything in advance. The Teacher&rsquo;s Guide tells you what to read, what to ask, and what to have on the counter.`) +
    shipFooterNote() +
    signature();
  return { subject: `What a week actually looks like`, html: buyerWrapper(body) };
}

// ══════════════════════════════════════════════════════════════
// 3 — Day 30 — Sourcing herbs before the kit lands
// ══════════════════════════════════════════════════════════════
export function buildBuyerEmail3(firstName: string): { subject: string; html: string } {
  const body =
    preheader(`The one thing worth doing before your kit arrives.`) +
    heading(`Start gathering your herbs`) +
    p(`Hi ${firstName},`) +
    p(`There is one piece of preparation worth doing early, and it is the one families most often leave until the week they need it.`) +
    p(`The curriculum uses a real herb each week. The kit brings you the year: the guide, the notebook, the cards, the stories. The herbs themselves you gather, because a plant that has sat in a warehouse since spring is not what you want your child smelling on a Tuesday morning.`) +
    p(`We keep a sourcing guide with trusted, affordable options, so you are not guessing at quality or paying for a name.`) +
    linkButton(`See the sourcing guide`, HERB_SOURCING_URL) +
    p(`You do not need all 36 at once. The first handful will carry you through the opening weeks, and buying a few at a time is easier on a grocery budget than one large order in October.`) +
    shipFooterNote() +
    signature();
  return { subject: `Start gathering your herbs`, html: buyerWrapper(body) };
}

// ══════════════════════════════════════════════════════════════
// 4 — Day 50 — Where it fits in your year
// ══════════════════════════════════════════════════════════════
export function buildBuyerEmail4(firstName: string): { subject: string; html: string } {
  const body =
    preheader(`How Eden's Table sits alongside the rest of your school year.`) +
    heading(`Where this fits in your year`) +
    p(`Hi ${firstName},`) +
    p(`If you are mapping out your year about now, here is how families are placing this.`) +
    p(`Eden&rsquo;s Table is designed to carry your core rather than sit beside it. Bible, science, language arts, math, art, history, geography, Latin, health and character are already woven in and already scheduled. Most families find it replaces a separate science program, a nature study, and a Bible curriculum, rather than being added on top of them.`) +
    p(`It is 36 weeks, which is a standard school year with room to breathe. If you take a week off, the herb simply waits. Nothing in the sequence breaks because you had a hard fortnight.`) +
    p(`&ldquo;By wisdom a house is built, and by understanding it is established; and by knowledge the rooms are filled with all precious and pleasant riches&rdquo; (Proverbs 24:3-4, NASB). Planning is part of that building, and you are doing it now, in good time.`) +
    shipFooterNote() +
    signature();
  return { subject: `Where this fits in your year`, html: buyerWrapper(body) };
}

// ══════════════════════════════════════════════════════════════
// 5 — Day 75 — Where things stand
// ══════════════════════════════════════════════════════════════
// Written to be TRUE whatever production is doing. It claims no milestone and
// names no new date. If a real milestone exists when this sends, the founder
// can add it, but the email must never depend on one having happened.
export function buildBuyerEmail5(firstName: string): { subject: string; html: string } {
  const body =
    preheader(`A straight answer about timing, and your options.`) +
    heading(`Where things stand`) +
    p(`Hi ${firstName},`) +
    p(`You paid for something months before it arrives, which takes trust. So here is a straight update rather than silence.`) +
    p(`We are still aiming to ship <strong>${SHIP_TARGET}</strong>, and every kit is guaranteed to ship on or before <strong>${SHIP_GUARANTEE}</strong>. That guarantee is not marketing language. If we cannot meet it, the law requires me to write to you and offer your money back, and I would do that anyway.`) +
    p(`You will get a shipping confirmation by email the moment your box moves. Nothing is required from you before then.`) +
    p(`And if your circumstances have changed, you can cancel for a full refund any time before it ships. Reply to this email and I will take care of it, no explanation needed. I would far rather you have the money than a box you no longer want.`) +
    p(`If you have questions about the curriculum itself, reply and ask. I answer these myself.`) +
    signature();
  return { subject: `Where things stand`, html: buyerWrapper(body) };
}

// ══════════════════════════════════════════════════════════════
// 6 — Day 95 — Getting ready for week one
// ══════════════════════════════════════════════════════════════
export function buildBuyerEmail6(firstName: string): { subject: string; html: string } {
  const body =
    preheader(`A short list to have ready before the box arrives.`) +
    heading(`Getting ready for week one`) +
    p(`Hi ${firstName},`) +
    p(`Your kit is getting close. Here is the short list of what is worth having ready, so that week one is a good morning rather than a scramble.`) +
    bullet(`<strong>The first few herbs.</strong> If you have not started gathering, the sourcing guide is at ${HERB_SOURCING_URL}.`) +
    bullet(`<strong>A shelf, not a drawer.</strong> The cards get used all week. Families who keep them visible actually use them.`) +
    bullet(`<strong>Half an hour, most days.</strong> Pick the time of day you are at your best, not the time that is left over.`) +
    bullet(`<strong>Nothing else.</strong> No prep, no printing, no lesson planning. Open the guide and follow the day.`) +
    goldDivider() +
    p(`One last thing, and it is the part I most want you to hear. You do not have to be an herbalist, and you do not have to know the answers before your children ask. You are the guide reading the map, and the map is good.`) +
    p(`Thank you for backing this before it existed. Families like yours are why it does.`) +
    shipFooterNote() +
    signature();
  return { subject: `Getting ready for week one`, html: buyerWrapper(body) };
}

export const BUYER_SEQUENCE_LENGTH = 6;

const BUYER_BUILDERS: Record<number, (firstName: string) => { subject: string; html: string }> = {
  1: buildBuyerEmail1,
  2: buildBuyerEmail2,
  3: buildBuyerEmail3,
  4: buildBuyerEmail4,
  5: buildBuyerEmail5,
  6: buildBuyerEmail6,
};

export function buildBuyerEmail(
  position: number,
  firstName: string,
): { subject: string; html: string } | null {
  const builder = BUYER_BUILDERS[position];
  return builder ? builder(firstName) : null;
}
