// Vercel Cron entry point for the daily lead-magnet founder digest.
//
// Schedule: 14:00 UTC daily = 08:00 America/Chicago (CST).
// During CDT (DST, UTC-5) the digest lands at 09:00 CT — acceptable one-hour
// seasonal drift; we don't reschedule the cron entry twice a year.
//
// Pattern mirrors api/cron/drain-nurture-queue.ts (PR #55, v3.33+):
//   1. Vercel Cron auto-injects `Authorization: Bearer ${CRON_SECRET}`.
//      We verify before invoking anything else.
//   2. Forward to the Supabase EF with SUPABASE_SERVICE_ROLE_KEY in
//      Authorization. EF runs at verify_jwt=true default; service-role
//      JWT is always valid.
//
// Required env vars (Vercel project settings):
//   CRON_SECRET                 random; matches Vercel-injected header
//   SUPABASE_URL                e.g. https://noeqztssupewjidpvhar.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY   full service-role JWT

import { cronHandler } from '../_lib/cron-forward';

export default cronHandler({ name: 'notify-founder-digest cron', efName: 'notify-founder-digest' });

export const config = { runtime: 'edge' };
