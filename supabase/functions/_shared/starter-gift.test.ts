// Founder gift Starter (punch #5, 2026-11-03): the key, the email wording, and the
// fulfiller's switch from key to wording.
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { isStarterGiftDeliveryKey, STARTER_GIFT_ID, STARTER_GIFT_KEY_PREFIX } from './starter-gift.ts';
import { isFpeaGiftDeliveryKey } from './fpea-offer.ts';
import { renderStarterDeliveryEmail } from './starter-email.ts';
import { STARTER_BANDS } from './starter-config.ts';

const EM_DASH = /—/;

Deno.test('gift key: only gift_ keys are founder gifts, and no other rail uses that prefix', () => {
  assertEquals(STARTER_GIFT_KEY_PREFIX, 'gift_');
  assert(isStarterGiftDeliveryKey('gift_sprouts_0123abcd'));
  for (const k of ['cs_live_abc', 'cs_test_abc', 'esa_0123', 'fpea_cs_live_abc_sprouts', '', null, undefined]) {
    assert(!isStarterGiftDeliveryKey(k), `${k} read as a founder gift`);
  }
  assert(!isFpeaGiftDeliveryKey('gift_sprouts_0123abcd'));
});

Deno.test('founder gift email: gift wording, the downloads link, no refund line, nothing to sell, no code, no FPEA', () => {
  for (const band of ['sprouts', 'seedlings'] as const) {
    const name = STARTER_BANDS[band].bandName;
    const other = band === 'sprouts' ? /seedlings/i : /sprouts/i;
    const r = renderStarterDeliveryEmail({ firstName: 'Ann', email: 'a@b.co', creditCode: 'EDEN-S-ABC234', downloadToken: 'tok', receipt: null, band, gift: STARTER_GIFT_ID });
    assertEquals(r.subject, `Your free ${name} Starter Unit is ready`);
    for (const part of [r.html, r.text]) {
      assert(part.includes(`This one is a gift from me: the first nine weeks of Eden's Table, ${name}, free.`));
      assert(part.includes('/starter/downloads?t=tok'));
      assert(!part.includes('not refundable'));
      assert(!part.includes('See the printed year'));
      assert(!part.includes('When you want the rest of the year'));
      assert(!part.includes('Printing begins'));
      assert(!/FPEA|convention|your order/i.test(part));
      assert(!part.includes('EDEN-S-'));
      assert(!/\bkit\b|preorder|credit/i.test(part));
      assert(!EM_DASH.test(part));
      assert(!other.test(part), `${band} gift email mentions the other band`);
    }
  }
});

Deno.test('a bought Starter email is unchanged by the gift wording', () => {
  const r = renderStarterDeliveryEmail({ firstName: 'Ann', email: 'a@b.co', creditCode: null, downloadToken: 'tok', receipt: null, band: 'sprouts' });
  assertEquals(r.subject, "Your Eden's Table Starter Unit is ready");
  for (const part of [r.html, r.text]) {
    assert(part.includes("Here are your first nine weeks of Eden's Table, Sprouts."));
    assert(part.includes('not refundable'));
    assert(!part.includes('a gift from me'));
  }
});

Deno.test('the fulfiller maps a gift_ key to the founder gift wording and an fpea_ key to the FPEA wording', async () => {
  const src = await Deno.readTextFile(new URL('./starter-fulfillment.ts', import.meta.url));
  assert(src.includes('isFpeaGiftDeliveryKey(sid) ? FPEA_OFFER_ID : isStarterGiftDeliveryKey(sid) ? STARTER_GIFT_ID : null'));
  assert(src.includes('...(giftId ? { gift: giftId } : {})'));
});
