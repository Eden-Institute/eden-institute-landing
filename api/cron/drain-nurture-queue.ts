// PR #55 v3.33+ — Vercel Cron entry point that drains nurture_email_queue
// via the nurture-emails Supabase Edge Function.
// Schedule: */15 * * * * (the /api/cron/drain-nurture-queue entry in vercel.json crons).
//
// Lock #48 implementation: this is the SCHEDULER side of the durable
// nurture pattern. The QUEUE PRODUCER side (resend-waitlist EF rewrite
// to INSERT INTO nurture_email_queue instead of using Resend
// `scheduled_at`) lands in PR #53.
//
// Auth chain: see api/_lib/cron-forward.ts. nurture-emails runs at verify_jwt=true
// AND requires role=service_role (_shared/require-service-role.ts), so the
// service-role key IS the EF's auth and the anon key will not do.
//
// Required env vars (set in Vercel project settings):
//   CRON_SECRET                  random string, must match the value Vercel injects
//   SUPABASE_URL                 e.g. https://noeqztssupewjidpvhar.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    full service-role JWT from Supabase
//
// Observability: returns the EF response JSON to Vercel function logs.
// Production logs visible at vercel.com/eden-b55b0b13/eden-institute-landing/logs.

import { cronHandler } from '../_lib/cron-forward';

export default cronHandler({ name: 'drain-nurture-queue', efName: 'nurture-emails' });

export const config = { runtime: 'edge' };
