// web/lib/onlineYearLaunch.ts
//
// THE SITE SWITCH for the Online Year (punch #472, OY9). While false, nothing on the public site offers it:
// no /homeschool card, the /online-year/<band> sales pages are noindex, and the Starter credit line and /returns
// keep their printed-only wording. Launch = Camila's go, then BOTH:
//   1. set the Supabase secret ONLINE_YEAR_ENABLED=true (opens checkout, sign-in, reader, printing), and
//   2. flip this to true in a one-line PR and merge it (the site shows the cards and the launch-day lines).
export const ONLINE_YEAR_ON_SALE = false;
