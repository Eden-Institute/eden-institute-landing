// supabase/functions/_shared/wired-pdf-job.ts
//
// Fearfully & Wonderfully Wired, W7: everything wired-pdf needs for one wired_pdf_jobs row.
// loadBlueprintData reads the family, the covered child(ren), their latest blended results, her
// family answers + saved priorities, and the ranked matches (the SAME rankCurricula the results
// page uses; affiliate fields are read only AFTER ranking, for the links, rule 3).

import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";
import { DOMAINS, type Domain, type Scores } from "./wired-engine.ts";
import { normalizeCode, rankCurricula } from "./wired-match.ts";
import { bestFitApproach, type FamilyAnswers, prefsFromAnswers, tipFirst } from "./wired-submit-core.ts";
import { approvedCurricula, type Db, esaRows, pg } from "./wired-submit-flow.ts";
import { bandOfSetKind, buildBlueprintPdf, buildFamilyMapPdf, buildFreeResultsPdf, type MomData, type MomTeachingSide, type PriorYear, type QuestionBand, reasonLines, SUBJECT_MAP, type FreeResultsData, type PdfMatch, type PdfSubject, type RaterView } from "./wired-pdf.ts";

export interface PdfJob {
  id: string; family_id: string; child_id: string | null; order_id: string | null; buyer_id: string | null;
  kind: "blueprint" | "family_map" | "free"; quiz_year: number; attempts: number; status: string;
}

export interface LoadedJob {
  email: string;
  firstName: string | null;
  hasOwnAnswers: boolean;
  /** Family Map jobs only: her own answers (top 3 + teaching style) for her pages, when she has answered. */
  mom?: MomData | null;
  children: FreeResultsData[];
}

/**
 * A pilot job (W12): wired_pilot_grant writes it with no order and no buyer. Every paid job carries both
 * (wired_grant_purchase refuses a null order id), so this never reads a paid buyer as a tester.
 */
export const isPilotJob = (job: Pick<PdfJob, "order_id" | "buyer_id">): boolean => job.order_id === null && job.buyer_id === null;

const RANK_LIMIT = 200;

