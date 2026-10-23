// deno test supabase/functions/_shared/weekly-trends-report.test.ts
//
// The Friday trends email, built from the real 2026-10-23 snapshot: separate labels
// for Back to Eden Chapter 1 and the Cultivators waitlist, no doubled parentheses,
// no "Visits held" when visits rose, and a sign-up rate on new visitors to the
// sign-up pages (falling back to all visitors when the RPC predates that field).

import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildEmail, friendly, interpret, rateBasis, rollup, type Snapshot } from './weekly-trends-report.ts';

// weekly_trends_snapshot() as it stood at 2026-10-23 14:00 UTC, plus the new
// lead_page_visitors field computed over the same window (166 / 147).
function oct23(): Snapshot {
  return {
    generated_at: '2026-10-23T14:00:36Z',
    this_week_start: '2026-10-16T14:00:36Z',
    last_week_start: '2026-10-09T14:00:36Z',
    leads: {
      this: 13,
      last: 20,
      by_source: [
        { funnel: 'edens_table', source: 'sprouts_magnet', wk: 'this', n: 7 },
        { funnel: 'edens_table', source: 'seedlings_magnet', wk: 'this', n: 3 },
        { funnel: 'quiz_funnel', source: '(unattributed)', wk: 'this', n: 3 },
        { funnel: 'edens_table', source: 'sprouts_magnet', wk: 'last', n: 9 },
        { funnel: 'edens_table', source: 'seedlings_magnet', wk: 'last', n: 4 },
        { funnel: 'quiz_funnel', source: '(unattributed)', wk: 'last', n: 5 },
        { funnel: 'edens_table', source: 'back_to_eden_ch1', wk: 'last', n: 1 },
        { funnel: 'edens_table', source: 'cultivators_waitlist', wk: 'last', n: 1 },
      ],
    },
    traffic_views: { this: 672, last: 542 },
    traffic_visitors: { this: 340, last: 255 },
    lead_page_visitors: { this: 166, last: 147 },
    quiz: { this: 3, last: 5 },
  };
}

Deno.test('the two old "waitlist" rows get their own names', () => {
  assertEquals(friendly('edens_table', 'back_to_eden_ch1'), 'Back to Eden · free Chapter 1');
  assertEquals(friendly('edens_table', 'cultivators_waitlist'), 'Cultivators (6-8) · waitlist');
  assertEquals(friendly('edens_table', 'practitioners_waitlist'), 'Practitioners (9-12) · waitlist');
  assertEquals(friendly('edens_table', '(unattributed)'), "Eden's Table · waitlist");
  // An unknown source shows its own name instead of hiding under "waitlist".
  assertEquals(friendly('edens_table', 'some_new_magnet'), "Eden's Table · some_new_magnet");
});

Deno.test('no two source rows share a label', () => {
  const { sources } = rollup(oct23().leads.by_source);
  const labels = sources.map((s) => s.label);
  assertEquals(new Set(labels).size, labels.length);
});

Deno.test('sources with the same meaning are added into one row', () => {
  const { sources } = rollup([
    { funnel: 'homeschool', source: 'sprouts_magnet', wk: 'this', n: 2 },
    { funnel: 'edens_table', source: 'sprouts_magnet', wk: 'this', n: 3 },
  ]);
  assertEquals(sources.length, 1);
  assertEquals(sources[0].thisN, 5);
});

Deno.test('the rate is leads over new visitors on the sign-up pages', () => {
  const basis = rateBasis(oct23());
  assert(basis.onLeadPages);
  const { subject, html, text } = buildEmail(oct23(), '2026-10-23');
  assertEquals(subject, 'Weekly trends — 13 leads, -7 (-35%) · 2026-10-23');
  // 13 / 166 = 7.8%, 20 / 147 = 13.6%
  assertStringIncludes(text, '7.8% of new sign-up-page visitors (was 13.6%)');
  assertStringIncludes(html, 'New visitors on sign-up pages');
  assertStringIncludes(html, 'Visitors, all pages');
  assert(!html.includes('Unique visitors'));
});

Deno.test('the 10/23 wording: no doubled parentheses, no "held" when visits rose', () => {
  const s = oct23();
  const { anomalies, focus } = interpret(s, rollup(s.leads.by_source).sources);
  const all = [...anomalies, focus].join('\n');
  assert(!all.includes('(+85 (+33%))'), all);
  assert(!/\(\+\d+ \(\+\d+%\)\)/.test(all), all);
  assert(!all.includes('Visits held'), all);
  // Total visits rose 33% but the sign-up pages only 13%: say so.
  assertStringIncludes(all, 'Visits rose +85 (+33%), but new visitors on the sign-up pages went 147 → 166 (+13%).');
  assertStringIncludes(all, 'Sign-up rate on the sign-up pages fell 13.6% → 7.8% (-43%).');
  // The focus names what happened on the sign-up pages and warns about small numbers.
  assertStringIncludes(focus, 'New visitors on the sign-up pages held (147 → 166)');
  assertStringIncludes(focus, 'Small numbers: 20 → 13 leads');
});

Deno.test('fewer people reaching the sign-up pages reads as a reach problem, not a page problem', () => {
  const s = oct23();
  s.lead_page_visitors = { this: 100, last: 147 };
  s.leads = { ...s.leads, this: 8 };
  const { focus } = interpret(s, rollup(s.leads.by_source).sources);
  assert(focus.startsWith('Reach.'), focus);
  assertStringIncludes(focus, 'Fewer new visitors on the sign-up pages this week (147 → 100)');
});

Deno.test('an RPC without lead_page_visitors falls back to all visitors and says so', () => {
  const s = oct23();
  delete s.lead_page_visitors;
  assertEquals(rateBasis(s).onLeadPages, false);
  const { html, text } = buildEmail(s, '2026-10-23');
  // 13 / 340 = 3.8%, 20 / 255 = 7.8%: the old numbers, labelled as all visitors.
  assertStringIncludes(text, '3.8% of all visitors (was 7.8%)');
  assert(!html.includes('New visitors on sign-up pages</td>'));
  assertStringIncludes(html, 'divided by ALL visitors');
});

Deno.test('a steady week no longer promises a Meta Leads test', () => {
  const s = oct23();
  s.leads = { this: 20, last: 20, by_source: [{ funnel: 'edens_table', source: 'sprouts_magnet', wk: 'this', n: 20 }, { funnel: 'edens_table', source: 'sprouts_magnet', wk: 'last', n: 20 }] };
  s.lead_page_visitors = { this: 150, last: 147 };
  s.traffic_visitors = { this: 260, last: 255 };
  const { focus } = interpret(s, rollup(s.leads.by_source).sources);
  assertEquals(focus, 'Steady week. Nothing moved outside the normal range.');
});
