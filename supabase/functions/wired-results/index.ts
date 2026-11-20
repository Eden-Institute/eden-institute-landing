// wired-results: a family's results, by signed token (Fearfully & Wonderfully Wired, W3;
// spec section 8). Public POST {token, child_id?}, DARK until WIRED_ENABLED. Never returns
// another family's data: every read is filtered by the token's family id. A locked 3rd
// child gets only the top wiring's name (7.2). verify_jwt = false (config.toml).
// W9: each child also carries `raters` (every rater's own scores: mom, teen, each observer by her label),
// `teen_link_allowed` (grade 9+) and `observers_allowed` (a Blueprint or Family Map child).

import { type Domain, type Scores } from '../_shared/wired-engine.ts';
import { buildResultsPayload, type FamilyAnswers } from '../_shared/wired-submit-core.ts';
import { type Db, pg } from '../_shared/wired-submit-flow.ts';
import { verifyWiredToken } from '../_shared/wired-token.ts';
import { wiredGate, wiredJson } from '../_shared/wired-gate.ts';
import type { Match } from '../_shared/wired-match.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const gate = wiredGate(req);
  if (gate) return gate;
  if (req.method !== 'POST') return wiredJson(405, { error: 'method_not_allowed' });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return wiredJson(400, { error: 'body must be JSON' });
  }
  let grant;
  try {
    grant = await verifyWiredToken(body?.token, 'results');
  } catch (err) {
    console.error('wired-results: token secret problem:', err instanceof Error ? err.message : String(err));
    return wiredJson(500, { error: 'server_misconfigured' });
  }
  if (!grant) return wiredJson(401, { error: 'invalid_or_expired_link' });
  const only = typeof body.child_id === 'string' && UUID_RE.test(body.child_id) ? body.child_id : null;

  const db: Db = { url: Deno.env.get('SUPABASE_URL') ?? '', key: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' };
  try {
    const fam = await pg<{ id: string; first_name: string | null }[]>(db, `wired_families?id=eq.${grant.familyId}&select=id,first_name&limit=1`);
    if (!fam?.length) return wiredJson(404, { error: 'not_found' });
    const kids = await pg<{ id: string; nickname: string; grade: number; unlocked_via: string | null }[]>(
      db,
      `wired_children?family_id=eq.${grant.familyId}&removed_at=is.null${only ? `&id=eq.${only}` : ''}&select=id,nickname,grade,unlocked_via&order=created_at.asc`,
    );
    const children = [];
    for (const k of kids ?? []) {
      const res = await pg<{ quiz_year: number; blended_scores: Scores; top3: Domain[]; renaissance: boolean; matches_snapshot: { matches?: Match[]; coming_soon?: { name: string; eden_band: string | null }[] } | null }[]>(
        db,
        `wired_results?child_id=eq.${k.id}&select=quiz_year,blended_scores,top3,renaissance,matches_snapshot&order=quiz_year.desc&limit=1`,
      );
      const r = res?.[0];
      if (!r) continue;
      const ses = await pg<{ family_answers: FamilyAnswers | null }[]>(
        db,
        `wired_sessions?child_id=eq.${k.id}&family_id=eq.${grant.familyId}&rater_role=eq.mom&quiz_year=eq.${r.quiz_year}&select=family_answers&limit=1`,
      );
      const payload = buildResultsPayload({
        child: { id: k.id, nickname: k.nickname, grade: k.grade, unlocked: k.unlocked_via !== null },
        quiz_year: r.quiz_year, scores: r.blended_scores, top3: r.top3, renaissance: r.renaissance,
        family_answers: ses?.[0]?.family_answers ?? null,
        matches: r.matches_snapshot?.matches ?? [], coming_soon: r.matches_snapshot?.coming_soon ?? [],
      });
      // W9: each rater's own view for the side by side ("Mom sees / Teen sees", plus each person she invited,
      // by the label she gave, never a name or email). Only for an unlocked child.
      let raters: { role: string; label: string | null; scores: Scores; top3: Domain[] }[] = [];
      if (k.unlocked_via !== null) {
        const all = await pg<{ rater_role: string; observer_id: string | null; scores: Scores; top3: Domain[] }[]>(
          db,
          `wired_sessions?child_id=eq.${k.id}&family_id=eq.${grant.familyId}&quiz_year=eq.${r.quiz_year}&completed_at=not.is.null&is_pilot_retake=eq.false&select=rater_role,observer_id,scores,top3&order=completed_at.asc`,
        );
        const obsIds = (all ?? []).map((x) => x.observer_id).filter((x): x is string => !!x);
        const labels = new Map(obsIds.length
          ? ((await pg<{ id: string; label: string | null }[]>(db, `wired_observers?id=in.(${obsIds.join(',')})&select=id,label`)) ?? []).map((o) => [o.id, o.label])
          : []);
        raters = (all ?? []).map((x) => ({ role: x.rater_role, label: x.observer_id ? labels.get(x.observer_id) ?? null : null, scores: x.scores, top3: x.top3 }));
      }
      children.push({
        ...payload, raters,
        teen_link_allowed: k.unlocked_via !== null && k.grade >= 9,
        observers_allowed: k.unlocked_via === 'blueprint' || k.unlocked_via === 'family_map' || k.unlocked_via === 'pilot',
      });
    }
    return wiredJson(200, { first_name: fam[0].first_name, children });
  } catch (err) {
    console.error('wired-results:', err instanceof Error ? err.message : String(err));
    return wiredJson(500, { error: 'could_not_load_results' });
  }
});
