// The purchase tracks (founder rule 2026-10-15: every event gets 3 or 4 emails, then everyone
// is on the shared Friday list; plan in Eden's Table > Projects > Email Journeys and Nurture >
// Email_Lifecycle_Plan_2026-10-15, section 2).
//
//   Starter Unit, first band:   Founding Family d1 + d2 (founding-family-templates.ts), then
//                               "Weeks 10 to 36" about 5 weeks after purchase, only if they do
//                               not own that band's printed year (covers punch #238).
//   Starter Unit, second band:  thank you (1 day), "How is the second band going?" (2 weeks),
//                               that band's "Weeks 10 to 36" (about 5 weeks, same rule).
//   Printed year, first band:   Founding Family p1 + p2, then a review ask about 4 weeks
//                               after delivery.
//   Printed year, second band
//   or both bands:              "Two bands on your shelf" (1 day), the two-band rhythm note
//                               (2 weeks after delivery), an ask for their words (4 weeks after).
//   Back to Eden:               how to read it (1 day), the five tenets (1 week), an ask for
//                               their words (2 weeks; for print, 2 weeks after delivery).
//   Deep-Dive Guide:            how to use it (1 day), Back to Eden (4 days), the free week
//                               for parents (1 week).
//
// Copy rules: no em dashes; Scripture first; no health claims; nothing Eastern; no invented
// reader words, memories or dates. Book passages are word for word from the published Back to
// Eden (DIGITAL PDF). Curriculum facts are from the content manual (Friday = Garden and Review,
// lock #16; Sprouts labs same-day, Seedlings sometimes slow, lock #47) and the approved list
// emails. Prices are display copy: $249 = products.retail_price_cents for sprouts_print_set and
// seedlings_print_set (checked 2026-10-15). Change the products table first, then here.

import { brandButton, emailWrapper, heading, p, signature } from './nurture-email-templates.ts';
import { EDITIONS, edensTableForParents, hi, link, preheader, quoteBlock } from './lead-track-templates.ts';
import { GROUP_INVITE } from './founding-family-templates.ts';
import { STARTER_BANDS } from './starter-config.ts';
import { escapeHtml } from './html-escape.ts';

const SITE = 'https://edeninstitute.health';
const PRINT_SET_PRICE = '$249';

export type Band = 'sprouts' | 'seedlings';
const BAND_NAME: Record<Band, string> = { sprouts: 'Sprouts', seedlings: 'Seedlings' };

function printYearUrl(band: Band): string {
  return STARTER_BANDS[band].printSetUrl ?? `${SITE}/books`;
}

const REPLY_LINE = 'You can reply to this email anytime. It comes straight to me.';
const SHARE_LINE = 'Your words help other families decide whether Eden&rsquo;s Table fits their table. If you are happy for me to share them, with just your first name, say so in your reply. I will never share anything without your yes.';

// ══════════════════════════════════════════════════════════════
// STARTER, about 5 weeks: weeks 10 to 36 in print. First band and second band share it; only
// the opening differs. Not sent to a family that owns this band's printed year.
// ══════════════════════════════════════════════════════════════
export function buildStarterWeeks10Email(firstName: string, band: Band, secondBand = false): { subject: string; html: string } {
  const b = BAND_NAME[band];
  const opening = secondBand
    ? `It has been about five weeks since you added ${b} to your table. If you have been teaching a week at a time, Week 9 is not far off. And if life happened and you are somewhere in the middle, that is completely normal!!`
    : `It has been about five weeks since you started the ${b} Starter Unit. If you have been teaching a week at a time, Week 9 is not far off. And if life happened and you are somewhere in the middle, that is completely normal!!`;
  const body = `
${preheader(`The rest of the ${b} year, in print, before Week 9 ends.`)}
${hi(firstName)}
${p(opening)}
${heading('What comes after Week 9')}
${p(`Weeks 10 to 36 are finished and in print. The printed ${b} year is all 36 weeks in three books: the Teacher&rsquo;s Guide, the Student Notebook and the Read-Aloud storybook. It is ${PRINT_SET_PRICE}, printed just for you when you order, and at your door in about two to three weeks.`)}
${p('So if you order in the next week or two, Week 10 should be there when you need it.')}
${brandButton(`See the printed ${b} year`, printYearUrl(band))}
${p(`Weeks 1 to 9 are in the printed books too, so the whole year is in one place. If more than one of your children is doing ${b}, you can add an extra Student Notebook for each of them at checkout.`)}
${p('And there is no rush. Your nine weeks are yours to keep either way.')}
${signature()}`;
  return { subject: 'Weeks 10 to 36 are ready', html: emailWrapper(body, 'order') };
}

