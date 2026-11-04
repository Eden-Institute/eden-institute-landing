// starter-fulfill drain (punch #430, 2026-11-04): one delivery per invocation. On
// 2026-11-03 a drain that stamped five Starters in a single invocation was killed at
// the platform's 2 s CPU limit halfway through the fifth, so the drain now hands each
// row to its own { session_id } invocation, the same call stripe-webhook makes.
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

const src = await Deno.readTextFile(new URL('../starter-fulfill/index.ts', import.meta.url));

Deno.test('starter-fulfill: only the kick delivers in-process; the drain gives every row its own invocation', () => {
  assertEquals(src.match(/fulfilStarterDelivery\(/g)?.length, 1, 'fulfilStarterDelivery is called from deliverHere only');
  assert(src.includes('sessionId ? await deliverHere(row) : await deliverInOwnInvocation(row.stripe_checkout_session_id)'));
  assert(src.includes('`${SUPABASE_URL}/functions/v1/starter-fulfill`'));
  assert(src.includes('body: JSON.stringify({ session_id: sessionId })'));
});

Deno.test('starter-fulfill: a drain stays a handful of rows', () => {
  const batch = Number(src.match(/const DRAIN_BATCH = (\d+);/)?.[1]);
  assert(batch >= 1 && batch <= 5, `DRAIN_BATCH is ${batch}`);
});
