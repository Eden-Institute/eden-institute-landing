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
 *
 * The slug is NOT re-derived here. herbParam() from src/lib/herbLinks.ts is
 * the same function the SPA routes on, so /herbs/chamomile and
 * /apothecary/chamomile always agree.
 */
import { createClient } from "@supabase/supabase-js";

/** The columns herbs_public exposes. Free-tier rows only — the view's own
 *  WHERE clause is the tier gate (tier_visibility = 'free' OR IS NULL), so
 *  nothing paid can leak into a static file by accident. */
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
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Fetch every free-tier monograph, sorted by common_name.
 *
 * Throws rather than returning [] on any failure. A silent empty result here
 * would still produce a green build — one that quietly deletes 155 live pages
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
    .from("herbs_public")
    .select(
      "herb_id, common_name, latin_name, plant_family, part_used, taste, temperature, moisture, " +
        "pronunciation, energetics_summary, stewardship_note, cautions, contraindications_general, " +
        "pregnancy_safety, breastfeeding_safety, children_safety, biblical_traditional_reference, status",
    )
    .order("common_name", { ascending: true })
    // The view returned 155 rows on 2026-09-05. PostgREST caps at 1000 by
    // default; an explicit range keeps the ceiling visible if the roster grows.
    .range(0, 999);

  if (error) {
    throw new Error("herbsPublic: herbs_public query failed - " + error.message);
  }
  if (!data || data.length === 0) {
    throw new Error("herbsPublic: herbs_public returned zero rows. Refusing to build an empty herb index.");
  }

  return (data as PublicHerb[]).filter((h) => !!h.common_name);
}

/** One row of the full roster: every herb, free and gated alike. */
export interface RosterHerb {
  herb_id: string;
  common_name: string;
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
    .select("herb_id, common_name, tier_visibility")
    .range(0, 999);

  if (error) {
    throw new Error("herbsPublic: herbs_directory_v query failed - " + error.message);
  }
  if (!data || data.length === 0) {
    throw new Error("herbsPublic: herbs_directory_v returned zero rows.");
  }

  return (data as RosterHerb[]).filter((h) => !!h.common_name);
}