// ══════════════════════════════════════════════════════════════
// STARTER, SECOND BAND, 1 day: thank you, skip the method, two bands at one table.
// `owned` is the band they already have (Starter or printed).
// ══════════════════════════════════════════════════════════════
export function buildSecondBandStarterThanks(firstName: string, band: Band, owned: Band): { subject: string; html: string } {
  const b = BAND_NAME[band];
  const o = BAND_NAME[owned];
  const body = `
${preheader(`Thank you for adding ${b}. You keep one rhythm, not two.`)}
${hi(firstName)}
${p(`Thank you so much for adding ${b}! You already know Eden&rsquo;s Table from ${o}, so I will skip how it works and get to what is new: two bands at one table.`)}
${p(`Both years run on the same days. Monday is the story, Wednesday is the Kitchen Lab and Friday is Garden and Review, in ${o} and in ${b}. So you keep one rhythm for the week, not two. The plants are different, so there will be two on your table each week.`)}
${p(`I would love to know how you end up running them. Side by side, or one after the other? ${REPLY_LINE}`)}
${signature()}`;
  return { subject: 'Two bands at one table', html: emailWrapper(body, 'order', { shopCard: false }) };
}

// ══════════════════════════════════════════════════════════════
// STARTER, SECOND BAND, 2 weeks: how is it going, in their words.
// ══════════════════════════════════════════════════════════════
export function buildSecondBandStarterCheckIn(firstName: string, band: Band): { subject: string; html: string } {
  const b = BAND_NAME[band];
  const body = `
${preheader('A few sentences back would help me so much.')}
${hi(firstName)}
${p(`It has been about two weeks since you added ${b}. How is it going with two bands at your table?`)}
${p('I would love to hear it in your own words: which day your kids look forward to, and what has been hard about running two. A few sentences is plenty. Just hit reply.')}
${p('And if you are happy for me to share what you write with other families, with just your first name, say so in your reply. I will never share anything without your yes.')}
${signature()}`;
  return { subject: 'How is the second band going?', html: emailWrapper(body, 'order', { shopCard: false }) };
}

// ══════════════════════════════════════════════════════════════
// PRINTED YEAR, FIRST BAND, about 4 weeks after delivery: their words, or a review.
// (The research says asking later gets more reviews; plan section 2.)
// ══════════════════════════════════════════════════════════════
export function buildPrintReviewAsk(firstName: string, band: Band): { subject: string; html: string } {
  const b = BAND_NAME[band];
  const body = `
${preheader('Could I ask you a favor?')}
${hi(firstName)}
${p(`Your ${b} books have been at your house about a month now. Could I ask you a favor?`)}
${p('Would you write me a few sentences about how it has gone? What your kids think of it, and what you would tell a friend who asked about it. Just hit reply. It comes straight to me.')}
${p(SHARE_LINE)}
${p('Thank you so much!!')}
${signature()}`;
  return { subject: `A month with your ${b} books`, html: emailWrapper(body, 'order', { shopCard: false }) };
}

// ══════════════════════════════════════════════════════════════
// PRINTED YEAR, SECOND BAND OR BOTH BANDS, 1 day: two bands on your shelf.
// A both-bands order that is the family's first gets the Founding 50 invite while it is open,
// like the first-band thank-you (founding-family-templates.ts p1).
// ══════════════════════════════════════════════════════════════
export type TwoBandOrder = { kind: 'both' } | { kind: 'second'; band: Band; owned: Band };

export function buildTwoBandPrintThanks(firstName: string, order: TwoBandOrder, groupInviteOpen: boolean): { subject: string; html: string } {
  const thanks = order.kind === 'both'
    ? 'Thank you so much for ordering both years, Sprouts and Seedlings! Your books are being printed just for you, and I will email you the day they ship.'
    : `Thank you so much for ordering the printed ${BAND_NAME[order.band]} year! With ${BAND_NAME[order.owned]} already at your house, that makes two bands on your shelf. Your books are being printed just for you, and I will email you the day they ship.`;
  const invite = order.kind === 'both' && groupInviteOpen ? GROUP_INVITE : '';
  const body = `
${preheader('Thank you! Your books are being printed now.')}
${hi(firstName)}
${p(thanks)}
${p('Both years run on the same days, so the two fit into one week: the story on Monday, the Kitchen Lab on Wednesday and Garden and Review on Friday.')}
${invite}
${p(REPLY_LINE)}
${signature()}`;
  return { subject: 'Two bands on your shelf', html: emailWrapper(body, 'order', { shopCard: false }) };
}

