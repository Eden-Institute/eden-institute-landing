// deno test --no-lock --allow-env supabase/functions/_shared/preorder-response-request.test.ts
//
// The rule these pin: a GET or HEAD (a buyer's click, or a link scanner) never records
// consent or a cancellation. Only the page's form POST does, and only for the answer
// the signed token carries.

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  answeredState,
  choiceMatchesToken,
  confirmPageUrl,
  doneState,
  PREORDER_RESPONSE_PAGE_URL,
  readPreorderForm,
  resultPageUrl,
  routePreorderRequest,
  stateForGet,
} from './preorder-response-request.ts';

const FN = 'https://example.supabase.co/functions/v1/preorder-response';

async function route(req: Request) {
  const url = new URL(req.url);
  const form = req.method === 'POST' ? await readPreorderForm(req) : null;
  return routePreorderRequest({ method: req.method, queryToken: url.searchParams.get('token'), form });
}

const formPost = (body: string, type = 'application/x-www-form-urlencoded') =>
  new Request(FN, { method: 'POST', headers: { 'Content-Type': type }, body });

Deno.test('a GET from the email link only confirms, it never records', async () => {
  assertEquals(await route(new Request(`${FN}?token=abc.def`)), { kind: 'confirm', token: 'abc.def' });
});

Deno.test('a HEAD from a scanner only confirms', async () => {
  assertEquals(await route(new Request(`${FN}?token=abc.def`, { method: 'HEAD' })), {
    kind: 'confirm',
    token: 'abc.def',
  });
});

Deno.test('a GET with no token confirms an empty token (which then fails verification)', async () => {
  assertEquals(await route(new Request(FN)), { kind: 'confirm', token: '' });
});

Deno.test('the page button POST records with the form token and choice', async () => {
  assertEquals(await route(formPost('token=abc.def&choice=consented')), {
    kind: 'record',
    token: 'abc.def',
    choice: 'consented',
  });
});

Deno.test('a multipart form POST also records', async () => {
  const fd = new FormData();
  fd.set('token', 'abc.def');
  fd.set('choice', 'cancelled');
  const req = new Request(FN, { method: 'POST', body: fd });
  assertEquals(await route(req), { kind: 'record', token: 'abc.def', choice: 'cancelled' });
});

Deno.test('a POST with the token only in the query string carries an empty token', async () => {
  const req = new Request(`${FN}?token=abc.def`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: '',
  });
  assertEquals(await route(req), { kind: 'record', token: '', choice: '' });
});

Deno.test('a JSON or unparseable POST body carries an empty token', async () => {
  assertEquals(await route(formPost('{"token":"abc.def"}', 'application/json')), {
    kind: 'record',
    token: '',
    choice: '',
  });
  assertEquals(await readPreorderForm(formPost('%%%', 'multipart/form-data; boundary=x')), null);
});

Deno.test('OPTIONS is a preflight, other methods are refused', async () => {
  assertEquals(await route(new Request(FN, { method: 'OPTIONS' })), { kind: 'preflight' });
  assertEquals(await route(new Request(FN, { method: 'PUT', body: 'x' })), { kind: 'method_not_allowed' });
  assertEquals(await route(new Request(FN, { method: 'DELETE' })), { kind: 'method_not_allowed' });
});

Deno.test('the button choice must match the choice the token carries', () => {
  assert(choiceMatchesToken('consented', 'consented'));
  assert(choiceMatchesToken('cancelled', 'cancelled'));
  assert(!choiceMatchesToken('consented', 'cancelled'));
  assert(!choiceMatchesToken('cancelled', 'consented'));
  assert(!choiceMatchesToken('', 'consented'));
  assert(!choiceMatchesToken('Consented', 'consented'));
});

Deno.test('a GET shows the button only for an unanswered notice', () => {
  assertEquals(stateForGet(null), 'not-found');
  assertEquals(stateForGet({ response: null, requires_opt_in: false }), 'confirm');
  assertEquals(stateForGet({ response: null, requires_opt_in: true }), 'confirm');
  assertEquals(stateForGet({ response: 'consented', requires_opt_in: true }), 'answered-consented');
  assertEquals(stateForGet({ response: 'cancelled', requires_opt_in: false }), 'answered-cancelled');
});

Deno.test('answered and done states follow the recorded answer', () => {
  assertEquals(answeredState('consented'), 'answered-consented');
  assertEquals(answeredState('cancelled'), 'answered-cancelled');
  assertEquals(doneState('consented'), 'done-consented');
  assertEquals(doneState('cancelled'), 'done-cancelled');
});

Deno.test('the confirm URL carries the token and display values only', () => {
  const token = 'eyJvIjoiMSJ9.sig-_x';
  const u = new URL(confirmPageUrl(token, 'consented', true));
  assertEquals(`${u.origin}${u.pathname}`, PREORDER_RESPONSE_PAGE_URL);
  assertEquals(u.searchParams.get('state'), 'confirm');
  assertEquals(u.searchParams.get('choice'), 'consented');
  assertEquals(u.searchParams.get('optin'), '1');
  assertEquals(u.searchParams.get('token'), token);
  assertEquals([...u.searchParams.keys()].sort(), ['choice', 'optin', 'state', 'token']);
  assertEquals(new URL(confirmPageUrl(token, 'cancelled', false)).searchParams.get('optin'), '0');
});

Deno.test('result URLs carry the state and never a token', () => {
  const states = [
    'done-consented',
    'done-cancelled',
    'answered-consented',
    'answered-cancelled',
    'invalid',
    'not-found',
    'error',
  ] as const;
  for (const s of states) {
    const u = new URL(resultPageUrl(s));
    assertEquals(`${u.origin}${u.pathname}`, PREORDER_RESPONSE_PAGE_URL);
    assertEquals([...u.searchParams.entries()], [['state', s]]);
  }
});
