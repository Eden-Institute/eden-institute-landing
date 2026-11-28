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
