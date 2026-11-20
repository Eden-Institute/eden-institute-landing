// supabase/functions/_shared/free-week-lessons.ts
//
// Free-week daily lesson emails (founder-approved 2026-11-19 22:47 CT).
//
// A free-week sign-up gets one short email a day on Days 2 to 6, each handing that
// day's Week 1 lesson with ONE button to the band's Week 1 page:
//   Day 2 = Lesson 1, Day 3 = Lesson 2, ... Day 6 = Lesson 5.
// Day 1 is the next-morning note (magnet position 1, _shared/next-morning.ts).
//
// Queue positions (public.magnet_email_queue.sequence_position): 11-15 = Lessons 1-5.
// Why 11-15 and not the free-looking numbers:
//   - 1, 2 and 8 are live (next-morning note, Day 7 check-in, Day 10 Starter note).
//   - 3-7 are the DORMANT Week 3-7 builders. MAGNET_CHAIN_NEXT {3:4,4:5,5:6,6:7} in
//     nurture-emails would chain the old Week 4-7 tail off any of them, and positions
//     3-7 are deduped as band-agnostic. Reusing them would wake that machinery.
//   - 9 and 10 would sit between the live 8 and the lessons and invite the next
//     builder to "fill the gap"; 11-15 reads as its own block (10 + lesson number).
//   - The table has no CHECK constraint on sequence_position (migration
//     20260603040000_magnet_email_queue.sql), so no migration is needed. 13-17 mean
//     something else only in public.launch_email_queue, a different table.
//
// Send time: lesson k goes at 8:00 AM Central on the k-th Central calendar day after
// the next-morning note's day (centralWallTimeToUtc, so daylight saving is exact).
// Both-band families: the second band's copy of each lesson goes 2 days after the
// first band's, the same send-time rule positions 1, 2 and 8 get (nurture-emails).
// Families who already own the band still get these: they are free lessons, not a
// sale, so the Day 10 owner skip (position 8) does not apply.
//
// Look: the plain note shell of the next-morning note (buildFreeWeekNextMorningEmail in
// nurture-emails): Arial body, signed "Camila", same footer and {{UNSUB_URL}}, plus one
// forest-and-gold button. The button URL is hand-tagged, so tagEmailHtml leaves it as
// written. Copy is verbatim from the founder's approval; no em dashes.

import { centralParts, centralWallTimeToUtc, NEXT_MORNING_HOUR_CENTRAL, nextMorningSendAt } from './next-morning.ts';

export type FreeWeekBand = 'sprouts' | 'seedlings';
export type LessonNumber = 1 | 2 | 3 | 4 | 5;

export const FREE_WEEK_LESSON_NUMBERS: readonly LessonNumber[] = [1, 2, 3, 4, 5];
export const FREE_WEEK_LESSON_POSITION_OFFSET = 10;
/** magnet_email_queue positions 11-15 = Lessons 1-5. */
export const FREE_WEEK_LESSON_POSITIONS: readonly number[] = FREE_WEEK_LESSON_NUMBERS.map((k) => k + FREE_WEEK_LESSON_POSITION_OFFSET);

/**
 * Band-specific free-week steps a both-band family gets once per band, with the second
 * band's copy held to BAND_SPACING_MS after the first band's sent_at (nurture-emails,
 * at send time): the next-morning note (1), Day 7 check-in (2), Day 10 Starter note (8)
 * and the five lessons (11-15).
 */
export const FREE_WEEK_BAND_SPACED_POSITIONS: ReadonlySet<number> = new Set<number>([1, 2, 8, ...FREE_WEEK_LESSON_POSITIONS]);
export const BAND_SPACING_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * PostgREST `order` for the magnet drain (nurture-emails drainMagnetQueue). A both-band
 * family's two copies of a lesson share one scheduled_for, and the spacing rule sends
 * whichever copy the drain reads FIRST and holds the other 2 days. With only
 * `scheduled_for.asc`, Postgres may return those ties in either order, and a flip between
 * two days sends the second band's lessons out of order (e.g. Lesson 3 before Lesson 1, or
 * two lessons on one morning). A fixed tie-break makes the same band go first every day.
 * `band.desc` = Sprouts first, which matches the order the drain has used so far (rows are
 * created Sprouts first), so switching to it mid-week changes nothing for families already
 * part-way through. Area 6 audit, 2026-11-20.
 */
