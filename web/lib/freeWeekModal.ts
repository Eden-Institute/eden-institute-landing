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

export interface FreeWeekModal {
  source: "sprouts_magnet" | "seedlings_magnet";
  title: string;
  subtitle: string;
  submitLabel: string;
  successMessage: string;
  successSubtitle: string;
}

const SUBMIT_LABEL = "Send me Week 1";
const SUCCESS_MESSAGE = "Week 1 is on its way to your inbox now.";

export const FREE_WEEK_MODAL: Record<"sprouts" | "seedlings", FreeWeekModal> = {
  sprouts: {
    source: "sprouts_magnet",
    title: "Get Sprouts Week 1 · Free",
    subtitle:
      "Tell us where to send it. Your free Sprouts Week 1 (Lavender): five real lessons, the Teacher's Guide, the Notebook and the story.",
    submitLabel: SUBMIT_LABEL,
    successMessage: SUCCESS_MESSAGE,
    successSubtitle: "",
  },
  seedlings: {
    source: "seedlings_magnet",
    title: "Get Seedlings Week 1 · Free",
    subtitle:
      "Tell us where to send it. Your free Seedlings Week 1 (Elderberry): five real lessons, the Teacher's Guide, the Notebook and a bonus story.",
    submitLabel: SUBMIT_LABEL,
    successMessage: SUCCESS_MESSAGE,
    successSubtitle: "",
  },
};
