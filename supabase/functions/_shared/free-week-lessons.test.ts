// Tests for _shared/free-week-lessons.ts (free-week daily Lessons 1-5, founder-approved
// 2026-11-19): copy, button URL, send times across both daylight-saving changes, the
// both-band spacing set, and the nurture-emails / resend-waitlist wiring.
import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  BAND_SPACING_MS,
  buildFreeWeekLessonEmail,
  buildFreeWeekLessonForPosition,
  FREE_WEEK_BAND_SPACED_POSITIONS,
  FREE_WEEK_LESSON_COPY,
  FREE_WEEK_LESSON_NUMBERS,
  FREE_WEEK_LESSON_POSITIONS,
  freeWeekLessonEmailKey,
  freeWeekLessonGreeting,
  freeWeekLessonSchedule,
  freeWeekLessonSendAt,
  freeWeekLessonUrl,
  type FreeWeekBand,
  isFreeWeekLessonPosition,
  lessonNumberForPosition,
  type LessonNumber,
} from './free-week-lessons.ts';
import { centralParts, nextMorningSendAt } from './next-morning.ts';

const BANDS: FreeWeekBand[] = ['sprouts', 'seedlings'];
const iso = (ms: number) => new Date(ms).toISOString();
const DAY = 24 * 60 * 60 * 1000;

const EXPECTED: Record<FreeWeekBand, Record<LessonNumber, string>> = {
  sprouts: {
    1: 'Lesson 1: meet the Eden family',
    2: 'Lesson 2: a lavender detective day',
    3: 'Lesson 3: your first Kitchen Lab',
    4: 'Lesson 4: lavender in ancient Rome',
    5: 'Lesson 5: you are alive!',
  },
  seedlings: {
    1: 'Lesson 1: Psalm 100 and the first clue',
    2: 'Lesson 2: a close look at elder',
    3: 'Lesson 3: elderberry syrup in the Kitchen Lab',
    4: 'Lesson 4: a whole book about one shrub',
    5: 'Lesson 5: the living soil',
  },
};

Deno.test('positions 11-15 carry Lessons 1-5 and never touch the dormant 3-7 chain', () => {
  assertEquals([...FREE_WEEK_LESSON_POSITIONS], [11, 12, 13, 14, 15]);
  for (const k of FREE_WEEK_LESSON_NUMBERS) assertEquals(lessonNumberForPosition(10 + k), k);
  for (const pos of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 16, 17, 21]) {
    assertEquals(isFreeWeekLessonPosition(pos), false, `position ${pos}`);
    assertEquals(buildFreeWeekLessonForPosition(pos, 'Camila', 'sprouts'), null);
  }
});

Deno.test('every subject, button and URL per band and lesson', () => {
  for (const band of BANDS) {
    for (const k of FREE_WEEK_LESSON_NUMBERS) {
      const { subject, html } = buildFreeWeekLessonEmail('Camila', band, k);
      assertEquals(subject, EXPECTED[band][k]);
      const url = `https://edeninstitute.health/freebies/${band}-week-1?utm_source=email&utm_medium=nurture&utm_campaign=free_week_1&utm_content=lesson_${k}`;
      assertEquals(freeWeekLessonUrl(band, k), url);
      // Exactly one button link (plus the footer unsubscribe link), with the exact URL.
      const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
      assertEquals(hrefs, [url, '{{UNSUB_URL}}']);
      assertStringIncludes(html, `>Open Lesson ${k}</a>`);
      assertEquals(FREE_WEEK_LESSON_COPY[band][k].button, `Open Lesson ${k}`);
      assertStringIncludes(html, '<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#222222;margin:0 0 14px 0;">Hi Camila,</p>');
      // Order: greeting, paragraphs, button, then the signature.
      const iGreet = html.indexOf('Hi Camila,');
      const iLastPara = html.indexOf(FREE_WEEK_LESSON_COPY[band][k].paragraphs.at(-1)!.slice(0, 30));
      const iButton = html.indexOf(`>Open Lesson ${k}</a>`);
      const iSign = html.indexOf('>Camila</p>');
      assert(iGreet < iLastPara && iLastPara < iButton && iButton < iSign, `${band} ${k} order`);
      assertStringIncludes(html, '303 Holly Cir, Unit 3262, Clarksville, TN 37043');
      assertEquals(freeWeekLessonEmailKey(band, k), `magnet_lesson_${k}_${band}`);
      const viaPos = buildFreeWeekLessonForPosition(10 + k, 'Camila', band);
      assert(viaPos);
      assertEquals(viaPos.subject, subject);
      assertEquals(viaPos.html, html);
      assertEquals(viaPos.emailKey, `magnet_lesson_${k}_${band}`);
    }
  }
});

