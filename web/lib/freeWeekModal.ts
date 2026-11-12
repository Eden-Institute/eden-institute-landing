// The free-week sign-up pop-up, one source of truth for both places it opens:
// /freebies (web/components/DualLeadMagnetCTAs.astro) and the /homeschool band
// ladders (web/pages/homeschool.astro). Before 2026-10-14 each page carried its own
// copy of these strings and a comment asking that they be kept in step by hand.
//
// 2026-10-14, founder-approved from the /freebies front-door audit
// (Eden's Table (Homeschool Curriculum)/Projects/UHPN October Sponsorship/
// Freebies_Front_Door_Audit_2026-10-13.docx, section 2, items 1 to 4):
//   1. The subtitle said "Check your inbox... on their way right now" BEFORE the
//      form was filled in. It now asks for the address; the inbox line moves to
//      the success screen.
//   2. The success screen said the waitlist line "You're on the list. We'll be in
//      touch." It now says Week 1 is on its way.
//   3. The button said "Connect With Us". It now says "Send me Week 1".
//   4. The Seedlings subtitle left out the bonus read-aloud (Story Seven) that the
//      page and the welcome email both include.
// successSubtitle is "" so the "Tell us where to send it" line disappears once the
// address is in. Every other WaitlistModal surface keeps its old wording, because
// these three settings are optional and only these two buttons set them.
//
// Must match the PDFs the welcome email delivers (supabase/functions/_shared/
// welcome-email-templates.ts). Copy rule: no em dashes.

/**
 * The Eden's Table waitlist audience. resend-waitlist maps it to
 * entry_funnel='edens_table'; the per-button `source` routes the nurture. Shared by
 * WaitlistController (Astro pages) and FreeWeekOfferCard (the app monograph).
 */
export const HOMESCHOOL_AUDIENCE_ID = "a48cb66e-b2a9-461d-98a6-bb1b12f72693";

export interface FreeWeekModal {
  source: "sprouts_magnet" | "seedlings_magnet";
  title: string;
  subtitle: string;
  submitLabel: string;
  successMessage: string;
  successSubtitle: string;
  /** Thank-you line when the server says the Week 1 email did NOT go (see LATE_MESSAGE). */
  lateMessage: string;
  /** The band's Week 1 download page, shown as a button in that case. */
  lateHref: string;
  lateLabel: string;
}

const SUBMIT_LABEL = "Send me Week 1";
const SUCCESS_MESSAGE = "Week 1 is on its way to your inbox now.";
// 2026-11-12, founder-approved wording (tap "Yes, build + ship all", Lane 2 area 5
// F3). resend-waitlist answers welcome_email_sent=false when Resend did not accept
// the Week 1 email; the pop-up then shows this line and a button to the band's
// Week 1 download page (the same page the welcome and the next-morning note link),
// instead of saying the email is on its way. Copy rule: no em dashes.
const LATE_MESSAGE = "You're signed up. Your email is running late, so here is Week 1 now:";
const LATE_LABEL = "Open Week 1";

export const FREE_WEEK_MODAL: Record<"sprouts" | "seedlings", FreeWeekModal> = {
  sprouts: {
    source: "sprouts_magnet",
    title: "Get Sprouts Week 1 · Free",
    subtitle:
      "Tell us where to send it. Your free Sprouts Week 1 (Lavender): five real lessons, the Teacher's Guide, the Notebook and the story.",
    submitLabel: SUBMIT_LABEL,
    successMessage: SUCCESS_MESSAGE,
    successSubtitle: "",
    lateMessage: LATE_MESSAGE,
    lateHref: "/freebies/sprouts-week-1",
    lateLabel: LATE_LABEL,
  },
  seedlings: {
    source: "seedlings_magnet",
    title: "Get Seedlings Week 1 · Free",
    subtitle:
      "Tell us where to send it. Your free Seedlings Week 1 (Elderberry): five real lessons, the Teacher's Guide, the Notebook and a bonus story.",
    submitLabel: SUBMIT_LABEL,
    successMessage: SUCCESS_MESSAGE,
    successSubtitle: "",
    lateMessage: LATE_MESSAGE,
    lateHref: "/freebies/seedlings-week-1",
    lateLabel: LATE_LABEL,
  },
};

/**
 * The late-email fallback for a pop-up opened with this `source`, or null for any
 * other sign-up (those keep their normal thank-you screen). WaitlistController reads
 * it from the button's data-waitlist-source, so every free-week button on every
 * page gets it without carrying three more attributes.
 */
export function freeWeekLateFor(
  source: string | null | undefined,
): Pick<FreeWeekModal, "lateMessage" | "lateHref" | "lateLabel"> | null {
  const m = source === "sprouts_magnet" ? FREE_WEEK_MODAL.sprouts : source === "seedlings_magnet" ? FREE_WEEK_MODAL.seedlings : null;
  return m ? { lateMessage: m.lateMessage, lateHref: m.lateHref, lateLabel: m.lateLabel } : null;
}
