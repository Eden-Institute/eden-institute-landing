import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { applyUnsub, verifyUnsubToken } from './email-unsubscribe.ts';

Deno.env.set('SUPABASE_URL', 'https://example.supabase.co');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-signing-key');

const FOOTER = '<p><a href="{{UNSUB_URL}}">Unsubscribe</a></p>';

Deno.test('footer link opens the confirm page on edeninstitute.health, never supabase.co', async () => {
  const { html } = await applyUnsub(FOOTER, 'Mom@Example.com', 'homeschool');
  assert(html.includes('href="https://edeninstitute.health/unsubscribe?token='), html);
  assert(!html.includes('supabase.co'), html);
  assert(!html.includes('{{UNSUB_URL}}'));
});

Deno.test('one-click header still posts to the unsubscribe function, with the same token as the footer', async () => {
  const { html, headers } = await applyUnsub(FOOTER, 'mom@example.com', 'homeschool');
  assertEquals(headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  const header = /^<https:\/\/example\.supabase\.co\/functions\/v1\/unsubscribe\?token=([^>]+)>$/.exec(headers['List-Unsubscribe']);
  assert(header, headers['List-Unsubscribe']);
  const footer = /unsubscribe\?token=([^"]+)"/.exec(html);
  assertEquals(footer?.[1], header[1]);
  assertEquals(await verifyUnsubToken(decodeURIComponent(header[1])), { email: 'mom@example.com', list: 'homeschool' });
});