Deno.test('copy spot checks render verbatim', () => {
  const s1 = buildFreeWeekLessonEmail('Camila', 'sprouts', 1).html;
  assertStringIncludes(s1, 'Your kids meet Vovó and PopPop on their Tennessee homestead, plus Levi, Ruthie, Manny, Evie, Gracie and Bear the dog.');
  assertStringIncludes(s1, 'My favorite is "Which of the Eden family would you most like to meet?"');
  assertStringIncludes(s1, 'Our verse this week is Psalm 139:14. Say it together three times.');
  const d3 = buildFreeWeekLessonEmail('Camila', 'seedlings', 3).html;
  assertStringIncludes(d3, 'stir in a cup of honey once it\'s warm (not hot), and jar it with today\'s date on the label.');
  assertStringIncludes(d3, 'including no honey for babies under one.');
  const d2 = buildFreeWeekLessonEmail('Camila', 'seedlings', 2).html;
  assertStringIncludes(d2, 'One rule we repeat every time: we never taste raw berries. Page 3 walks you through it.');
  assertEquals(FREE_WEEK_LESSON_COPY.sprouts[1].paragraphs.length, 3);
  assertEquals(FREE_WEEK_LESSON_COPY.seedlings[3].paragraphs.length, 3);
  assertEquals(FREE_WEEK_LESSON_COPY.sprouts[5].paragraphs.length, 2);
});

Deno.test('no em dash (U+2014) anywhere, in any band, lesson or fallback greeting', () => {
  for (const band of BANDS) {
    for (const k of FREE_WEEK_LESSON_NUMBERS) {
      for (const name of ['Camila', null, 'Friend']) {
        const { subject, html } = buildFreeWeekLessonEmail(name, band, k);
        assert(!subject.includes('—'), `${band} ${k} subject`);
        assert(!html.includes('—') && !html.includes('&mdash;'), `${band} ${k} html`);
      }
    }
  }
});

Deno.test('first name: same handling as the next-morning note, comma greeting', () => {
  assertEquals(freeWeekLessonGreeting('Camila'), 'Hi Camila,');
  assertEquals(freeWeekLessonGreeting('  Ana  '), 'Hi Ana,');
  assertEquals(freeWeekLessonGreeting(null), 'Hi there,');
  assertEquals(freeWeekLessonGreeting(''), 'Hi there,');
  assertEquals(freeWeekLessonGreeting('Friend'), 'Hi there,');
  assertEquals(freeWeekLessonGreeting('friend'), 'Hi there,');
  assertEquals(freeWeekLessonGreeting('A&B <x>'), 'Hi A&amp;B &lt;x&gt;,');
});

Deno.test('lesson k sends at 8 AM Central, k Central days after the next-morning note', () => {
  // Evening sign-up Tue Nov 24 2026, 7 PM CST: note Wed Nov 25, lessons Thu Nov 26 to Mon Nov 30.
  const signup = Date.parse('2026-11-25T01:00:00Z');
  const sched = freeWeekLessonSchedule(signup);
  assertEquals(iso(nextMorningSendAt(signup)), '2026-11-25T14:00:00.000Z');
  assertEquals(sched.map((r) => r.sequence_position), [11, 12, 13, 14, 15]);
  assertEquals(sched.map((r) => iso(r.at)), [
    '2026-11-26T14:00:00.000Z',
    '2026-11-27T14:00:00.000Z',
    '2026-11-28T14:00:00.000Z',
    '2026-11-29T14:00:00.000Z',
    '2026-11-30T14:00:00.000Z',
  ]);
});

Deno.test('send times stay at 8 AM Central across the spring change (Mar 14 2027)', () => {
  // Wed Mar 10 2027, 8 PM CST: note Thu Mar 11 (CST). Lesson 3 lands on Sun Mar 14, the
  // day clocks spring forward, so 8 AM Central becomes 13:00Z from there on.
  const sched = freeWeekLessonSchedule(Date.parse('2027-03-11T02:00:00Z'));
  assertEquals(sched.map((r) => iso(r.at)), [
    '2027-03-12T14:00:00.000Z',
    '2027-03-13T14:00:00.000Z',
    '2027-03-14T13:00:00.000Z',
    '2027-03-15T13:00:00.000Z',
    '2027-03-16T13:00:00.000Z',
  ]);
  for (const r of sched) {
    const p = centralParts(r.at);
    assertEquals([p.h, p.min], [8, 0]);
  }
});

