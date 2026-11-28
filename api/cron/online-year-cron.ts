// Vercel Cron entry point for online-year-cron (Eden's Table Online Year, OY8): once a day at 13:00 UTC
// (8 AM CDT / 7 AM CST), the 14-days-before and end-day emails (approved Emails 3 and 4).
//
// Auth chain (api/_lib/cron-forward.ts): Vercel Cron injects `Authorization: Bearer ${CRON_SECRET}`;
// the EF is called with the service-role key and runs at verify_jwt=true, checking the role.

import { cronHandler } from '../_lib/cron-forward.js';

export default cronHandler({ name: 'online-year-cron', efName: 'online-year-cron', body: {} });

export const config = { runtime: 'edge' };
