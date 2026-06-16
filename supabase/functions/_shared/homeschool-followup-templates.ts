// supabase/functions/_shared/homeschool-followup-templates.ts
//
// Homeschool nurture follow-up emails (Weeks 4-7), drained from
// magnet_email_queue by the nurture-emails EF at sequence_position 4/5/6/7.
//
//   Week 4 (~day 21) — older-kids stopgap → Foundations course ($97 founding
//                      through Jan 1, 2027). The one email here with a CTA.
//   Week 5 (~day 28) — "use the Around-the-Table cards" (value, no CTA)
//   Week 6 (~day 35) — seasonal herb of note (value, no CTA)
//   Week 7 (~day 42) — devotional / identity (no CTA)
//
// All four are band-agnostic (Sprouts + Seedlings get the same copy), so they
// take only firstName. They reuse the canonical emailWrapper (exported from
// nurture-email-templates.ts) for identical header/footer chrome; the small
// text helpers are copied verbatim from that file so rendering matches exactly.
// This file is intentionally separate so the large canonical template file is
// not touched. Voice rule: no em dashes (see feedback_no_em_dashes).

import { emailWrapper } from './nurture-email-templates.ts';

const BRAND = {
  forest: '#2C3E2D',
  text: '#3D3832',
  gold: '#C5A44E',
  sage: '#5C7A5C',
};

const COURSE_URL = 'https://learn.edeninstitute.health/course/back-to-eden1';

// ── Helpers (verbatim from nurture-email-templates.ts so output matches) ──
function p(text: string, extra = ''): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${BRAND.text};margin:0 0 16px 0;${extra}">${text}</p>`;
}

function heading(text: string): string {
  return `<h2 style="font-family:Georgia,serif;font-size:22px;line-height:1.3;color:${BRAND.forest};margin:0 0 16px 0;font-weight:bold;">${text}</h2>`;
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
<p style="font-family:Georgia,serif;font-size:14px;margin:4px 0 0 0;"><a href="https://edeninstitute.health" style="color:${BRAND.sage};text-decoration:underline;">edeninstitute.health</a></p>`;
}

// ── Week 4 (~day 21): older-kids stopgap → Foundations course ──
export function buildMagnetWeek4Email(firstName: string): { subject: string; html: string } {
  const body =
    `${p(`Hi ${firstName},`)}` +
    `${p(`You&rsquo;ve spent a few weeks with Eden&rsquo;s Table around your own table. And a lot of you have written with the same question: &ldquo;What about my older kids?&rdquo;`)}` +
    `${p(`The <strong>Cultivators</strong> (middle school) and <strong>Practitioners</strong> (high school) bands are in development. But you don&rsquo;t have to wait to bring this to your older children.`)}` +
    `${p(`<strong>Back to Eden: Foundations of Biblical Herbalism</strong> is the adult course all of Eden&rsquo;s Table grew from. It covers the Biblical framework for wellness, your God-given constitution, plant energetics, tissue states, and terrain-based thinking. When you learn it, you can lead your middle and high schoolers through it directly. The same Scripture-rooted, clinically grounded foundation, taught to you so you can teach them. A stopgap that is really a strong beginning.`)}` +
    `${brandButton('Begin the Foundations Course &nbsp;&middot;&nbsp; $97', COURSE_URL)}` +
    `${p(`Founding price is $97 (normally $197), held through January 1, 2027.`)}` +
    `${signature()}`;
  return { subject: 'For your older kids, a way to start now', html: emailWrapper(body) };
}

// ── Week 5 (~day 28): use the Around-the-Table cards (value, no CTA) ──
export function buildMagnetWeek5Email(firstName: string): { subject: string; html: string } {
  const body =
    `${p(`Hi ${firstName},`)}` +
    `${p(`Of everything in your Eden&rsquo;s Table download, the <strong>Around-the-Table cards</strong> are the easiest place to begin, because they need no prep and no &ldquo;school time.&rdquo; Just dinner.`)}` +
    `${p(`Tonight, try this: pull one card and read the question aloud before you eat. Let the kids answer in any order. Don&rsquo;t correct, don&rsquo;t turn it into a lesson. Just let the conversation wander. Five minutes, then eat.`)}` +
    `${p(`That&rsquo;s the whole method. Eden&rsquo;s Table isn&rsquo;t one more thing to add to your day. It&rsquo;s a small rhythm folded into a meal you&rsquo;re already sharing. The herbs, the Scripture, and the wonder grow out of that table over time.`)}` +
    `${p(`If a card sparks something good this week, I&rsquo;d love to hear it. Just hit reply.`)}` +
    `${signature()}`;
  return { subject: 'The easiest 5 minutes at your table tonight', html: emailWrapper(body) };
}

// ── Week 6 (~day 35): seasonal herb (value, no CTA) ──
export function buildMagnetWeek6Email(firstName: string): { subject: string; html: string } {
  const body =
    `${p(`Hi ${firstName},`)}` +
    `${p(`No lesson plan this time. Just one herb I think every family should know, and one simple way to use it.`)}` +
    `${heading('Chamomile')}` +
    `${p(`Gentle enough for little ones, calming for the whole household, and likely already in your cupboard. The simplest use: steep a teaspoon of dried flowers in hot water for five minutes, covered. (The cover keeps the calming oils in the cup instead of the air.) A small mug after dinner is a quiet way to wind a busy house down toward bedtime.`)}` +
    `${p(`God filled the garden with provision like this, plants that tend the bodies He designed. Teaching our children to notice them is its own kind of worship.`)}` +
    `${p(`More herbs to come as the seasons turn.`)}` +
    `${signature()}`;
  return { subject: 'One herb worth knowing this season: Chamomile', html: emailWrapper(body) };
}

// ── Week 7 (~day 42): devotional / identity (no CTA) ──
export function buildMagnetWeek7Email(firstName: string): { subject: string; html: string } {
  const body =
    `${p(`Hi ${firstName},`)}` +
    `${p(`It&rsquo;s worth remembering: the first place God set His people was not a temple or a school. It was a garden. And the first work He gave was to tend it (Genesis 2:15).`)}` +
    `${p(`That&rsquo;s the heart of what we&rsquo;re building. Not just facts about plants, but a way of raising children who see creation as something entrusted to them, to know, to steward, to give thanks for. When your child learns why chamomile calms or how elderberry guards the body, they&rsquo;re learning to read a little more of the language God wrote into the world.`)}` +
    `${p(`You don&rsquo;t need a curriculum to begin that. You&rsquo;re already doing it, at your table, in your garden, in the questions you let your children ask. Eden&rsquo;s Table is just here to walk alongside you.`)}` +
    `${p(`Grateful you&rsquo;re on this path with us.`)}` +
    `${signature()}`;
  return { subject: 'The first classroom was a garden', html: emailWrapper(body) };
}
