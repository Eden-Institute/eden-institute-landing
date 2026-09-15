// Vercel Cron entry point for the end-of-day founder recap.
//
// Schedule: 01:00 UTC daily = 20:00 America/Chicago (CDT, UTC-5).
// During CST (UTC-6) it lands at 19:00 CT. Same one-hour seasonal drift
// api/cron/notify-founder-digest.ts accepts; we don't reschedule twice a year.
//
// Note the date rollover: 01:00 UTC is still the PREVIOUS calendar day in
// Central, which is exactly what we want. The EF derives its own Central-time
// window, so the report covers the day the founder just lived through.
//
// Pattern mirrors api/cron/notify-founder-digest.ts:
//   1. Vercel Cron auto-injects `Authorization: Bearer ${CRON_SECRET}`.
//   2. Forward to the Supabase EF with SUPABASE_SERVICE_ROLE_KEY.
//
// Required env vars (already set for the other crons):
//   CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { cronHandler } from '../_lib/cron-forward';

export default cronHandler({ name: 'founder-evening-recap cron', efName: 'founder-evening-recap' });

export const config = { runtime: 'edge' };