export async function loadBlueprintData(db: Db, job: PdfJob): Promise<LoadedJob> {
  const fam = (await pg<{ id: string; email: string; first_name: string | null }[]>(db, `wired_families?id=eq.${job.family_id}&select=id,email,first_name&limit=1`))?.[0];
  if (!fam) throw new Error("family not found (deleted?)");
  let email = fam.email;
  if (job.buyer_id) {
    const b = (await pg<{ email: string }[]>(db, `wired_buyers?id=eq.${job.buyer_id}&select=email&limit=1`))?.[0];
    if (b?.email) email = b.email;
  }

  let childIds: string[] = [];
  if (job.kind === "blueprint" || job.kind === "free") {
    if (!job.child_id) throw new Error("blueprint job without a child");
    childIds = [job.child_id];
  } else {
    // A purchase: the children that order unlocked. A pilot Family Map (W12) has no order: the children its
    // pilot_family_map unlock covered.
    const unlocks = await pg<{ child_id: string }[]>(db, job.order_id
      ? `wired_unlocks?order_id=eq.${job.order_id}&product=eq.family_map&select=child_id`
      : `wired_unlocks?family_id=eq.${job.family_id}&product=eq.pilot_family_map&select=child_id`);
    childIds = [...new Set((unlocks ?? []).map((u) => u.child_id).filter(Boolean))];
  }
  if (!childIds.length) throw new Error("no covered children");

  const kids = await pg<{ id: string; nickname: string; grade: number; created_at: string }[]>(db,
    `wired_children?id=in.(${childIds.join(",")})&family_id=eq.${job.family_id}&removed_at=is.null&select=id,nickname,grade,created_at&order=created_at.asc`);
  if (!kids?.length) throw new Error("covered children were removed");

  const prefsRow = (await pg<{ filters: Record<string, unknown> | null; priority_ranking: string[] | null; state: string | null }[]>(db,
    `wired_family_prefs?family_id=eq.${job.family_id}&select=filters,priority_ranking,state&limit=1`))?.[0];
  const own = (await pg<{ adult_scores: Scores | null; teaching_style: MomTeachingSide[] | null; session_id: string | null }[]>(db,
    `wired_family_results?family_id=eq.${job.family_id}&quiz_year=eq.${job.quiz_year}&select=adult_scores,teaching_style,session_id&limit=1`))?.[0];
  const hasOwnAnswers = !!own;
  // Her pages in the Family Map (2026-11-21): her top 3 as scored at submit (her session), else her scores' order.
  let mom: MomData | null = null;
  if (own && job.kind === "family_map" && Array.isArray(own.teaching_style) && own.teaching_style.length) {
    const ses = own.session_id
      ? (await pg<{ top3: Domain[] | null }[]>(db, `wired_sessions?id=eq.${own.session_id}&family_id=eq.${job.family_id}&select=top3&limit=1`))?.[0]
      : undefined;
    const sc = own.adult_scores;
    const top3 = ses?.top3?.length ? ses.top3 : sc ? DOMAINS.slice().sort((a, b) => (sc[b] ?? 0) - (sc[a] ?? 0)).slice(0, 3) : [];
    if (top3.length) mom = { top3, teaching: own.teaching_style };
  }

  const curricula = await approvedCurricula(db);
  const display = new Map((await pg<{ id: string; url: string | null; affiliate_url: string | null; is_affiliate: boolean | null; subjects: string[] | null; price_cents: number | null; prep_load: string | null }[]>(db,
    `wired_curricula?approved=eq.true&select=id,url,affiliate_url,is_affiliate,subjects,price_cents,prep_load`) ?? []).map((r) => [r.id, r]));
  const f = (prefsRow?.filters ?? {}) as Record<string, unknown>;
  const state = typeof prefsRow?.state === "string" && /^[A-Z]{2}$/.test(prefsRow.state) ? prefsRow.state : null;
  const filters = { withinBudget: f.withinBudget === true, christianOnly: f.christianOnly === true, esaOnly: f.esaOnly === true && !!state, state };
  const esa = filters.esaOnly && state ? await esaRows(db, state) : [];

  const children: FreeResultsData[] = [];
  for (const k of kids) {
    const res = (await pg<{ quiz_year: number; blended_scores: Scores; top3: Domain[]; computed_at: string; renaissance: boolean; matches_snapshot: { ranking?: string[] } | null }[]>(db,
      `wired_results?child_id=eq.${k.id}&select=quiz_year,blended_scores,top3,computed_at,renaissance,matches_snapshot&order=quiz_year.desc&limit=1`))?.[0];
    if (!res) throw new Error(`no results for child ${k.id}`);
    const ses = await pg<{ family_answers: FamilyAnswers | null; completed_at: string | null; rater_role: string; observer_id: string | null; scores: Scores | null; top3: Domain[] | null; bank_version: string | null }[]>(db,
      `wired_sessions?child_id=eq.${k.id}&family_id=eq.${job.family_id}&quiz_year=eq.${res.quiz_year}&completed_at=not.is.null&is_pilot_retake=eq.false&select=family_answers,completed_at,rater_role,observer_id,scores,top3,bank_version&order=completed_at.asc`);
    const mom = (ses ?? []).find((s) => s.rater_role === "mom");
    const fa = mom?.family_answers ?? (ses ?? []).find((s) => s.family_answers)?.family_answers;
    if (!fa) throw new Error(`no family answers for child ${k.id}`);
    const others = (ses ?? []).filter((s) => s.rater_role !== "mom").length;
    // Each person's own view for the side-by-side page (same rows as the results page): observers by the label
    // mom gave, never a name or email.
    const obsIds = (ses ?? []).map((s) => s.observer_id).filter((x): x is string => !!x);
    const labels = new Map(obsIds.length
      ? ((await pg<{ id: string; label: string | null }[]>(db, `wired_observers?id=in.(${obsIds.join(",")})&select=id,label`)) ?? []).map((o) => [o.id, o.label])
      : []);
    const raters: RaterView[] = (ses ?? []).filter((s) => s.scores && s.top3)
      .map((s) => ({ role: s.rater_role, label: s.observer_id ? labels.get(s.observer_id) ?? null : null, scores: s.scores!, top3: s.top3! }));
    // The year-over-year page (Blueprint + Family Map only; the free results PDF has none).
    const yoy = job.kind === "free" ? null : await loadPriorYear(db, job.family_id, k.id, res.quiz_year, mom?.bank_version ?? null);

    // Her current grade; prefsFromAnswers carries her stored plan_year, so the matches and the coming-soon line
    // follow the same planning grade as the results page (2026-11-22).
    const out = rankCurricula({
      grade: k.grade, scores: res.blended_scores, top3: res.top3, curricula, esa, limit: RANK_LIMIT,
      // Her saved ranking (wired-matches) when she changed it on the results page, else the ranking she
      // gave in the quiz (stored in the results snapshot at submit); before 2026-11-20 this fell back to the
      // default order, so a mom who never touched the results page got matches in the default order.
      prefs: prefsFromAnswers(fa, prefsRow?.priority_ranking ?? res.matches_snapshot?.ranking ?? null, filters),
    });
    const matches: PdfMatch[] = out.matches.map((m) => {
      const d = display.get(m.id);
      const subjects = [...new Set((d?.subjects ?? []).map((s) => SUBJECT_MAP[s.trim().toLowerCase()]).filter(Boolean))] as PdfSubject[];
      const isAffiliate = d?.is_affiliate === true && !!d?.affiliate_url;
      return {
        name: m.name,
        link: isAffiliate ? d!.affiliate_url : d?.url ?? null,
        isAffiliate,
        subjects,
        because: reasonLines({ because: m.because, served_top3: m.served_top3, components: m.components, price_cents: d?.price_cents ?? null, prep_load: normalizeCode(d?.prep_load), esa_state: m.esa_state }, k.nickname, res.top3),
      };
    });
    children.push({
      nickname: k.nickname, grade: k.grade, scores: res.blended_scores, top3: res.top3,
      answeredOn: new Date(mom?.completed_at ?? res.computed_at), observerCount: others, raters,
      // Same rule as the results page: the line shows only when the planning grade's OWN Eden's Table set is coming soon.
      renaissance: res.renaissance === true,
      approach: bestFitApproach(res.blended_scores, res.renaissance === true, fa.approach ?? null),
      tipFirst: tipFirst(fa.frustration),
      matches, comingSoonBand: out.coming_soon.length ? (out.coming_soon.some((c) => /9-12/.test(c.eden_band ?? "")) ? "9-12" : "6-8") : null,
      ...(yoy ? { priorYear: yoy.priorYear, questionBand: yoy.questionBand } : {}),
    });
  }
  return { email, firstName: fam.first_name, hasOwnAnswers, mom, children };
}

