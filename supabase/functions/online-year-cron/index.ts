// supabase/functions/online-year-cron/index.ts
// Online Year daily job (OY8, punch #472): 14-days-before and end-day emails (approved Emails 3 and 4).
// Called once a day by Vercel Cron (api/cron/online-year-cron.ts, 13:00 UTC = 8 AM CDT / 7 AM CST) with the
// service-role key; verify_jwt = true and service role only (config.toml). Logic: ../_shared/online-year-email-send.ts.
// Not behind ONLINE_YEAR_ENABLED: it only writes to families who hold a license, and there are none before launch.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceRoleRequest, serviceRoleRequired } from '../_shared/require-service-role.ts';
import { runOnlineYearCron } from '../_shared/online-year-email-send.ts';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (!isServiceRoleRequest(req)) return serviceRoleRequired(CORS);
  const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  const result = await runOnlineYearCron(db, Deno.env.get('RESEND_API_KEY') ?? '');
  console.log(`online-year-cron: ${JSON.stringify(result)}`);
  return new Response(JSON.stringify(result), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
});
