// Vercel Cron entry point for the Wired quiz dead letter (Fearfully & Wonderfully Wired, W3).
// Every 30 minutes it calls the wired-replay-failures edge function, which finishes any quiz
// submission wired-submit could not store (same path as a live submission). With nothing in
// wired_failures it returns { found: 0 } in a few milliseconds.
//
// Auth chain (api/_lib/cron-forward.ts): Vercel Cron injects `Authorization: Bearer
// ${CRON_SECRET}` (checked there); the EF is called with the service-role key and runs at
// verify_jwt=true, checking the role. Env: CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { cronHandler } from '../_lib/cron-forward.js';

export default cronHandler({ name: 'wired-replay-failures', efName: 'wired-replay-failures', body: {} });

export const config = { runtime: 'edge' };
