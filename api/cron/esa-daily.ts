// Vercel Cron entry point for the ESA invoice daily pass (reminders + unpaid alerts).
// Added 2026-09-14 (#498). Once a day it calls esa-payment { action: "daily" }, which:
//   - sends the ONE family reminder for an invoice unpaid after 14 days (founder 2026-09-14),
//   - emails the founder about any invoice still unpaid after 30 days (once per invoice).
//
// Auth chain (api/_lib/cron-forward.ts):
//   1. Vercel Cron injects `Authorization: Bearer ${CRON_SECRET}`; verified here.
//   2. We call the EF with the service-role key; esa-payment runs at verify_jwt=true and checks the role.
//
// Required env (Vercel project settings): CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { cronHandler } from '../_lib/cron-forward';

export default cronHandler({ name: 'esa-daily', efName: 'esa-payment', body: { action: 'daily' } });

export const config = { runtime: 'edge' };
