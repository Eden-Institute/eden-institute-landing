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
  // Coming-soon rows stay in (founder 2026-11-20: show the 2 coming-soon sets, with a waitlist), with the
  // internal sheet placeholder stripped from the public name.
  return ((data ?? []) as FinderCurriculum[]).map((r) => (r.coming_soon ? { ...r, name: comingSoonName(r) } : r));
}

/** The public waitlist bands (same names, dates and wording as the /homeschool band cards). */
export const COMING_SOON_BANDS: Record<string, { band: "cultivators" | "practitioners"; name: string; grades: string; status: string }> = {
  C033: { band: "cultivators", name: "Cultivators", grades: "grades 6-8", status: "Planned for late 2027" },
  C034: { band: "practitioners", name: "Practitioners", grades: "grades 9-12", status: "Planned for 2028" },
};
export function comingSoonName(r: { sheet_id: string; name: string }): string {
  const b = COMING_SOON_BANDS[r.sheet_id];
  return b ? `Eden's Table: ${b.name} (${b.grades})` : r.name.replace(/\s*\(name to come[^)]*\)/i, "");
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
  comingSoon: "Coming soon",
  /** The approved Eden's Table coming-soon line (results copy, approved 2026-11-19). */
  comingSoonLine: (grades: string) => `Eden's Table for ${grades} is on the way, made the same Charlotte Mason way as our K-5 sets. Join the waitlist and be the first to know.`,
  waitlistButton: "Join the waitlist",
  familiesSay: "What families say",
  familiesNote: "Shared with permission by families who used the free sample. Eden's Table is our own curriculum, so these aren't independent reviews.",
};

/** Re-exported launch switch: the finder invites moms to the Wired quiz only once it is public. */
export { WIRED_IS_PUBLIC } from "../../supabase/functions/_shared/wired-launch";

/**
 * The finder FAQ, APPROVED by Camila 2026-11-20 ~06:00 CT (Lane SEO review page + her tap "Approve both"
 * on Q1 and Q4), word for word: side-session notes curriculum_finder_faq_APPROVED_2026-11-20.md.
 * Rendered at the bottom of /curriculum-finder and as FAQPage JSON-LD. `link` = a phrase inside the answer
 * that links (Q4: "ESA state guides" -> /esa). Q1's quiz line is added only when WIRED_IS_PUBLIC.
 */
export const FINDER_FAQ_HEADING = "Questions moms ask";
export const FINDER_FAQ: { q: string; a: string; link?: { text: string; href: string } }[] = [
  { q: "How do I choose a homeschool curriculum?", a: "Start with your child, not the catalog. Before you compare a single curriculum, think about how your child learns best, what lights them up, and where they struggle. A curriculum that fits your child gets used; one that doesn't sits on the shelf. Once you know that, narrow it down by grade, subjects, prep time and budget with the filters here, read what other moms say, and try a free sample before you buy." },
  { q: "What does \"open-and-go\" mean?", a: "Open-and-go curriculum is ready to teach the moment you open it. The lesson, the questions and the activities are on the page, so you don't spend an evening planning. Some curricula ask for light, moderate or heavy prep instead. Filter by prep time to see only the ones that fit your days." },
  { q: "Can I try a homeschool curriculum before I buy it?", a: "Yes. Most of the curricula here link a free sample, trial or free lesson, and some are completely free. Turn on \"Has a free sample or trial\" to see them." },
  { q: "Can I use ESA funds for these curricula?", a: "Often, yes. Choose your state in the ESA filter and the finder shows the curricula marked ESA-eligible there. Our ESA state guides explain how each program works and how to apply. Rules change, so check your state's program before you buy.", link: { text: "ESA state guides", href: "/esa" } },
  { q: "Are these Christian curricula?", a: "Each one was hand-picked: Christian, or secular that doesn't work against your faith. Turn on \"Christian curricula only\" to see just the Christian ones." },
  { q: "Where do the \"what moms say\" notes come from?", a: "From independent reviews by homeschool families. Each card links its sources, so you can read the full review yourself." },
];
/** Q1's approved launch-day line (append only when WIRED_IS_PUBLIC; links /wired). */
export const FINDER_FAQ_Q1_QUIZ = "Not sure where to start? Our free quiz walks you through what you see in your child and shows the curricula that fit.";

/** Eden's Table rows on the finder (our own curriculum). */
export const EDEN_TABLE_SHEET_IDS = ["C031", "C032"];

/**
 * The testimonials already approved and live on /homeschool (§9.6), word for word, same attributions.
 * Shown on the Eden's Table cards as "What families say" (never as independent reviews).
 * src/test/curriculumFinder.test.tsx fails if any quote or name here stops matching /homeschool.
 */
export const EDEN_TESTIMONIALS: { quote: string; by: string }[] = [
  { quote: "I am a mother who has been homeschooling kids for over 18 years. I had the opportunity to review some of the lessons in the elementary grades and these lessons are amazing for someone who wants to add herbs/gardening plus faith based lessons to their curriculum. As a homesteading family, I would have loved to have something like this when my kids were little. The balance of faith and herb/gardening is perfect, it is a complete lesson and well thought out. The lessons for younger kids are easy to understand and get a little more in depth when moving up a level. Each week you study a new herb/plant and everything is included for the week. With the stories, table cards, questions, scriptures, recipes, and everything together it covers core subjects like math, reading, faith, and herbs/plants; this is a great addition to a homeschooling curriculum.", by: "Amanda, homeschooling 18 years · Dream Chasers Homestead" },
  { quote: "I just wanted you to see how into it they are! No complaining and actually asking to do their ‘learning’!!", by: "Kati, former nurse and paramedic" },
  { quote: "This curriculum is truly amazing! I have numerous herbal books from all sorts of authors, and this curriculum truly puts it into bite-size chunks of information while still incorporating incredible vocabulary, concepts, and quality stories. The fact that you are incorporating all these other topics beyond just herbal information is truly incredible as well. I truly love everything about it so far and can't wait until it launches! It is exactly what I was looking for and I am so excited for what will unfold in the years to come as we dive deep as a family.", by: "Kendria Scriver, curriculum writer" },
  { quote: "Ahhhhhh I just spent the last few hours poring over the free sample you sent us. This curriculum is absolutely fantastic. I cannot wait to buy this in the fall. This will be our kids favourite curriculum to explore.", by: "Coralee, who read the free sample cover to cover" },
  { quote: "This is a beautiful curriculum to start. I've just begun reading our teaching guide.", by: "Brooke, Clarksville, TN" },
  { quote: "LOVE this!", by: "Ems Glenn" },
];
