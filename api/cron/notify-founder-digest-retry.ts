// Vercel Cron entry point for the founder digest's RETRY PASS.
//
// Schedule: 14:37 UTC daily, 37 minutes after the first pass
// (api/cron/notify-founder-digest.ts at 14:00 UTC). Same handler, same auth.
//
// The Edge Function claims each day in digest_runs, so this pass is a no-op
// ("already_ran") when the first pass sent the digest, and sends it when the
// first pass failed or died mid-run. Added 2026-09-13 after gateway 504s left
// the 2026-09-12 digest unsent until it was re-run by hand.

import handler from './notify-founder-digest.js';

export default handler;

export const config = { runtime: 'edge' };
