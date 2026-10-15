// The lead tracks and the refund note (founder rule 2026-10-15: every event gets 3 or 4
// emails, then everyone is on the shared Friday list; plan in Eden's Table > Projects >
// Email Journeys and Nurture > Email_Lifecycle_Plan_2026-10-15).
//
//   Constitution quiz:      Email 1 at once (resend-waitlist), 2 on day 2, 3 on day 4,
//                           4 on day 6 ONLY for "yes, children at home".
//   Back to Eden Chapter 1: the chapter at once (welcome-email-templates.ts), then the same
//                           day 2 / day 4 / day 6 shape.
//   Full refund:            the factual email (order-messages.ts), then this one plain note
//                           3 days later. Nothing to buy.
//
// Copy rules: no em dashes; Scripture first; no health claims; nothing Eastern; no invented
// reader words (founder 2026-10-15: until real reader words exist, day 4 quotes Back to Eden).
// Each pattern's verse and practice come from that pattern's own Deep-Dive Guide
// (_shared/guide/guide-content-<slug>.ts, chapterThree.scriptureVerse and chapterFive), the
// Back to Eden passages from the published book (Print Edition (Lulu), DIGITAL PDF).

import { BRAND, brandButton, emailWrapper, goldDivider, heading, p, signature } from './nurture-email-templates.ts';
import { escapeHtml } from './html-escape.ts';

const SITE = 'https://edeninstitute.health';

export function preheader(text: string): string {
  return `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${text}</div>`;
}

export function link(text: string, url: string): string {
  return `<a href="${url}" style="color:${BRAND.sage};text-decoration:underline;">${text}</a>`;
}

export function hi(firstName: string): string {
  return p(`Hi ${escapeHtml(firstName.trim() || 'friend')},`);
}

/** A verse or a book passage, set apart from the letter around it. */
export function quoteBlock(text: string, source: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px 0;">
<tr><td style="background-color:${BRAND.bgOuter};padding:20px 24px;border-left:3px solid ${BRAND.gold};">
<p style="font-family:Georgia,serif;font-size:17px;line-height:1.6;color:${BRAND.forest};font-style:italic;margin:0 0 10px 0;">${text}</p>
<p style="font-family:Georgia,serif;font-size:14px;color:${BRAND.footerText};margin:0;">${source}</p>
</td></tr>
</table>`;
}

export interface ChildrenAnswerUrls {
  yes: string;
  no: string;
}

function answerButton(label: string, url: string): string {
  return `<td align="center" style="padding:0 8px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td align="center" style="background-color:${BRAND.forest};border-radius:8px;">
<a href="${url}" target="_blank" style="display:inline-block;background-color:${BRAND.forest};color:${BRAND.gold};font-family:Georgia,serif;font-size:16px;font-weight:bold;text-decoration:none;text-align:center;padding:12px 36px;border-radius:8px;line-height:24px;mso-line-height-rule:exactly;">${label}</a>
</td></tr></table>
</td>`;
}

/** The day-2 tap question. The two links tag the answer; only a Yes gets the day-6 email. */
function childrenQuestion(urls: ChildrenAnswerUrls): string {
  return goldDivider() +
    heading('One quick question') +
    p('Do you have children at home?') +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px 0;"><tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
${answerButton('Yes', urls.yes)}
${answerButton('No', urls.no)}
</tr></table>
</td></tr></table>` +
    p('Tap one and you are done. It helps me send you only what fits.', `font-size:14px;color:${BRAND.footerText};text-align:center;`);
}

// ── The eight patterns ──
// verse / verseLine: chapterThree.scriptureVerse of each guide, the verse quoted as the guide
// quotes it, the guide's own commentary kept and its em dashes rewritten.
// practice / practiceVerse: chapterFive (restRhythm, movement, dietary, spiritualPractice),
// cut to one small week-long practice with no health claims. practiceVerse only where the
// guide gives a second verse that Email 1 has not already used.
interface PatternCopy {
  axes: string;
  tagline: string;
  verse: string;
  verseRef: string;
  verseLine: string;
  practice: string;
  practiceVerse?: { text: string; ref: string };
}

