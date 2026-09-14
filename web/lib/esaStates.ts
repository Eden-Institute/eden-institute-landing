/**
 * ESA / scholarship state pages: /esa and /esa/<state>. Added 2026-09-14.
 *
 * WHY. Eden's Table is approved in seven programs and had ZERO scholarship
 * orders on any of them, because nothing a parent could find said so. These
 * pages answer the exact question parents type into Google and AI assistants:
 * "Can I use my <program> money for Eden's Table, and how?"
 *
 * SOURCE OF TRUTH for every status line below is
 *   OneDrive: Eden's Table (Homeschool Curriculum)/Projects/ESA and Marketplace Vendor/ESA_Catalog_Spec_2026-09-11.md
 * and the founder-approved family replies in ESA_Manual_Order_SOP_2026-09-13.docx
 * (same folder). When a portal changes (an Odyssey listing is approved, the
 * ClassWallet call confirms Arizona or New Hampshire), change `status` and
 * `howToBuy` HERE and nowhere else.
 *
 * RULES FOR EDITING, all deliberate (same as /curriculum):
 * - Keep these words OFF every page: herbalism, herbal, herb, remedy, medicine,
 *   medicinal, health, wellness, healing, tea, tincture, body pattern, terrain,
 *   clinical. Four state reviews flagged them against medical and nutrition
 *   prohibitions. "Science and nature study" is the accurate, locked framing.
 * - No em dashes in visible copy.
 * - Never say a family CAN buy somewhere they cannot yet. A pending listing is
 *   described as pending.
 * - Prices: the printed set is "$261 total ($249 plus $12 shipping)", which
 *   matches both the marketplace listings ($261) and /books ($249 + $12).
 */

export type EsaStatus =
  /** A family can pay us through the program today. */
  | "open"
  /** Approved, and a family can buy today by reimbursement or card, while we
      confirm direct payment with the program's payment platform. */
  | "confirming"
  /** Approved vendor; the marketplace listings are waiting on the platform's
      approval, so nothing is orderable there yet. */
  | "listing_pending";

export interface EsaItem {
  name: string;
  price: string;
  note: string;
}

export interface EsaState {
  slug: string;
  state: string;
  /** The program name as parents search for it. */
  program: string;
  /** Short form used in running copy. */
  short: string;
  platform: string;
  /** Month the program approved Eden's Table (from the approval emails). */
  approved: string;
  status: EsaStatus;
  statusLabel: string;
  /** One plain sentence under the headline. */
  summary: string;
  /** Ordered steps. Plain text; links are added by the page from `links`. */
  howToBuy: { heading: string; body: string }[];
  items: EsaItem[];
  /** Official or directory links verified in the research files. */
  links: { label: string; href: string }[];
  /** Extra state-specific questions for the FAQ block. */
  faq: { q: string; a: string }[];
}

const SET: EsaItem = {
  name: "Printed Curriculum Set",
  price: "$261 total",
  note: "$249 plus $12 shipping. Teacher's Guide, Student Notebook and Read-Aloud Storybook, all 36 weeks.",
};
const NOTEBOOK: EsaItem = {
  name: "Extra Student Notebook",
  price: "$39.99",
  note: "Shipping included. A second write-in notebook for another child using the set.",
};
const STARTER: EsaItem = {
  name: "9-Week Starter Unit",
  price: "$39",
  note: "Weeks 1 to 9 of the 36-week year, as a download. Not the full year.",
};

const PENDING_ODYSSEY_STEPS = (short: string) => [
  {
    heading: "Where it stands",
    body: `Eden's Table is an approved ${short} vendor. Our three listings have been submitted in the ${short} marketplace and are waiting for the marketplace to approve them, so they cannot be ordered there yet.`,
  },
  {
    heading: "When it opens",
    body: `Once the listings are approved, sign in to your ${short} marketplace and search for Eden's Table. The printed set is listed as "Sprouts K-2 36-Week Science and Nature Study Printed Curriculum Set, Bible-Based".`,
  },
  {
    heading: "Want to know the day it opens?",
    body: "Email us with the name of your program and we will write back the day the listing goes live.",
  },
];

