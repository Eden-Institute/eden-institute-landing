// Vercel Cron entry point for the weekly trends briefing's RETRY PASS.
//
// Schedule: Friday 14:37 UTC, 37 minutes after the first pass
// (api/cron/weekly-trends-digest.ts at Friday 14:00 UTC). Same handler, same auth.
//
// The Edge Function claims each Friday in weekly_trends_runs, so this pass is a
// no-op ("already_ran") when the first pass sent the briefing, and sends it when
// the first pass failed or died mid-run. Added 2026-09-16, mirroring
// api/cron/notify-founder-digest-retry.ts: before this, one gateway 504 lost the week.

import handler from './weekly-trends-digest.js';

export default handler;

export const config = { runtime: 'edge' };