const PATTERNS: Record<string, PatternCopy> = {
  'burning-bowstring': {
    axes: 'hot, dry and tense',
    tagline: 'You run hot, burn dry, and hold everything tight.',
    verse: 'A tranquil heart gives life to the flesh.',
    verseRef: 'Proverbs 14:30',
    verseLine: 'Letting go of tension is not weakness. It is wisdom. A bow has to be unstrung to stay strong.',
    practice: 'Give yourself an evening wind-down. Pick a time each night, put the phone in another room, make a cup of something warm and gentle, like chamomile, and read a psalm before bed. Your pattern resists rest more than most, so it helps to make rest a habit instead of a decision you have to make every night.',
    practiceVerse: { text: 'Be still, and know that I am God.', ref: 'Psalm 46:10' },
  },
  'open-flame': {
    axes: 'hot, dry and relaxed',
    tagline: 'You burn bright and open: warm, expressive, and unguarded.',
    verse: 'Above all else, guard your heart, for everything you do flows from it.',
    verseRef: 'Proverbs 4:23',
    verseLine: 'A fire in a hearth warms the house. A fire without one burns it down. The call for your pattern is stewardship, not suppression.',
    practice: 'Pick one rhythm and keep it all week: the same bedtime every night, or meals at the same times each day. Your pattern runs warm and open, and a little structure is what keeps that warmth steady. And try one honest no this week, to something you would usually say yes to out of habit.',
    practiceVerse: { text: 'Let your yes be yes and your no be no.', ref: 'Matthew 5:37' },
  },
  'pressure-cooker': {
    axes: 'hot, damp and tense',
    tagline: 'You run hot, hold fluid, and clench tight. Pressure builds with no release valve.',
    verse: 'In your anger do not sin. Do not let the sun go down while you are still angry.',
    verseRef: 'Ephesians 4:26',
    verseLine: 'Your pattern does best letting go a little every day, before the breaking point, trusting God to hold what you release.',
    practice: 'Build one small release into every day this week: a brisk walk, ten minutes of writing everything down, or an honest conversation with someone you trust. Then hand the rest to God in prayer. A little every day is easier than all at once.',
    practiceVerse: { text: 'Cast all your anxiety on Him, because He cares for you.', ref: '1 Peter 5:7' },
  },
  'overflowing-cup': {
    axes: 'hot, damp and relaxed',
    tagline: 'You run warm, hold fluid, and everything spills over.',
    verse: 'Create in me a clean heart, O God.',
    verseRef: 'Psalm 51:10',
    verseLine: 'Your pattern carries more than it can hold. The call is to let go of what has piled up, and to let things resolve instead of holding on to all of it.',
    practice: 'Start each morning this week by moving, even a ten-minute walk, with a cup of warm water and lemon. Then pick one drawer, one shelf or one corner of the house and clear it out. Your pattern tends to hold on to more than it needs, and letting go of something small is good practice.',
  },
  'drawn-bowstring': {
    axes: 'cold, dry and tense',
    tagline: 'You run cold, dry, and tight, depleted but unable to rest.',
    verse: 'Come to me, all you who are weary and burdened, and I will give you rest.',
    verseRef: 'Matthew 11:28',
    verseLine: 'Your pattern carries a burden it was never meant to carry alone. Learning to release the tension, the control and the worry is the way back.',
    practice: 'This week, protect your rest. Make a warm cup of tea at the same time each evening, keep the bedroom dark and quiet, and let go of one thing someone else could carry for you. Your pattern runs tight and tired at the same time, and rest has to be made easy before it will come.',
    practiceVerse: { text: 'He gives strength to the weary and increases the power of the weak.', ref: 'Isaiah 40:29' },
  },
  'spent-candle': {
    axes: 'cold, dry and relaxed',
    tagline: 'You have burned to the wick: cold, dry, and too exhausted to hold yourself together.',
    verse: 'He makes me lie down in green pastures, He leads me beside quiet waters, He restores my soul.',
    verseRef: 'Psalm 23:2-3',
    verseLine: 'Your pattern does not need to be pushed harder. It needs to be re-lit, gently and slowly, with steady nourishment and rest.',
    practice: 'This week, start every day with a warm breakfast, keep your walks short and easy, and rest when you need to without feeling guilty about it. When someone offers to help, say yes. Your pattern needs to be filled back up before anything else.',
  },
  'frozen-knot': {
    axes: 'cold, damp and tense',
    tagline: 'You run cold, hold water, and lock everything down.',
    verse: 'Forget the former things; do not dwell on the past. See, I am doing a new thing! Now it springs up; do you not perceive it?',
    verseRef: 'Isaiah 43:18-19',
    verseLine: 'Your pattern holds on to what was. Loosening that grip, on the past, on control, on the familiar, makes room for what God is doing now.',
    practice: 'Move first thing each morning this week, even a brisk ten-minute walk before the day starts. Trade cold drinks for warm ones. And pick one old thing to let go of, whether it is a box in the closet or something you have been holding on to for too long.',
  },
  'still-water': {
    axes: 'cold, damp and relaxed',
    tagline: 'You run deep and slow: calm, patient, and unmoved.',
    verse: 'Whatever you do, work heartily, as for the Lord.',
    verseRef: 'Colossians 3:23',
    verseLine: 'Your pattern is strong at enduring and slow to start. The call is to move, not out of restless worry but out of faithful obedience.',
    practice: 'Move every day this week, and try to do it in the morning: a brisk walk, time in the garden, dancing in the kitchen. Do not wait until you feel like it. Start, and the feeling usually follows. Your pattern is steady and patient, and it does best when something gets it moving early.',
  },
};

