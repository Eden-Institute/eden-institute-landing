/**
 * herbsPublic — build-time reader for the public herb monographs.
 *
 * WHY THIS EXISTS
 *
 * Until 2026-09-05 every herb monograph lived only inside the SPA at
 * /apothecary/:herbId. That route is public by design (anonymous quiz-takers
 * follow matched-herb links into it), but it is client-rendered, so a crawler
 * fetching /apothecary/chamomile received 4,693 bytes of app shell with the
 * site-wide default <title> and ZERO occurrences of the word "chamomile".
 * Verified against the live site with a Googlebot user-agent. 155 free-tier
 * monographs were therefore invisible to search while /homeschool — the one
 * substantial pre-rendered page on the domain — was carrying every organic
 * arrival by itself.
 *
 * These pages are pre-rendered at /herbs/:slug rather than taking over
 * /apothecary/:slug on purpose. The app route serves signed-in readers with
 * tier gating, favorites and pattern-match badges resolved live from
 * herbs_directory_v; a static file at the same path would shadow it on any
 * hard load and freeze DB content at build time. Two surfaces, two audiences,
 * cross-linked: /herbs/* is the public front door, /apothecary/* stays the app.
 * (Since 2026-09-28 each free herb's /apothecary/<slug> IS a static file, but
 * only the SPA shell with a head naming /herbs/<slug> as canonical: no herb
 * content is frozen into it. See scripts/build-apothecary-shells.mjs.)
 *
 * The slug is NOT re-derived here. herbParam() from src/lib/herbLinks.ts is
 * the same function the SPA routes on, so /herbs/chamomile and
 * /apothecary/chamomile always agree.
 */
import { createClient } from "@supabase/supabase-js";

/** The free columns of every herb in the directory (punch #296, founder
 *  2026-11-03: all 299 visible herbs get a public page, not only the 155
 *  free-tier ones). Since 2026-09-15 every herb shows exactly these fields to
 *  a free visitor in the app. Two locks keep Seed and Root content out of a
 *  static file: the select below names only these columns, and the build reads
 *  as anon, for whom herbs_directory_v NULLs every Seed/Root column anyway.
 *  src/test/herbPagesPublic.test.ts holds the column list to that. */
export interface PublicHerb {
  herb_id: string;
  common_name: string;
  latin_name: string | null;
  plant_family: string | null;
  part_used: string | null;
  taste: string | null;
  temperature: string | null;
  moisture: string | null;
  pronunciation: string | null;
  energetics_summary: string | null;
  stewardship_note: string | null;
  cautions: string | null;
  contraindications_general: string | null;
  pregnancy_safety: string | null;
  breastfeeding_safety: string | null;
  children_safety: string | null;
  biblical_traditional_reference: string | null;
  status: string | null;
  /**
   * The one honest line about the pre-1900 evidence behind Temperature and
   * Moisture, or null when there is nothing to say. Resolved at build time from
   * herb_energetics_evidence_v and attached by getPublicHerbs().
   *
   * WHY IT MATTERS HERE. The app page and this page show the SAME temperature
   * and moisture. Since 2026-09-15 the app page also says when the old sources
   * disagree with that value. Until this was added, the public page showed the
   * value alone, so the two surfaces disagreed about how settled the reading is
   * on 44 herbs. The founder's rule is that a disagreement is never hidden, and
   * the front door is exactly where hiding it would matter most.
   */
  evidence_line: string | null;
}

/** Every column a public /herbs page may read. Nothing Seed or Root. */
export const PUBLIC_HERB_COLUMNS = [
  "herb_id", "common_name", "latin_name", "plant_family", "part_used", "taste", "temperature", "moisture",
  "pronunciation", "energetics_summary", "stewardship_note", "cautions", "contraindications_general",
  "pregnancy_safety", "breastfeeding_safety", "children_safety", "biblical_traditional_reference", "status",
] as const;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Fetch every visible herb's free fields, sorted by common_name.
 *
 * Throws rather than returning [] on any failure. A silent empty result here
 * would still produce a green build — one that quietly deletes 299 live pages
 * and publishes a sitemap that no longer lists them. An empty result must mean
 * empty, never "the call failed".
 */
