// supabase/functions/_shared/online-year-email-send.ts
//
// I/O for the Online Year family emails (OY8, punch #472): reads licenses and parents with the service-role
// client, plans with online-year-emails.ts (pure, tested), sends through Resend with a per-email
// Idempotency-Key, and marks the cron emails sent. Used by stripe-webhook (order emails, right after a grant)
// and online-year-cron (renew + ended, daily).
//
// NEVER THROWS. In the webhook the sale and licenses are already recorded; an email problem is logged and
// reported in the return value, never allowed to fail or retry the webhook.

import { SELLER_ADDRESS, SELLER_LEGAL_NAME } from './receipt.ts';
import { OY_EMAIL_FROM, OY_EMAIL_REPLY_TO, planCronEmails, planOrderEmails, ENDED_GRACE_DAYS, RENEW_DAYS, type OyEmail, type OyLicense, type OyParent } from './online-year-emails.ts';

export const OY_EMAIL_ADDRESS = `${SELLER_LEGAL_NAME} · ${SELLER_ADDRESS}`;
const LIC_COLS = 'id, parent_id, band, child_name, kind, starts_at, ends_at, status, order_id, renews_license_id, renew_notice_sent_at, ended_notice_sent_at';

// deno-lint-ignore no-explicit-any
type Db = any;

export async function sendOyEmail(e: OyEmail, resendKey: string, category: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  if (!resendKey) {
    console.error('online-year email: RESEND_API_KEY missing; not sent');
    return false;
  }
  const res = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': e.idempotencyKey },
    body: JSON.stringify({
      from: OY_EMAIL_FROM,
      reply_to: OY_EMAIL_REPLY_TO,
      to: [e.to],
      subject: e.subject,
      html: e.html,
      text: e.text,
      tags: [{ name: 'category', value: category }, { name: 'campaign', value: 'online_year' }],
    }),
  });
  if (!res.ok) console.error(`online-year email: Resend ${res.status} for ${e.idempotencyKey}`, (await res.text().catch(() => '')).slice(0, 300));
  return res.ok;
}

const asParent = (r: { id: unknown; email: unknown; first_name: unknown }): OyParent => ({ id: String(r.id), email: String(r.email), first_name: (r.first_name as string | null) ?? null });

/** Email 1 or 2 for a just-granted order. Returns how many went out; never throws. */
export async function sendOnlineYearOrderEmails(db: Db, orderId: string, resendKey: string): Promise<{ sent: number; failed: number }> {
  let sent = 0, failed = 0;
  try {
    const { data: orderLics, error } = await db.from('online_year_licenses').select(LIC_COLS).eq('order_id', orderId);
    if (error) throw new Error(error.message);
    if (!orderLics?.length) return { sent, failed };
    const parentId = String(orderLics[0].parent_id);
    const { data: p, error: pe } = await db.from('online_year_parents').select('id, email, first_name').eq('id', parentId).single();
    if (pe || !p) throw new Error(pe?.message ?? 'no parent');
    const { data: fam, error: fe } = await db.from('online_year_licenses').select(LIC_COLS).eq('parent_id', parentId);
    if (fe) throw new Error(fe.message);
    for (const e of planOrderEmails(asParent(p), orderId, orderLics as OyLicense[], (fam ?? []) as OyLicense[], OY_EMAIL_ADDRESS)) {
      (await sendOyEmail(e, resendKey, e.idempotencyKey.startsWith('oy-ready') ? 'online_year_ready' : 'online_year_sibling')) ? sent++ : failed++;
    }
  } catch (err) {
    console.error('online-year order emails failed', err instanceof Error ? err.message : String(err));
    failed++;
  }
  return { sent, failed };
}

/** The daily job (online-year-cron). Returns what it did; never throws. */
export async function runOnlineYearCron(db: Db, resendKey: string, now: Date = new Date()): Promise<{ due: number; sent: number; failed: number }> {
  let sent = 0, failed = 0, due = 0;
  try {
    const from = new Date(now.getTime() - ENDED_GRACE_DAYS * 86_400_000).toISOString();
    const to = new Date(now.getTime() + RENEW_DAYS * 86_400_000).toISOString();
    const { data: ending, error } = await db.from('online_year_licenses').select(LIC_COLS).eq('status', 'active').gte('ends_at', from).lte('ends_at', to);
    if (error) throw new Error(error.message);
    if (!ending?.length) return { due, sent, failed };
    const parentIds = [...new Set((ending as OyLicense[]).map((l) => l.parent_id))];
    // Everything those families hold: renewals (renews_license_id) and running siblings both live there.
    const { data: fam, error: fe } = await db.from('online_year_licenses').select(LIC_COLS).in('parent_id', parentIds);
    if (fe) throw new Error(fe.message);
    const { data: ps, error: pe } = await db.from('online_year_parents').select('id, email, first_name').in('id', parentIds);
    if (pe) throw new Error(pe.message);
    const parents = new Map<string, OyParent>((ps ?? []).map((r: { id: unknown; email: unknown; first_name: unknown }) => [String(r.id), asParent(r)]));
    const emails = planCronEmails(now, (fam ?? []) as OyLicense[], parents, OY_EMAIL_ADDRESS);
    due = emails.length;
    for (const e of emails) {
      const ok = await sendOyEmail(e, resendKey, e.mark?.column === 'renew_notice_sent_at' ? 'online_year_renew_14' : 'online_year_ended');
      if (ok && e.mark) {
        const { error: me } = await db.from('online_year_licenses').update({ [e.mark.column]: now.toISOString() }).eq('id', e.mark.licenseId).is(e.mark.column, null);
        if (me) console.error(`online-year cron: sent but not marked ${e.idempotencyKey}: ${me.message}`);
      }
      ok ? sent++ : failed++;
    }
  } catch (err) {
    console.error('online-year cron failed', err instanceof Error ? err.message : String(err));
    failed++;
  }
  return { due, sent, failed };
}