function patternFor(slug: string): PatternCopy {
  return PATTERNS[slug] ?? PATTERNS['frozen-knot'];
}

function shortName(constitutionName: string): string {
  return constitutionName.replace(/^The /i, '');
}

// ══════════════════════════════════════════════════════════════
// QUIZ EMAIL 1, at once: the result in Scripture-first words, then the guide.
// Replaces buildNurtureEmail1. Its three herb cards are gone: their one-line notes were
// health claims ("lowers blood pressure"), and the result page and the guide carry the herbs.
// ══════════════════════════════════════════════════════════════
export function buildQuizEmail1(firstName: string, constitutionName: string, slug: string): { subject: string; html: string } {
  const c = patternFor(slug);
  const name = escapeHtml(constitutionName);
  const body = `
${preheader(c.tagline)}
${hi(firstName)}
${p('Your result is in.')}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid ${BRAND.gold};background-color:${BRAND.bgOuter};">
<tr><td style="padding:24px;text-align:center;">
<p style="font-family:Georgia,serif;font-size:12px;font-weight:bold;letter-spacing:3px;color:${BRAND.gold};text-transform:uppercase;margin:0 0 8px 0;">YOUR PATTERN</p>
<p style="font-family:Georgia,serif;font-size:24px;font-weight:bold;color:${BRAND.forest};margin:0 0 10px 0;">${name}</p>
<p style="font-family:Georgia,serif;font-size:15px;color:${BRAND.text};font-style:italic;margin:0;">${c.tagline}</p>
</td></tr>
</table>
${p('&ldquo;I praise You, for I am fearfully and wonderfully made&rdquo; (Psalm 139:14). God did not make one body and copy it. He made yours on purpose, and the quiz is simply a way of noticing how.')}
${p(`Your answers lean <strong>${c.axes}</strong>. That is not a diagnosis, and it is not a label. It is the baseline your body keeps coming back to.`)}
${heading(`A verse for ${name}`)}
${quoteBlock(`&ldquo;${c.verse}&rdquo;`, c.verseRef)}
${p(c.verseLine)}
${p(link('See your full result anytime', `${SITE}/results/${slug}`))}
${goldDivider()}
${heading('Your next step')}
${p(`There is a Deep-Dive Guide written for each pattern. Yours goes through the ten herbs that suit ${name}, how to prepare each one and its safety notes, the herbs to be careful with, simple rhythms for food, movement and rest, and what Scripture says about the way you were made.`)}
${brandButton(`Get your ${escapeHtml(shortName(constitutionName))} guide: $4.99`, `${SITE}/go/deep-dive/${slug}`)}
${p('It comes to your inbox as a PDF the moment you check out.')}
${p('In two days I will send you one small thing to try for your pattern. Nothing to buy.')}
${signature()}`;
  return { subject: `Your result: ${constitutionName}`, html: emailWrapper(body, 'constitution') };
}

