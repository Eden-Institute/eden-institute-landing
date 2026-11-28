// web/lib/onlineYearCopy.ts
//
// Every word on the Online Year order page (/online-year/checkout, OY2, punch #472).
// APPROVED: word for word from "Approved copy" in EdensTable_Digital_License_Plan.md (her review page
// MfwucqoucDoZPXoq97a9a7, Nov 23), snapshotted in docs/online-year-copy/approved.md and pinned by
// src/test/onlineYearCopy.test.ts.
// OY_APPROVED_ORDER_PAGE: 6 lines the order page needed that the plan's copy did not have; Camila approved them
// word for word on 2026-11-25 (Lane 2 tap "Approve all 6", docs/online-year-copy/approved-2026-11-25-order-page.md).
// OY_APPROVED_THANK_YOU + OY_APPROVED_ORDER_ERRORS: the plan's "After checkout + order-page errors" (APPROVED
// 2026-11-25 12:21 PM CT, review page KmTbr6gswSDytGPRdwvRyx), word for word, snapshotted in
// docs/online-year-copy/approved-2026-11-25-thank-you.md. The thank-you lines keep the plan's own placeholders
// ([Child], [end date]) and its Sprouts wording; web/lib/onlineYearThankYou.ts fills them in and swaps the band
// ("Seedlings buyers see Seedlings (3-5) and 'Open Seedlings'").

export type OnlineYearBandKey = "sprouts" | "seedlings";

export const OY_APPROVED = {
  title: "Online Year, all 36 weeks",
  bandLabel: { sprouts: "Sprouts (K-2)", seedlings: "Seedlings (3-5)" } as Record<OnlineYearBandKey, string>,
  price: "$149 a year",
  siblingPrice: "Each sibling $29 a year",
  noRenewal: "12 months, no shipping, no automatic renewal",
  childLabel: "Child's first name or nickname",
  childHelper: "It goes on their Notebook pages. We don't need a last name.",
  agreement:
    "I understand this is a 12-month license for my household only. It's read online, doesn't download, and can't be shared. Digital purchases are final.",
  button: "Start the Online Year",
  underButton: "All sales final on digital products. No automatic renewal: we'll email you before your year ends.",
  signInEmail: "You'll sign in with this email address.",
  moreCountries: "We hope to open it to more countries later.",
} as const;

export const OY_APPROVED_ORDER_PAGE = {
  emailLabel: "Your email",
  addChild: "Add another child in this band",
  removeChild: "Remove",
  countryLabel: "Where do you live?",
  countries: { US: "United States", CA: "Canada", AU: "Australia", other: "Somewhere else" } as Record<string, string>,
  siblingNote: "Your first child is $149 and each brother or sister is $29. If you already have an Online Year in this band with this email, each new child you add here is $29.",
} as const;

export const OY_COUNTRY_CODES = ["US", "CA", "AU"] as const;

/** /online-year/thank-you, word for word (Sprouts shown, placeholders as the plan writes them). */
export const OY_APPROVED_THANK_YOU = {
  readyHeading: "Thank you! Your Online Year of Sprouts (K-2) is ready.",
  yearOneChild: "[Child]'s year runs through [end date].",
  yearTwoOrMore: "[Child] and [Child]'s years run through [end date].",
  openButton: "Open Sprouts",
  startWeek1:
    "Start with Week 1 in the Teacher's Guide; it lays out each day for you. When it's time for Notebook pages, tap Print, and [Child]'s name goes on every page.",
  // 2+ children (APPROVED 2026-11-25 ~6 PM CT, her tap "Each child's name" via NP; no names in this version).
  startWeek1TwoOrMore:
    "Start with Week 1 in the Teacher's Guide; it lays out each day for you. When it's time for Notebook pages, tap Print, and each child's name goes on their own pages.",
  signIn:
    "You'll sign in with the email you used at checkout. Each time you use a new device, we'll email you a code. It works on 3 devices with one child, plus one more for each sibling.",
  emailSent: "We just sent you an email with all of this too.",
  help: "If anything isn't working, email hello@edeninstitute.health and we'll fix it.",
  pendingHeading: "Thank you! Your order went through.",
  pendingBody: "We're setting up your Online Year now. Your welcome email is on its way, and it has everything you need to get started.",
  pendingHelp: "If it hasn't arrived in 10 minutes, check your spam folder or email hello@edeninstitute.health and we'll fix it.",
} as const;

/**
 * The order page's own error lines (create-checkout sends them; supabase/functions/_shared/online-year-checkout.ts
 * ONLINE_YEAR_ERROR_LINES carries the same words, pinned by the same test). Every other refusal keeps the generic line.
 */
