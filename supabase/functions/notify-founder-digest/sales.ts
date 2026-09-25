// Sales section of the Daily Lead Digest (added 2026-09-24).
//
// Replaces the retired founding-kit runway line. Pure: no network, no env, so the
// tally and both renderings are unit-tested in sales.test.ts. index.ts does the
// fetching and hands the rows in.
//
// Sources, and why these ones:
//   Printed sets + extra notebooks -> orders + order_items + products.sku, the same
//     join the /founder dashboard reads (founder_orders RPC, migration
//     20260911000100_lulu_pod_fulfillment.sql). Stripe print orders and ESA printed
//     orders both land here (esa-fulfil.ts inserts the order).
//   Starter Units (Stripe)         -> orders.lookup_key sprouts_starter_unit /
//     seedlings_starter_unit, as starter_conversion_report() and list-announce count them.
//   Starter Units (ESA)            -> starter_deliveries rows keyed esa_*: an ESA Starter
//     writes a delivery with NO order (esa-fulfil.ts), so orders alone would miss it.
//   ESA invoices paid              -> esa_invoices.paid_at, is_test excluded (fetchEsaStatus).
//     The printed sets and Starters those invoices bought are already in the lines above.
//
// Exclusions, matching the founder dashboards: status cancelled/refunded (filtered in
// the query), internal buyer emails (public.is_internal_email, migration
// 20260720030000_internal_payment_flag.sql, mirrored below), and E2E test purchases
// (raw.metadata.e2e_test = "true", _shared/e2e-mode.ts).

export type Band = 'sprouts' | 'seedlings';

export const PRINT_SET_SKUS: Record<string, Band> = {
  sprouts_print_set: 'sprouts',
  seedlings_print_set: 'seedlings',
};
export const EXTRA_NB_SKUS: Record<string, Band> = {
  sprouts_nb_print: 'sprouts',
  seedlings_nb_print: 'seedlings',
};
export const STARTER_KEYS: Record<string, Band> = {
  sprouts_starter_unit: 'sprouts',
  seedlings_starter_unit: 'seedlings',
};

/** Mirror of public.is_internal_email (20260720030000_internal_payment_flag.sql). */
export function isInternalEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  return e === 'hello@edeninstitute.health' ||
    e === 'grammarswag@gmail.com' ||
    (e.startsWith('hello+') && e.endsWith('@edeninstitute.health'));
}

export interface SalesOrderRow {
  customer_email: string | null;
  lookup_key: string | null;
  quantity: number | null;
  created_at: string;
  e2e: string | null;
  order_items: { quantity: number | null; products: { sku: string | null } | null }[] | null;
}

export interface SalesDeliveryRow {
  email: string | null;
  band: string | null;
  created_at: string;
}

export interface SalesCounts {
  setsSprouts: number;
  setsSeedlings: number;
  nbSprouts: number;
  nbSeedlings: number;
  starterSprouts: number;
  starterSeedlings: number;
  esaPaid: number;
}

export interface SalesDigest {
  yesterday: SalesCounts;
  week: SalesCounts;
}

export function emptyCounts(): SalesCounts {
  return { setsSprouts: 0, setsSeedlings: 0, nbSprouts: 0, nbSeedlings: 0, starterSprouts: 0, starterSeedlings: 0, esaPaid: 0 };
}

const qty = (n: number | null | undefined) => (typeof n === 'number' && n > 0 ? n : 1);

function addOrder(c: SalesCounts, o: SalesOrderRow): void {
  const starter = o.lookup_key ? STARTER_KEYS[o.lookup_key] : undefined;
  if (starter) {
    if (starter === 'sprouts') c.starterSprouts += qty(o.quantity);
    else c.starterSeedlings += qty(o.quantity);
    return;
  }
  const items = (o.order_items ?? []).filter((i) => i.products?.sku);
  // An order whose line items failed to write still counts once, by its lookup_key.
  const lines = items.length > 0
    ? items.map((i) => ({ sku: i.products!.sku as string, n: qty(i.quantity) }))
    : o.lookup_key ? [{ sku: o.lookup_key, n: 1 }] : [];
  for (const { sku, n } of lines) {
    const set = PRINT_SET_SKUS[sku];
    const nb = EXTRA_NB_SKUS[sku];
    if (set === 'sprouts') c.setsSprouts += n;
    else if (set === 'seedlings') c.setsSeedlings += n;
    else if (nb === 'sprouts') c.nbSprouts += n;
    else if (nb === 'seedlings') c.nbSeedlings += n;
  }
}

