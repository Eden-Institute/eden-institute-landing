// Vercel Cron entry point that drains lulu_jobs via the lulu-submit Supabase
// Edge Function.
//
// THIS IS THE SAFETY NET, not the primary path. stripe-webhook kicks lulu-submit
// directly on purchase, so an order normally reaches Lulu within seconds. This
// tick exists for everything that can go wrong with that kick: the webhook could
// not reach the function, Lulu was down, a required setting (LULU_SHIPPING_LEVEL,
// a product's file URLs) was missing and has since been filled in.
//
// Every 10 minutes. Lulu holds each job for a 48-hour production delay anyway,
// so a few minutes of queue latency changes nothing for the buyer; the short
// interval is about surfacing a stuck queue quickly, not speed.
//
// Auth chain (api/_lib/cron-forward.ts):
//   1. Vercel Cron injects `Authorization: Bearer ${CRON_SECRET}`; verified here.
//   2. We call the EF with the service-role key. lulu-submit runs at
//      verify_jwt=true AND checks the role claim, so the anon key will not do.
//
// Required env (Vercel project settings):
//   CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { cronHandler } from '../_lib/cron-forward.js';

export default cronHandler({
  name: 'drain-lulu-jobs',
  // No order_id in the body: this is the drain mode.
  efName: 'lulu-submit',
  // "Nothing to do" and "cannot do anything" must not look the same. Stuck jobs
  // are logged at error level so they surface rather than blend in.
  stuckAlert: {
    field: 'stuck',
    message: (n) =>
      `${n} Lulu job(s) have exhausted their retries and need a human. ` +
      `See lulu_jobs.last_error, then Resubmit from /founder.`,
  },
});

export const config = { runtime: 'edge' };