export async function getPublicHerbs(): Promise<PublicHerb[]> {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "herbsPublic: VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are not set at build time. " +
        "The herb pages cannot be generated without them.",
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    // Node has no localStorage. The generated browser client in
    // src/integrations/supabase/client.ts passes storage: localStorage and
    // would throw here, which is why this build-time client is separate.
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("herbs_directory_v")
    .select(PUBLIC_HERB_COLUMNS.join(", "))
    .order("common_name", { ascending: true })
    // 155 rows from herbs_public on 2026-09-05; 299 from herbs_directory_v on
    // 2026-11-03 (hidden herbs excluded by the view). PostgREST caps at 1000 by
    // default; an explicit range keeps the ceiling visible if the roster grows.
    .range(0, 999);

  if (error) {
    throw new Error("herbsPublic: herbs_directory_v (public herbs) query failed - " + error.message);
  }
  if (!data || data.length === 0) {
    throw new Error("herbsPublic: herbs_directory_v returned zero rows. Refusing to build an empty herb index.");
  }

  // The evidence line, read as anon exactly as a visitor would. The view NULLs
  // the source list below Root, so nothing paid can reach a static file; the
  // three fields selected here are the free ones by design.
  const { data: evidence, error: evidenceError } = await supabase
    .from("herb_energetics_evidence_v")
    .select("herb_id, disagreement_text, no_pre1900_source_found, no_counted_source_line")
    .range(0, 999);

  // A failed lookup must not silently strip the line from every page, which
  // would look exactly like "no herb has a disagreement".
  if (evidenceError) {
    throw new Error(
      "herbsPublic: herb_energetics_evidence_v query failed - " + evidenceError.message,
    );
  }

  const lineFor = new Map<string, string>();
  for (const row of evidence ?? []) {
    // Same precedence as the app's freeEvidenceLine(), deliberately: the two
    // surfaces must never say different things about the same herb.
    const line =
      row.disagreement_text ||
      (row.no_pre1900_source_found ? NO_PRE1900_SOURCE_LINE : null) ||
      row.no_counted_source_line ||
      null;
    if (row.herb_id && line) lineFor.set(row.herb_id, line);
  }

  return (data as unknown as PublicHerb[])
    .filter((h) => !!h.common_name)
    .map((h) => ({ ...h, evidence_line: lineFor.get(h.herb_id) ?? null }));
}

/** Kept in step with NO_PRE1900_SOURCE_LINE in src/lib/energeticsEvidence.ts. */
export const NO_PRE1900_SOURCE_LINE = "No pre-1900 source found for this reading.";

/** One row of the full roster: every herb, free and gated alike. */
export interface RosterHerb {
  herb_id: string;
  common_name: string;
  /** For the monograph title and description templates (src/lib/monographMeta.ts). */
  latin_name: string | null;
  tier_visibility: string | null;
}

/**
 * Fetch the FULL herb roster (300 rows on 2026-09-05), not just the free ones.
 *
 * Needed because authored content links herbs we do not publish statically.
 * constitution-data.ts names ten herbs per Pattern, and thirteen of those are
 * Seed-tier: they have no /herbs/ page and must keep pointing at the app's
 * /apothecary/:slug locked preview. Resolving against the whole roster is what
 * lets a build tell "gated herb" apart from "slug that matches nothing", and
 * the second case is a broken link, not a tier decision.
 */
export async function getHerbRoster(): Promise<RosterHerb[]> {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("herbsPublic: Supabase env is not set at build time; cannot read the herb roster.");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("herbs_directory_v")
    .select("herb_id, common_name, latin_name, tier_visibility")
    .range(0, 999);

  if (error) {
    throw new Error("herbsPublic: herbs_directory_v query failed - " + error.message);
  }
  if (!data || data.length === 0) {
    throw new Error("herbsPublic: herbs_directory_v returned zero rows.");
  }

  return (data as RosterHerb[]).filter((h) => !!h.common_name);
}
