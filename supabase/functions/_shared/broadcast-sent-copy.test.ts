// founder-broadcast keeps the exact copy each order received (punch #143, 2026-11-04):
// written onto the claimed log row BEFORE the Resend call, so an order whose copy
// cannot be kept is never mailed, and the columns exist before the function writes them.
import { assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';

const src = await Deno.readTextFile(new URL('../founder-broadcast/index.ts', import.meta.url));

Deno.test('founder-broadcast: the per-order copy is kept before the send, for every kind', () => {
  const keep = src.indexOf('await keepSentCopy(db, idempotencyKey, r, claimedAt, recipientSubject, html);');
  const send = src.indexOf('const messageId = await sendEmail(r.customer_email, recipientSubject, html,');
  assert(keep > 0 && send > keep, 'keepSentCopy must run immediately before sendEmail');
  assert(src.includes('.update({ sent_subject: subject, sent_html: html })'));
});

Deno.test('the migration adds both columns, idempotently', async () => {
  const dir = new URL('../../migrations/', import.meta.url);
  let sql = '';
  for await (const f of Deno.readDir(dir)) {
    if (f.name.endsWith('_broadcast_sent_copy.sql')) sql = await Deno.readTextFile(new URL(f.name, dir));
  }
  assert(sql.includes('add column if not exists sent_subject text'));
  assert(sql.includes('add column if not exists sent_html text'));
});
