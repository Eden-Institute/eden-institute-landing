/**
 * ThreePillars (§3) — Open-and-Go / Family Style / Faith Rooted.
 *
 * No CTAs. Cream background. Three equal-weight columns on desktop,
 * 1-column stack below 880px. Botanical illustrations are deferred
 * until the broader asset pass; for now each pillar gets a thin
 * sage-tinted hairline marker.
 */
const PILLARS = [
  {
    title: "Open and Go.",
    body: "Every lesson includes a parent guide and student notebook. No prep required. Read it, teach it, close it. The Teacher Guide is written for the parent with zero herbalism background.",
  },
  {
    title: "Family Style.",
    body: "Multi-age by design. Older students go deeper, younger ones grow into it. One curriculum, one table, one family — the kitchen is the classroom and the garden is the textbook.",
  },
  {
    title: "Faith Rooted.",
    body: "Every unit anchored in Scripture. Yahweh is the source of vital force. Herbalism is stewardship of His creation, not alternative medicine. Free from chakras, doshas, and Eastern metaphysics.",
  },
] as const;

export default function ThreePillars() {
  return (
    <section className="px-6 py-20 md:py-24" style={{ backgroundColor: "hsl(var(--cream))" }}>
      <div className="max-w-6xl mx-auto">
        <p
          className="text-[11px] tracking-[0.3em] uppercase mb-4 text-center font-sans"
          style={{ color: "hsl(var(--honey))" }}
        >
          Why Families Choose Eden's Table
        </p>
        <h2
          className="font-serif text-3xl md:text-4xl text-center mb-14"
          style={{ color: "hsl(var(--ink))" }}
        >
          Three pillars. One table.
        </h2>

        <div className="grid gap-10 min-[880px]:grid-cols-3">
          {PILLARS.map((p) => (
            <div key={p.title} className="text-center min-[880px]:text-left">
              <div
                className="w-12 h-px mx-auto min-[880px]:mx-0 mb-6"
                style={{ backgroundColor: "hsl(var(--sage-border))" }}
              />
              <h3
                className="font-serif text-2xl mb-4"
                style={{ color: "hsl(var(--ink))" }}
              >
                {p.title}
              </h3>
              <p
                className="text-base leading-relaxed"
                style={{ color: "hsl(var(--ink-soft))" }}
              >
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
