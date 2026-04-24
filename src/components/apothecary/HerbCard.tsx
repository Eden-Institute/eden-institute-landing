import { useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import type { HerbPublicRow } from "@/hooks/useHerbsPublic";

interface HerbCardProps {
  herb: HerbPublicRow;
}

const chipClass =
  "inline-block px-2.5 py-0.5 rounded-full text-xs font-body tracking-wide";

const sectionLabel =
  "font-accent text-[11px] tracking-[0.25em] uppercase mb-1.5";

export function HerbCard({ herb }: HerbCardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasSafetyFlag = Boolean(herb.cautions || herb.contraindications_general);

  return (
    <article
      className="rounded-lg border p-5 bg-background flex flex-col h-full"
      style={{ borderColor: "hsl(var(--border))" }}
    >
      <header>
        <h3
          className="font-serif text-xl font-semibold leading-tight"
          style={{ color: "hsl(var(--eden-bark))" }}
        >
          {herb.common_name ?? "Unnamed herb"}
        </h3>
        {herb.latin_name && (
          <p className="font-body italic text-sm text-muted-foreground mt-0.5">
            {herb.latin_name}
          </p>
        )}
        {herb.pronunciation && (
          <p className="font-accent text-[11px] tracking-[0.2em] uppercase text-muted-foreground mt-1">
            {herb.pronunciation}
          </p>
        )}
      </header>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {herb.temperature && (
          <span
            className={chipClass}
            style={{
              backgroundColor: "hsl(var(--eden-cream))",
              color: "hsl(var(--eden-bark))",
            }}
          >
            {herb.temperature}
          </span>
        )}
        {herb.moisture && (
          <span
            className={chipClass}
            style={{
              backgroundColor: "hsl(var(--eden-cream))",
              color: "hsl(var(--eden-bark))",
            }}
          >
            {herb.moisture}
          </span>
        )}
        {herb.part_used && (
          <span
            className={chipClass}
            style={{
              backgroundColor: "hsl(var(--eden-cream))",
              color: "hsl(var(--eden-bark))",
            }}
          >
            {herb.part_used}
          </span>
        )}
        {herb.plant_family && (
          <span
            className={chipClass}
            style={{
              backgroundColor: "hsl(var(--eden-cream) / 0.6)",
              color: "hsl(var(--eden-bark))",
            }}
          >
            {herb.plant_family}
          </span>
        )}
        {hasSafetyFlag && (
          <span
            className={`${chipClass} flex items-center gap-1`}
            style={{
              backgroundColor: "hsl(var(--destructive) / 0.1)",
              color: "hsl(var(--destructive))",
            }}
            title="Cautions apply"
          >
            <AlertTriangle className="w-3 h-3" />
            Cautions
          </span>
        )}
      </div>

      {herb.taste && (
        <p className="font-body text-xs text-muted-foreground mt-3">
          <span className="font-accent uppercase tracking-[0.2em] text-[10px] mr-1">
            Taste
          </span>
          {herb.taste}
        </p>
      )}

      {herb.energetics_summary && (
        <p
          className={`font-body text-sm mt-3 leading-relaxed ${
            expanded ? "" : "line-clamp-3"
          }`}
        >
          {herb.energetics_summary}
        </p>
      )}

      {expanded && (
        <div
          className="mt-4 space-y-5 border-t pt-4"
          style={{ borderColor: "hsl(var(--border))" }}
        >
          {herb.stewardship_note && (
            <section>
              <h4
                className={sectionLabel}
                style={{ color: "hsl(var(--eden-gold))" }}
              >
                Stewardship
              </h4>
              <p className="font-body text-sm leading-relaxed">
                {herb.stewardship_note}
              </p>
            </section>
          )}

          {herb.biblical_traditional_reference && (
            <section>
              <h4
                className={sectionLabel}
                style={{ color: "hsl(var(--eden-gold))" }}
              >
                Tradition
              </h4>
              <p className="font-body text-sm leading-relaxed italic">
                {herb.biblical_traditional_reference}
              </p>
            </section>
          )}

          {(herb.cautions || herb.contraindications_general) && (
            <section>
              <h4
                className={`${sectionLabel} flex items-center gap-1.5`}
                style={{ color: "hsl(var(--destructive))" }}
              >
                <AlertTriangle className="w-3 h-3" />
                Cautions
              </h4>
              {herb.cautions && (
                <p className="font-body text-sm leading-relaxed">
                  {herb.cautions}
                </p>
              )}
              {herb.contraindications_general && (
                <p className="font-body text-sm leading-relaxed mt-1.5 text-muted-foreground">
                  <span className="font-medium">
                    General contraindications:
                  </span>{" "}
                  {herb.contraindications_general}
                </p>
              )}
            </section>
          )}

          {(herb.pregnancy_safety ||
            herb.breastfeeding_safety ||
            herb.children_safety) && (
            <section>
              <h4
                className={sectionLabel}
                style={{ color: "hsl(var(--eden-gold))" }}
              >
                Special populations
              </h4>
              <dl className="font-body text-sm leading-relaxed space-y-1">
                {herb.pregnancy_safety && (
                  <div>
                    <dt className="inline font-medium">Pregnancy: </dt>
                    <dd className="inline">{herb.pregnancy_safety}</dd>
                  </div>
                )}
                {herb.breastfeeding_safety && (
                  <div>
                    <dt className="inline font-medium">Breastfeeding: </dt>
                    <dd className="inline">{herb.breastfeeding_safety}</dd>
                  </div>
                )}
                {herb.children_safety && (
                  <div>
                    <dt className="inline font-medium">Children: </dt>
                    <dd className="inline">{herb.children_safety}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          <p className="font-body text-xs text-muted-foreground italic pt-1">
            Clinical overlay — tissue states, organ system affinity, actions,
            constitutional matches, and citations — unlocks with Seed.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="mt-4 flex items-center gap-1 font-accent uppercase tracking-[0.2em] text-[11px] hover:opacity-70 self-start"
        style={{ color: "hsl(var(--eden-bark))" }}
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse monograph" : "Read full monograph"}
      >
        {expanded ? (
          <>
            <ChevronUp className="w-3 h-3" /> Collapse
          </>
        ) : (
          <>
            <ChevronDown className="w-3 h-3" /> Read monograph
          </>
        )}
      </button>
    </article>
  );
}
