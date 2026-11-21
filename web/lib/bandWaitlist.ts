// The grade 6-12 waitlist form (PR #780, founder 2026-11-20: "prompt them to join a waitlist"): the site's existing
// WaitlistModal with /homeschool's "Tell me when it opens" words, the same source tags (cultivators_waitlist /
// practitioners_waitlist, which feed the waitlist_cultivators / waitlist_practitioners segments through
// band_waitlist), consent and welcome. ONE definition, used by the Curriculum Finder's coming-soon cards and the
// Wired results page's coming-soon line (2026-11-21), so both open the very same form.
import { HOMESCHOOL_AUDIENCE_ID } from "./freeWeekModal";

export type UpperBand = "cultivators" | "practitioners";

/** The public waitlist bands (same names, dates and wording as the /homeschool band cards), by workbook sheet id. */
export const COMING_SOON_BANDS: Record<string, { band: UpperBand; name: string; grades: string; status: string }> = {
  C033: { band: "cultivators", name: "Cultivators", grades: "grades 6-8", status: "Planned for late 2027" },
  C034: { band: "practitioners", name: "Practitioners", grades: "grades 9-12", status: "Planned for 2028" },
};

/** A coming-soon row's band from its eden_band ("6-8 set" / "9-12 set"). */
export function upperBandOf(edenBand: string | null | undefined): UpperBand {
  return /9-12/.test(edenBand ?? "") ? "practitioners" : "cultivators";
}

/** The WaitlistModal props for one band. `formName` is the GA4 form name (one per placement); `source` names the list. */
export function bandWaitlistProps(band: UpperBand, formName: string) {
  const b = Object.values(COMING_SOON_BANDS).find((x) => x.band === band)!;
  return {
    audienceId: HOMESCHOOL_AUDIENCE_ID,
    source: `${band}_waitlist`,
    formName,
    title: `Tell me when ${b.name} opens`,
    subtitle: `I will email you the moment ${b.name} has a date. Add your mobile number if you would also like a text when it opens.`,
    successCtaHref: "https://edeninstitute.health/homeschool#choose-band",
    successCtaLabel: "See where to start today",
    successCtaBlurb: `${b.name} goes deeper into the 72 plants your child meets in Sprouts and Seedlings, so the best preparation is to start with them now.`,
  };
}
