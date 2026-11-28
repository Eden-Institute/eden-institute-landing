// Tests for online-year-emails.ts (OY8, punch #472): the approved words, and who gets which email when.
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { endedEmail, planCronEmails, planOrderEmails, readyEmail, renewEmail, siblingEmail, taggedUrl, type OyLicense, type OyParent } from './online-year-emails.ts';
import { sendOyEmail } from './online-year-email-send.ts';

const ADDR = 'Rooted in Faith Ventures LLC · 303 Holly Cir, Unit 3262, Clarksville, TN 37043';
const MOM: OyParent = { id: 'p1', email: 'ruth@example.com', first_name: 'Ruth' };
const DAY = 86_400_000;
const NOW = new Date('2027-11-17T13:00:00Z');
let n = 0;
const lic = (o: Partial<OyLicense> = {}): OyLicense => ({
  id: `l${++n}`, parent_id: 'p1', band: 'sprouts', child_name: 'Ada', kind: 'first_child',
  starts_at: '2026-12-01T15:00:00Z', ends_at: '2027-12-01T15:00:00Z', status: 'active', order_id: 'o1', ...o,
});
const has = (text: string, line: string) => assert(text.includes(line), `missing: ${line}\n---\n${text}`);

Deno.test('Email 1 (ready), one child: the approved words, button and tags', () => {
  const e = readyEmail(MOM, 'sprouts', [{ name: 'Ada', ends_at: '2027-12-01T15:00:00Z' }], 'o1', ADDR);
  assertEquals(e.subject, 'Your Sprouts Online Year is ready');
  assertEquals(e.preview, "Open it tonight. Here's how the year works.");
  for (const l of [
    'Hi Ruth,',
    "Thank you! Your Online Year of Sprouts (K-2) is ready. Ada's year runs through December 1, 2027.",
    "Start with Week 1 in the Teacher's Guide; it lays out each day for you. When it's time for Notebook pages, tap Print, and Ada's name goes on every page.",
    "You'll sign in with this email address. Each time you use a new device, we'll email you a code. It works on 3 devices with one child, plus one more for each sibling.",
    "Because this is digital, it isn't refundable. If anything isn't working, just reply and we'll fix it.",
    `You're getting this because of your Online Year order. ${ADDR}`,
  ]) has(e.text, l);
  has(e.html, '>Open Sprouts</a>');
  has(e.html, 'href="https://edeninstitute.health/online-year/sign-in?utm_source=email&amp;utm_medium=email&amp;utm_campaign=online_year&amp;utm_content=ready"');
  assertEquals(e.idempotencyKey, 'oy-ready-o1-sprouts');
});

Deno.test('Email 1, two children: the approved plural line', () => {
  const e = readyEmail(MOM, 'seedlings', [{ name: 'Ada', ends_at: '2027-12-01T15:00:00Z' }, { name: 'Ben', ends_at: '2027-12-01T15:00:00Z' }], 'o1', ADDR);
  has(e.text, "Thank you! Your Online Year of Seedlings (3-5) is ready. Ada and Ben's years run through December 1, 2027.");
  has(e.text, "tap Print, and each child's name goes on their own pages.");
  has(e.html, '>Open Seedlings</a>');
});

Deno.test('Email 2 (sibling added): the approved words', () => {
  const e = siblingEmail(MOM, lic({ id: 's1', child_name: 'Ben', kind: 'sibling', ends_at: '2028-03-01T15:00:00Z' }), '2027-12-01T15:00:00Z', ADDR);
  assertEquals(e.subject, "Ben's Notebook pages are ready");
  assertEquals(e.preview, 'Their own Online Year starts today.');
  has(e.text, 'Ben is all set! Their Notebook pages are open now, with their name on every page, and their year runs through March 1, 2028.');
  has(e.text, "The Teacher's Guide and storybook stay with your first Online Year, which runs through December 1, 2027.");
  has(e.html, 'utm_content=sibling');
});

Deno.test('Email 3 (renew): price by kind, the sibling line only for a $149 license with a sibling still running', () => {
  const first = renewEmail(MOM, lic({ id: 'f1' }), ['Ben'], ADDR);
  assertEquals(first.subject, "Ada's Online Year ends on December 1, 2027");
  assertEquals(first.preview, 'Renew anytime before then to keep going without a gap.');
  has(first.text, "Just a heads up: Ada's Online Year of Sprouts ends on December 1, 2027.");
  has(first.text, "If you'd like another 12 months, you can renew now for $149, and nothing changes on your end. The new year starts when this one ends, so renewing early doesn't cost you any days.");
  has(first.text, "The Teacher's Guide and storybook come with this license, so renew it to keep them open for Ben too.");
  has(first.text, "If you're finished, you don't need to do anything. We never charge you automatically, and it simply closes on December 1, 2027.");
  has(first.html, ">Renew Ada&#39;s year</a>".replace('&#39;', "'"));
  has(first.html, 'online-year/checkout?band=sprouts&amp;utm_source=email');
  const sib = renewEmail(MOM, lic({ id: 's2', child_name: 'Ben', kind: 'sibling' }), ['X'], ADDR);
  has(sib.text, 'renew now for $29');
  assert(!sib.text.includes('come with this license'));
});

Deno.test('Email 4 (ended): the approved words', () => {
  const e = endedEmail(MOM, lic({ id: 'e1' }), ADDR);
  assertEquals(e.subject, "Ada's Online Year has ended");
  assertEquals(e.preview, 'Everything you printed is yours to keep. Renew anytime.');
  has(e.text, "Ada's Online Year of Sprouts ended today. Thank you for spending this year with us.");
  has(e.text, "Everything you printed is yours to keep. If you'd like to keep going, you can renew anytime and pick up where you left off.");
  has(e.html, 'utm_content=ended');
});

