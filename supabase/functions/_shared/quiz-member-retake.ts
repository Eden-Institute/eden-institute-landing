// supabase/functions/_shared/quiz-member-retake.ts
//
// Founder decision 2026-09-15: the free quiz cannot overwrite a member's saved
// Pattern. Anyone can type any email into the signed-out quiz, so the database
// trigger tg_quiz_completion_sync_constitution (migration
// 20260916130000_quiz_no_member_overwrite.sql) now only FILLS an empty
// profiles.constitution_type / person_profiles.eden_constitution / display_name.
//
// A signed-in member retaking the quiz still updates their own saved Pattern.
// That update is applied here, by user id, and only when the request carries a
// valid user JWT whose account email is the email that was submitted. The
// in-app diagnostic (record-diagnostic-completion) is a separate path and is
// unaffected.

export interface CallerUser {
  id: string;
  email: string | null;
}

function normalize(email: unknown): string | null {
  if (typeof email !== 'string') return null;
  const t = email.trim().toLowerCase();
  return t ? t : null;
}

/**
 * The user id whose saved Pattern this quiz submission may overwrite, or null.
 * Null means "anonymous submission": the trigger's fill-if-empty rule is all
 * that applies.
 */
export function memberRetakeUserId(caller: CallerUser | null, submittedEmail: unknown): string | null {
  if (!caller || typeof caller.id !== 'string' || !caller.id) return null;
  const callerEmail = normalize(caller.email);
  const submitted = normalize(submittedEmail);
  if (!callerEmail || !submitted) return null;
  return callerEmail === submitted ? caller.id : null;
}

/**
 * Kebab marketing slug ('pressure-cooker') to the canonical eden_patterns slug
 * ('the_pressure_cooker') that person_profiles.eden_constitution requires (FK).
 * Mirrors public.eden_pattern_canonical_slug for the slug forms resend-waitlist
 * writes. Returns null for anything that is not a plain slug.
 */
export function canonicalPatternSlug(slug: unknown): string | null {
  if (typeof slug !== 'string') return null;
  let cleaned = slug.trim().toLowerCase();
  if (!/^[a-z_\- ]+$/.test(cleaned)) return null;
  cleaned = cleaned.replace(/^the[\s_-]+/, '').replace(/[\s-]+/g, '_');
  return cleaned ? `the_${cleaned}` : null;
}

/**
 * Writes a signed-in member's retake to their own account, by user id.
 * profiles.constitution_type takes the same value the trigger would have
 * written; person_profiles (self row) takes the canonical slug. Never throws;
 * a failure is logged and the quiz submission still succeeds.
 */
export async function applyMemberRetake(opts: {
  supabaseUrl: string;
  serviceKey: string;
  userId: string;
  constitutionType: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: boolean }> {
  const f = opts.fetchImpl ?? fetch;
  const headers = {
    apikey: opts.serviceKey,
    Authorization: `Bearer ${opts.serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  };
  const uid = encodeURIComponent(opts.userId);
  let ok = true;
  try {
    const p = await f(`${opts.supabaseUrl}/rest/v1/profiles?user_id=eq.${uid}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ constitution_type: opts.constitutionType }),
    });
    if (!p.ok) {
      ok = false;
      console.error('member retake: profiles update failed', p.status);
    }
    const canonical = canonicalPatternSlug(opts.constitutionType);
    if (canonical) {
      const pp = await f(`${opts.supabaseUrl}/rest/v1/person_profiles?user_id=eq.${uid}&is_self=is.true`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ eden_constitution: canonical }),
      });
      if (!pp.ok) {
        ok = false;
        console.error('member retake: person_profiles update failed', pp.status);
      }
    }
  } catch (err) {
    ok = false;
    console.error('member retake threw', err instanceof Error ? err.message : String(err));
  }
  return { ok };
}
