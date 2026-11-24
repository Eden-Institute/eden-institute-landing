// podcastAppearances: the show list for /as-heard-on (punch #474, 2026-11-24).
//
// Camila's ask (Lane 8, 2026-11-23): one page that links to every podcast she has been a guest on and
// stays up to date, so the book (Unschooled by Design, Acknowledgments QR) can point readers there.
// Her taps 2026-11-24 (Lane 2): "Small table (Recommended)" = the list lives in public.podcast_appearances,
// one row per aired episode, added by the podcast lane when an episode airs; and "Leave it off" =
// Southern Appalachian Herbs stays off the page (as decided 2026-10-17).
//
// How it stays current with no code change: the build reads the table (so every show is in the static
// HTML that Google and the book's QR readers get), and the AsHeardOnLive island reads it again in the
// browser and adds any row the build did not have yet. Only published rows are readable (RLS); the
// columns read here are public facts about public episodes.
//
// Host clips are unchanged: they stay in web/lib/hostClips.ts behind the permission gate and attach to a
// row by its exact show name.
import { createClient } from "@supabase/supabase-js";

export interface PodcastAppearance {
  id: string;
  show: string;
  host: string;
  episode_title: string;
  episode_url: string;
  /** YYYY-MM-DD, the day the episode went public. Orders the page (newest first); not shown. */
  aired_on: string;
}

export const APPEARANCE_COLUMNS = "id,show,host,episode_title,episode_url,aired_on";

/** The PostgREST path both reads use: published rows only, newest first. */
export const APPEARANCES_PATH =
  `/rest/v1/podcast_appearances?select=${APPEARANCE_COLUMNS}&published=eq.true&order=aired_on.desc,show.asc`;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function isAppearance(r: unknown): r is PodcastAppearance {
  if (!r || typeof r !== "object") return false;
  const o = r as Record<string, unknown>;
  for (const k of ["id", "show", "host", "episode_title", "episode_url", "aired_on"]) {
    if (typeof o[k] !== "string" || !(o[k] as string).trim()) return false;
  }
  return /^https:\/\//.test(o.episode_url as string) && DATE.test(o.aired_on as string);
}

/** Keeps only well-formed rows (every field present, an https link, a real date), newest first. */
export function cleanAppearances(rows: unknown): PodcastAppearance[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter(isAppearance)
    .map((r) => ({ id: r.id, show: r.show, host: r.host, episode_title: r.episode_title, episode_url: r.episode_url, aired_on: r.aired_on }))
    .sort((a, b) => (a.aired_on < b.aired_on ? 1 : a.aired_on > b.aired_on ? -1 : a.show.localeCompare(b.show)));
}

/** Rows the browser found that the build did not have (a show logged after the last deploy). */
export function newerThanBuild(live: PodcastAppearance[], knownIds: string[]): PodcastAppearance[] {
  const known = new Set(knownIds);
  return live.filter((r) => !known.has(r.id));
}

/** The data-cta slug for a show's "Listen to the full episode" link (same rule the page has always used). */
export function showSlug(show: string): string {
  return show.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

/** Build time: every published appearance. A production build fails rather than ship an empty page. */
export async function fetchAppearances(): Promise<PodcastAppearance[]> {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!url || !key) {
    if (import.meta.env.PROD) throw new Error("podcastAppearances: VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are not set at build time");
    return [];
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from("podcast_appearances")
    .select(APPEARANCE_COLUMNS)
    .eq("published", true)
    .order("aired_on", { ascending: false });
  if (error) {
    if (import.meta.env.PROD) throw new Error(`podcastAppearances: read failed: ${error.message}`);
    return [];
  }
  const rows = cleanAppearances(data);
  if (import.meta.env.PROD && rows.length === 0) throw new Error("podcastAppearances: no published rows; refusing to build an empty As Heard On page");
  return rows;
}

/** In the browser: the same rows, or null if they cannot be read (the built list then stands as is). */
export async function fetchLiveAppearances(
  url: string | undefined,
  key: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<PodcastAppearance[] | null> {
  if (!url || !key) return null;
  try {
    // apikey only: the gateway reads the publishable key from it (anon role); it is not a user token.
    const res = await fetchImpl(`${url}${APPEARANCES_PATH}`, { headers: { apikey: key } });
    if (!res.ok) return null;
    return cleanAppearances(await res.json());
  } catch {
    return null;
  }
}