export const ESA_STATES: EsaState[] = [
  {
    slug: "arizona",
    state: "Arizona",
    program: "Arizona Empowerment Scholarship Account (ESA)",
    short: "Arizona ESA",
    platform: "ClassWallet",
    approved: "July 2026",
    status: "confirming",
    // Arizona wording is "registered", never "approved": the ADE Parent Handbook
    // 2025-26 p.64 says the program "has no involvement on vendors' marketing or
    // statements", and that a vendor accepting ESA funds does not make an item
    // allowable. The account holder decides. (Rules research 2026-09-14.)
    statusLabel: "Registered vendor · buy today by reimbursement",
    summary:
      "Yes. Eden's Table is a registered vendor for the Arizona Empowerment Scholarship Account program. You can order today and request reimbursement while we confirm direct payment through ClassWallet.",
    howToBuy: [
      {
        heading: "Order and request reimbursement",
        body: "Order the printed set on our store ($249 plus $12 shipping). Your order confirmation email is an itemized receipt with the order number, date, each item, total paid and the card used, and Stripe emails its own receipt too. Upload both with your reimbursement request in ClassWallet. Arizona reviews every request, so check the current ESA Parent Handbook before you buy.",
      },
      {
        heading: "Paying with your ESA card",
        body: "Some Arizona families pay on our checkout with the ESA card issued through ClassWallet. Card rules can still decline a purchase. If yours is declined, use reimbursement instead.",
      },
      {
        heading: "Paying us directly by invoice",
        body: "We are confirming with ClassWallet how Arizona families can pay us directly. Email us and we will let you know as soon as it is set up.",
      },
    ],
    items: [SET, NOTEBOOK],
    links: [
      { label: "Arizona Department of Education ESA program", href: "https://www.azed.gov/esa" },
      { label: "ESA Parent Handbook", href: "https://www.azed.gov/esa/parent-handbook" },
    ],
    faq: [
      {
        q: "Is Eden's Table an allowed curriculum purchase for an Arizona ESA?",
        a: "Arizona lists curricula and supplementary materials as a qualified expense, and Eden's Table is a registered ESA vendor. Being a registered vendor does not by itself make a purchase allowable, and the program reviews every purchase, so check the current Parent Handbook for your situation.",
      },
    ],
  },
  {
    slug: "utah",
    state: "Utah",
    program: "Utah Fits All Scholarship",
    short: "Utah Fits All",
    platform: "Odyssey",
    approved: "July 2026",
    status: "listing_pending",
    statusLabel: "Approved · marketplace listing pending",
    summary:
      "Yes. Eden's Table is an approved Utah Fits All vendor. Our marketplace listings are waiting on approval, so they cannot be ordered there quite yet.",
    howToBuy: PENDING_ODYSSEY_STEPS("Utah Fits All"),
    items: [SET, STARTER, NOTEBOOK],
    links: [{ label: "Utah Fits All FAQs", href: "https://www.utaheducationfitsall.org/faqs/" }],
    faq: [],
  },
  {
    slug: "louisiana",
    state: "Louisiana",
    program: "Louisiana GATOR Scholarship",
    short: "LA GATOR",
    platform: "Odyssey",
    approved: "July 2026",
    status: "listing_pending",
    statusLabel: "Approved · marketplace listing pending",
    summary:
      "Yes. Eden's Table is an approved service provider for the LA GATOR Scholarship marketplace. Our listings are waiting on marketplace approval, so they cannot be ordered there quite yet.",
    howToBuy: PENDING_ODYSSEY_STEPS("LA GATOR"),
    items: [SET, STARTER, NOTEBOOK],
    links: [],
    faq: [],
  },
  {
    slug: "wyoming",
    state: "Wyoming",
    program: "Wyoming Steamboat Legacy Scholarship (ESA)",
    short: "Wyoming ESA",
    platform: "Odyssey",
    approved: "July 2026",
    status: "listing_pending",
    statusLabel: "Approved · marketplace listing pending",
    summary:
      "Yes. Eden's Table is an approved Wyoming ESA vendor. Our marketplace listings are waiting on approval, so they cannot be ordered there quite yet.",
    howToBuy: PENDING_ODYSSEY_STEPS("Wyoming ESA"),
    items: [SET, STARTER, NOTEBOOK],
    links: [
      { label: "Wyoming ESA Family Handbook", href: "https://edu.wyoming.gov/wp-content/uploads/2025/04/ESA-Family-Handbook.pdf" },
    ],
    faq: [],
  },
  {
    slug: "arkansas",
    state: "Arkansas",
    program: "Arkansas Education Freedom Account (EFA)",
    short: "Arkansas EFA",
    platform: "ClassWallet",
    approved: "July 2026",
    status: "open",
    statusLabel: "Approved · order by invoice today",
    summary:
      "Yes. Eden's Table is an approved Arkansas EFA vendor, and you can order today with an invoice paid through ClassWallet Direct Pay.",
    howToBuy: [
      {
        heading: "1. Ask us for an invoice",
        body: "Email us with the account holder's name as it shows in ClassWallet, your student's first and last name, which books you want, and the shipping address you have on file with the program. If more than one child is on the program, send each child's name and we will make a separate invoice for each.",
      },
      {
        heading: "2. Upload it in ClassWallet",
        body: "We send the invoice back as a PDF. Upload it as a Direct Pay request in ClassWallet. The Arkansas Department of Education reviews it (their goal is about two weeks, longer in busy seasons), and ClassWallet then pays us.",
      },
      {
        heading: "3. We print and ship",
        body: "As soon as payment arrives we order your books. They are printed to order, so plan on about two to three weeks from there.",
      },
    ],
    items: [SET, NOTEBOOK],
    links: [
      {
        label: "Arkansas Education Freedom Accounts",
        href: "https://dese.ade.arkansas.gov/offices/office-of-school-choice-and-parent-empowerment/education-freedom-accounts",
      },
    ],
    faq: [
      {
        q: "Is Eden's Table listed in the School Choice Arkansas Provider Finder?",
        a: "Yes. Eden's Table is listed as a curriculum provider paid by Direct Pay.",
      },
    ],
  },
  {
    slug: "alabama",
    state: "Alabama",
    program: "Alabama CHOOSE Act Education Savings Account",
    short: "Alabama CHOOSE Act",
    platform: "ClassWallet",
    approved: "September 2026",
    status: "confirming",
    statusLabel: "Approved · invoices starting soon",
    summary:
      "Yes. Eden's Table was approved as an Alabama CHOOSE Act Education Service Provider in September 2026. Alabama families pay approved providers by invoice, and we are finishing our payment setup now.",
    howToBuy: [
      {
        heading: "How Alabama families pay",
        body: "Alabama pays approved providers through Pay Vendor in ClassWallet, and every payment needs an invoice from the provider. When you submit it, choose the expense category for curriculum and supplemental reading materials.",
      },
      {
        heading: "Ask us for an invoice",
        body: "Email us with the parent's name, your student's first and last name, and which items you want. We are finishing our ClassWallet setup for Alabama, and we will send your invoice as soon as it is confirmed.",
      },
      {
        heading: "Shipping",
        body: "Printed books are printed to order and arrive in about two to three weeks after payment. The 9-week starter is a download.",
      },
    ],
    items: [SET, STARTER, NOTEBOOK],
    links: [
      { label: "Alabama Department of Revenue, CHOOSE Act", href: "https://www.revenue.alabama.gov/tax-policy/the-choose-act/" },
    ],
    faq: [],
  },
  {
    slug: "new-hampshire",
    state: "New Hampshire",
    program: "New Hampshire Education Freedom Account (EFA)",
    short: "New Hampshire EFA",
    platform: "ClassWallet, administered by Children's Scholarship Fund New Hampshire",
    approved: "July 2026",
    status: "confirming",
    statusLabel: "Approved · buy today by reimbursement",
    summary:
      "Yes. Eden's Table is an approved New Hampshire EFA provider, listed in the Children's Scholarship Fund New Hampshire directory. You can order today and request reimbursement while we confirm direct payment through ClassWallet.",
    howToBuy: [
      {
        heading: "Order and request reimbursement",
        body: "Order the printed set on our store ($249 plus $12 shipping). Your order confirmation email is an itemized receipt, and Stripe emails its own receipt too. Upload both with your reimbursement request in ClassWallet. Every request is reviewed, so check the CSF New Hampshire Parent Handbook before you buy.",
      },
      {
        heading: "Paying us directly by invoice",
        body: "We are confirming with ClassWallet how New Hampshire families can pay us directly. Email us and we will let you know as soon as it is set up.",
      },
    ],
    items: [SET, NOTEBOOK],
    links: [
      { label: "Eden's Table in the CSF New Hampshire directory", href: "https://app.nh.scholarshipfund.org/esa/esa_parent/esa_vendors/19171" },
      { label: "New Hampshire Education Freedom Accounts", href: "https://www.education.nh.gov/pathways-education/education-freedom-accounts" },
    ],
    faq: [],
  },
];

