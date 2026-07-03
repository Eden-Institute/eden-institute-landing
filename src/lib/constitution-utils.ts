import { PATTERN_PROFILES } from "@/lib/edenPattern";

const slugFromName = (name: string): string =>
  name.toLowerCase().replace(/^the\s+/, "").trim().replace(/\s+/g, "-");

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
      { slug: slugFromName(p.name), name: p.name },
    ]),
  );

export function getSlugFromType(constitutionType: string): string {
  return CONSTITUTION_MAP[constitutionType]?.slug ?? "burning-bowstring";
}

export function getNameFromType(constitutionType: string): string {
  return CONSTITUTION_MAP[constitutionType]?.name ?? "Unknown";
}