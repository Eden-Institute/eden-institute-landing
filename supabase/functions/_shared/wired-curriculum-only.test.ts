// Spec answer 38 (2026-11-19): the quiz ranks resource_type = Curriculum ONLY. Helpful extras (apps, video
// libraries, songs...) never enter approvedCurricula, which wired-submit, wired-matches and wired-pdf use.
import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { approvedCurricula, CURRICULUM_ONLY_FILTER } from './wired-submit-flow.ts';

Deno.test('approvedCurricula asks PostgREST for approved Curriculum rows (or rows from before the column) only', async () => {
  const seen: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request) => {
    seen.push(String(input instanceof Request ? input.url : input));
    return Promise.resolve(new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }) as typeof fetch;
  try {
    const rows = await approvedCurricula({ url: 'https://db.test', key: 'k' });
    assertEquals(rows, []);
  } finally {
    globalThis.fetch = realFetch;
  }
  assertEquals(seen.length, 1);
  assertEquals(CURRICULUM_ONLY_FILTER, 'or=(resource_type.is.null,resource_type.eq.Curriculum)');
  assertStringIncludes(seen[0], 'wired_curricula?approved=eq.true&or=(resource_type.is.null,resource_type.eq.Curriculum)&select=');
  assert(!seen[0].includes('affiliate'), 'never selects affiliate columns (rule 3)');
});
