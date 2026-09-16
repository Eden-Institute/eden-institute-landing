/**
 * Pre-1900 energetics evidence: the shapes the herb page renders, and the
 * narrowing that keeps a malformed row from reaching the DOM.
 *
 * FOUNDER DECISION 2026-09-15 (memory p_herb_evidence_honesty_2026_09_15):
 * every pre-1900 source found for a herb's temperature and moisture is shown
 * on the herb page with its citation, and where the sources disagree the page
 * says so plainly. The value the app matches on is the modern reading of what
 * the herb does in the body; the old readings corroborate, add, or break ties
 * only. A herb the research could not source is marked "no pre-1900 source
 * found", never filled with a plausible guess.
 *
 * WHERE THE DATA LIVES
 * public.herbs.energetics_citation, written for 50 herbs by
 * supabase/migrations/20260916190000_energetics_sources_batches_1_2.sql, and
 * read through public.herb_energetics_evidence_v. That view is the real tier
 * gate: it returns the plain-English fields to every caller (anon included)
 * and NULLs `sources`, `checked_no_reading` and `counted_readings` below Root,
 * because sources are a Root feature under the 2026-09-15 tier model while
 * honesty about the evidence is not a paid feature.
 *
 * WHAT THE PAGE MAY NEVER DO
 * Claim agreement that is not in the data. Nothing here derives "the sources
 * agree" from anything: `sourcesAgree` is the stored boolean, the disagreement
 * sentence is the founder-approved text stored with the herb, and a herb with
 * no evidence row renders nothing at all.
 */

/** One pre-1900 source as stored in energetics_citation.sources. */
export interface EnergeticsSource {
  /** Full bibliographic string, as the research recorded it. */
  source: string;
  /** Short form used inside the disagreement sentence, e.g. "Culpeper (1653)". */
  short: string;
  /** Year or period, verbatim: "1653", "16th century", "c. 200 CE". */
  year: string;
  /** Corpus slug: galenic-european | ayurvedic | chinese | unani | american. */
  corpus: string;
  /** Human tradition label, e.g. "Galenic (European)". */
  tradition: string;
  /** first-hand | second-hand-report. */
  tier: string;
  /** What the source assigns, in its own words. Null when it assigns none. */
  assigns_temperature: string | null;
  assigns_moisture: string | null;
  /** The quoted line, in the original language where the source is not English. */
  excerpt: string;
  /** Plain-English reading of the excerpt. */
  gloss: string;
  /** Where in the work the excerpt sits. */
  locator: string;
  /** Where the text was read. Rendered through isHttpUrl, never raw. */
  url: string;
  /** Whether this reading counted toward the rule, and what it does to the app value. */
  counted: boolean;
  counted_temperature: boolean;
  counted_moisture: boolean;
  not_counted_why: string;
  agreement: string;
}

/** One row of public.herb_energetics_evidence_v. */
export interface HerbEnergeticsEvidence {
  herb_id: string;
  /** 1 or 2: which research batch found this. */
  batch: number | null;
  /** True when the search ran and turned up no qualifying pre-1900 source. */
  no_pre1900_source_found: boolean | null;
  /** The stored boolean. Never computed here. */
  sources_agree: boolean | null;
  /** "agree" | "disagree" | "none". */
  agreement_state: string | null;
  /** The founder-approved sentence for the page. Null when there is nothing to say. */
  disagreement_text: string | null;
  /** Plain-English basis for the value the app shows. */
  rule: string | null;
  source_count: number | null;
  /** Root and above; NULL below, by the view. */
  sources: unknown;
  checked_no_reading: unknown;
  counted_readings: unknown;
  rule_general: string | null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableStr(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Narrow the jsonb `sources` payload to the list the page renders.
 *
 * Defensive on purpose: below Root the view sends null, and a row written by
 * some future migration may not match this shape. Either way the caller gets
 * an empty list and renders no source section, never a half-built citation.
 * A source with no `source` string is dropped rather than rendered blank.
 */
export function asEnergeticsSources(value: unknown): EnergeticsSource[] {
  if (!Array.isArray(value)) return [];
  const out: EnergeticsSource[] = [];
  for (const raw of value) {
    if (!isPlainObject(raw)) continue;
    const source = str(raw.source);
    if (!source) continue;
    out.push({
      source,
      short: str(raw.short) || source,
      year: str(raw.year),
      corpus: str(raw.corpus),
      tradition: str(raw.tradition),
      tier: str(raw.tier),
      assigns_temperature: nullableStr(raw.assigns_temperature),
      assigns_moisture: nullableStr(raw.assigns_moisture),
      excerpt: str(raw.excerpt),
      gloss: str(raw.gloss),
      locator: str(raw.locator),
      url: str(raw.url),
      counted: raw.counted === true,
      counted_temperature: raw.counted_temperature === true,
      counted_moisture: raw.counted_moisture === true,
      not_counted_why: str(raw.not_counted_why),
      agreement: str(raw.agreement),
    });
  }
  return out;
}

/** The jsonb list of texts searched that gave no reading (Root and above). */
export function asCheckedNoReading(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0);
}

/**
 * What a herb assigns to a single axis, as one short phrase for the source
 * list. Returns null when the source assigns nothing on that axis, so the page
 * prints nothing rather than "null" or an invented Neutral.
 */
export function sourceReadingLabel(source: EnergeticsSource): string | null {
  const parts: string[] = [];
  if (source.assigns_temperature) parts.push(source.assigns_temperature);
  if (source.assigns_moisture) parts.push(source.assigns_moisture);
  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * The one line a FREE reader sees under the energetics, or null for silence.
 *
 * Three states, and only three:
 *   - the sources disagree  -> the founder's own sentence, stored with the herb;
 *   - the search found none -> the no-source line;
 *   - anything else         -> nothing. Agreement is never announced, because
 *     "the sources agree" on a single counted reading would overclaim.
 */
export const NO_PRE1900_SOURCE_LINE =
  "No pre-1900 source found for this reading.";

export function freeEvidenceLine(
  evidence: HerbEnergeticsEvidence | null | undefined,
): string | null {
  if (!evidence) return null;
  if (evidence.disagreement_text) return evidence.disagreement_text;
  if (evidence.no_pre1900_source_found) return NO_PRE1900_SOURCE_LINE;
  return null;
}