export const OY_APPROVED_ORDER_ERRORS = {
  badChildName: "Please type just your child's first name or nickname, using letters only.",
  duplicateChildName: "You typed the same name twice. Please give each child their own name or nickname.",
  email: "Please check your email address. It's how you'll sign in.",
  tooManyChildren: "For a family this size, email hello@edeninstitute.health and we'll set it up for you.",
  notConfigured: "Checkout isn't quite ready. Please try again shortly, or email hello@edeninstitute.health.",
} as const;

/** The approved support address inside OY_APPROVED_THANK_YOU.help / pendingHelp (rendered as a mailto link). */
export const OY_HELP_EMAIL = "hello@edeninstitute.health";

/**
 * Where "Open Sprouts" / "Open Seedlings" goes: the Online Year sign-in page, which is also the reader (OY5).
 * Internal link, so no UTM tags.
 */
export const ONLINE_YEAR_SIGNIN_PATH = "/online-year/sign-in";

/**
 * The reader's own lines, word for word from the plan's "Approved copy > Inside the reader" (her review page,
 * Nov 23, version 5; device line updated on her "3, plus 1 per sibling" tap). Placeholders as the plan writes them.
 */
export const OY_APPROVED_READER = {
  topLine: "Online Year · [Band] · open through [end date]",
  licensedLine: "Licensed to [parent's name] · [email] · for use at home",
  signIn: "Sign in to your Online Year. Enter the email you used at checkout, and we'll send you a 6-digit code.",
  codeScreen: "Check your email for your code. It works for 10 minutes.",
  codeButton: "Sign in",
  newCodeLink: "Send a new code",
  atLimit: "You're signed in on [N] devices, your family's limit. Signing in here signs out the one you used longest ago.",
  atLimitButton: "Sign in here",
  lastTwoWeeks: "Your Online Year ends on [end date]. Renew to keep going.",
  renewFirstChild: "Renew for $149",
  yearEnded:
    "[Child]'s Online Year ended on [end date]. Everything you printed is yours to keep. Renew for another 12 months to pick up where you left off.",
  yearEndedButton: "Renew [Child]'s year",
  printButton: "Print [Child]'s Notebook pages for this week",
  doneButton: "Mark Week [N] done for [Child]",
  portfolio: "[Child]'s portfolio: week, date finished, plant, Scripture, plus the standards the year is aligned to.",
  portfolioButton: "Download [Child]'s portfolio",
  certificate: "[Child] finished the Sprouts year of Eden's Table and learned [number] plants. [school year]",
} as const;

/**
 * Reader lines the plan's approved copy did not have (buttons, labels, errors). Drafted 2026-11-28 and APPROVED by
 * Camila the same day on her review page (https://claude.ai/artifact/XPNmSg8mbyZd1DmbdEMVu7, Send 07:06 UTC):
 * 12 as drafted, 4 changed to her words: storybook "Read-Aloud", beforeWeek1 "Getting Started", backOfBook
 * "Academic Standards & Final Notes", and slowDown names the exact time (her tap: the clock time). Pinned by
 * src/test/onlineYearReader.test.ts. (The object keeps its old name so nothing else has to move.)
 */
export const OY_READER_DRAFT_APPROVED = true;
export const OY_READER_DRAFT = {
  sendCodeButton: "Email me a code",
  codeLabel: "Your 6-digit code",
  codeInvalid: "That code didn't work. Check the newest email from us, or send a new code.",
  tooManyTries: "That code has had too many tries. Please send a new code.",
  slowDown: "Too many tries for now. You can try again at [time].",
  signedOut: "You've been signed out on this device. Sign in again to keep going.",
  noYearHere: "Your Online Year isn't for this band. Choose your band above.",
  teachersGuide: "Teacher's Guide",
  storybook: "Read-Aloud",
  beforeWeek1: "Getting Started",
  week: "Week [N] · [Plant]",
  backOfBook: "Academic Standards & Final Notes",
  previous: "Previous pages",
  next: "Next pages",
  signOut: "Sign out of this device",
  loading: "Opening your pages...",
} as const;

// ── On the website (OY9): word for word from the plan's "Approved copy > On the website" (Nov 23). Sprouts is
// written; Seedlings uses the same words with its band name and grades (the plan's own rule). ─────────────────

export const OY_APPROVED_CARD = {
  step: "Step 3 · The whole year, online",
  title: "Online Year, all 36 weeks",
  price: "$149 a year",
  points: [
    "All 36 weeks, read online",
    "Teacher's Guide and storybook on screen",
    "Notebook pages to print, with your child's name",
    "A downloadable portfolio for each child, with the standards",
    "Each sibling $29 a year",
    "12 months, no shipping, no automatic renewal",
  ],
  when: "Tonight. Sign in with your email right after checkout.",
  button: "Start the Online Year",
} as const;

