/**
 * FounderLetter (§2) — verbatim 4-paragraph letter from spec v1.5.
 *
 * Founder portrait deferred per spec Open Question #6 (target July 22, 2026).
 * Slot renders a cream-warm circle placeholder until the photo ships.
 *
 * Credentials line is the locked v1.5 version: "Master's in education /
 * Credentialed teacher / Author, Back to Eden / Clarksville, TN." Spec
 * §2 explicitly forbids "practicing clinical herbalist" — do NOT drift.
 */
export default function FounderLetter() {
  return (
    <section className="px-6 py-20 md:py-24" style={{ backgroundColor: "hsl(var(--cream-light))" }}>
      <div className="max-w-[800px] mx-auto">
        <p
          className="text-[11px] tracking-[0.3em] uppercase mb-6 text-center font-sans"
          style={{ color: "hsl(var(--honey))" }}
        >
          From the Founder
        </p>

        {/* Portrait slot — awaiting asset delivery July 22 */}
        <div className="flex justify-center mb-8">
          <div
            className="w-32 h-32 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: "hsl(var(--cream-warm))",
              border: "1px solid hsl(var(--sage-pale))",
            }}
            role="img"
            aria-label="Camila Johnson portrait — arriving July 22, 2026"
          >
            <span className="text-[10px] italic" style={{ color: "hsl(var(--ink-soft))" }}>
              Portrait
            </span>
          </div>
        </div>

        <h2
          className="text-center italic text-3xl md:text-4xl leading-tight mb-10"
          style={{ color: "hsl(var(--ink))", fontFamily: "var(--font-accent)" }}
        >
          “I built this because I couldn't find it. And my children needed it to exist.”
        </h2>

        <div
          className="space-y-6 text-base leading-[1.85]"
          style={{ color: "hsl(var(--ink-soft))" }}
        >
          <p>
            I'm Camila — a credentialed teacher with a Master's in education.
            I spent years studying herbalism formally, and every school I attended
            was rooted in Far Eastern mysticism. Chakras, doshas, energy paradigms
            I don't share.
          </p>
          <p>
            I didn't want to quit. The plants are real. Three thousand years of
            Western clinical herbalism is real. The body's design is real. But I
            refused to learn it — or teach it to my children — through a paradigm
            contrary to my faith.
          </p>
          <p>
            So I built a framework that begins with Yahweh as the source of
            vital force, threads Scripture through every plant and every body
            system, and roots clinical reasoning in the Western tradition that
            came before the East was imported into our wellness culture.
          </p>
          <p>
            Then I built the curriculum to teach it to my own children. Open-and-go.
            K through 12. Anchored in Scripture, free from chakras and doshas,
            grounded in real botany and real anatomy and real history.
          </p>
          <p>
            If you've ever picked up a Christian herbalism curriculum and quietly
            noticed Eastern frameworks beneath the surface — this is the alternative
            you've been waiting for.
          </p>
        </div>

        <p
          className="mt-10 text-3xl text-center"
          style={{ color: "hsl(var(--green-deep))", fontFamily: "'Caveat', cursive" }}
        >
          — Camila Johnson
        </p>
        <p
          className="mt-4 text-xs text-center tracking-[0.15em]"
          style={{ color: "hsl(var(--ink-soft))" }}
        >
          Master's in education · Credentialed teacher · Author, Back to Eden: A Biblical Foundation for Herbal Healing · Clarksville, Tennessee
        </p>
      </div>
    </section>
  );
}
