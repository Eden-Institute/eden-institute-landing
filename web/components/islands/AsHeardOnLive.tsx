// AsHeardOnLive (punch #474, 2026-11-24): on /as-heard-on, reads public.podcast_appearances in the browser and
// shows any episode logged after the last site build, above the built list, in the same layout. If the read
// fails or finds nothing new it renders nothing, so the page never changes for the worse.
import { useEffect, useState } from "react";
import { fetchLiveAppearances, newerThanBuild, showSlug, type PodcastAppearance } from "../../lib/podcastAppearances";

export default function AsHeardOnLive({ knownIds }: { knownIds: string[] }) {
  const [extra, setExtra] = useState<PodcastAppearance[]>([]);
  useEffect(() => {
    let live = true;
    fetchLiveAppearances(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY).then((rows) => {
      if (live && rows) setExtra(newerThanBuild(rows, knownIds));
    });
    return () => { live = false; };
  }, [knownIds]);
  if (extra.length === 0) return null;
  return (
    <>
      {extra.map((s) => (
        <article
          key={s.id}
          className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-8 items-start border-t pt-10"
          style={{ borderColor: "hsl(var(--eden-gold) / 0.3)" }}
        >
          <div>
            <h2 className="font-serif text-2xl md:text-3xl font-bold mb-2" style={{ color: "hsl(var(--eden-bark))" }}>{s.show}</h2>
            <p className="font-accent text-lg mb-3" style={{ color: "hsl(var(--eden-forest))" }}>with {s.host}</p>
            <p className="font-body text-base text-muted-foreground mb-4">{s.episode_title}</p>
            <a
              href={s.episode_url}
              target="_blank"
              rel="noopener"
              className="font-body underline"
              style={{ color: "hsl(var(--eden-forest))" }}
              data-cta={`as-heard-on-page-${showSlug(s.show)}`}
            >
              Listen to the full episode
            </a>
          </div>
        </article>
      ))}
    </>
  );
}
