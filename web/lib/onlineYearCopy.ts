// web/lib/onlineYearCopy.ts
//
// Every word on the Online Year order page (/online-year/checkout, OY2, punch #472).
// APPROVED: word for word from "Approved copy" in EdensTable_Digital_License_Plan.md (her review page
// MfwucqoucDoZPXoq97a9a7, Nov 23), snapshotted in docs/online-year-copy/approved.md and pinned by
// src/test/onlineYearCopy.test.ts.
// PENDING: new lines the order page needs that the approved copy does not have. They go to Camila on a
// review page before this page can be used; the test lists them so none slips through unreviewed.

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

export const OY_PENDING = {
  emailLabel: "Your email",
  addChild: "Add another child in this band",
  removeChild: "Remove",
  countryLabel: "Where do you live?",
  countries: { US: "United States", CA: "Canada", AU: "Australia", other: "Somewhere else" } as Record<string, string>,
  siblingNote: "Your first child is $149 and each brother or sister is $29. If you already have an Online Year in this band with this email, each new child you add here is $29.",
} as const;

export const OY_COUNTRY_CODES = ["US", "CA", "AU"] as const;
