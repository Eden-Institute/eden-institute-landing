// Vercel Cron entry point for the Wired quiz purchase PDFs (Fearfully & Wonderfully Wired, W7).
// Every 5 minutes it calls the wired-pdf edge function, which builds and emails ONE queued PDF job.
// stripe-webhook already kicks it right after each purchase; this is the safety net for a kick
// that failed or a job that needs a retry. With nothing queued it returns { claimed: 0 } at once.
//
// Auth chain (api/_lib/cron-forward.ts): Vercel Cron injects `Authorization: Bearer
// ${CRON_SECRET}` (checked there); the EF is called with the service-role key and runs at
// verify_jwt=true, checking the role. Env: CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { cronHandler } from '../_lib/cron-forward.js';

export default cronHandler({ name: 'wired-pdf', efName: 'wired-pdf', body: {} });

export const config = { runtime: 'edge' };
