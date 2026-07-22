/**
 * ApothecaryDisclaimer — the standing safety and provenance notice for the
 * Apothecary surfaces.
 *
 * WHY THIS EXISTS
 *
 * The deep-dive guides carry a disclaimer (GuideTemplate.tsx) and the Terms
 * carry a full one (Terms.tsx section 11), but the Apothecary itself carried
 * NONE, on any surface, at any tier. A reader could browse 300 herbs with
 * pregnancy safety fields, drug interactions, refer thresholds and pattern
 * verdicts without ever meeting a "this is educational" line. That is the
 * highest-clinical-density surface in the product and it was the only one
 * with no notice at all.
 *
 * TWO NOTICES, DELIBERATELY SEPARATE
 *
 * `safety` is the standard educational-not-medical-advice line, worded to
 * match the guides so a reader who owns both hears one voice.
 *
 * `provenance` is the honest account of where the herb data comes from, and
 * it is not boilerplate. It exists because the citation audit established
 * facts a reader deserves to know:
 *
 *   - 231 of 300 herbs carry a temperature with NO pre-1900 source. The
 *     American Eclectic corpus (King's, Cook, Felter, Ellingwood) classifies
 *     by ACTION and assigns no thermal quality at all, and the New World
 *     herbs have no classical corpus to consult. Those values are modern
 *     energetic synthesis and always will be; no further searching fixes it.
 *   - Roughly a fifth of the citations are post-1900 works.
 *   - Pattern verdicts print a warning only when curated evidence backs it;
 *     the computed fallback is forbidden from saying "avoid" (see
 *     src/lib/herbVerdict.ts) and falls silent instead.
 *
 * Saying that plainly is disclosure. Implying every energetic value rests on
 * a period source would not be true, and this project's standing rule is that
 * an admitted gap beats a confident-sounding one.
 */

interface ApothecaryDisclaimerProps {
  /**
   * `full` renders both notices, for the directory footer and the monograph
   * page. `safety` renders the medical line alone, for surfaces where the
   * sourcing note would be noise.
   */
  variant?: "full" | "safety";
  className?: string;
}

export function ApothecaryDisclaimer({
  variant = "full",
  className = "",
}: ApothecaryDisclaimerProps) {
  return (
    <aside
      className={`mt-12 pt-6 border-t ${className}`}
      style={{ borderColor: "hsl(var(--eden-gold) / 0.25)" }}
      aria-label="Educational use and sourcing"
    >
      <div className="flex flex-col gap-4 max-w-2xl">
        <div className="flex flex-col gap-1.5">
          <h2
            className="font-accent text-[11px] tracking-[0.25em] uppercase"
            style={{ color: "hsl(var(--eden-gold))" }}
          >
            Educational use
          </h2>
          <p className="font-body text-sm leading-relaxed text-muted-foreground">
            The Apothecary is educational and does not constitute medical
            advice. Nothing here is intended to diagnose, treat, cure, or
            prevent any disease. Always consult a qualified healthcare provider
            before changing what you take, especially if you are pregnant,
            nursing, taking medication, or managing a diagnosed condition.
          </p>
        </div>

        {variant === "full" && (
          <div className="flex flex-col gap-1.5">
            <h2
              className="font-accent text-[11px] tracking-[0.25em] uppercase"
              style={{ color: "hsl(var(--eden-gold))" }}
            >
              On our sources
            </h2>
            <p className="font-body text-sm leading-relaxed text-muted-foreground">
              These entries draw on public-domain materia medica, most of it
              published before 1900, alongside a smaller number of modern
              reference works. Energetic qualities such as warming, cooling,
              drying and moistening are a traditional framework for describing
              how a plant behaves in the body, not a laboratory measurement.
              Where a period source states one, we cite it. Where none does,
              and for many North American herbs none exists, the value reflects
              modern herbal consensus rather than a historical text. When we
              cannot support a caution with real evidence, we say nothing
              rather than guess.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
