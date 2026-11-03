// deno test --no-lock -A supabase/functions/notify-founder-digest/sample-links.test.ts
//
// Partner sample leak check (punch #244 FIX 3): a key serving many households in a
// day is flagged by name; an ordinary family, or the shared key on an ordinary day,
// is not; a link already turned off is reported without turning the digest red.

import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  describeSpike,
  findSampleLinkSpikes,
  RECIPIENT_VISITOR_LIMIT,
  SHARED_VISITOR_LIMIT,
  type SampleServeRow,
} from './sample-links.ts';
import { evaluateSystemHealth, hasHealthProblem, systemHealthHtml } from './system-health.ts';

type Holder = NonNullable<SampleServeRow['partner_sample_keys']>;
const KALLIE: Holder = { email: 'kallie@example.com', name: 'Kallie', revoked_at: null };

/** `visitors` distinct visitors, each downloading `each` files. */
function serves(keyId: string | null, visitors: number, each = 1, holder: Holder = KALLIE): SampleServeRow[] {
  const rows: SampleServeRow[] = [];
  for (let v = 0; v < visitors; v++) {
    for (let d = 0; d < each; d++) {
      rows.push({ key_id: keyId, visitor_hash: `${keyId ?? 'shared'}-v${v}`, partner_sample_keys: keyId ? holder : null });
    }
  }
  return rows;
}

function healthInput() {
  const q = { nurture_email_queue: 0, magnet_email_queue: 0, launch_email_queue: 0, buyer_email_queue: 0, followup_email_queue: 0, founding_family_queue: 0 };
  return {
    recapStatus: 'sent', lastTrendsSent: '2026-10-30', digestFailed30d: 0, failedByQueue: q, oldestFailed: null,
    stuckByQueue: { ...q }, stripeProblems: 0, luluProblems: 0, starterProblems: 0, ga4ByStatus: {}, ga4SecretSet: true,
    sampleLinkSpikes: [] as ReturnType<typeof findSampleLinkSpikes> | null,
  };
}

Deno.test('limits: 5 places for a personal link, 10 for the shared one', () => {
  assertEquals(RECIPIENT_VISITOR_LIMIT, 5);
  assertEquals(SHARED_VISITOR_LIMIT, 10);
});

Deno.test('one family downloading all six files from three places is not flagged', () => {
  assertEquals(findSampleLinkSpikes(serves('k1', 3, 6)), []);
  assertEquals(findSampleLinkSpikes(serves('k1', RECIPIENT_VISITOR_LIMIT - 1, 6)), []);
});

Deno.test('a personal link opened from 5 places in a day is flagged, by name', () => {
  const spikes = findSampleLinkSpikes(serves('k1', RECIPIENT_VISITOR_LIMIT, 2));
  assertEquals(spikes.length, 1);
  assertEquals(spikes[0], { keyId: 'k1', name: 'Kallie', email: 'kallie@example.com', visitors: 5, downloads: 10, revoked: false });
  const line = describeSpike(spikes[0], '2026-11-04');
  assertStringIncludes(line, "Kallie's partner sample link (kallie@example.com) was opened from 5 different places on 2026-11-04 (10 downloads)");
  assertStringIncludes(line, 'turn off that one link (key k1); nobody else is affected');
});

Deno.test('the shared link is held by many, so it needs 10 places', () => {
  assertEquals(findSampleLinkSpikes(serves(null, SHARED_VISITOR_LIMIT - 1)), []);
  const [s] = findSampleLinkSpikes(serves(null, 25, 3));
  assertEquals([s.keyId, s.visitors, s.downloads], [null, 25, 75]);
  assertStringIncludes(describeSpike(s, '2026-11-04'), 'The shared partner sample link (in every package sent before November 3) was opened from 25 different places');
  assertStringIncludes(describeSpike(s, '2026-11-04'), 'ask Claude before doing anything');
});

Deno.test('keys are counted apart and the busiest comes first; repeat downloads are one visitor', () => {
  const rows = [
    ...serves('k1', 6, 1),
    ...serves('k2', 40, 1, { email: 'amy@example.com', name: 'Amy', revoked_at: null }),
    ...serves('k3', 2, 30, { email: 'one@example.com', name: null, revoked_at: null }),
  ];
  const spikes = findSampleLinkSpikes(rows);
  assertEquals(spikes.map((s) => [s.keyId, s.visitors]), [['k2', 40], ['k1', 6]]);
});

Deno.test('in the digest: a spike turns System health red; none is a pass; unreadable is "could not check"', () => {
  const input = healthInput();
  input.sampleLinkSpikes = findSampleLinkSpikes(serves('k1', 12));
  let checks = evaluateSystemHealth(input, '2026-11-04', '2026-11-05');
  const c = checks.find((x) => x.key === 'sample_links')!;
  assertEquals(c.ok, false);
  assertStringIncludes(c.detail, "Kallie's partner sample link");
  assert(hasHealthProblem(checks));
  assertStringIncludes(systemHealthHtml(checks), 'opened from 12 different places');

  input.sampleLinkSpikes = [];
  checks = evaluateSystemHealth(input, '2026-11-04', '2026-11-05');
  assertEquals(checks.find((x) => x.key === 'sample_links')!.ok, true);
  assertEquals(hasHealthProblem(checks), false);

  input.sampleLinkSpikes = null;
  checks = evaluateSystemHealth(input, '2026-11-04', '2026-11-05');
  assertEquals(checks.find((x) => x.key === 'sample_links')!.ok, null);
});

Deno.test('a link already turned off is reported but does not turn the digest red', () => {
  const input = healthInput();
  input.sampleLinkSpikes = findSampleLinkSpikes(serves('k1', 12, 1, { ...KALLIE, revoked_at: '2026-11-04T20:00:00Z' }));
  const checks = evaluateSystemHealth(input, '2026-11-04', '2026-11-05');
  const c = checks.find((x) => x.key === 'sample_links')!;
  assertEquals(c.ok, true);
  assertStringIncludes(c.detail, 'and has since been turned off');
  assertEquals(hasHealthProblem(checks), false);
});
