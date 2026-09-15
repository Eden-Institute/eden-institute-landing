// Vercel Cron entry point that drains starter_deliveries via the starter-fulfill
// Supabase Edge Function.
//
// THIS IS THE SAFETY NET, not the primary path. stripe-webhook kicks
// starter-fulfill directly on purchase, so a buyer normally has their files
// within seconds. This tick exists for everything that can go wrong with that
// kick: the webhook could not reach the function, the isolate died mid-stamp,
// Resend was down, Storage 500'd.
//
// It is deliberately frequent (every 10 minutes). A buyer of a $39 instant
// download who is still waiting an hour later has effectively not received what
// they paid for, so the recovery window has to be short.
//
// Auth chain (api/_lib/cron-forward.ts):
//   1. Vercel Cron injects `Authorization: Bearer ${CRON_SECRET}`; verified here
//      so the endpoint cannot be triggered from arbitrary IPs.
//   2. We call the EF with the service-role key. starter-fulfill runs at
//      verify_jwt=true AND checks the role claim, so the anon key will not do.
//
// Required env (Vercel project settings):
//   CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { cronHandler } from '../_lib/cron-forward';

export default cronHandler({
  name: 'drain-starter-deliveries',
  // No session_id in the body: this is the drain mode.
  efName: 'starter-fulfill',
  // A drain that reports "nothing to do" is indistinguishable from one that
  // CANNOT do anything, which is how two scheduled tasks sat dead for three weeks
  // in August 2026 while reporting success every Monday. Stuck deliveries are
  // therefore logged at error level so they surface rather than blend in.
  stuckAlert: {
    field: 'stuck',
    message: (n) =>
      `${n} delivery/deliveries have exhausted their retries ` +
      `and need a human. Query starter_delivery_attempts by session id.`,
  },
});

export const config = { runtime: 'edge' };