export const OY_APPROVED_DETAILS_HEADING = "The whole year, on your screen";
export function onlineYearDetails(band: OnlineYearBandKey): string[] {
  const label = OY_APPROVED.bandLabel[band];
  return [
    `The Online Year opens all 36 weeks of ${label} in your browser, on your phone, tablet or computer. You read the Teacher's Guide and the Read-Aloud Storybook right on the screen, and you print each child's Notebook pages as you go, with their name on every page.`,
    "It's $149 for a year for your first child. Each brother or sister in the same band is $29 a year and gets their own Notebook pages. Every license is for one child, for 12 months from the day you buy it.",
    "Each child's license builds their own portfolio. Tap Done when you finish a week, and it saves the date, the plant and the Scripture. Download it anytime as a PDF, with the standards the year is aligned to, for your state's portfolio or year-end evaluation if your state asks for one. At the end of the year, print a certificate with your child's name and every plant they learned.",
    "It's for your family at home. Every page carries your family's name and nothing downloads. You sign in with a code we email you, on 3 devices with one child, plus one more for each sibling you add.",
    "When your year is almost up, we'll email you two weeks ahead. Renew if you want to keep going. We never charge you automatically.",
    "Rather have books on the shelf? The printed set is $249 plus shipping (from $12), and it's yours to keep.",
  ];
}

/** The FAQ, in the approved order. Question 6 (ESA) stays OFF until the Online Year can be ordered through ESA. */
export const OY_APPROVED_FAQ: { q: string; a: string }[] = [
  { q: "Can I print it?", a: "You can print each child's Notebook pages, with their name on them. The Teacher's Guide and the storybook are read on screen and don't print or download." },
  { q: "What do I need?", a: "A phone, tablet or computer with a web browser, and a printer for the Notebook pages. You can use it on 3 devices with one child, plus one more for each sibling you add; each new device asks for a code we email you. The kitchen labs use simple supplies, and each week's list is in the Teacher's Guide." },
  { q: "How long does it last?", a: "12 months from the day you buy it. Two weeks before it ends, we'll email you so you can renew for another year. Renewing early doesn't cost you any days: the new year starts when the old one ends. If you don't renew, it simply closes. There's never an automatic charge." },
  { q: "How do siblings work?", a: "Each child in the same band gets their own license. Your first child's is $149 and includes the Teacher's Guide and storybook. Each sibling's is $29 and adds that child's Notebook pages, their own portfolio with the standards and a certificate in their name, and one more device. You can add a sibling anytime, and their year runs 12 months from the day you add them. The Teacher's Guide and storybook stay open as long as your $149 license is active." },
  { q: "What's in each child's portfolio?", a: "Each week you finish, tap Done. Your child's portfolio saves the date, that week's plant and its Scripture, and lists the standards the year is aligned to (the same list printed at the back of the Teacher's Guide). Download it anytime as a PDF for your state's portfolio or year-end evaluation, if your state asks for one. At the end of the year, print a certificate with your child's name and every plant they learned. Your child never has to log in." },
  { q: "I have kids in both bands. How does that work?", a: "Sprouts (K-2) and Seedlings (3-5) are separate years with different plants. You'd get an Online Year for each band: $149 for the first child in each, and $29 for each sibling in that band." },
  { q: "Is it refundable?", a: "No. Because it's digital, it isn't refundable. That's stated here rather than after you buy, so you can decide with it in front of you. If something isn't working, email hello@edeninstitute.health and we'll fix it." },
  { q: "Does my Starter Unit count toward it?", a: "Yes. The $39 credit from your Starter Unit email counts toward the same band's Online Year, so your first year is $110." },
  { q: "Can families outside the U.S. buy it?", a: "Yes, in Canada and Australia, priced in U.S. dollars. We hope to open it to more countries later." },
];

/**
 * The sales page's lead and anchor lines (her landing-page taps 2026-11-27, punch #482 decisions 4 and 6, as worded in
 * those taps): digital pages lead with the free week; the Online Year is compared with the printed set; per week.
 */
export const OY_SALES_LINES = {
  freeFirst: "Try a full week free first, no card needed",
  anchor: "All 36 weeks on screen for $149, against $249 plus $12 shipping for the printed set.",
  perWeek: "About $4.14 a week.",
} as const;

/** The Starter page credit line on launch day (approved "starter-line", Nov 23). */
export function starterCreditLineOnSale(bandName: "Sprouts" | "Seedlings"): string {
  return `Comes with a $39 credit toward the ${bandName} year, printed or online, whenever you're ready for the rest.`;
}
