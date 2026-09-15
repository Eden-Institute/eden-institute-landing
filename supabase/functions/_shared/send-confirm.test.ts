// deno test supabase/functions/_shared/send-confirm.test.ts

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { checkCampaignConfirm } from './send-confirm.ts';

const C = 'esa_approval_announcement_2026_09_14';

Deno.test('the exact campaign name confirms', () => {
  assertEquals(checkCampaignConfirm(C, C), { ok: true });
});

Deno.test('surrounding whitespace from a copy and paste is forgiven', () => {
  assertEquals(checkCampaignConfirm(`  ${C}\n`, C), { ok: true });
});

Deno.test('missing, empty, or null is refused and names the campaign to type', () => {
  for (const v of [undefined, null, '']) {
    const r = checkCampaignConfirm(v, C);
    assertEquals(r.ok, false);
    if (!r.ok) assertEquals(r.error.includes(C), true);
  }
});

Deno.test('a different campaign (an old saved command) is refused', () => {
  assertEquals(checkCampaignConfirm('print_first_pivot_letter_2026_09_12', C).ok, false);
});

Deno.test('case matters and a prefix is not enough', () => {
  assertEquals(checkCampaignConfirm(C.toUpperCase(), C).ok, false);
  assertEquals(checkCampaignConfirm('esa_approval', C).ok, false);
});

Deno.test('a non-string is refused', () => {
  assertEquals(checkCampaignConfirm(42, C).ok, false);
  assertEquals(checkCampaignConfirm({ campaign: C }, C).ok, false);
});