export const MAGNET_DRAIN_ORDER = 'scheduled_for.asc,band.desc,id.asc';

export function lessonPosition(k: LessonNumber): number {
  return k + FREE_WEEK_LESSON_POSITION_OFFSET;
}

/** The lesson number (1-5) a queue position carries, or null if it is not a lesson. */
export function lessonNumberForPosition(pos: number): LessonNumber | null {
  const k = pos - FREE_WEEK_LESSON_POSITION_OFFSET;
  return (FREE_WEEK_LESSON_NUMBERS as readonly number[]).includes(k) ? (k as LessonNumber) : null;
}

export function isFreeWeekLessonPosition(pos: number): boolean {
  return lessonNumberForPosition(pos) !== null;
}

/** Engagement email_key (Resend tag; dashboard label in EmailEngagementTab). */
export function freeWeekLessonEmailKey(band: FreeWeekBand, k: LessonNumber): string {
  return `magnet_lesson_${k}_${band}`;
}

/** The one button's URL, as a raw URL (an href writes each & as &amp;). */
export function freeWeekLessonUrl(band: FreeWeekBand, k: LessonNumber): string {
  return `https://edeninstitute.health/freebies/${band}-week-1?utm_source=email&utm_medium=nurture&utm_campaign=free_week_1&utm_content=lesson_${k}`;
}

/** Lesson k's send time: 8 AM Central, k Central days after the next-morning note's day. */
export function freeWeekLessonSendAt(nextMorningMs: number, k: LessonNumber): number {
  const { y, m, d } = centralParts(nextMorningMs);
  return centralWallTimeToUtc(y, m, d + k, NEXT_MORNING_HOUR_CENTRAL);
}

/** Positions and send times of all five lessons for a sign-up at `signupMs`. */
export function freeWeekLessonSchedule(signupMs: number): { sequence_position: number; at: number }[] {
  const nextMorning = nextMorningSendAt(signupMs);
  return FREE_WEEK_LESSON_NUMBERS.map((k) => ({ sequence_position: lessonPosition(k), at: freeWeekLessonSendAt(nextMorning, k) }));
}

// ps: an optional P.S. after the signature with ONE link (added 2026-11-20, Lesson 5 only, founder pick "Do it" on
// Lane SEO review page FetkLKB83dGn6hyxaEAA7e: Lesson 5 lands the day a family finishes Week 1, and 0 of 67 Week 1 page
// visitors in 30 days clicked the Starter link there). `before` is the text, `linkText` the visible link.
type LessonPs = { before: string; linkText: string; href: string };
type LessonCopy = { subject: string; button: string; paragraphs: string[]; ps?: LessonPs };

/** The Lesson 5 P.S. link: that band's Starter page, hand-tagged so tagEmailHtml leaves it as written. */
export function freeWeekLessonPsUrl(band: FreeWeekBand): string {
  const path = band === 'sprouts' ? '/starter' : '/starter/seedlings';
  return `https://edeninstitute.health${path}?utm_source=email&utm_medium=nurture&utm_campaign=free_week_1&utm_content=lesson_5_ps`;
}

