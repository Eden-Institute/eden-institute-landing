// One short, easy-to-say link per podcast show Camila has joined (2026-11-16, Lane SEO
// funnel ideas, batch 5 item b5_podcast, Camila: "Do it"; her note the same evening:
// "start targeting podcasts to push the book and the quiz").
//
// WHY. A listener who hears "edeninstitute.health/roaming-mama" can type it from memory,
// lands on a page that greets them with that show's own host clip, and finds the free
// starting points in one place: Week 1 of Eden's Table, Chapter 1 of Back to Eden and
// the Body Pattern quiz. Because every show has its own path, page_views.path and
// waitlist_signups.source_url say which show sent which family. Kids Cook Real Food
// runs the same pattern across 200+ interviews.
//
// The page is web/components/PodcastWelcome.astro, rendered by a two-line file per show,
// web/pages/<slug>.astro (noindex, and not in the sitemap: it exists for listeners, not
// for search). The clip must be a permission: true host clip from that same show
// (web/lib/hostClips.ts); src/test/funnelBatch5.test.ts checks it, checks the show
// names, and checks that every line has its page file and every page has a line.
//
// audience decides which offer comes first:
//   homeschool  Week 1 of Eden's Table first, then Chapter 1 and the quiz
//   wellness    Chapter 1 and the quiz first (adult Christian wellness shows), then Week 1
//
// ADDING A SHOW: once its episode is public, add one line here and copy one of the
// two-line page files to web/pages/<slug>.astro. A show with no clip yet can still get a
// line with clip: null. The test fails if a line has no page file or a page has no line.

import { SHOWS, type Show } from "./hostClips";

export interface PodcastLink {
  /** The path, without the slash: edeninstitute.health/<slug>. Lowercase words and hyphens. */
  slug: string;
  /** Exactly as SHOWS lists it. */
  show: string;
  /** A permitted endorsement clip from this show's host, or null. */
  clip: string | null;
  audience: "homeschool" | "wellness";
}

export const PODCAST_LINKS: PodcastLink[] = [
  { slug: "holy-ground", show: "Holy Ground Motherhood", clip: "E13", audience: "homeschool" },
  { slug: "prayers-for-parents", show: "Prayers for Parents", clip: "E08", audience: "homeschool" },
  { slug: "planted-on-purpose", show: "Planted on Purpose", clip: "E06", audience: "homeschool" },
  { slug: "visibly-fit", show: "Visibly Fit with Wendie Pett", clip: "E01", audience: "wellness" },
  { slug: "weary-women", show: "Christian Wellness for Weary Women", clip: "E15", audience: "wellness" },
  { slug: "roaming-mama", show: "The Roaming Mama Podcast", clip: "E10", audience: "homeschool" },
  { slug: "adhd-families", show: "Homeschooling Systems for ADHD Families", clip: "E14", audience: "homeschool" },
];

export function showFor(link: PodcastLink): Show {
  const s = SHOWS.find((x) => x.show === link.show);
  if (!s) throw new Error(`podcastLinks: no show named "${link.show}" in SHOWS`);
  return s;
}
