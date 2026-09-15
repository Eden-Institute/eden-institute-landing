// Vercel Cron entry point for the founder's 24-hour launch-email preview.
//
// Schedule: 15:00 UTC daily = 10:00 America/Chicago (CDT). The launch series
// sends at 15:00 UTC, so a run at 15:00 UTC finds the next day's email sitting
// almost exactly 24 hours out. The edge function widens that to an 18-30 hour
// window so a drifting cron, or a send hour that shifts with DST, can never
// skip an email entirely.
//
// The function is idempotent (sequence_position is the primary key of
// launch_email_previews), so an extra run costs nothing.
//
// Pattern mirrors api/cron/notify-founder-digest.ts.
//
// Required env vars (already set for the other crons):
//   CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { cronHandler } from '../_lib/cron-forward.js';

export default cronHandler({ name: 'launch-email-preview cron', efName: 'launch-email-preview' });

export const config = { runtime: 'edge' };