// ══════════════════════════════════════════════════════════════
// QUIZ EMAIL 2, day 2: one useful thing for their pattern, nothing to buy, then the
// children question. No shop card.
// ══════════════════════════════════════════════════════════════
export function buildQuizEmail2(firstName: string, constitutionName: string, slug: string, answers: ChildrenAnswerUrls): { subject: string; html: string } {
  const c = patternFor(slug);
  const verse = c.practiceVerse ? quoteBlock(`&ldquo;${c.practiceVerse.text}&rdquo;`, c.practiceVerse.ref) : '';
  const body = `
${preheader('Something small to try this week. Nothing to buy.')}
${hi(firstName)}
${p(`Two days ago you found out your pattern is <strong>${escapeHtml(constitutionName)}</strong>. Here is one small thing to try this week. Nothing to buy.`)}
${heading('For this week')}
${p(c.practice)}
${verse}
${childrenQuestion(answers)}
${signature()}`;
  return { subject: 'One small thing to try this week', html: emailWrapper(body, 'constitution', { shopCard: false }) };
}

// Chapter 8 of Back to Eden, page 133 of the published edition, verbatim.
const PASSAGE_CH8 = 'God did not create one type of human and replicate it. He created a diversity of persons, each bearing His image in a distinct way, each knit together in a mother&rsquo;s womb with particularity and intention. The psalmist does not say God roughly assembled us, or that we were made in approximate proximity to His purposes. The Hebrew is explicit: fearfully and wonderfully made. Each one. Specifically.';

export const EDITIONS = 'It comes three ways, in print or as an instant download: the paperback, the spiral Study &amp; Journal Edition with room to write beside every page, and the Study Guide that sits next to the paperback.';

// ══════════════════════════════════════════════════════════════
// QUIZ EMAIL 3, day 4: a Back to Eden passage, then the book (and the guide, unless owned).
// ══════════════════════════════════════════════════════════════
export function buildQuizEmail3(firstName: string, constitutionName: string, slug: string, ownsGuide: boolean): { subject: string; html: string } {
  const guideLine = ownsGuide
    ? ''
    : p(`Or, if you would rather start with your own pattern, your ${link(`${escapeHtml(shortName(constitutionName))} Deep-Dive Guide`, `${SITE}/go/deep-dive/${slug}`)} is still here for $4.99.`);
  const body = `
${preheader('A short passage from Back to Eden, the book behind your quiz.')}
${hi(firstName)}
${p('Your quiz comes from Chapter 8 of my book, <em>Back to Eden</em>. Here is a short piece of it.')}
${quoteBlock(PASSAGE_CH8, '<em>Back to Eden</em>, Chapter 8')}
${p('That is the heart of the whole book. It starts with who made the body and why, and only then gets to the plants: why symptoms are signals, the five tenets of health and why they come before any herb, and how to read a person before reaching for any remedy.')}
${p(EDITIONS)}
${brandButton('See the book', `${SITE}/back-to-eden`)}
${guideLine}
${signature()}`;
  return { subject: 'A Creator who does not make copies', html: emailWrapper(body, 'constitution') };
}

// ══════════════════════════════════════════════════════════════
// EMAIL 4, day 6, parents only (both tracks): Eden's Table and the free week.
// Sent only to someone who tapped Yes on the day-2 question.
// ══════════════════════════════════════════════════════════════
/** The approved Email 4 paragraphs after its opening line (Eden's Table, the two years, the free
 *  week, where to start). Shared with the Deep-Dive Guide track's parents email. */
export function edensTableForParents(): string {
  return `${p('<strong>Eden&rsquo;s Table</strong> is our homeschool curriculum. It teaches children the bodies God designed and the plants He gave to tend them, one plant a week, woven through Scripture, science and the rhythms of your own kitchen table. Each week has a story, a kitchen lab and questions for the dinner table, all on the page.')}
${p('Two years are ready now: <strong>Sprouts</strong> for kindergarten through second grade, and <strong>Seedlings</strong> for grades 3 to 5. Week 1 of each is free, a whole real week, ready to print tonight.')}
${brandButton('Get a free week', `${SITE}/freebies`)}
${p(`Not sure where to start? Children in kindergarten through second grade start with Sprouts. Children in grades 3 to 5 who are new to herbs start with Sprouts too, because its plants are the ones Seedlings builds on. Older children start there as well, since the later years build on these same plants. ${link('Here is more on where to start', `${SITE}/homeschool#choose-band`)}.`)}
`;
}

export function buildParentsEmail(firstName: string, track: 'quiz' | 'chapter'): { subject: string; html: string } {
  const body = `
${preheader('One plant a week, Scripture first. Week 1 is free.')}
${hi(firstName)}
${p('You tapped Yes when I asked if you have children at home, so this one is for them.')}
${edensTableForParents()}${signature()}`;
  return {
    subject: "For your children: a free week of Eden's Table",
    html: emailWrapper(body, track === 'quiz' ? 'constitution' : 'back_to_eden'),
  };
}