// Verbatim from the founder's approval (2026-11-19). The greeting is added at render.
export const FREE_WEEK_LESSON_COPY: Record<FreeWeekBand, Record<LessonNumber, LessonCopy>> = {
  sprouts: {
    1: {
      subject: 'Lesson 1: meet the Eden family',
      button: 'Open Lesson 1',
      paragraphs: [
        'Today is the easy one. Curl up together and read Meet the Family out loud. Your kids meet Vovó and PopPop on their Tennessee homestead, plus Levi, Ruthie, Manny, Evie, Gracie and Bear the dog.',
        'Then pass around a little dried lavender and just smell it. That\'s the whole lesson. Page 2 of the guide has three questions for after. My favorite is "Which of the Eden family would you most like to meet?"',
        'Our verse this week is Psalm 139:14. Say it together three times.',
      ],
    },
    2: {
      subject: 'Lesson 2: a lavender detective day',
      button: 'Open Lesson 2',
      paragraphs: [
        'Today your kids get to be scientists. Hand them a few dried lavender buds and let them roll one between their fingers, look close at the purple flowers and gray-green leaves, and tell you what each sense notices.',
        'Then they draw a lavender spike in the notebook and label the flowers and the stem. Ask them, "What does your nose notice first?" Page 3 of the guide walks you through it.',
      ],
    },
    3: {
      subject: 'Lesson 3: your first Kitchen Lab',
      button: 'Open Lesson 3',
      paragraphs: [
        'Today you make lavender tea together. One teaspoon of dried buds in a mug, eight ounces of hot water, cover it and count five minutes together. Strain it, add honey if you like, and let it cool before anyone sips. You pour, they measure.',
        'Then spoon a few buds onto a little cloth square and tie it into a sachet. Your kids write down the color, smell and taste in the notebook. Page 4 has the whole recipe and the safety notes.',
      ],
    },
    4: {
      subject: 'Lesson 4: lavender in ancient Rome',
      button: 'Open Lesson 4',
      paragraphs: [
        'Did you know the Romans tucked lavender into their baths and their laundry? Its name is said to come from the Latin word lavare, to wash.',
        'Today your kids find Italy and the Mediterranean on a map, then draw three tall lavender stems with Roman arches behind them and call it Lavender in Rome. Page 5 has the story to read them first.',
      ],
    },
    5: {
      subject: 'Lesson 5: you are alive!',
      button: 'Open Lesson 5',
      paragraphs: [
        'Last lesson of the week. Head outside, or to a windowsill plant, and find three living things. A leaf, a bug, a worm. Have your kids tell each one out loud, "You are alive!"',
        'Then sit down together, talk through the week with the review questions on page 6, and say Psalm 139:14 one more time. Next up in the curriculum is chamomile.',
      ],
      ps: {
        before: "P.S. If your kids are asking what's next, Weeks 1 through 9 are $39 as an instant download, and chamomile is ready for Monday: ",
        linkText: 'edeninstitute.health/starter',
        href: freeWeekLessonPsUrl('sprouts'),
      },
    },
  },
  seedlings: {
    1: {
      subject: 'Lesson 1: Psalm 100 and the first clue',
      button: 'Open Lesson 1',
      paragraphs: [
        'Seedlings starts in the Word. Open your Bible to Psalm 100 and read all five verses out loud together. Then meet elderberry, the first of thirty-six clues to how God designed us.',
        'Page 2 of the guide has three questions to talk through, and your kids write their answers in the garden journal. If you have a little one tagging along, let them paint elderberry purple.',
        'Our memory verse this week is Psalm 100:3.',
      ],
    },
    2: {
      subject: 'Lesson 2: a close look at elder',
      button: 'Open Lesson 2',
      paragraphs: [
        'Today is a discovery day. Your kids look closely at elder: the flat, lacy cream flower clusters and the dark berries that stain everything purple. Then they draw both in the notebook, color the berries and label them.',
        'No fresh elder? Look closely at the dried berries from Lesson 3\'s supply list.',
        'One rule we repeat every time: we never taste raw berries. Page 3 walks you through it.',
      ],
    },
    3: {
      subject: 'Lesson 3: elderberry syrup in the Kitchen Lab',
      button: 'Open Lesson 3',
      paragraphs: [
        'This is the one they\'ll remember. With you at the stove: one cup of dried elderberries and four cups of water. Bring it to a boil, then let it simmer about 45 minutes until it cooks down by half.',
        'Strain it, pressing out every drop, stir in a cup of honey once it\'s warm (not hot), and jar it with today\'s date on the label. It rests in the fridge and opens in Week 2.',
        'Page 4 has the full recipe and the safety notes, including no honey for babies under one.',
      ],
    },
    4: {
      subject: 'Lesson 4: a whole book about one shrub',
      button: 'Open Lesson 4',
      paragraphs: [
        'Back in the 1600s, a doctor wrote an entire book about the elder. A whole book about one shrub!',
        'Today your kids find Europe and the British Isles on a map, then draw a big decorated capital E filled with elder leaves, flowers and berries, with "A remedy from every hedge" lettered underneath. Page 5 has the story.',
      ],
    },
    5: {
      subject: 'Lesson 5: the living soil',
      button: 'Open Lesson 5',
      paragraphs: [
        'Last lesson of the week, and old clothes help. Spread a scoop of garden soil on white paper and count every living thing you find. Then water a bare patch and a mulched patch and see which one holds the water.',
        'Talk through the week with the review on page 6 and say Psalm 100:3 together. Next up in the curriculum is tulsi.',
      ],
      ps: {
        before: "P.S. If your kids are asking what's next, Weeks 1 through 9 are $39 as an instant download, and tulsi is ready for Monday: ",
        linkText: 'edeninstitute.health/starter/seedlings',
        href: freeWeekLessonPsUrl('seedlings'),
      },
    },
  },
};

