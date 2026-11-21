// wired-matches: re-rank a child's curriculum matches live when mom changes her filters or
// ranking (Fearfully & Wonderfully Wired, W3; spec sections 6 + 8, answers 9, 25, 28).
// Public POST {token, child_id, filters, ranking}, DARK until WIRED_ENABLED. The ONE writer
// of wired_family_prefs (answer 9). Locked children get no matches. verify_jwt = false.
// 2026-11-21: each match also carries its display fields (url, is_affiliate, price_cents, price_basis,
// prep_load), read only AFTER ranking (rule 3), and the reply carries up to 3 Helpful extras (answer 38)
// chosen with the same filters (_shared/wired-display.ts).

import { type Domain, type Scores } from '../_shared/wired-engine.ts';
import { rankCurricula } from '../_shared/wired-match.ts';
import { cleanRanking, type FamilyAnswers, prefsFromAnswers } from '../_shared/wired-submit-core.ts';
import { approvedCurricula, type Db, esaRows, helpfulExtraRows, matchDisplayRows, pg } from '../_shared/wired-submit-flow.ts';
import { pickHelpfulExtras, withDisplay } from '../_shared/wired-display.ts';
import { verifyWiredToken } from '../_shared/wired-token.ts';
import { wiredGate, wiredJson } from '../_shared/wired-gate.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATE_RE = /^[A-Za-z]{2}$/;

Deno.serve(async (req) => {
  const gate = wiredGate(req);
  if (gate) return gate;
  if (req.method !== 'POST') return wiredJson(405, { error: 'method_not_allowed' });
  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return wiredJson(400, { error: 'body must be JSON' });
  }
  let grant;
  try {
    grant = await verifyWiredToken(body?.token, 'results');
  } catch (err) {
    console.error('wired-matches: token secret problem:', err instanceof Error ? err.message : String(err));
    return wiredJson(500, { error: 'server_misconfigured' });
  }
  if (!grant) return wiredJson(401, { error: 'invalid_or_expired_link' });
  if (typeof body.child_id !== 'string' || !UUID_RE.test(body.child_id)) return wiredJson(400, { error: 'child_id is required' });

  const f = body.filters && typeof body.filters === 'object' ? body.filters : {};
  const state = typeof f.state === 'string' && STATE_RE.test(f.state) ? f.state.toUpperCase() : null;
  const filters = { withinBudget: f.withinBudget === true, christianOnly: f.christianOnly === true, esaOnly: f.esaOnly === true && !!state, state };
  const ranking = cleanRanking(body.ranking);

  const db: Db = { url: Deno.env.get('SUPABASE_URL') ?? '', key: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' };
  try {
    const kid = await pg<{ id: string; grade: number; unlocked_via: string | null }[]>(
      db, `wired_children?id=eq.${body.child_id}&family_id=eq.${grant.familyId}&removed_at=is.null&select=id,grade,unlocked_via&limit=1`,
    );
    if (!kid?.length) return wiredJson(404, { error: 'not_found' });
    if (kid[0].unlocked_via === null) return wiredJson(403, { error: 'locked' });
    const res = await pg<{ quiz_year: number; blended_scores: Scores; top3: Domain[] }[]>(
      db, `wired_results?child_id=eq.${kid[0].id}&select=quiz_year,blended_scores,top3&order=quiz_year.desc&limit=1`,
    );
    if (!res?.length) return wiredJson(404, { error: 'no_results' });
    const ses = await pg<{ family_answers: FamilyAnswers | null }[]>(
      db, `wired_sessions?child_id=eq.${kid[0].id}&family_id=eq.${grant.familyId}&rater_role=eq.mom&quiz_year=eq.${res[0].quiz_year}&select=family_answers&limit=1`,
    );
    const fa = ses?.[0]?.family_answers;
    if (!fa) return wiredJson(404, { error: 'no_family_answers' });

    const [curricula, esa, extraRows] = await Promise.all([
      approvedCurricula(db), filters.esaOnly && state ? esaRows(db, state) : Promise.resolve([]), helpfulExtraRows(db),
    ]);
    const prefs = prefsFromAnswers(fa, ranking, filters);
    const out = rankCurricula({ grade: kid[0].grade, scores: res[0].blended_scores, top3: res[0].top3, curricula, esa, prefs });
    // Display fields only now, after the order is fixed (rule 3).
    const matches = withDisplay(out.matches, await matchDisplayRows(db, out.matches.map((m) => m.id)));
    const extras = pickHelpfulExtras({ grade: kid[0].grade, scores: res[0].blended_scores, top3: res[0].top3, prefs, rows: extraRows, esa });

    // Remember her latest filters, ranking and state (the only writer of wired_family_prefs).
    await pg(db, 'wired_family_prefs?on_conflict=family_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ family_id: grant.familyId, filters, priority_ranking: ranking, state, updated_at: new Date().toISOString() }),
    });
    return wiredJson(200, { matches, coming_soon: out.coming_soon, ranking: out.ranking, budget_filter_offered: out.budget_filter_offered, extras });
  } catch (err) {
    console.error('wired-matches:', err instanceof Error ? err.message : String(err));
    return wiredJson(500, { error: 'could_not_rank' });
  }
});
