// Email topics (punch #22, 2026-11-04): the preference-page choices, the webhook parser,
// and the rule that a topic choice is never a global unsubscribe.
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { EMAIL_TOPICS, isEmailTopicKey, parseTopicsUpdate } from './email-topics.ts';

const EM_DASH = /—/;

Deno.test('topics fit Resend limits and the copy rules', () => {
  for (const t of Object.values(EMAIL_TOPICS)) {
    assert(t.name.length >= 1 && t.name.length <= 50, t.name);
    assert(t.description.length <= 200, t.description);
    assert(!EM_DASH.test(t.name) && !EM_DASH.test(t.description), t.name);
  }
  assertEquals(new Set(Object.values(EMAIL_TOPICS).map((t) => t.name)).size, Object.keys(EMAIL_TOPICS).length);
  assert(isEmailTopicKey('fridays') && isEmailTopicKey('news') && isEmailTopicKey('partners'));
  // The exact names the founder approved (11/4 + 11/5); Resend topics are matched by name.
  assertEquals(Object.values(EMAIL_TOPICS).map((t) => t.name), ['The Friday letter', 'New books and sales', 'Partner promotions']);
  for (const k of ['', 'FRIDAYS', 'toString', 'hasOwnProperty', null, 3]) assert(!isEmailTopicKey(k), String(k));
});

Deno.test('contact.topics.updated is read exactly as Resend documents it', () => {
  const u = parseTopicsUpdate({
    type: 'contact.topics.updated',
    created_at: '2026-11-04T16:00:00.000Z',
    data: { email: ' Mom@Example.com ', topics: [{ id: 't1', subscription: 'opt_out' }, { id: 't2', subscription: 'opt_in' }] },
  });
  assertEquals(u, {
    email: 'mom@example.com',
    changedAt: '2026-11-04T16:00:00.000Z',
    topics: [{ id: 't1', subscription: 'opt_out' }, { id: 't2', subscription: 'opt_in' }],
  });
});

Deno.test('anything else, or a half-readable payload, writes nothing', () => {
  const ok = { email: 'a@b.co', topics: [{ id: 't1', subscription: 'opt_out' }] };
  for (const e of [
    { type: 'contact.updated', created_at: '2026-11-04T16:00:00Z', data: { ...ok, unsubscribed: true } },
    { type: 'contact.topics.updated', created_at: 'not a date', data: ok },
    { type: 'contact.topics.updated', created_at: '2026-11-04T16:00:00Z', data: { email: 'nobody', topics: ok.topics } },
    { type: 'contact.topics.updated', created_at: '2026-11-04T16:00:00Z', data: { email: 'a@b.co', topics: [] } },
    { type: 'contact.topics.updated', created_at: '2026-11-04T16:00:00Z', data: { email: 'a@b.co', topics: [{ id: 't1', subscription: 'unsubscribed' }] } },
    { type: 'contact.topics.updated', created_at: '2026-11-04T16:00:00Z', data: { email: 'a@b.co', topics: [ok.topics[0], { subscription: 'opt_in' }] } },
  ]) {
    assertEquals(parseTopicsUpdate(e), null, JSON.stringify(e));
  }
});

Deno.test('resend-webhook: a topic event takes its own path and never reaches the unsubscribe RPC', async () => {
  const src = await Deno.readTextFile(new URL('../resend-webhook/index.ts', import.meta.url));
  const topicPath = src.indexOf('if (event.type === "contact.topics.updated")');
  const rpc = src.indexOf('supabase.rpc("waitlist_apply_resend_event"');
  assert(topicPath > 0 && rpc > topicPath, 'the topic branch must return before the RPC calls');
  const fn = src.slice(src.indexOf('async function recordTopicPreferences'), src.indexOf('// Map a raw Resend event'));
  assert(fn.includes('from("email_topic_preferences")'));
  assert(!fn.includes('waitlist_apply_resend_event') && !fn.includes('unsubscribed'), 'recordTopicPreferences touches topics only');
  assert(fn.includes('received_at: receivedAt'), 'received_at is sent explicitly so the upsert cannot freeze it');
});

Deno.test('broadcast-stage: create can scope a Broadcast to a topic; schedule refuses a topic-less one once topics are live', async () => {
  const src = await Deno.readTextFile(new URL('../broadcast-stage/index.ts', import.meta.url));
  assert(src.includes('...(topicId ? { topic_id: topicId } : {})'));
  assert(src.includes("if (!b.body.topic_id && (await liveTopicIds()).size > 0)"));
});

Deno.test('broadcast-stage topics mode: creates only what is missing, opt_in + public, and only with create: true', async () => {
  const src = await Deno.readTextFile(new URL('../broadcast-stage/index.ts', import.meta.url));
  const block = src.slice(src.indexOf("if (mode === 'topics')"), src.indexOf("if (mode === 'status')"));
  assert(block.length > 0, 'topics mode exists');
  assert(block.includes("default_subscription: 'opt_in', visibility: 'public'"), 'created opt_in and public');
  assert(block.includes('if (body.create !== true)'), 'report-only unless create: true');
  assert(block.indexOf("action: 'exists'") < block.indexOf("method: 'POST'"), 'an existing topic is reported before any create');
  assert(!block.includes("method: 'PATCH'") && !block.includes("method: 'DELETE'"), 'never changes or removes a topic');
});
