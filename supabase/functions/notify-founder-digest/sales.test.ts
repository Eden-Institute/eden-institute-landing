// deno test --no-lock -A supabase/functions/notify-founder-digest/sales.test.ts
//
// The digest's Sales section: bands, add-ons, Starter sources, the yesterday vs
// 7-day split, and the internal / E2E exclusions. No network.

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  isInternalEmail,
  salesHtml,
  salesTextLines,
  salesTotal,
  tallySales,
  type SalesOrderRow,
} from './sales.ts';

const WIN = {
  dayStart: '2026-09-23T00:00:00-06:00',
  dayEnd: '2026-09-24T00:00:00-06:00',
  weekStart: '2026-09-17T00:00:00-06:00',
};
const YESTERDAY = '2026-09-23T15:00:00+00:00';
const EARLIER = '2026-09-19T15:00:00+00:00';

function order(p: Partial<SalesOrderRow> & { skus?: [string, number][] }): SalesOrderRow {
  return {
    customer_email: p.customer_email ?? 'mom@example.com',
    lookup_key: p.lookup_key ?? (p.skus?.[0]?.[0] ?? null),
    quantity: p.quantity ?? null,
    created_at: p.created_at ?? YESTERDAY,
    e2e: p.e2e ?? null,
    order_items: p.order_items ?? (p.skus ?? []).map(([sku, quantity]) => ({ quantity, products: { sku } })),
  };
}

Deno.test('printed sets count by band and extra notebooks count as add-ons', () => {
  const s = tallySales([
    order({ skus: [['sprouts_print_set', 1], ['sprouts_nb_print', 2]] }),
    order({ skus: [['seedlings_print_set', 1], ['seedlings_nb_print', 1]] }),
    order({ skus: [['seedlings_nb_print', 1]] }),
  ], [], { yesterday: 0, week: 0 }, WIN);
  assertEquals(s.yesterday.setsSprouts, 1);
  assertEquals(s.yesterday.setsSeedlings, 1);
  assertEquals(s.yesterday.nbSprouts, 2);
  assertEquals(s.yesterday.nbSeedlings, 2);
});

Deno.test('Starter Units come from orders.lookup_key plus ESA deliveries, by band', () => {
  const s = tallySales(
    [
      order({ lookup_key: 'sprouts_starter_unit', order_items: [] }),
      order({ lookup_key: 'seedlings_starter_unit', order_items: [], created_at: EARLIER }),
    ],
    [
      { email: 'esa@example.com', band: 'seedlings', created_at: YESTERDAY },
      { email: 'esa2@example.com', band: null, created_at: EARLIER },
    ],
    { yesterday: 1, week: 3 },
    WIN,
  );
  assertEquals(s.yesterday.starterSprouts, 1);
  assertEquals(s.yesterday.starterSeedlings, 1);
  assertEquals(s.week.starterSprouts, 2);
  assertEquals(s.week.starterSeedlings, 2);
  assertEquals(s.yesterday.esaPaid, 1);
  assertEquals(s.week.esaPaid, 3);
});

Deno.test('yesterday is inside the week; rows outside the week are ignored', () => {
  const s = tallySales([
    order({ skus: [['sprouts_print_set', 1]], created_at: YESTERDAY }),
    order({ skus: [['sprouts_print_set', 1]], created_at: EARLIER }),
    order({ skus: [['sprouts_print_set', 1]], created_at: '2026-09-16T12:00:00+00:00' }),
    order({ skus: [['sprouts_print_set', 1]], created_at: '2026-09-24T07:00:00+00:00' }),
  ], [], { yesterday: 0, week: 0 }, WIN);
  assertEquals(s.yesterday.setsSprouts, 1);
  assertEquals(s.week.setsSprouts, 2);
});

Deno.test('internal buyers, E2E purchases and other products are excluded', () => {
  const s = tallySales([
    order({ skus: [['sprouts_print_set', 1]], customer_email: 'hello@edeninstitute.health' }),
    order({ skus: [['sprouts_print_set', 1]], customer_email: 'Hello+e2e7@EdenInstitute.health' }),
    order({ skus: [['sprouts_print_set', 1]], e2e: 'true' }),
    order({ skus: [['sprouts_kit', 1]] }),
    order({ lookup_key: 'deep_dive_guide', order_items: [] }),
  ], [{ email: 'grammarswag@gmail.com', band: 'sprouts', created_at: YESTERDAY }], { yesterday: 0, week: 0 }, WIN);
  assertEquals(salesTotal(s.yesterday), 0);
  assertEquals(salesTotal(s.week), 0);
  assert(isInternalEmail(' hello@edeninstitute.health '));
  assert(!isInternalEmail('hello@example.com'));
});

Deno.test('an order whose line items are missing still counts once by lookup_key', () => {
  const s = tallySales([order({ lookup_key: 'seedlings_print_set', order_items: [] })], [], { yesterday: 0, week: 0 }, WIN);
  assertEquals(s.yesterday.setsSeedlings, 1);
});

Deno.test('text and HTML render every row, with no kit, preorder or founding wording', () => {
  const s = tallySales([order({ skus: [['sprouts_print_set', 1], ['sprouts_nb_print', 1]] })], [], { yesterday: 0, week: 1 }, WIN);
  const text = salesTextLines(s).join('\n');
  assert(text.startsWith('Sales (yesterday / last 7 days):'));
  assert(text.includes('1 / 1\tPrinted set, Sprouts'));
  assert(text.includes('1 / 1\tExtra notebook add-on, Sprouts'));
  assert(text.includes('0 / 1\tESA invoices paid'));
  const html = salesHtml(s);
  assert(html.includes('>Sales</p>') && html.includes('Last 7 days') && html.includes('Starter Unit, Seedlings'));
  for (const out of [text, html]) {
    assert(!/kit|preorder|founding|—/i.test(out), out);
  }
});

Deno.test('a failed read is shown, not hidden', () => {
  assert(salesTextLines(null).join('\n').includes('could not be read'));
  assert(salesHtml(null).includes('could not be read'));
});
