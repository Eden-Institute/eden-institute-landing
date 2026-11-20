// curriculumFinder: build-time + client data for /curriculum-finder (2026-11-19, Camila's tap: a public
// finder that any mom can use with no email, and "Email me my shortlist" to collect emails).
//
// The rows come from public.curriculum_finder_list() (approved curricula, safe columns only: never the
// founder-only contact fields). The build reads it as anon so every curriculum is in the static HTML
// Google sees; the island filters in the browser. ⚠️ FINDER_COPY is DRAFT copy, PENDING Camila's
// approval on the finder review page.
import { createClient } from "@supabase/supabase-js";

export interface FinderCurriculum {
  id: string; sheet_id: string; name: string; publisher: string | null; link: string | null; is_affiliate: boolean;
  approach: string | null; approach_secondary: string | null; subjects: string[]; grade_min: number | null; grade_max: number | null;
  domains_served: string[]; prep_load: string | null; price_cents: number | null; price_basis: string | null; multi_age: boolean | null;
  faith_alignment: string | null; eden_band: string | null; coming_soon: boolean;
  free_trial_url: string | null; free_trial_type: string | null; free_trial_note: string | null; completely_free: boolean; free_trial_checked: string | null;
  mom_pros: string[]; mom_cons: string[]; mom_sources: { title?: string; url: string }[]; mom_note: string | null;
  esa_yes_states: string[]; last_verified_at: string | null;
}

export async function fetchFinderRows(): Promise<FinderCurriculum[]> {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  // A production build must never ship an empty finder, so it fails loudly. Tests and local dev
  // (no keys) render the page shell with no rows.
  if (!url || !key) {
    if (import.meta.env.PROD) throw new Error("curriculumFinder: VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are not set at build time");
    return [];
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await sb.rpc("curriculum_finder_list");
  if (error) {
    if (import.meta.env.PROD) throw new Error(`curriculumFinder: curriculum_finder_list failed: ${error.message}`);
    return [];
  }
  return ((data ?? []) as FinderCurriculum[]).filter((r) => !r.coming_soon);
}

/** wired_curricula.subjects -> the finder's subject filter (data mapping, not copy). */
export const SUBJECT_GROUPS: Record<string, string[]> = {
  "Math": ["Math"],
  "Reading & phonics": ["Reading / phonics"],
  "Writing & grammar": ["Writing", "Language arts"],
  "Science": ["Science"],
  "History & geography": ["History / social studies", "Geography"],
  "Bible": ["Bible"],
  "Art & music": ["Art", "Music"],
  "Foreign language": ["Foreign language"],
  "Life skills & health": ["Life skills", "Health / PE"],
};

export const PREP_ORDER = ["Open-and-go", "Light", "Moderate", "Heavy"];

/** DRAFT, pending Camila's approval. */
export const FINDER_COPY = {
  title: "Homeschool Curriculum Finder: 100 Hand-Picked Options with Free Samples",
  description: "Compare 100 homeschool curricula by grade, subject, prep time, price and ESA eligibility. Read what moms say and try free samples before you buy.",
  heading: "Find the right homeschool curriculum",
  intro: "100 curricula, hand-picked and checked: Christian, or secular that doesn't work against your faith. Filter by grade, subject, prep time and budget, read what other moms say, and try a free sample before you spend a dollar.",
  searchLabel: "Search by name or publisher",
  freeOnly: "Completely free",
  hasTrial: "Has a free sample or trial",
  christianOnly: "Christian curricula only",
  anyGrade: "Any grade",
  anySubject: "Any subject",
  anyPrep: "Any prep time",
  anyState: "ESA state (optional)",
  esaYes: "ESA-eligible in your state",
  count: (n: number) => `${n} ${n === 1 ? "curriculum" : "curricula"}`,
  tryFree: "Try it free",
  free: "Completely free",
  moms: "What moms say",
  pros: "Pros",
  cons: "Cons",
  sources: "From independent reviews:",
  star: "Save to my shortlist",
  starred: "Saved",
  barLine: (n: number) => `${n} saved`,
  barButton: "Email me my shortlist",
  formTitle: "Get your shortlist by email",
  formLine: "We'll email you a PDF of the curricula you saved, with every free sample link and what moms say about each one.",
  emailLabel: "Email",
  nameLabel: "First name (optional)",
  fridayBox: "Also send me the Friday homeschool email (one a week, unsubscribe anytime).",
  send: "Email my shortlist",
  sending: "Sending...",
  sent: "Sent! Check your inbox in a minute or two.",
  quizTitle: "Not sure which one fits your child?",
  quizLine: "Take the free Fearfully & Wonderfully Wired quiz. It shows how God wired your child and which of these curricula fit them best.",
  quizButton: "Take the free quiz",
  affiliate: "Some of these links pay Eden a commission if you buy. That never changes which curricula show up or the order they're in.",
  affiliateLabel: "Eden earns a commission",
  empty: "Nothing matches all of those filters. Try removing one.",
};
