// deno test supabase/functions/_shared/signup-attribution.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { attributionFillFilter, attributionPatch } from './signup-attribution.ts';

Deno.test('patch carries only the fields that have a value', () => {
  assertEquals(attributionPatch({ source_url: 'https://edeninstitute.health/assessment?utm_source=facebook', referrer: null, utm_source: 'facebook', utm_medium: ' group_post ', utm_campaign: '', utm_term: undefined }), {
    source_url: 'https://edeninstitute.health/assessment?utm_source=facebook',
    utm_source: 'facebook',
    utm_medium: 'group_post',
  });
});

Deno.test('nothing to write when the visitor brought no attribution', () => {
  assertEquals(attributionPatch({}), {});
  assertEquals(attributionPatch({ source_url: '   ', referrer: null }), {});
});

Deno.test('filter: this email, this funnel, first touch only (no landing page yet)', () => {
  assertEquals(attributionFillFilter('mom+test@example.com', 'quiz_funnel'), 'email=eq.mom%2Btest%40example.com&entry_funnel=eq.quiz_funnel&source_url=is.null');
});
