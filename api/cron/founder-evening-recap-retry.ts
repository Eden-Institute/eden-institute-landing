// Vercel Cron entry point for the evening recap's RETRY PASS.
//
// Schedule: 01:37 UTC daily, 37 minutes after the first pass
// (api/cron/founder-evening-recap.ts at 01:00 UTC). Same handler, same auth.
//
// The Edge Function claims each Central-time day in recap_runs, so this pass is a
// no-op ("already_ran") when the first pass sent the recap, and sends it when the
// first pass failed or died mid-run. 01:37 UTC is still the same Central day as
// 01:00 UTC, so both passes claim the same row. Added 2026-09-16 after gateway 504s
// lost the 2026-09-11 and 2026-09-12 recaps; the manual {"date"} re-send stays
// available for anything older.

import handler from './founder-evening-recap.js';

export default handler;

export const config = { runtime: 'edge' };