/**
 * The most recent earlier quiz year for one child (wired_results.quiz_year < the year shown), with that year's
 * other people (completed, non-retake teen + observer sessions: the same count as observerCount) and the grade set
 * mom answered each year (her session's bank_version -> wired_question_banks.set_kind). Null when there is none:
 * the page is then left out and nothing else in the PDF changes.
 */
export async function loadPriorYear(db: Db, familyId: string, childId: string, quizYear: number, momBankNow: string | null): Promise<{ priorYear: PriorYear; questionBand: QuestionBand | null } | null> {
  const prev = (await pg<{ quiz_year: number; blended_scores: Scores | null; top3: Domain[] | null }[]>(db,
    `wired_results?child_id=eq.${childId}&quiz_year=lt.${quizYear}&select=quiz_year,blended_scores,top3&order=quiz_year.desc&limit=1`))?.[0];
  if (!prev || !(prev.quiz_year < quizYear) || !prev.blended_scores || !Array.isArray(prev.top3)) return null;
  const prevSes = (await pg<{ rater_role: string; bank_version: string | null }[]>(db,
    `wired_sessions?child_id=eq.${childId}&family_id=eq.${familyId}&quiz_year=eq.${prev.quiz_year}&completed_at=not.is.null&is_pilot_retake=eq.false&select=rater_role,bank_version`)) ?? [];
  const momBankThen = prevSes.find((s) => s.rater_role === "mom")?.bank_version ?? null;
  const versions = [...new Set([momBankNow, momBankThen].filter((x): x is string => !!x))];
  const kinds = new Map(versions.length
    ? ((await pg<{ version: string; set_kind: string }[]>(db,
      `wired_question_banks?version=in.(${versions.map(encodeURIComponent).join(",")})&select=version,set_kind`)) ?? []).map((b) => [b.version, b.set_kind])
    : []);
  return {
    priorYear: {
      quizYear: prev.quiz_year,
      scores: prev.blended_scores,
      top3: prev.top3,
      otherCount: prevSes.filter((s) => s.rater_role !== "mom").length,
      band: momBankThen ? bandOfSetKind(kinds.get(momBankThen)) : null,
    },
    questionBand: momBankNow ? bandOfSetKind(kinds.get(momBankNow)) : null,
  };
}

const safe = (s: string) => s.normalize("NFKD").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "Child";

export async function renderJob(job: PdfJob, loaded: LoadedJob): Promise<{ bytes: Uint8Array; pages: number; filename: string }> {
  const bytes = job.kind === "blueprint"
    ? await buildBlueprintPdf(loaded.children[0])
    : job.kind === "free"
      ? await buildFreeResultsPdf(loaded.children[0])
      : await buildFamilyMapPdf({ children: loaded.children, mom: loaded.mom ?? null });
  const pages = (await PDFDocument.load(bytes)).getPageCount();
  const filename = job.kind === "blueprint" ? `${safe(loaded.children[0].nickname)}-Learner-Blueprint.pdf`
    : job.kind === "free" ? `${safe(loaded.children[0].nickname)}-Wired-Results.pdf` : "Family-Learning-Map.pdf";
  return { bytes, pages, filename };
}
