// Vercel Cron entry point for the nightly Resend contact-property sync.
//
// Schedule: 08:30 UTC daily = 03:30 America/Chicago (CDT). Chosen so the
// engagement tiers reflect the previous day's opens before any 10:00 Central
// send goes out, and so it never overlaps the 15-minute nurture drain's busiest
// window (the 15:00 UTC list sends).
//
// Pattern mirrors api/cron/founder-evening-recap.ts:
//   1. Vercel Cron auto-injects `Authorization: Bearer ${CRON_SECRET}`.
//   2. Forward to the Supabase EF with SUPABASE_SERVICE_ROLE_KEY.
//
// The EF processes at most `batch` changed contacts per call (100, about
// 70 s; the EF wall clock is 150 s) and reports `remaining`. On an ordinary
// night the delta is small and one call finishes it; after a big send the
// tail carries into the next night.
//
// Required env vars (already set for the other crons):
//   CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { cronHandler } from '../_lib/cron-forward.js';

export default cronHandler({
  name: 'sync-contact-properties cron',
  efName: 'contact-properties-sync',
  body: { mode: 'sync', batch: 100 },
});

export const config = { runtime: 'edge' };
