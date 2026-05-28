/**
 * WeeklyRhythm (§5) — Mon-Fri rhythm cards from the locked Wk 02 master.
 *
 * Critical: this rhythm was corrected in spec v1.5 from a hallucinated v1.0
 * version. The locked sequence is Mon Story & Discussion / Tue Discovery /
 * Wed Kitchen Lab / Thu History & Art / Fri Garden & Review. Don't allow
 * any future copy edit to re-drift it without checking the Wk 02 master.
 *
 * Five horizontal cards above 880px; vertical scroll below. Each card
 * carries a single-glyph icon, the day, the title, and the one-line body.
 */
const DAYS = [
  {
    day: "Monday",
    title: "Story & Discussion",
    body: "Meet the herb through the Eden Family. Story arc weeks introduce a chapter; scripture weeks open with Genesis 1:29 and her sisters.",
    icon: "📖",
  },
  {
    day: "Tuesday",
    title: "Discovery",
    body: "Sensory encounter. Touch the herb. Smell it. Place it in your child's hand. The Core Question opens the discovery.",
    icon: "🌿",
  },
  {
    day: "Wednesday",
    title: "Kitchen Lab",
    body: "Brew, mix, taste. The recipe is on the page. Math hat on — measure the teaspoon.",
    icon: "☕",
  },
  {
    day: "Thursday",
    title: "History & Art",
    body: "Where this plant came from. Who tended it first. Draw it on the page next to the herb.",
    icon: "📜",
  },
  {
    day: "Friday",
    title: "Garden & Review",
    body: "Plant the seed. Review the chant. Read Vovó's closing line. Week complete.",
    icon: "🌱",
  },
] as const;

export default function WeeklyRhythm() {
  return (
    <section className="px-6 py-20 md:py-24" style={{ backgroundColor: "hsl(var(--cream-warm))" }}>
      <div className="max-w-6xl mx-auto">
        <p
          className="text-[11px] tracking-[0.3em] uppercase mb-4 text-center font-sans"
          style={{ color: "hsl(var(--honey))" }}
        >
          How a Week Works
        </p>
        <h2
          className="font-serif text-3xl md:text-4xl text-center mb-4"
          style={{ color: "hsl(var(--ink))" }}
        >
          Monday through Friday. Twenty-five to fifty minutes a day.
        </h2>
        <p
          className="text-center max-w-2xl mx-auto mb-12 text-base"
          style={{ color: "hsl(var(--ink-soft))" }}
        >
          Every week, every band, the same gentle rhythm. Different herb,
          different scripture, same table.
        </p>

        <div className="grid gap-4 min-[880px]:grid-cols-5">
          {DAYS.map((d) => (
            <div
              key={d.day}
              className="rounded-sm p-5"
              style={{
                backgroundColor: "hsl(var(--cream-light))",
                border: "1px solid hsl(var(--sage-pale))",
              }}
            >
              <div className="text-2xl mb-3" aria-hidden="true">{d.icon}</div>
              <h3
                className="font-serif text-lg font-bold mb-1"
                style={{ color: "hsl(var(--green-deep))" }}
              >
                {d.day}
              </h3>
              <p
                className="text-sm font-semibold mb-2"
                style={{ color: "hsl(var(--ink))" }}
              >
                {d.title}
              </p>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "hsl(var(--ink-soft))" }}
              >
                {d.body}
              </p>
            </div>
          ))}
        </div>

        <p
          className="text-center text-sm mt-10 max-w-3xl mx-auto italic"
          style={{ color: "hsl(var(--ink-soft))" }}
        >
          Every day carries a Bear Moment, the week's Herb Chant, and Teacher
          Notes (Today's Word + which subjects this day touches).
        </p>
      </div>
    </section>
  );
}
