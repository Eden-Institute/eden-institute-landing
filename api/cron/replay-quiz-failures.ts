// PR (2026-04-29) v2 — Vercel Cron entry point that drains quiz_completion_failures
// via the replay-quiz-completion-failures Supabase Edge Function.
// Schedule: */30 * * * * (the /api/cron/replay-quiz-failures entry in vercel.json crons).
//
// Architecture: mirrors api/cron/drain-nurture-queue.ts (Lock #48 consumer for the
// nurture-email queue). Same auth chain, same env vars, same edge runtime.
//
// v2 hotfix (2026-04-29): Authorization header now sends service-role key
// (matches nurture-emails / drain-nurture-queue exactly). v1 was sending
// CRON_SECRET in Authorization which the Supabase EF replay-quiz-completion-
// failures v2 doesn't accept (it requires service-role JWT, same as
// nurture-emails).
//
// Why 30 minutes (vs nurture's 15): quiz-completion failures are recoverable but
// not time-sensitive in the same way email drips are. A 30-min recovery window is
// fast enough that the visitor's nurture sequence (which fires off the same email
// the EF gives them on success) catches up cleanly. Tunable in vercel.json.
//
// Auth chain:
//   1. Vercel Cron auto-injects `Authorization: Bearer ${CRON_SECRET}` on cron-
//      triggered requests. We verify that header matches the env var. This
//      prevents arbitrary POSTs from draining the queue.
//   2. We then call the Supabase EF with the service-role key in Authorization.
//      Same posture as the existing drain-nurture-queue cron.
//
// Required env vars (set in Vercel project settings):
//   CRON_SECRET                  random string, must match Vercel injection
//   SUPABASE_URL                 e.g. https://noeqztssupewjidpvhar.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    full service-role JWT from Supabase
//
// Observability: returns the EF response JSON to Vercel function logs.
// Production logs visible at vercel.com/eden-b55b0b13/eden-institute-landing/logs.

import { cronHandler } from '../_lib/cron-forward.js';

export default cronHandler({ name: 'replay-quiz-failures', efName: 'replay-quiz-completion-failures' });

export const config = { runtime: 'edge' };
