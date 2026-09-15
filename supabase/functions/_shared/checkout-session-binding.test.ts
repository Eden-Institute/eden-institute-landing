// Run with: deno test supabase/functions/_shared/checkout-session-binding.test.ts

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  CHECKOUT_SESSION_ID_RE,
  isCallerAllowed,
  sessionBoundUserId,
} from './checkout-session-binding.ts';

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';

Deno.test('session id format: live and test ids pass, anything else fails', () => {
  assertEquals(CHECKOUT_SESSION_ID_RE.test('cs_live_a1B2c3D4e5'), true);
  assertEquals(CHECKOUT_SESSION_ID_RE.test('cs_test_a1B2c3D4e5'), true);
  assertEquals(CHECKOUT_SESSION_ID_RE.test(''), false);
  assertEquals(CHECKOUT_SESSION_ID_RE.test('cs_live_'), false);
  assertEquals(CHECKOUT_SESSION_ID_RE.test('pi_live_a1B2c3'), false);
  assertEquals(CHECKOUT_SESSION_ID_RE.test('cs_live_abc/../x'), false);
  assertEquals(CHECKOUT_SESSION_ID_RE.test('cs_live_abc\n'), false);
});

Deno.test('bound user comes from session.metadata first', () => {
  assertEquals(sessionBoundUserId({ metadata: { supabase_user_id: A } }), A);
});

Deno.test('bound user falls back to expanded subscription.metadata', () => {
  assertEquals(
    sessionBoundUserId({ metadata: { lookup_key: 'seed_monthly' }, subscription: { metadata: { supabase_user_id: B } } }),
    B,
  );
});

Deno.test('no bound user when nothing is stamped or subscription is an unexpanded id', () => {
  assertEquals(sessionBoundUserId({ metadata: null }), null);
  assertEquals(sessionBoundUserId({ metadata: { supabase_user_id: '' } }), null);
  assertEquals(sessionBoundUserId({ subscription: 'sub_123' }), null);
});

Deno.test('anonymous one-off guide purchase stays allowed', () => {
  assertEquals(isCallerAllowed({ mode: 'payment', boundUserId: null, callerUserId: null }), true);
});

Deno.test('a one-off bought while signed in can still be verified anonymously', () => {
  assertEquals(isCallerAllowed({ mode: 'payment', boundUserId: A, callerUserId: null }), true);
});

Deno.test('the matching signed-in user is allowed', () => {
  assertEquals(isCallerAllowed({ mode: 'subscription', boundUserId: A, callerUserId: A }), true);
  assertEquals(isCallerAllowed({ mode: 'payment', boundUserId: A, callerUserId: A }), true);
});

Deno.test('a different signed-in user is refused', () => {
  assertEquals(isCallerAllowed({ mode: 'subscription', boundUserId: A, callerUserId: B }), false);
  assertEquals(isCallerAllowed({ mode: 'payment', boundUserId: A, callerUserId: B }), false);
});

Deno.test('an anonymous caller is refused for a subscription session', () => {
  assertEquals(isCallerAllowed({ mode: 'subscription', boundUserId: A, callerUserId: null }), false);
  assertEquals(isCallerAllowed({ mode: 'subscription', boundUserId: null, callerUserId: null }), false);
});

Deno.test('a signed-in caller on an unstamped session is allowed', () => {
  assertEquals(isCallerAllowed({ mode: 'subscription', boundUserId: null, callerUserId: A }), true);
});