// ══════════════════════════════════════════════════════════════
// PRINTED YEAR, TWO BANDS, 2 weeks after delivery: the two-band rhythm.
// ══════════════════════════════════════════════════════════════
export function buildTwoBandRhythm(firstName: string): { subject: string; html: string } {
  const body = `
${preheader('How Sprouts and Seedlings fit together at one table.')}
${hi(firstName)}
${p('Your books have been at your house about two weeks now. Have you started Week 1?')}
${p('Here is how the two years fit into one week. Both run on the same five days. Monday is the story, in Sprouts and in Seedlings. Wednesday is the Kitchen Lab in both, and Friday is Garden and Review in both. The plants are different, because Seedlings builds on Sprouts, so there are two plants on your table each week.')}
${p('One difference to know about: the Sprouts Kitchen Lab is made and used the same day, while the Seedlings one is sometimes slow, like a sage honey you start on Wednesday and open two weeks later.')}
${p('How are you running them, side by side or one after the other? I would love to know what works at your house. Just hit reply.')}
${signature()}`;
  return { subject: 'Two bands, one week', html: emailWrapper(body, 'order', { shopCard: false }) };
}

// ══════════════════════════════════════════════════════════════
// PRINTED YEAR, TWO BANDS, 4 weeks after delivery: their words.
// ══════════════════════════════════════════════════════════════
export function buildTwoBandWords(firstName: string): { subject: string; html: string } {
  const body = `
${preheader('Could I ask you a favor?')}
${hi(firstName)}
${p('Your books have been at your house about a month now. How is it going with two bands at one table?')}
${p('Would you write me a few sentences about it? What your kids think, and what you would tell a friend who is thinking about two bands. Just hit reply. It comes straight to me.')}
${p(SHARE_LINE)}
${p('Thank you so much!!')}
${signature()}`;
  return { subject: 'A month with two bands', html: emailWrapper(body, 'order', { shopCard: false }) };
}

// ══════════════════════════════════════════════════════════════
// BACK TO EDEN
// Edition facts from /back-to-eden (web/pages/back-to-eden.astro): the Study & Journal Edition
// is the whole book plus a study guide before every chapter; the Study Guide is everything in
// it except the book text, kept open beside the paperback.
// ══════════════════════════════════════════════════════════════
export type BookEdition = 'paperback' | 'study_journal' | 'study_guide';

/** 1 day: thank you, and how to read it (the Introduction's own advice). */
export function buildBookThanks(firstName: string, edition: BookEdition, print: boolean): { subject: string; html: string } {
  const thanks = print
    ? 'Thank you so much for buying <em>Back to Eden</em>! Your copy is being printed now, and I will email you the day it ships.'
    : 'Thank you so much for buying <em>Back to Eden</em>!';
  const editionLine = edition === 'study_journal'
    ? 'Your Study &amp; Journal Edition has a short study guide before every chapter, and room to write beside every page. Read the study guide first and you will know what to look for.'
    : edition === 'study_guide'
      ? 'Your Study Guide is made to stay open beside the book, with a short study guide before every chapter. Read that first and you will know what to look for.'
      : 'At the end of every chapter there are a few reflection questions. Keep a notebook and a pen nearby for them.';
  const body = `
${preheader('Thank you! One piece of advice before you start.')}
${hi(firstName)}
${p(thanks)}
${p('Before you start, here is the one piece of advice from the Introduction: read it in order, at least the first time. Each chapter builds on the one before it, so the plants near the end make sense because of everything that comes first.')}
${p(editionLine)}
${quoteBlock('Take your time. There is no rush here. The goal is not to consume information but to change the way you see.', '<em>Back to Eden</em>, Introduction')}
${p(REPLY_LINE)}
${signature()}`;
  return { subject: 'How to read Back to Eden', html: emailWrapper(body, 'order', { shopCard: false }) };
}

/** 1 week: the five tenets before any herb (Chapter 6). Nothing to buy. */
export function buildBookTenets(firstName: string, print: boolean): { subject: string; html: string } {
  const notYet = print ? ' If your copy has not arrived yet, you can still start this one today.' : '';
  const body = `
${preheader('Chapter 6 in a few lines, and one thing to try this week.')}
${hi(firstName)}
${p('Chapter 6 of <em>Back to Eden</em> opens like this:')}
${quoteBlock('Before we speak of herbs, before we speak of disease, before we speak of intervention of any kind, we must understand what the body is constantly trying to preserve.', '<em>Back to Eden</em>, Chapter 6')}
${p('That is why the five tenets of health come first: hydration, movement, nutrition, rest and connection. The chapter says it in four words: &ldquo;Foundation always precedes intervention.&rdquo;')}
${heading('Something to try this week')}
${p(`Try the first and last questions at the end of the chapter. Rate yourself from 1 to 5 on each of the five tenets, then choose one small, specific change for the lowest one and keep it all week.${notYet}`)}
${p('Nothing to buy. Just hit reply if you want to tell me which one you picked.')}
${signature()}`;
  return { subject: 'The five tenets before any herb', html: emailWrapper(body, 'order', { shopCard: false }) };
}