Deno.test('no em dashes in any email, and "Hi," when no first name is on file', () => {
  const noName = { ...MOM, first_name: null };
  for (const e of [readyEmail(noName, 'sprouts', [{ name: 'Ada', ends_at: '2027-12-01T15:00:00Z' }], 'o', ADDR), endedEmail(MOM, lic(), ADDR), renewEmail(MOM, lic(), [], ADDR)]) {
    assert(!/—/.test(e.html + e.text));
  }
  assert(readyEmail(noName, 'sprouts', [{ name: 'Ada', ends_at: '2027-12-01T15:00:00Z' }], 'o', ADDR).text.startsWith('Hi,'));
});

Deno.test('order plan: first-child order = one Email 1 per band; sibling-only order = Email 2 per sibling', () => {
  const a = lic({ id: 'a', order_id: 'o1' }), b = lic({ id: 'b', child_name: 'Ben', kind: 'sibling', order_id: 'o1' });
  assertEquals(planOrderEmails(MOM, 'o1', [a, b], [a, b], ADDR).map((e) => e.idempotencyKey), ['oy-ready-o1-sprouts']);
  const c = lic({ id: 'c', child_name: 'Cy', kind: 'sibling', order_id: 'o2' }), d = lic({ id: 'd', child_name: 'Di', kind: 'sibling', order_id: 'o2' });
  assertEquals(planOrderEmails(MOM, 'o2', [c, d], [a, b, c, d], ADDR).map((e) => e.idempotencyKey), ['oy-sibling-c', 'oy-sibling-d']);
  const closed = lic({ id: 'x', status: 'closed' });
  assertEquals(planOrderEmails(MOM, 'o3', [closed], [closed], ADDR), []);
});

Deno.test('cron plan: 14 days out -> renew once; ended within 3 days -> ended once; renewed or refunded -> nothing', () => {
  const parents = new Map([['p1', MOM]]);
  const soon = lic({ id: 'soon', ends_at: new Date(NOW.getTime() + 10 * DAY).toISOString() });
  const far = lic({ id: 'far', ends_at: new Date(NOW.getTime() + 20 * DAY).toISOString() });
  const told = lic({ id: 'told', ends_at: soon.ends_at, renew_notice_sent_at: NOW.toISOString() });
  const ended = lic({ id: 'ended', ends_at: new Date(NOW.getTime() - 1 * DAY).toISOString() });
  const old = lic({ id: 'old', ends_at: new Date(NOW.getTime() - 10 * DAY).toISOString() });
  const renewedOld = lic({ id: 'rold', ends_at: new Date(NOW.getTime() - 1 * DAY).toISOString() });
  const renewal = lic({ id: 'rnew', renews_license_id: 'rold', starts_at: renewedOld.ends_at, ends_at: new Date(NOW.getTime() + 364 * DAY).toISOString() });
  const refunded = lic({ id: 'ref', status: 'closed', ends_at: soon.ends_at });
  const plan = planCronEmails(NOW, [soon, far, told, ended, old, renewedOld, renewal, refunded], parents, ADDR);
  assertEquals(plan.map((e) => e.idempotencyKey).sort(), ['oy-ended-ended', 'oy-renew14-soon']);
  assertEquals(plan.find((e) => e.idempotencyKey === 'oy-renew14-soon')!.mark, { licenseId: 'soon', column: 'renew_notice_sent_at' });
});

Deno.test('cron plan: the sibling line names only siblings in the same band whose year outlasts the $149 one', () => {
  const first = lic({ id: 'f', ends_at: new Date(NOW.getTime() + 5 * DAY).toISOString() });
  const ben = lic({ id: 'sb', child_name: 'Ben', kind: 'sibling', ends_at: new Date(NOW.getTime() + 200 * DAY).toISOString() });
  const cy = lic({ id: 'sc', child_name: 'Cy', kind: 'sibling', ends_at: new Date(NOW.getTime() + 2 * DAY).toISOString() });
  const e = planCronEmails(NOW, [first, ben, cy], new Map([['p1', MOM]]), ADDR).find((x) => x.idempotencyKey === 'oy-renew14-f')!;
  assert(e.text.includes('keep them open for Ben too.'));
});

Deno.test('taggedUrl and the Resend call carry the idempotency key, the orders sender and the campaign tag', async () => {
  assertEquals(taggedUrl('https://x/a?band=sprouts', 'ended'), 'https://x/a?band=sprouts&utm_source=email&utm_medium=email&utm_campaign=online_year&utm_content=ended');
  let seen: RequestInit | null = null;
  const ok = await sendOyEmail(endedEmail(MOM, lic({ id: 'k' }), ADDR), 'rk', 'online_year_ended', (async (_u: string, init: RequestInit) => {
    seen = init;
    return new Response('{}', { status: 200 });
  }) as unknown as typeof fetch);
  assert(ok);
  const h = (seen as unknown as RequestInit).headers as Record<string, string>;
  assertEquals(h['Idempotency-Key'], 'oy-ended-k');
  const body = JSON.parse(String((seen as unknown as RequestInit).body));
  assertEquals(body.from, 'Camila at The Eden Institute <hello@orders.edeninstitute.health>');
  assertEquals(body.tags, [{ name: 'category', value: 'online_year_ended' }, { name: 'campaign', value: 'online_year' }]);
  assertEquals(await sendOyEmail(endedEmail(MOM, lic(), ADDR), '', 'x'), false);
});