Deno.test('send times stay at 8 AM Central across the fall change (Nov 7 2027)', () => {
  // Wed Nov 3 2027, 8 PM CDT: note Thu Nov 4 (CDT). Lesson 3 lands on Sun Nov 7, the
  // day clocks fall back, so 8 AM Central becomes 14:00Z from there on.
  const sched = freeWeekLessonSchedule(Date.parse('2027-11-04T01:00:00Z'));
  assertEquals(sched.map((r) => iso(r.at)), [
    '2027-11-05T13:00:00.000Z',
    '2027-11-06T13:00:00.000Z',
    '2027-11-07T14:00:00.000Z',
    '2027-11-08T14:00:00.000Z',
    '2027-11-09T14:00:00.000Z',
  ]);
  for (const r of sched) {
    const p = centralParts(r.at);
    assertEquals([p.h, p.min], [8, 0]);
  }
});

Deno.test('freeWeekLessonSendAt from a next-morning time rolls over the month end', () => {
  assertEquals(iso(freeWeekLessonSendAt(Date.parse('2026-12-29T14:00:00Z'), 5)), '2027-01-03T14:00:00.000Z');
});

Deno.test('both-band spacing: 1, 2, 8 and every lesson are spaced; dormant 3-7 are not', () => {
  for (const pos of [1, 2, 8, 11, 12, 13, 14, 15]) assert(FREE_WEEK_BAND_SPACED_POSITIONS.has(pos), `position ${pos}`);
  for (const pos of [3, 4, 5, 6, 7, 9, 10, 16]) assert(!FREE_WEEK_BAND_SPACED_POSITIONS.has(pos), `position ${pos}`);
  assertEquals(BAND_SPACING_MS, 2 * DAY);

  // Simulate the send-time rule (nurture-emails drainMagnetQueue) for a family who took
  // Sprouts and Seedlings in the same minute: each Seedlings lesson waits until 2 days
  // after the Sprouts copy went, so they never land on the same morning.
  const sched = freeWeekLessonSchedule(Date.parse('2026-11-25T01:00:00Z'));
  for (const { sequence_position, at } of sched) {
    assert(FREE_WEEK_BAND_SPACED_POSITIONS.has(sequence_position));
    const sproutsSentAt = at; // first band goes on time
    const seedlingsDue = at; // same scheduled_for
    const recentSibling = seedlingsDue - sproutsSentAt < BAND_SPACING_MS;
    const seedlingsAt = recentSibling ? sproutsSentAt + BAND_SPACING_MS : seedlingsDue;
    assertEquals(seedlingsAt - sproutsSentAt, 2 * DAY);
    assertEquals(centralParts(seedlingsAt).h, 8);
  }
});

Deno.test('nurture-emails dispatches 11-15 before the unknown-position branch and spaces them', async () => {
  const src = (await Deno.readTextFile(new URL('../nurture-emails/index.ts', import.meta.url))).replace(/\r\n/g, '\n');
  assertStringIncludes(src, "from '../_shared/free-week-lessons.ts'");
  assertStringIncludes(src, 'const BAND_SPACED_POSITIONS = FREE_WEEK_BAND_SPACED_POSITIONS;');
  const start = src.indexOf('async function drainMagnetQueue(');
  const end = src.indexOf('\n}\n', start);
  const drain = src.slice(start, end);
  const iLesson = drain.indexOf('buildFreeWeekLessonForPosition(pos, row.first_name, band)');
  const iUnknown = drain.indexOf('Unknown sequence_position');
  assert(iLesson > 0, 'lesson dispatch present in drainMagnetQueue');
  assert(iUnknown > iLesson, 'lesson dispatch comes before the unknown-position failure');
  // Lessons go to owners too: the ownsBand skip stays inside the position-8 branch only.
  assertEquals(drain.match(/ownsBand\(/g)?.length, 1);
  // The dormant chain is untouched.
  assertStringIncludes(src, 'const MAGNET_CHAIN_NEXT: Record<number, number> = { 3: 4, 4: 5, 5: 6, 6: 7 };');
});

Deno.test('resend-waitlist enqueues positions 1, 11-15, 2 and 8 for a free-week sign-up', async () => {
  const src = (await Deno.readTextFile(new URL('../resend-waitlist/index.ts', import.meta.url))).replace(/\r\n/g, '\n');
  assertStringIncludes(src, "from '../_shared/free-week-lessons.ts'");
  assertStringIncludes(src, 'sequence_position: lessonPosition(k)');
  assertStringIncludes(src, 'scheduled_for: new Date(freeWeekLessonSendAt(nextMorningMs, k)).toISOString()');
  assertStringIncludes(src, '...lessonRows,');
  const block = src.slice(src.indexOf('const lessonRows = '), src.indexOf('magnet_email_queue?on_conflict='));
  assert(block.length > 0, 'magnet enqueue block found');
  for (const pos of [1, 2, 8]) assertStringIncludes(block, `sequence_position: ${pos}, scheduled_for:`);
  // No magnet row at the dormant 3-7.
  for (const pos of [3, 4, 5, 6, 7]) assert(!block.includes(`sequence_position: ${pos},`), `position ${pos}`);
});