const BRAND = { forest: '#2C3E2D', gold: '#C5A44E' };

const escapeText = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * "Hi Camila," or "Hi there," when there is no real first name. Same first-name
 * handling as the next-morning note: trimmed, HTML-escaped, and the queue's 'Friend'
 * fallback (resend-waitlist) counts as no name.
 */
export function freeWeekLessonGreeting(rawFirstName: string | null): string {
  const name = String(rawFirstName ?? '').trim()
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return name && name.toLowerCase() !== 'friend' ? `Hi ${name},` : 'Hi there,';
}

export function buildFreeWeekLessonEmail(
  rawFirstName: string | null,
  band: FreeWeekBand,
  k: LessonNumber,
): { subject: string; html: string } {
  const copy = FREE_WEEK_LESSON_COPY[band][k];
  const para = (t: string) =>
    `<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#222222;margin:0 0 14px 0;">${t}</p>`;
  const small = (t: string) =>
    `<p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:#888888;margin:0 0 4px 0;">${t}</p>`;
  const href = freeWeekLessonUrl(band, k).replace(/&/g, '&amp;');
  const button = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 20px 0;">
<tr><td align="center" style="background-color:${BRAND.forest};border-radius:8px;">
<a href="${href}" target="_blank" style="display:inline-block;background-color:${BRAND.forest};color:${BRAND.gold};font-family:Georgia,serif;font-size:16px;font-weight:bold;text-decoration:none;text-align:center;padding:14px 40px;border-radius:8px;line-height:24px;mso-line-height-rule:exactly;">${escapeText(copy.button)}</a>
</td></tr>
</table>`;
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:16px;background-color:#ffffff;">
<div style="max-width:560px;">
${para(freeWeekLessonGreeting(rawFirstName))}
${copy.paragraphs.map((p) => para(escapeText(p))).join('\n')}
${button}
${para('Camila')}
${copy.ps ? para(`${escapeText(copy.ps.before)}<a href="${copy.ps.href.replace(/&/g, '&amp;')}" target="_blank" style="color:${BRAND.forest};text-decoration:underline;">${escapeText(copy.ps.linkText)}</a>`) : ''}
<div style="border-top:1px solid #eeeeee;margin:28px 0 12px 0;"></div>
${small('You&rsquo;re receiving this because you requested a free week of Eden&rsquo;s Table from The Eden Institute.')}
${small('Rooted in Faith Ventures LLC &middot; 303 Holly Cir, Unit 3262, Clarksville, TN 37043')}
${small('<a href="{{UNSUB_URL}}" style="color:#888888;text-decoration:underline;">Unsubscribe</a>')}
</div>
</body></html>`;
  return { subject: copy.subject, html };
}

/**
 * The dispatcher's view of a magnet queue position: the built lesson email and its
 * email_key for positions 11-15, or null for any other position (nurture-emails then
 * falls through to its other branches and, for an unknown position, marks it failed).
 */
export function buildFreeWeekLessonForPosition(
  pos: number,
  rawFirstName: string | null,
  band: FreeWeekBand,
): { subject: string; html: string; emailKey: string } | null {
  const k = lessonNumberForPosition(pos);
  if (k === null) return null;
  return { ...buildFreeWeekLessonEmail(rawFirstName, band, k), emailKey: freeWeekLessonEmailKey(band, k) };
}
