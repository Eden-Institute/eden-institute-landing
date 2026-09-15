// supabase/functions/_shared/learnworlds-charge.ts
//
// Decides what stripe-webhook does with a charge.succeeded event.
//
// The Foundations Course is sold on LearnWorlds, which is connected to this
// Stripe account through Stripe Connect, so a real course sale is a charge
// created by a Connect platform application (`application` set). Our own
// Checkout Sessions and subscription invoices are ledgered elsewhere.
//
// Founder decision 2026-09-15: a charge is counted as a course sale ONLY when
// it comes from the Connect application. A charge whose description merely
// mentions "foundations", "back to eden" or "learnworlds" is no longer counted;
// it is flagged for founder review instead (never silently dropped). Checked
// before the change: public.course_sales held 0 rows, so no past sale relied on
// the description match.
//
// Optional pin: when LEARNWORLDS_STRIPE_APPLICATION_ID is set, only that exact
// application id counts; a charge from any other application is flagged for
// review. The id is not known yet (no LearnWorlds charge has reached this
// webhook), so it is unset by default and any Connect application counts.

export type LearnWorldsChargeDecision =
  | { kind: 'ignore'; reason: string }
  | { kind: 'course_sale' }
  | { kind: 'review'; reason: string };

export interface ChargeLike {
  status?: string | null;
  invoice?: unknown;
  metadata?: Record<string, string> | null;
  description?: string | null;
  application?: string | { id?: string } | null;
}

const COURSE_DESCRIPTION = /back to eden|foundations|learnworlds/i;

function applicationId(app: ChargeLike['application']): string | null {
  if (!app) return null;
  if (typeof app === 'string') return app;
  return typeof app.id === 'string' && app.id ? app.id : null;
}

export function classifyLearnWorldsCharge(
  charge: ChargeLike,
  pinnedApplicationId: string | null | undefined = null,
): LearnWorldsChargeDecision {
  if (charge.status !== 'succeeded') return { kind: 'ignore', reason: 'not succeeded' };
  if (charge.invoice) return { kind: 'ignore', reason: 'subscription invoice' };
  const meta = charge.metadata ?? {};
  if (meta.lookup_key || meta.preorder_sku) return { kind: 'ignore', reason: 'our own checkout' };

  const app = applicationId(charge.application);
  const pin = pinnedApplicationId?.trim() || null;
  const looksLikeCourse = COURSE_DESCRIPTION.test(charge.description ?? '');

  if (app) {
    if (!pin || app === pin) return { kind: 'course_sale' };
    return { kind: 'review', reason: `charge from Connect application ${app}, not the pinned LearnWorlds application` };
  }
  if (looksLikeCourse) {
    return { kind: 'review', reason: 'description looks like a course sale but the charge has no Connect application' };
  }
  return { kind: 'ignore', reason: 'not a LearnWorlds charge' };
}