// ══════════════════════════════════════════════════════════════
// CHAPTER EMAIL 2, day 2: the one idea of Chapter 1, something to try, the children
// question. No shop card.
// ══════════════════════════════════════════════════════════════
// Chapter 1, page 19 of the published edition, verbatim.
const PASSAGE_CH1 = 'The intelligence within your body has a name. The One who designed your physiology has not abandoned it.';

export function buildChapterEmail2(firstName: string, answers: ChildrenAnswerUrls): { subject: string; html: string } {
  const body = `
${preheader('One sentence from Chapter 1, and something to try this week.')}
${hi(firstName)}
${p('Chapter 1 covers a lot of ground, but it all comes back to one line:')}
${quoteBlock(PASSAGE_CH1, '<em>Back to Eden</em>, Chapter 1')}
${p('People have noticed for thousands of years that the body works with order and purpose. Where many of them went wrong was in naming the source: energy, the universe, an unnamed force. Scripture names Him. &ldquo;In Him all things hold together&rdquo; (Colossians 1:17).')}
${heading('Something to try this week')}
${p('The next time your body tells you something (a headache, a short night, a tired afternoon), stop before you reach for anything and ask what it might be saying. It is the first question at the end of Chapter 1, and the rest of the book is built on it.')}
${childrenQuestion(answers)}
${signature()}`;
  return { subject: 'One line from Chapter 1', html: emailWrapper(body, 'back_to_eden', { shopCard: false }) };
}

// Chapter 5 of Back to Eden, page 64 of the published edition, verbatim.
const PASSAGE_CH5 = 'The shift from &ldquo;How do I stop this?&rdquo; to &ldquo;What is my body attempting to accomplish?&rdquo; marks the beginning of stewardship. This does not eliminate the need for intervention. There are moments when external support is necessary, even lifesaving. But the starting assumption changes. The body is not primarily an adversary; it is an ally responding to circumstances. And an ally, when they raise a concern, deserves to be heard.';

// ══════════════════════════════════════════════════════════════
// CHAPTER EMAIL 3, day 4: symptoms are signals, a passage, the editions.
// ══════════════════════════════════════════════════════════════
export function buildChapterEmail3(firstName: string): { subject: string; html: string } {
  const body = `
${preheader('A short passage from Chapter 5 of Back to Eden.')}
${hi(firstName)}
${p('Chapter 5 of <em>Back to Eden</em> is called Symptoms Are Signals. It starts in Romans 8, with creation groaning, and asks what the body is doing when it hurts. Here is a short piece of it:')}
${quoteBlock(PASSAGE_CH5, '<em>Back to Eden</em>, Chapter 5')}
${p('That is the kind of book it is. It does not hand you a list of remedies. It gives you the foundation underneath them, starting with Scripture, so the plants begin to make sense on their own.')}
${p(EDITIONS + ' If you want to study it and write as you go, choose the Study &amp; Journal Edition. If you just want to read, the paperback is all you need.')}
${brandButton('See the three editions', `${SITE}/back-to-eden#editions`)}
${signature()}`;
  return { subject: 'Symptoms are signals', html: emailWrapper(body, 'back_to_eden') };
}

// ══════════════════════════════════════════════════════════════
// REFUND NOTE, 3 days after a full refund: one plain question, nothing to buy.
// Not transactional, so it carries the postpurchase unsubscribe link.
// ══════════════════════════════════════════════════════════════
// No product name: real order labels ("Sprouts Complete Kit + 2 x Sprouts Student Notebook")
// read badly mid-sentence, and the refund email three days earlier already named the order.
export function buildRefundNote(firstName: string): { subject: string; html: string } {
  const body = `
${preheader('Just hit reply. A sentence is plenty.')}
${hi(firstName)}
${p('Your refund went through a few days ago. Can I ask you one thing?')}
${p('What didn&rsquo;t fit? Just hit reply. A sentence is plenty.')}
${p('Whatever it was, the price, the timing, the material itself or something we got wrong, it helps me make this better for the next family.')}
${signature()}`;
  return { subject: "Can I ask what didn't fit?", html: emailWrapper(body, 'order', { shopCard: false }) };
}
