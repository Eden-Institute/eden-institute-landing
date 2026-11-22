// wired-bank: the active question bank for one set, with every scoring key stripped
// (Fearfully & Wonderfully Wired, W3; spec section 8). Public GET, cacheable, DARK until
// WIRED_ENABLED (see _shared/wired-gate.ts). verify_jwt = false (config.toml).
//
//   GET /functions/v1/wired-bank?set=k2|g3_5|g6_8|g9_12|teen|adult

import { publicBank } from '../_shared/wired-engine.ts';
import { activeBank, type Db } from '../_shared/wired-submit-flow.ts';
import { wiredJson } from '../_shared/wired-gate.ts';
import { wiredTesterGate } from '../_shared/wired-pilot-pass.ts';

const SETS = new Set(['k2', 'g3_5', 'g6_8', 'g9_12', 'teen', 'adult']);

Deno.serve(async (req) => {
  const gate = await wiredTesterGate(req);
  if (gate) return gate;
  if (req.method !== 'GET') return wiredJson(405, { error: 'method_not_allowed' });
  const set = new URL(req.url).searchParams.get('set') ?? '';
  if (!SETS.has(set)) return wiredJson(400, { error: 'set must be one of k2, g3_5, g6_8, g9_12, teen, adult' });
  const db: Db = { url: Deno.env.get('SUPABASE_URL') ?? '', key: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' };
  try {
    const bank = await activeBank(db, set);
    if (!bank) return wiredJson(404, { error: 'no_active_bank' });
    return wiredJson(200, publicBank(bank), { 'Cache-Control': 'public, max-age=300' });
  } catch (err) {
    console.error('wired-bank:', err instanceof Error ? err.message : String(err));
    return wiredJson(500, { error: 'could_not_load_questions' });
  }
});