/** Programs we have applied to and are waiting on. Plain facts only. */
export const ESA_PENDING = [
  { state: "Florida", program: "Step Up For Students scholarships", note: "Provider application submitted, waiting on review." },
  { state: "West Virginia", program: "Hope Scholarship", note: "Provider application submitted September 2026, waiting on review." },
];

export const ESA_UPDATED = "September 2026";

/** Shown on every ESA page. Programs approve or register vendors; they do not
    endorse products, and implying they do is barred (16 CFR 461.2(b)) and is a
    misrepresentation ground in several programs (AR Rule 7.10.4, NH RSA 194-F:4). */
export const ESA_DISCLAIMER =
  "Eden's Table is published by Rooted in Faith Ventures LLC, an independent company. Being an approved or registered vendor means a program allows families to buy from us. It is not an endorsement by any state agency or program, and each program decides what it will pay for.";

export const ESA_CONTACT_EMAIL = "hello@edeninstitute.health";

/** Questions every state page answers. Written the way parents ask them. */
export const ESA_COMMON_FAQ = [
  {
    q: "What is Eden's Table?",
    a: "A 36-week Bible-based science and nature study curriculum for kindergarten through second grade. Each week centers on one plant, and reading, writing, math, history, geography and art are woven into the study of it. It is published by Rooted in Faith Ventures LLC.",
  },
  {
    q: "What grades is it for?",
    a: "Kindergarten through second grade, ages five to seven. Every lesson is written at two depths, so a younger and an older child can work the same week together.",
  },
  {
    q: "What comes in the printed set?",
    a: "A Teacher's Guide (240 pages, coil bound), a Student Notebook (224 pages, coil bound) and a Read-Aloud Storybook (112 pages, paperback). It covers the full 36-week year and is printed to order.",
  },
  {
    q: "Is it a Christian curriculum?",
    a: "Yes. Each week is anchored in a Scripture memory verse and connects the week's plant to God's design in creation. Families looking for a secular program should know this before they buy.",
  },
  {
    q: "Does it include any food, plants or consumable supplies?",
    a: "No. Eden's Table sells books and printable files only. No food, plant material, supplements or other consumable products are sold or shipped.",
  },
  {
    q: "What if I need a refund on a scholarship purchase?",
    a: "Refunds on orders paid with program money go back to the program, never to the parent personally, as the programs require. Our return and refund policy has the details.",
  },
  {
    q: "My state is not listed. Can you apply there?",
    a: "Please tell us which state and program you use. We decide where to apply next based on where families ask.",
  },
];