/**
 * Tally sales for yesterday [dayStart, dayEnd) and the last 7 days [weekStart, dayEnd).
 * `deliveries` must already be limited to ESA Starter rows (no Stripe order behind them).
 */
export function tallySales(
  orders: SalesOrderRow[],
  deliveries: SalesDeliveryRow[],
  esaPaid: { yesterday: number; week: number },
  win: { dayStart: string; dayEnd: string; weekStart: string },
): SalesDigest {
  const ds = Date.parse(win.dayStart);
  const de = Date.parse(win.dayEnd);
  const ws = Date.parse(win.weekStart);
  const yesterday = emptyCounts();
  const week = emptyCounts();
  const buckets = (iso: string): SalesCounts[] => {
    const t = Date.parse(iso);
    if (!(t >= ws && t < de)) return [];
    return t >= ds ? [yesterday, week] : [week];
  };
  for (const o of orders) {
    if (isInternalEmail(o.customer_email) || o.e2e === 'true') continue;
    for (const c of buckets(o.created_at)) addOrder(c, o);
  }
  for (const d of deliveries) {
    if (isInternalEmail(d.email)) continue;
    for (const c of buckets(d.created_at)) {
      if (d.band === 'seedlings') c.starterSeedlings += 1;
      else c.starterSprouts += 1; // a row with no band is Sprouts (starter_unit_band migration)
    }
  }
  yesterday.esaPaid = esaPaid.yesterday;
  week.esaPaid = esaPaid.week;
  return { yesterday, week };
}

export function salesTotal(c: SalesCounts): number {
  return c.setsSprouts + c.setsSeedlings + c.nbSprouts + c.nbSeedlings + c.starterSprouts + c.starterSeedlings;
}

const ROWS: [keyof SalesCounts, string][] = [
  ['setsSprouts', 'Printed set, Sprouts'],
  ['setsSeedlings', 'Printed set, Seedlings'],
  ['nbSprouts', 'Extra notebook add-on, Sprouts'],
  ['nbSeedlings', 'Extra notebook add-on, Seedlings'],
  ['starterSprouts', 'Starter Unit, Sprouts'],
  ['starterSeedlings', 'Starter Unit, Seedlings'],
  ['esaPaid', 'ESA invoices paid'],
];

const ESA_NOTE = 'ESA purchases are already counted in the lines above.';
const UNREADABLE = 'Sales could not be read today. Check the notify-founder-digest logs.';

/** Plain-text lines for the digest's text part. `null` = the sales read failed. */
export function salesTextLines(s: SalesDigest | null): string[] {
  if (!s) return ['Sales:', `  ${UNREADABLE}`];
  return [
    'Sales (yesterday / last 7 days):',
    ...ROWS.map(([k, label]) => `  ${s.yesterday[k]} / ${s.week[k]}\t${label}`),
    `  ${ESA_NOTE}`,
  ];
}

/** The HTML block. Styling matches the other digest sections. */
export function salesHtml(s: SalesDigest | null): string {
  const heading = `<p style="font-family:Georgia,serif;font-size:12px;font-weight:bold;letter-spacing:2px;color:#C9A84C;text-transform:uppercase;margin:16px 0 8px 0;">Sales</p>`;
  if (!s) {
    return `${heading}
<p style="font-family:Georgia,serif;font-size:14px;color:#8B2E2E;margin:0 0 8px 0;">${UNREADABLE}</p>`;
  }
  const th = 'padding:8px 10px;font-family:Georgia,serif;font-size:11px;letter-spacing:1px;color:#6B6560;text-transform:uppercase;border-bottom:2px solid #C9A84C;';
  const td = 'padding:6px 10px;border-bottom:1px solid #F0EAD8;font-family:Georgia,serif;font-size:13px;color:#1C3A2E;';
  const rows = ROWS.map(([k, label]) => `
    <tr>
      <td style="${td}">${label}</td>
      <td style="${td}text-align:right;font-weight:${s.yesterday[k] > 0 ? 'bold' : 'normal'};">${s.yesterday[k]}</td>
      <td style="${td}text-align:right;">${s.week[k]}</td>
    </tr>`).join('');
  return `${heading}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:4px;">
<thead>
<tr style="background:#F5F0E8;">
<th style="${th}text-align:left;">Item</th>
<th style="${th}text-align:right;">Yesterday</th>
<th style="${th}text-align:right;">Last 7 days</th>
</tr>
</thead>
<tbody>${rows}</tbody>
</table>
<p style="font-family:Georgia,serif;font-size:11px;color:#6B6560;margin:4px 0 8px 0;font-style:italic;">${ESA_NOTE}</p>
`;
}
