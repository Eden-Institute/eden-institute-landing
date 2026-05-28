/**
 * CoLearnerPromise (§4) — KEY positioning. Brand belief work, no CTA.
 *
 * Spec instruction: "This section carries the brand's most important
 * original positioning. Devote real real-estate." Split layout with the
 * parent-path vine diagram on left, headline + body on right. Diagram
 * deferred to broader asset pass; for now a stylized two-track SVG
 * stands in (parent track gold, child track sage, converging at top).
 */
export default function CoLearnerPromise() {
  return (
    <section
      className="px-6 py-20 md:py-28"
      style={{ backgroundColor: "hsl(var(--cream-light))" }}
    >
      <div className="max-w-6xl mx-auto grid gap-12 min-[880px]:grid-cols-2 items-center">
        {/* LEFT — two-path vine diagram (placeholder SVG until illustration ships) */}
        <div className="order-2 min-[880px]:order-1">
          <div
            className="aspect-square w-full max-w-[480px] mx-auto rounded-sm flex items-center justify-center"
            style={{
              backgroundColor: "hsl(var(--cream-warm))",
              border: "1px solid hsl(var(--sage-pale))",
            }}
            role="img"
            aria-label="Two-path diagram: child track (Sprouts to Practitioners over 12 years) and parent track (Foundations to Clinical Tier 3) converging at the top"
          >
            <svg viewBox="0 0 200 240" className="w-2/3 h-2/3" aria-hidden="true">
              {/* Child path — sage */}
              <path
                d="M 50 230 Q 60 160 80 100 Q 95 50 100 20"
                fill="none"
                stroke="hsl(var(--sage-border))"
                strokeWidth="2"
              />
              {/* Parent path — honey */}
              <path
                d="M 150 230 Q 140 160 120 100 Q 105 50 100 20"
                fill="none"
                stroke="hsl(var(--honey))"
                strokeWidth="2"
              />
              {/* Convergence dot */}
              <circle cx="100" cy="20" r="5" fill="hsl(var(--green-deep))" />
              {/* Labels */}
              <text x="50" y="245" textAnchor="middle" fontSize="10" fill="hsl(var(--ink-soft))">Child</text>
              <text x="150" y="245" textAnchor="middle" fontSize="10" fill="hsl(var(--ink-soft))">Parent</text>
            </svg>
          </div>
        </div>

        {/* RIGHT — headline + body */}
        <div className="order-1 min-[880px]:order-2">
          <p
            className="text-[11px] tracking-[0.3em] uppercase mb-4 font-sans"
            style={{ color: "hsl(var(--honey))" }}
          >
            The Co-Learner Promise
          </p>
          <h2
            className="italic text-3xl md:text-4xl leading-tight mb-8"
            style={{ color: "hsl(var(--ink))", fontFamily: "var(--font-accent)" }}
          >
            You're Not Just Buying a Curriculum for Your Children. You're Starting Your Own Education at the Same Table.
          </h2>

          <div
            className="space-y-5 text-[17px] leading-relaxed"
            style={{ color: "hsl(var(--ink-soft))" }}
          >
            <p>
              Most homeschool curriculum is built for the child. The parent is
              the teacher — translating, supervising, googling answers in the kitchen.
            </p>
            <p>
              Eden's Table is different. It's the only K-12 herbalism curriculum
              where you, the parent, can begin in Kindergarten alongside your child
              and reach genuine clinical competence by the time they're in
              Practitioners band.
            </p>
            <p>
              Your child learns lavender's calming properties in second grade.
              You learn lavender's nervine action and constitutional pattern through
              the Foundations Course. By the time your child is studying body systems
              in Seedlings, you're studying clinical body terrain in the Body Systems &amp;
              Clinical Literacy tier. By the time your child reaches Cultivators,
              you're practicing.
            </p>
            <p>
              One curriculum. Two thresholds. Built for the family that wants to
              grow together — not the family that wants the child to grow alone.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
