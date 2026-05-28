import HatBadge from "./HatBadge";
import type { HatName } from "@/lib/homeschool/data";

/**
 * HatFramework (§7) — explainer of what each HAT covers and which weekday
 * activity drives it. Parent-facing so they can write transcripts with
 * confidence (per spec voice: "Eden's Table is a curriculum, not a unit
 * study").
 *
 * 5 cards in a grid. Above 880px: 5 columns. Below: 2 columns with the
 * 5th wrapping centered.
 */
const HATS: { hat: HatName; subject: string; body: string }[] = [
  {
    hat: "science",
    subject: "Botany, anatomy, body systems, scientific method",
    body: "Wednesday Kitchen Lab + Tuesday Discovery",
  },
  {
    hat: "ela",
    subject: "Vocabulary spine, story comprehension, write-in prompts, sentence-starter scaffolding",
    body: "Every day",
  },
  {
    hat: "math",
    subject: "Measurement, ratios, doubling/halving recipes, time intervals",
    body: "Wednesday Kitchen Lab + slow-medicine timing",
  },
  {
    hat: "theology",
    subject: "Scripture-anchored Mondays, Genesis 1:29 framework, stewardship ethics",
    body: "Monday + Devotional",
  },
  {
    hat: "history",
    subject: "Ancient herbalism traditions, monastery medicine, Creation Care Timeline",
    body: "Thursday",
  },
];

export default function HatFramework() {
  return (
    <section className="px-6 py-20 md:py-24" style={{ backgroundColor: "hsl(var(--cream-light))" }}>
      <div className="max-w-6xl mx-auto">
        <p
          className="text-[11px] tracking-[0.3em] uppercase mb-4 text-center font-sans"
          style={{ color: "hsl(var(--honey))" }}
        >
          What Subjects Does Eden's Table Count As?
        </p>
        <h2
          className="font-serif text-3xl md:text-4xl text-center mb-6"
          style={{ color: "hsl(var(--ink))" }}
        >
          Five HATs. Worn daily.
        </h2>
        <p
          className="text-center max-w-2xl mx-auto mb-12 text-base leading-relaxed"
          style={{ color: "hsl(var(--ink-soft))" }}
        >
          Eden's Table is a curriculum, not a unit study. Every lesson wears
          multiple hats — different subjects are visibly engaged in every
          activity. We name them on the page so you can chart your homeschool
          transcripts with confidence.
        </p>

        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 min-[1100px]:grid-cols-5 justify-items-center">
          {HATS.map((h) => (
            <div
              key={h.hat}
              className="rounded-sm p-5 w-full text-center"
              style={{
                backgroundColor: "hsl(var(--cream))",
                border: "1px solid hsl(var(--sage-pale))",
              }}
            >
              <div className="mb-3 flex justify-center">
                <HatBadge hat={h.hat} />
              </div>
              <p
                className="text-sm leading-relaxed mb-3"
                style={{ color: "hsl(var(--ink))" }}
              >
                {h.subject}
              </p>
              <p
                className="text-xs italic"
                style={{ color: "hsl(var(--ink-soft))" }}
              >
                {h.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
