// deno test --no-lock --allow-env supabase/functions/_shared/unsubscribe-request.test.ts
//
// The rule these pin: a GET never unsubscribes anyone (link scanners fetch every
// link), and RFC 8058 one-click POSTs still unsubscribe in one step.

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  confirmPageUrl,
  readUnsubForm,
  resultPageUrl,
  routeUnsubRequest,
} from './unsubscribe-request.ts';

const FN = 'https://example.supabase.co/functions/v1/unsubscribe';

async function route(req: Request) {
  const url = new URL(req.url);
  const form = req.method === 'POST' ? await readUnsubForm(req) : null;
  return routeUnsubRequest({ method: req.method, queryToken: url.searchParams.get('token'), form });
}

Deno.test('a GET only confirms, it never performs', async () => {
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

Deno.test('RFC 8058 one-click, urlencoded body, token in the query', async () => {
  const req = new Request(`${FN}?token=abc.def`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'List-Unsubscribe=One-Click',
  });
  assertEquals(await route(req), { kind: 'one_click', token: 'abc.def' });
});

Deno.test('RFC 8058 one-click, multipart body', async () => {
  const fd = new FormData();
  fd.set('List-Unsubscribe', 'One-Click');
  const req = new Request(`${FN}?token=abc.def`, { method: 'POST', body: fd });
  assertEquals(await route(req), { kind: 'one_click', token: 'abc.def' });
});

Deno.test('a POST with no body at all is still one-click', async () => {
  assertEquals(await route(new Request(`${FN}?token=abc.def`, { method: 'POST' })), {
    kind: 'one_click',
    token: 'abc.def',
  });
});

Deno.test('a POST with a JSON body is treated as one-click on the query token', async () => {
  const req = new Request(`${FN}?token=abc.def`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"x":1}',
  });
  assertEquals(await route(req), { kind: 'one_click', token: 'abc.def' });
});

Deno.test('the confirm page button posts the token as a form field', async () => {
  const req = new Request(FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'token=' + encodeURIComponent('abc.def'),
  });
  assertEquals(await route(req), { kind: 'form_post', token: 'abc.def' });
});

Deno.test('a body with both the one-click marker and a token is one-click', async () => {
  const req = new Request(`${FN}?token=q.q`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'List-Unsubscribe=One-Click&token=f.f',
  });
  assertEquals(await route(req), { kind: 'one_click', token: 'q.q' });
});

Deno.test('a malformed multipart body parses as null, not a throw', async () => {
  const req = new Request(FN, {
    method: 'POST',
    headers: { 'Content-Type': 'multipart/form-data; boundary=nope' },
    body: 'garbage',
  });
  assertEquals(await readUnsubForm(req), null);
});

Deno.test('OPTIONS is a preflight and other methods are refused', () => {
  assertEquals(routeUnsubRequest({ method: 'OPTIONS', queryToken: null, form: null }), { kind: 'preflight' });
  assertEquals(routeUnsubRequest({ method: 'PUT', queryToken: 'a.b', form: null }), { kind: 'method_not_allowed' });
  assertEquals(routeUnsubRequest({ method: 'DELETE', queryToken: 'a.b', form: null }), { kind: 'method_not_allowed' });
});

Deno.test('page URLs encode the token and name the result', () => {
  assertEquals(confirmPageUrl('a+b/c.d='), 'https://edeninstitute.health/unsubscribe?token=a%2Bb%2Fc.d%3D');
  assertEquals(resultPageUrl('done'), 'https://edeninstitute.health/unsubscribe?status=done');
  assertEquals(resultPageUrl('invalid'), 'https://edeninstitute.health/unsubscribe?status=invalid');
});