/** 2 weeks (print: 2 weeks after delivery): what they think, in their words. */
export function buildBookWords(firstName: string, print: boolean): { subject: string; html: string } {
  const opening = print
    ? 'Your copy of <em>Back to Eden</em> has been at your house about two weeks now. Can I ask what you think so far?'
    : 'You have had <em>Back to Eden</em> for about two weeks now. Can I ask what you think so far?';
  const body = `
${preheader('A few sentences back would mean so much.')}
${hi(firstName)}
${p(opening)}
${p('A few sentences is plenty, even if you are only a few chapters in. Which chapter has stayed with you, or where did you get stuck? Just hit reply. It comes straight to me.')}
${p('If you are happy for me to share what you write with other readers, with just your first name, say so in your reply. I will never share anything without your yes.')}
${signature()}`;
  return { subject: 'What do you think so far?', html: emailWrapper(body, 'order', { shopCard: false }) };
}

// ══════════════════════════════════════════════════════════════
// DEEP-DIVE GUIDE
// Chapter names are the guide's own (constitution-pdf/index.ts). The PDF is attached to the
// delivery email; /guide/<slug> emails a fresh access link (guide-access.ts).
// ══════════════════════════════════════════════════════════════
function shortName(constitutionName: string): string {
  return constitutionName.replace(/^The /i, '');
}

/** 1 day: how to use your guide. */
export function buildGuideHowTo(firstName: string, constitutionName: string, slug: string): { subject: string; html: string } {
  const name = escapeHtml(shortName(constitutionName));
  const body = `
${preheader('Where to start, and what to read before the herbs.')}
${hi(firstName)}
${p(`Thank you so much for getting your <strong>${name}</strong> Deep-Dive Guide! It came to your inbox as a PDF, so it is yours to keep and print. Here is the order I would read it in.`)}
${p('<strong>Chapter One, Your Pattern.</strong> Start here and see how much of it sounds like you.')}
${p('<strong>Chapter Three, Biblical Framework.</strong> Read it before the herbs. It is the Scripture underneath everything else in the guide.')}
${p('<strong>Chapter Four, Your Herbal Allies.</strong> Read each herb&rsquo;s safety notes, and the list of herbs to be careful with, before you buy anything.')}
${p('<strong>Chapter Five, Nutrition &amp; Lifestyle.</strong> Pick one rhythm from it and keep it for a week.')}
${p('Chapter Two is the history, and it can wait for a slow afternoon.')}
${p('The guide is educational, not medical advice. For anything serious, talk with a qualified practitioner, and always read an herb&rsquo;s safety notes first.')}
${p(`If you ever lose the PDF, your guide is on the website too. Go to ${link('your guide page', `${SITE}/guide/${slug}`)} and ask for a fresh link with the email you used to buy it.`)}
${signature()}`;
  return { subject: `How to use your ${name} guide`, html: emailWrapper(body, 'order') };
}

/** 4 days: Back to Eden as the next step. Not sent to someone who owns the book. */
export function buildGuideBook(firstName: string, constitutionName: string): { subject: string; html: string } {
  const name = escapeHtml(shortName(constitutionName));
  const body = `
${preheader('Your guide tells you your pattern. The book tells you why.')}
${hi(firstName)}
${p(`Your ${name} guide comes from my book, <em>Back to Eden</em>. The patterns are in Chapter 8, and the rest of the book is the foundation underneath them.`)}
${quoteBlock('Know why the body does what it does, and the herbs begin to make sense on their own.', '<em>Back to Eden</em>, Introduction')}
${p('It starts with who made the body and why, and only then gets to the plants: why symptoms are signals, the five tenets of health and why they come before any herb, and how to read a person before reaching for any remedy.')}
${p(EDITIONS)}
${brandButton('See the book', `${SITE}/back-to-eden`)}
${signature()}`;
  return { subject: 'The book behind your guide', html: emailWrapper(body, 'order') };
}

/** 1 week, parents: the free week. `saidYes` = they tapped Yes on the children question. */
export function buildGuideParents(firstName: string, saidYes: boolean): { subject: string; html: string } {
  const opening = saidYes
    ? 'You tapped Yes when I asked if you have children at home, so this one is for them.'
    : 'If you have children at home, this one is for them.';
  const body = `
${preheader('One plant a week, Scripture first. Week 1 is free.')}
${hi(firstName)}
${p(opening)}
${edensTableForParents()}${signature()}`;
  return { subject: "For your children: a free week of Eden's Table", html: emailWrapper(body, 'order') };
}
