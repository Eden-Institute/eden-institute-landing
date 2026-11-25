/**
 * Online Year OY2 (punch #472): the words on the order page and on Stripe's screen are Camila's APPROVED
 * copy, word for word (docs/online-year-copy/approved.md, a verbatim snapshot of the plan file's
 * "Approved copy (Nov 23)"), plus the 6 order-page lines she approved on 2026-11-25
 * (docs/online-year-copy/approved-2026-11-25-order-page.md), plus the thank-you page and order-page error lines
 * she approved on 2026-11-25 12:21 PM CT (docs/online-year-copy/approved-2026-11-25-thank-you.md).
 * A new line fails this test until it is approved.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ONLINE_YEAR_SIGNIN_PATH,
  OY_APPROVED,
  OY_APPROVED_ORDER_ERRORS,
  OY_APPROVED_ORDER_PAGE,
  OY_APPROVED_THANK_YOU,
  OY_HELP_EMAIL,
} from "../../web/lib/onlineYearCopy";
import { onlineYearOpenButton, onlineYearReadyHeading } from "../../web/lib/onlineYearThankYou";

const root = join(__dirname, "..", "..");
const approved = readFileSync(join(root, "docs", "online-year-copy", "approved.md"), "utf8").replace(/\s+/g, " ");
const approvedOrderPage = readFileSync(join(root, "docs", "online-year-copy", "approved-2026-11-25-order-page.md"), "utf8").replace(/\s+/g, " ");
const shared = readFileSync(join(root, "supabase", "functions", "_shared", "online-year-checkout.ts"), "utf8");
// The order-page error lines live in create-checkout's Online Year module (not _shared, so stripe-webhook's closure is unchanged).
const cc = readFileSync(join(root, "supabase", "functions", "create-checkout", "online-year-checkout.ts"), "utf8");

function strings(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (v && typeof v === "object") return Object.values(v).flatMap(strings);
  return [];
}

describe("Online Year order page copy", () => {
  it("every approved string is in the approved snapshot, word for word", () => {
    for (const s of strings(OY_APPROVED)) expect(approved, s).toContain(s.replace(/\s+/g, " "));
  });

  it("the 6 order-page lines are the ones she approved on 2026-11-25, word for word", () => {
    expect(Object.keys(OY_APPROVED_ORDER_PAGE).sort()).toEqual(["addChild", "countries", "countryLabel", "emailLabel", "removeChild", "siblingNote"]);
    const { countries, ...lines } = OY_APPROVED_ORDER_PAGE;
    for (const s of strings(lines)) expect(approvedOrderPage, s).toContain(s);
    expect(approvedOrderPage).toContain([countries.US, countries.CA, countries.AU, countries.other].join(" · "));
  });

  it("no em dashes anywhere on the page", () => {
    for (const s of [...strings(OY_APPROVED), ...strings(OY_APPROVED_ORDER_PAGE)]) expect(s).not.toMatch(/—/);
  });

  it("Stripe's product names, descriptions and submit line come from the approved copy (Sprouts words in the snapshot)", () => {
    expect(approved).toContain("Eden's Table Online Year: Sprouts (K-2), first child");
    expect(approved).toContain("Eden's Table Online Year: Sprouts (K-2), sibling");
    expect(approved).toContain(
      "12 months of online access to all 36 weeks of Sprouts: the Teacher's Guide, the Read-Aloud Storybook, this child's Notebook pages to print, and their portfolio. For one household.",
    );
    expect(approved).toContain("12 months of this child's Sprouts Notebook pages to print and their own portfolio. Goes with an active first-child Online Year.");
    // The shared module builds those same sentences with the band swapped in.
    expect(shared).toContain("12 months of online access to all 36 weeks of ${BAND_WORD[band]}: the Teacher's Guide, the Read-Aloud Storybook, this child's Notebook pages to print, and their portfolio. For one household.");
    expect(shared).toContain("12 months of this child's ${BAND_WORD[band]} Notebook pages to print and their own portfolio. Goes with an active first-child Online Year.");
    expect(shared).toContain("'All sales final on digital products. No automatic renewal: we\\'ll email you before your year ends.'");
  });
});

// The thank-you page and the order page's error lines: "After checkout + order-page errors", approved
// 2026-11-25 12:21 PM CT, snapshotted verbatim in docs/online-year-copy/approved-2026-11-25-thank-you.md.
const approvedThankYou = readFileSync(join(root, "docs", "online-year-copy", "approved-2026-11-25-thank-you.md"), "utf8").replace(/\s+/g, " ");

describe("Online Year thank-you page + order-page error lines", () => {
  it("every thank-you line is in the 2026-11-25 snapshot, word for word (placeholders as the plan writes them)", () => {
    expect(Object.keys(OY_APPROVED_THANK_YOU).sort()).toEqual([
      "emailSent", "help", "openButton", "pendingBody", "pendingHeading", "pendingHelp", "readyHeading", "signIn", "startWeek1", "yearOneChild", "yearTwoOrMore",
    ]);
    for (const s of strings(OY_APPROVED_THANK_YOU)) expect(approvedThankYou, s).toContain(s);
    expect(approvedThankYou).toContain(`Heading: ${OY_APPROVED_THANK_YOU.readyHeading}`);
    expect(approvedThankYou).toContain(`Button: ${OY_APPROVED_THANK_YOU.openButton} (to the Online Year sign-in page)`);
    expect(approvedThankYou).toContain(`Heading: ${OY_APPROVED_THANK_YOU.pendingHeading}`);
  });

  it("Seedlings buyers see Seedlings (3-5) and 'Open Seedlings', as the snapshot says", () => {
    expect(approvedThankYou).toContain('Seedlings buyers see Seedlings (3-5) and "Open Seedlings"');
    expect(onlineYearReadyHeading("seedlings")).toBe("Thank you! Your Online Year of Seedlings (3-5) is ready.");
    expect(onlineYearOpenButton("seedlings")).toBe("Open Seedlings");
    expect(onlineYearReadyHeading("sprouts")).toBe(OY_APPROVED_THANK_YOU.readyHeading);
    expect(onlineYearOpenButton("sprouts")).toBe(OY_APPROVED_THANK_YOU.openButton);
  });

  it("the 5 order-page error lines are in the snapshot, and create-checkout sends exactly those words for those codes", () => {
    const codeFor: Record<keyof typeof OY_APPROVED_ORDER_ERRORS, string> = {
      badChildName: "OY_BAD_CHILD_NAME",
      duplicateChildName: "OY_DUPLICATE_CHILD_NAME",
      email: "OY_EMAIL",
      tooManyChildren: "OY_TOO_MANY_CHILDREN",
      notConfigured: "OY_NOT_CONFIGURED",
    };
    expect(Object.keys(OY_APPROVED_ORDER_ERRORS).sort()).toEqual(Object.keys(codeFor).sort());
    for (const [k, line] of Object.entries(OY_APPROVED_ORDER_ERRORS)) {
      expect(approvedThankYou, line).toContain(line);
      expect(cc, line).toContain(`${codeFor[k as keyof typeof codeFor]}: ${JSON.stringify(line)},`);
    }
    // Every other refusal keeps the line these replace.
    expect(approvedThankYou).toContain('replace "Something went wrong. Please refresh the page and try again." for these cases');
    expect(cc).toContain("export const ONLINE_YEAR_SOMETHING_WRONG = 'Something went wrong. Please refresh the page and try again.';");
  });

  it("Open Sprouts goes to the Online Year sign-in page: one internal path, no tracking tags", () => {
    expect(ONLINE_YEAR_SIGNIN_PATH).toBe("/online-year/sign-in");
    expect(ONLINE_YEAR_SIGNIN_PATH).not.toMatch(/utm_|\?|https?:/);
    expect(OY_APPROVED_THANK_YOU.help).toContain(OY_HELP_EMAIL);
    expect(OY_APPROVED_THANK_YOU.pendingHelp).toContain(OY_HELP_EMAIL);
  });

  it("no em dashes", () => {
    for (const s of [...strings(OY_APPROVED_THANK_YOU), ...strings(OY_APPROVED_ORDER_ERRORS)]) expect(s).not.toMatch(/—/);
  });
});
