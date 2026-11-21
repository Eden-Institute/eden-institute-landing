/**
 * /esa/florida: step-by-step page for Florida PEP and FES-UA families. Added 2026-11-20 (Lane 2c),
 * from Camila's Lane 4 pick "Florida + receipt form" and her goal "an easy peasy way for parents to
 * CLEARLY see the steps to order with funds and make it as easy as humanly possible".
 *
 * Florida is NOT an ESA_STATES page: Eden's Table is not an approved vendor there yet (it stays in
 * ESA_PENDING, which links here). What IS true today: a PEP or FES-UA family can buy on our store
 * and ask their scholarship organization to pay them back. This page says exactly that.
 *
 * Every rule below comes from a document in FL_SOURCES, each loaded and read on 2026-11-20:
 *   - SUFS reimbursement page (Unique Abilities path; no PEP-specific page exists): EMA, up to 60
 *     days, 2026-27 window through July 31, 2027, "complete transaction date", "paid in full".
 *   - SUFS 2026-27 deadlines FAQ: names both UA and PEP, July 31, 2027, up to 60 days.
 *   - SUFS PEP Purchasing Guide (2025-26 edition, effective April 2026; no 2026-27 edition found):
 *     curriculum includes "teachers' manuals".
 *   - AAA FTC/PEP/FES-EO Purchasing Handbook 2026-27 rev 11/10/26: teacher's editions prohibited;
 *     goods bought for reimbursement ship to the residential address on the student's account.
 *     It does NOT cover AAA's FES-UA families, so the page does not apply it to them.
 *   - AAA Florida page: reimbursements are requested in the Scholarship Management Platform (SMP).
 *   - SUFS vendors page: MyScholarShop interest list closed, reopening early 2027.
 *
 * The same copy rules as web/lib/esaStates.ts apply (no banned words, no em dashes, never "can
 * buy" where a family cannot); the page refuses to build if any text here breaks them.
 */

export const FL_STEPS: { n: number; heading: string; body: string }[] = [
  {
    n: 1,
    heading: "Order on our store",
    body: "Choose the Sprouts (grades K-2) or Seedlings (grades 3-5) printed set, or a 9-Week Starter Unit download, and pay with your own card. Your order number (it starts with ET-) comes in your confirmation email.",
  },
  {
    n: 2,
    heading: "Get your reimbursement-ready receipt",
    body: "Enter your order number in the form below. You get a one-page PDF marked Paid in full, with the date you paid, each item and its price, the total, the card you paid with, and your student's name.",
  },
  {
    n: 3,
    heading: "Submit it for reimbursement",
    body: "Step Up For Students families: sign in to EMA and submit a reimbursement request with the receipt attached. AAA Scholarship Foundation families: sign in to the Scholarship Management Platform (SMP) and request your reimbursement there.",
  },
  {
    n: 4,
    heading: "Wait for the review",
    body: "Step Up For Students asks families to allow up to 60 days for a reimbursement review. Purchases for the 2026-27 school year can be submitted through July 31, 2027.",
  },
];

/** What to order. Prices match /books and /starter. */
export const FL_ORDER_LINKS: { label: string; price: string; href: string }[] = [
  { label: "Sprouts printed set, grades K-2", price: "$249 plus $12 shipping", href: "/books" },
  { label: "Seedlings printed set, grades 3-5", price: "$249 plus $12 shipping", href: "/books#seedlings" },
  { label: "Sprouts 9-Week Starter Unit (download)", price: "$39", href: "/starter" },
  { label: "Seedlings 9-Week Starter Unit (download)", price: "$39", href: "/starter/seedlings" },
];

/** The AAA caveats, shown in their own box before the form. */
export const FL_AAA_NOTES: string[] = [
  "Teacher's Guide: AAA's 2026-27 Purchasing Handbook for FTC, PEP and FES-EO lists teacher's editions as not eligible. Every printed set includes a Teacher's Guide, so AAA may not reimburse that part. Step Up For Students counts teachers' manuals as curriculum.",
  "Shipping address: that AAA handbook asks for anything you buy for reimbursement to ship to the home address on your student's scholarship account. Use that address at checkout. Downloads are not affected.",
  "AAA families with FES-UA follow AAA's own FES-UA purchasing guide, so check it before you buy.",
];

export const FL_FAQ: { q: string; a: string }[] = [
  {
    q: "Can I use my PEP or FES-UA scholarship for Eden's Table?",
    a: "Yes, by reimbursement. Buy on our store with your own card, download your paid-in-full receipt here, and submit it to Step Up For Students (in EMA) or AAA (in SMP). Reviews can take up to 60 days.",
  },
  {
    q: "Is Eden's Table on MyScholarShop?",
    a: "Not yet. Step Up For Students has closed new vendor sign-ups for MyScholarShop while it launches a new platform, and expects to reopen them in early 2027. Our provider application is submitted and waiting on review. Until then, ordering on our store and requesting reimbursement is how to use your funds for Eden's Table.",
  },
  {
    q: "What does the reimbursement-ready receipt show?",
    a: "Our legal name and address, your order number, the full date you paid, each item with its price, shipping and sales tax, the total, the card you paid with (brand and last 4 digits), the words Paid in full, the parent's name and your student's name.",
  },
  {
    q: "Will the Teacher's Guide be reimbursed?",
    a: "Step Up For Students counts teachers' manuals as curriculum. AAA's 2026-27 handbook for FTC, PEP and FES-EO lists teacher's editions as not eligible, so AAA may not reimburse the Teacher's Guide part of a printed set.",
  },
  {
    q: "Is my order information safe in the receipt form?",
    a: "The form shows nothing until your order number and the email on that order match. We do not store what you type, and the receipt is made on the spot for you to download.",
  },
  {
    q: "I have more than one child. Do I need more than one receipt?",
    a: "List every student on one receipt, or make one receipt per student if your scholarship organization asks for that. A brother or sister sharing a set usually needs only an extra Student Notebook.",
  },
];

export const FL_SOURCES: { label: string; href: string }[] = [
  { label: "Step Up For Students, reimbursement requests", href: "https://www.stepupforstudents.org/scholarships/unique-abilities/reimbursement/" },
  { label: "Step Up For Students, 2026-27 deadlines and payment schedules", href: "https://www.stepupforstudents.org/faq/faqs-for-2026-27-scholarship-deadlines-and-payment-schedules/" },
  { label: "Step Up For Students, PEP Purchasing Guide", href: "https://go.stepupforstudents.org/hubfs/GUIDES/PEP-Purchasing-Guide.pdf" },
  { label: "Step Up For Students, MyScholarShop vendors", href: "https://www.stepupforstudents.org/schools-and-providers/vendors/" },
  {
    label: "AAA Scholarship Foundation, FTC/PEP/FES-EO Purchasing Handbook 2026-27 (rev. 11/10/26)",
    href: "https://www.aaascholarships.org/wp-content/uploads/2026/11/AAA_FTC-PEP_Purchasing_Handbook_2026-27_rev20261110.pdf",
  },
  { label: "AAA Scholarship Foundation, Florida scholarships", href: "https://www.aaascholarships.org/?p=5954" },
];

/** When FL_SOURCES were last read. */
export const FL_CHECKED = "November 20, 2026";
