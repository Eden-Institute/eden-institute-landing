// Vercel Cron entry point for the hourly Broadcast list refresh.
//
// Founder decision 2026-10-14: list emails are scheduled ahead in Resend and their lists
// refresh themselves. A Resend segment is a static snapshot, so broadcast-stage (mode
// refresh_due) re-stages the "Broadcast: ..." segment of every Broadcast scheduled to send
// within the next 26 hours, at most once every 6 hours, so the last refresh lands a few hours
// before the send: families who became eligible are added, anyone who opted out or bought is
// removed. It sends nothing and schedules nothing; with nothing due it is one Resend list call.
//
// Schedule: every hour at :05.
//
// Pattern mirrors api/cron/sync-contact-properties.ts.
// Required env vars (already set for the other crons):
//   CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { cronHandler } from '../_lib/cron-forward.js';

export default cronHandler({
  name: 'refresh-broadcasts cron',
  efName: 'broadcast-stage',
  body: { mode: 'refresh_due' },
});

export const config = { runtime: 'edge' };
