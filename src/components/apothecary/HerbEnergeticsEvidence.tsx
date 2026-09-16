import { Link } from "react-router-dom";
import { ROUTES } from "@/lib/routes";
import { isHttpUrl } from "@/lib/safeUrl";
import {
  asCheckedNoReading,
  asEnergeticsSources,
  freeEvidenceLine,
  sourceReadingLabel,
  type HerbEnergeticsEvidence as Evidence,
} from "@/lib/energeticsEvidence";

/**
 * The pre-1900 evidence behind one herb's temperature and moisture.
 *
 * FOUNDER DECISION 2026-09-15 (p_herb_evidence_honesty_2026_09_15):
 *   - FREE and anon: when the old sources disagree, the page says so plainly,
 *     in the founder's own sentence, right under the energetics. When the
 *     research found no qualifying source, the page says that instead. Calm
 *     and small: this is a footnote, not a warning.
 *   - ROOT and above: the full source list, since sources are a Root feature
 *     under the same day's tier model. Lower tiers get the usual Root teaser.
 *   - A herb with no evidence row renders NOTHING. Silence means "not
 *     researched", which is different from "searched and found nothing", and
 *     the page never blurs the two.
 *
 * Nothing here ever announces agreement. The strongest positive claim the
 * component can make is to show the sources and let the reader read them.
 */

interface HerbEnergeticsEvidenceProps {
  /** The row from useHerbEnergeticsEvidence, or null/undefined for herbs with none. */
  evidence: Evidence | null | undefined;
  /** Root or above. The view has already NULLed `sources` below Root; this only picks the panel. */
  hasRoot: boolean;
  /** "monograph" is the full-page section; "card" is the tighter directory card. */
  variant?: "monograph" | "card";
  /**
   * Which half to render. The monograph shows both together; the directory
   * card shows the one-line "line" on the collapsed row and keeps the
   * "sources" list for the quick view, so a long bibliography never pushes
   * the next herb off the screen.
   */
  part?: "both" | "line" | "sources";
}

export function HerbEnergeticsEvidence({
  evidence,
  hasRoot,
  variant = "monograph",
  part = "both",
}: HerbEnergeticsEvidenceProps) {
  if (!evidence) return null;

  const line = part === "sources" ? null : freeEvidenceLine(evidence);
  const wantSources = part !== "line";
  const sources = hasRoot && wantSources ? asEnergeticsSources(evidence.sources) : [];
  const checked = hasRoot && wantSources ? asCheckedNoReading(evidence.checked_no_reading) : [];
  const sourceCount = evidence.source_count ?? 0;
  const showRootTeaser = !hasRoot && wantSources && sourceCount > 0;

  if (!line && sources.length === 0 && !showRootTeaser) return null;

  const isCard = variant === "card";
  // The card's own sections are h4 under the herb's h3 title; the monograph's
  // are h2/h3. Matching the host keeps the heading order linear for a screen
  // reader walking either surface.
  const Heading = isCard ? "h4" : "h3";

  return (
    <div
      className={isCard ? "mt-2" : "mt-4"}
      aria-label="What the old sources say"
    >
      {line && (
        <p
          className={`font-body leading-relaxed text-muted-foreground ${
            isCard ? "text-xs" : "text-sm"
          }`}
        >
          {line}
        </p>
      )}

      {sources.length > 0 && (
        <section className={line ? "mt-3" : ""}>
          <Heading
            className="font-accent uppercase tracking-[0.25em] text-[11px] mb-2"
            style={{ color: "hsl(40, 60%, 34%)" }}
          >
            The old sources
          </Heading>
          <ul className="space-y-3">
            {sources.map((source, i) => {
              const reading = sourceReadingLabel(source);
              return (
                <li
                  key={`${source.short}-${source.locator}-${i}`}
                  className="border-l-2 pl-3 py-0.5"
                  style={{
                    borderColor: source.counted
                      ? "hsl(var(--eden-gold))"
                      : "hsl(var(--eden-bark) / 0.25)",
                  }}
                >
                  <p className="font-body text-xs leading-relaxed">
                    <span className="font-medium">{source.short}</span>
                    {source.tradition && (
                      <span className="text-muted-foreground">
                        {" "}
                        · {source.tradition}
                      </span>
                    )}
                    {reading && (
                      <span className="text-muted-foreground">
                        {" "}
                        · reads it as {reading}
                      </span>
                    )}
                  </p>
                  {source.gloss && (
                    <p className="font-body text-xs leading-relaxed text-muted-foreground mt-0.5">
                      {source.gloss}
                    </p>
                  )}
                  {source.excerpt && (
                    <p className="font-body text-xs italic leading-relaxed text-muted-foreground mt-0.5">
                      &ldquo;{source.excerpt}&rdquo;
                    </p>
                  )}
                  {source.agreement && (
                    <p className="font-body text-[11px] leading-relaxed text-muted-foreground mt-0.5">
                      {source.agreement}
                    </p>
                  )}
                  <p className="font-body text-[11px] leading-relaxed text-muted-foreground mt-0.5">
                    {source.source}
                    {source.locator && <> · {source.locator}</>}
                  </p>
                  {isHttpUrl(source.url) && (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-body text-[11px] underline decoration-dotted underline-offset-2 text-muted-foreground hover:opacity-80"
                    >
                      Read the text
                    </a>
                  )}
                </li>
              );
            })}
          </ul>

          {evidence.rule && (
            <p className="font-body text-[11px] leading-relaxed text-muted-foreground mt-3">
              <span className="font-medium">How the app reads it: </span>
              {evidence.rule}
            </p>
          )}

          {checked.length > 0 && (
            <details className="mt-2">
              <summary className="font-body text-[11px] text-muted-foreground cursor-pointer">
                Also searched, no reading found ({checked.length})
              </summary>
              <ul className="mt-1 space-y-0.5 list-disc pl-5">
                {checked.map((item) => (
                  <li
                    key={item}
                    className="font-body text-[11px] leading-relaxed text-muted-foreground"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      {/* Same teaser shape the card and monograph already use for the other
          Root sections, so the ladder reads consistently. */}
      {showRootTeaser && (
        <div className={line ? "mt-2" : ""}>
          <p className="font-body text-xs text-muted-foreground italic">
            {sourceCount === 1
              ? "Root opens the pre-1900 source behind this reading, with the passage and where to read it."
              : `Root opens the ${sourceCount} pre-1900 sources behind this reading, with the passages and where to read them.`}
          </p>
          <Link
            to={`${ROUTES.APOTHECARY_PRICING}#tier-root`}
            data-cta={
              isCard ? "card-energetics-sources-root" : "monograph-energetics-sources-root"
            }
            className="inline-flex items-center min-h-[44px] -my-2 font-body text-xs underline-offset-2 hover:underline"
            style={{ color: "hsl(var(--eden-gold))" }}
          >
            Unlock with Root →
          </Link>
        </div>
      )}
    </div>
  );
}
