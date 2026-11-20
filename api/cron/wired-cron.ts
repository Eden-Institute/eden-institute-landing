// Vercel Cron entry point for wired-cron (Fearfully & Wonderfully Wired): once a day at 13:00 UTC
// (8 AM CDT / 7 AM CST). W8: queues the July 1 and July 15 check-in emails on those dates; on every
// other day it returns { position: null } at once. W9 adds observer reminders and the deletion sweep.
//
// Auth chain (api/_lib/cron-forward.ts): Vercel Cron injects `Authorization: Bearer ${CRON_SECRET}`;
// the EF is called with the service-role key and runs at verify_jwt=true, checking the role.

import { cronHandler } from '../_lib/cron-forward.js';

export default cronHandler({ name: 'wired-cron', efName: 'wired-cron', body: {} });

export const config = { runtime: 'edge' };
