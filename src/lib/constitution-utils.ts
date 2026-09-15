import { PATTERN_PROFILES } from "@/lib/edenPattern";

/**
 * Convert a Pattern name (e.g. "The Burning Bowstring" or "Burning Bowstring")
 * to its canonical slug ("burning-bowstring").
 */
export function patternNameToSlug(name: string): string {
  return name.toLowerCase().replace(/^the\s+/i, "").trim().replace(/\s+/g, "-");
}

/**
 * CONSTITUTION_MAP — axis-label ("Cold / Damp / Tense") → { slug, name }.
 *
 * Derived from edenPattern.PATTERN_PROFILES (the single source of truth for the
 * eight Patterns and their 3-axis composition), so the archetype roster is
 * maintained in exactly one place. Adding a Pattern there flows through here.
 */
export const CONSTITUTION_MAP: Record<string, { slug: string; name: string }> =
  Object.fromEntries(
    Object.values(PATTERN_PROFILES).map((p) => [
      `${p.temperature} / ${p.moisture} / ${p.tone}`,
      { slug: patternNameToSlug(p.name), name: p.name },
    ]),
  );

/** Reverse of CONSTITUTION_MAP: slug ("frozen-knot") → axis label ("Cold / Damp / Tense"). */
export const SLUG_TO_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(CONSTITUTION_MAP).map(([type, v]) => [v.slug, type]),
);

/** Axis label for a Pattern slug, or undefined for an unknown slug. */
export function getTypeFromSlug(slug: string): string | undefined {
  return SLUG_TO_TYPE[slug];
}