// supabase/functions/_shared/founding-milestones.ts
//
// Founder-facing milestone pings for the founding-500 run: an email to FOUNDER_EMAIL
// the moment the net founding count first reaches 250 / 400 / 475 / 490 / cap, so the
// founder watches the run fill and knows the exact flip moment instead of waiting for
// the next morning's digest. Called from stripe-webhook right after a preorder is
// recorded; the caller wraps it in try/catch, so a Resend or DB hiccup can never fail
// (and force Stripe to retry) an already-recorded order.
//
// Exactly-once per milestone: the founding_milestones primary key (product_id,
// milestone) is the claim. Only the inserter that wins the row sends; a concurrent
// duplicate gets 23505 and sends nothing. If the send fails AFTER the claim (non-2xx
// OR a rejected fetch), the row is deleted so the next recorded order re-attempts the
// notification; a failed delete is logged loudly because the leaked claim would
// otherwise silently suppress that milestone forever. Known narrow window: if the
// isolate dies between the claim insert and the send, the row survives unsent (no
// sent-status column to sweep) and that one ping is lost; accepted for a
// founder-notification nicety, the daily digest still reports the count.

import { Db, getFoundingGate } from './order-db.ts';
import { FOUNDING_GATE_SKU } from './order-config.ts';

// Intermediate milestones per the founder brief; the cap itself (the flip moment) is
// always appended, so a config change to founding_qty_limit keeps the final ping.
const INTERMEDIATE_MILESTONES = [250, 400, 475, 490];

// deno-lint-ignore no-explicit-any
function errCode(err: any): string | undefined { return err?.code; }

export async function notifyFoundingMilestones(db: Db): Promise<void> {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) {
    // Bail BEFORE claiming any milestone: an unclaimed milestone is re-attempted on
    // the next order, a claimed-but-unsent one would be lost forever.
    console.warn('notifyFoundingMilestones: RESEND_API_KEY missing; skipping');
    return;
  }
  const founderEmail = Deno.env.get('FOUNDER_EMAIL') ?? 'hello@edeninstitute.health';
  const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'The Eden Institute <hello@edeninstitute.health>';

  const { data: gate, error: gateError } = await db.from('products')
    .select('id, founding_qty_limit').eq('sku', FOUNDING_GATE_SKU).maybeSingle();
  if (gateError) throw new Error(`gate product lookup failed: ${gateError.message}`);
  if (!gate?.id || typeof gate.founding_qty_limit !== 'number') return;

  const cap: number = gate.founding_qty_limit;
  const status = await getFoundingGate(db, gate.id);
  const milestones = [...INTERMEDIATE_MILESTONES.filter((m) => m < cap), cap];

  for (const m of milestones) {
    if (status.sold < m) continue;

    const { error } = await db.from('founding_milestones')
      .insert({ product_id: gate.id, milestone: m, sold_at_notify: status.sold });
    if (error) {
      if (errCode(error) !== '23505') {
        console.error(`founding milestone ${m}: claim failed: ${error.message}`);
      }
      continue; // 23505 = already notified (possibly by a concurrent delivery)
    }

    const isFlip = m >= cap;
    const subject = isFlip
      ? `Founding ${cap} complete: retail pricing is live`
      : `Founding kits: ${status.sold} of ${cap} claimed (milestone ${m})`;
    const bodyLines = isFlip
      ? [
        `The ${cap}th founding kit has been claimed (${status.sold} net founding units recorded).`,
        `The founding window is now latched closed: checkout sells at retail automatically,`,
        `and a refund can no longer reopen founding pricing.`,
        ``,
        `Launch-runbook reminder: the static founding copy needs its post-sellout sweep:`,
        `/homeschool (incl. the co-op section), the /preorder hero, page title, and`,
        `JSON-LD prices, the SPA Homeschool twin, and sprouts-founders.html`,
        `(full checklist: docs/preorder-system-phase-1.md, Part 4).`,
      ]
      : [
        `${status.sold} of ${cap} founding kits are claimed (${Math.max(0, cap - status.sold)} remaining at the founding price).`,
        ``,
        `This is the ${m}-unit milestone ping from the preorder webhook. The final ping`,
        `arrives the moment kit ${cap} sells and pricing flips to retail.`,
      ];
    const text = bodyLines.join('\n');
    const html = `<p style="font-family:Georgia,serif;font-size:15px;line-height:1.7;color:#1C3A2E;">${
      bodyLines.map((l) => (l === '' ? '</p><p style="font-family:Georgia,serif;font-size:15px;line-height:1.7;color:#1C3A2E;">' : l)).join(' ')
    }</p>`;

    // The fetch itself can REJECT (DNS, connection reset, timeout), not just return
    // non-2xx; both failure modes must release the claim or the milestone is lost.
    let sent = false;
    try {
      const sendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fromEmail, to: founderEmail, subject, html, text }),
      });
      sent = sendRes.ok;
      if (!sendRes.ok) {
        console.error(`founding milestone ${m}: Resend failed`, sendRes.status, await sendRes.text().catch(() => ''));
      }
    } catch (sendErr) {
      console.error(`founding milestone ${m}: Resend fetch rejected:`, sendErr instanceof Error ? sendErr.message : String(sendErr));
    }
    if (!sent) {
      // Release the claim so the next recorded order retries this milestone. A failed
      // release must be loud: the leaked row would silently suppress this milestone
      // forever (manual fix: delete it from founding_milestones).
      const { error: releaseError } = await db.from('founding_milestones').delete()
        .eq('product_id', gate.id).eq('milestone', m);
      if (releaseError) {
        console.error(`founding milestone ${m}: claim release FAILED; milestone email is suppressed until the row is deleted manually: ${releaseError.message}`);
      }
      continue;
    }
    console.log(`founding milestone ${m} notified (sold=${status.sold} of ${cap})`);
  }
}
