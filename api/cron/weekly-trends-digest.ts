// Vercel Cron entry point for the weekly trends briefing.
//
// Schedule: Friday 14:00 UTC = 08:00 America/Chicago (CST) / 09:00 (CDT).
// Same one-hour seasonal drift convention as the daily digest — we don't
// reschedule the cron entry twice a year.
//
// Pattern mirrors api/cron/notify-founder-digest.ts:
//   1. Vercel Cron auto-injects `Authorization: Bearer ${CRON_SECRET}`.
//      We verify before invoking anything else.
//   2. Forward to the Supabase EF with SUPABASE_SERVICE_ROLE_KEY in
//      Authorization. EF runs at verify_jwt=true default; service-role
//      JWT is always valid.
//
// Required env vars (Vercel project settings — already set for the daily digest):
//   CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { cronHandler } from '../_lib/cron-forward.js';

export default cronHandler({ name: 'weekly-trends-digest cron', efName: 'weekly-trends-digest' });

export const config = { runtime: 'edge' };
