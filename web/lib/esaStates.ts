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
 * - Every item carries its price twice: `price` for people and `priceValue` for
 *   the Product JSON-LD. The state page refuses to build if the two disagree, or
 *   if an invoice state's price disagrees with web/lib/esaInvoice.ts.
 *   public/llms.txt quotes these prices too and is NOT checked; change it by hand.
 * - Bump ESA_UPDATED_ISO whenever what these pages say changes. It drives the
 *   "Updated" line, the sitemap <lastmod> for /esa and /esa/*, and dateModified.
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
  /** The amount `price` shows, as a number, for the Product JSON-LD. */
  priceValue: number;
  note: string;
  /** Product photo for the JSON-LD: the same photo /curriculum shows for this item. */
  image: string;
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
  /** Independent, non-government resources, shown in their own box below `links`
      ("More help for <short> families"). Never put these in `links`: that box is
      headed "Official ... information", and a private directory there would imply
      state involvement. The page renders `<a>{name}</a> {description}`. Set
      `sponsored` when the link was given in exchange for something (rel="sponsored"). */
  resources?: { name: string; href: string; description: string; sponsored?: boolean }[];
  /** Extra state-specific questions for the FAQ block. */
  faq: { q: string; a: string }[];
}

const PHOTO = "https://edeninstitute.health/showcases";

const SET: EsaItem = {
  name: "Printed Curriculum Set",
  price: "$261 total",
  priceValue: 261,
  note: "$249 plus $12 shipping. Teacher's Guide, Student Notebook and Read-Aloud Storybook, all 36 weeks.",
  image: `${PHOTO}/ET_PrintSet.webp`,
};
const NOTEBOOK: EsaItem = {
  name: "Extra Student Notebook",
  price: "$39.99",
  priceValue: 39.99,
  note: "Shipping included. A second write-in notebook for another child using the set.",
  image: `${PHOTO}/ET_NB_Cover.webp`,
};
const STARTER: EsaItem = {
  name: "9-Week Starter Unit",
  price: "$39",
  priceValue: 39,
  note: "Weeks 1 to 9 of the 36-week year, as a download. Not the full year.",
  image: `${PHOTO}/ET_StarterUnit.webp`,
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
    status: "open",
    // Arizona wording is "registered", never "approved": the ADE Parent Handbook
    // 2025-26 p.64 says the program "has no involvement on vendors' marketing or
    // statements", and that a vendor accepting ESA funds does not make an item
    // allowable. The account holder decides. (Rules research 2026-09-14.)
    // Invoices open 2026-09-14: ClassWallet confirmed Arizona is attached to the vendor
    // account (ESA_Catalog_Spec "ClassWallet call DONE"). LOCKED founder decision the same
    // day: ClassWallet's 2% Arizona deduction is passed to the family as its own invoice line,
    // grossed up to 2.0408% (ADE handbook allows a vendor processing fee; wording confirmed
    // 2026-09-15, same sentence as the invoice PDF and the form). Set $261 + $5.33 = $266.33; notebook
    // $39.99 + $0.82 = $40.81.
    statusLabel: "Registered vendor · order by invoice today",
    summary:
      "Yes. Eden's Table is a registered vendor for the Arizona Empowerment Scholarship Account program, and you can order today with an invoice you submit in ClassWallet.",
    howToBuy: [
      {
        heading: "1. Make your invoice with the form below",
        body: "Enter the account holder's name as it shows in ClassWallet, each student's first and last name, what each student needs, and the shipping address you have on file with the program. Your invoice is ready to download right away, and we email you a copy. Each student gets their own invoice.",
      },
      {
        heading: "2. Submit it in ClassWallet",
        body: "Submit the PDF invoice in ClassWallet as a payment to a vendor. ClassWallet deducts 2%, so this invoice adds 2.0408% to cover it. The invoice shows it as its own line: the printed set comes to $266.33 and an extra notebook to $40.81. Arizona reviews every request, so check the current ESA Parent Handbook before you order.",
      },
      {
        heading: "3. We print and ship",
        body: "As soon as payment arrives we order your books. They are printed to order, so plan on about two to three weeks from there.",
      },
      {
        heading: "Prefer to pay first and get reimbursed?",
        body: "You can also order on our store ($249 plus $12 shipping) and request reimbursement. Your order confirmation email is an itemized receipt, and Stripe emails its own receipt too. Upload both with your reimbursement request in ClassWallet.",
      },
    ],
    items: [
      {
        name: "Printed Curriculum Set",
        price: "$266.33 by invoice",
        priceValue: 266.33,
        note: "$261 ($249 plus $12 shipping) plus the $5.33 Arizona processing fee. Teacher's Guide, Student Notebook and Read-Aloud Storybook, all 36 weeks.",
        image: `${PHOTO}/ET_PrintSet.webp`,
      },
      {
        name: "Extra Student Notebook",
        price: "$40.81 by invoice",
        priceValue: 40.81,
        note: "$39.99 with shipping, plus the $0.82 Arizona processing fee. A second write-in notebook for another child using the set.",
        image: `${PHOTO}/ET_NB_Cover.webp`,
      },
    ],
    links: [
      { label: "Arizona Department of Education ESA program", href: "https://www.azed.gov/esa" },
      { label: "ESA Parent Handbook", href: "https://www.azed.gov/esa/parent-handbook" },
    ],
    // Marketing trade agreed 2026-09-14 with Education Vendors LLC (Gmail thread
    // 1a0a11e0327f14e6): Eden's Table gets a placement in her directory; this link is
    // Eden's side. Wording founder-approved 2026-09-14. rel="sponsored" (founder pick)
    // because Google's spam policy asks for it on links given in exchange for services.
    // Direct URL per her 19:19 email and signature.
    // 2026-09-17: her side went live (Melissa's 18:28 UTC email, verified in the page
    // HTML the same day) - a Featured Learning Tool card on /learning-tools/ and the top
    // Featured Learning Tools slot on /browse-vendors/?_category=tutor. That is what
    // unlocks the second line below; before it went live, saying Eden's Table is listed
    // there would have been false. Note Eden has NO standalone directory listing: she
    // does not take curriculum as standard listings, so /listing/edens-table-...
    // redirects to /browse-vendors/. Never point families at a listing URL.
    resources: [
      {
        name: "Arizona Education Vendors",
        href: "https://www.azedvendors.com",
        description:
          "is an independent directory of tutors, schools, enrichment and learning tools across Arizona. It is run by Education Vendors LLC, not by the state or the ESA program.",
        sponsored: true,
      },
      {
        name: "Their Learning Tools page",
        href: "https://azedvendors.com/learning-tools/",
        description:
          "lists curriculum and learning resources for Arizona ESA families, and Eden's Table is one of them.",
        sponsored: true,
      },
    ],
    faq: [
      {
        q: "Is Eden's Table an allowed curriculum purchase for an Arizona ESA?",
        a: "Arizona lists curricula and supplementary materials as a qualified expense, and Eden's Table is a registered ESA vendor. Being a registered vendor does not by itself make a purchase allowable, and the program reviews every purchase, so check the current Parent Handbook for your situation.",
      },
      {
        q: "Why is there a processing fee on an Arizona invoice?",
        a: "ClassWallet deducts 2%, so this invoice adds 2.0408% to cover it. The Arizona ESA Parent Handbook lets a vendor charge account holders a processing fee to offset it, so it is shown as its own line on your invoice. Arkansas, Alabama and New Hampshire invoices have no fee.",
      },
      {
        q: "Where else can I look for Arizona ESA vendors?",
        a: "Arizona Education Vendors is an independent directory of tutors, schools, enrichment programs and learning tools across Arizona that accept ESA funds, run by Education Vendors LLC. It is not run by the state or the ESA program, and a listing there is not an approval by the Arizona Department of Education. Your ESA Parent Handbook is still the final word on what your account will pay for.",
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
        heading: "1. Make your invoice with the form below",
        body: "Enter the account holder's name as it shows in ClassWallet, each student's first and last name, what each student needs, and the shipping address you have on file with the program. Your invoice is ready to download right away, and we email you a copy. Each student gets their own invoice.",
      },
      {
        heading: "2. Upload it in ClassWallet",
        body: "Upload the PDF invoice as a Direct Pay request in ClassWallet. The Arkansas Department of Education reviews it (their goal is about two weeks, longer in busy seasons), and ClassWallet then pays us.",
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
    status: "open",
    // Invoices open 2026-09-14: ClassWallet confirmed Alabama is attached ("you are now
    // visible for the users in Alabama"); families submit our invoice through Direct Pay;
    // no fee; a download is fine, date of service = the day the files are sent. Alabama
    // has NO reimbursement. The Starter is offered on Alabama invoices only (founder).
    statusLabel: "Approved · order by invoice today",
    summary:
      "Yes. Eden's Table is an approved Alabama CHOOSE Act Education Service Provider, and you can order today with an invoice you submit in ClassWallet.",
    howToBuy: [
      {
        heading: "1. Make your invoice with the form below",
        body: "Enter the parent's name, each student's first and last name, what each student needs, and your shipping address for printed books. Your invoice is ready to download right away, and we email you a copy. Each student gets their own invoice.",
      },
      {
        heading: "2. Submit it in ClassWallet",
        body: "Submit the PDF invoice in ClassWallet as a Direct Pay (Pay Vendor) request and choose the expense category for curriculum and supplemental reading materials. Alabama does not reimburse purchases, so the invoice is the way to pay.",
      },
      {
        heading: "3. We send or ship",
        body: "As soon as payment arrives, we email the 9-week starter files, or order your printed books, which are printed to order and arrive in about two to three weeks.",
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
    status: "open",
    // Invoices open 2026-09-14: ClassWallet confirmed CSF New Hampshire is attached; no fee
    // to Eden (CSF pays it). EFAs are per student, so one invoice per student (CSF handbook
    // p.18, p.29); ship only to the NH address on file with the program (p.18).
    statusLabel: "Approved · order by invoice today",
    summary:
      "Yes. Eden's Table is an approved New Hampshire EFA provider, listed in the Children's Scholarship Fund New Hampshire directory, and you can order today with an invoice you submit in ClassWallet.",
    howToBuy: [
      {
        heading: "1. Make your invoice with the form below",
        body: "Enter the account holder's name as it shows in ClassWallet, each student's first and last name, what each student needs, and the New Hampshire shipping address you have on file with the program. Your invoice is ready to download right away, and we email you a copy. EFAs are per student, so each student gets their own invoice.",
      },
      {
        heading: "2. Submit it in ClassWallet",
        body: "Submit the PDF invoice in ClassWallet as a Direct Pay request. There is no processing fee on New Hampshire invoices.",
      },
      {
        heading: "3. We print and ship",
        body: "As soon as payment arrives we order your books. They are printed to order, so plan on about two to three weeks from there.",
      },
      {
        heading: "Prefer to pay first and get reimbursed?",
        body: "You can also order on our store ($249 plus $12 shipping) and request reimbursement in ClassWallet with your itemized receipt. Every request is reviewed, so check the CSF New Hampshire Parent Handbook first.",
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

/** Last content review of the ESA pages. Bump it when what they say changes (see
    the rules at the top). */
export const ESA_UPDATED_ISO = "2026-09-17";

/** The same date as shown on the pages, e.g. "September 2026". */
export const ESA_UPDATED = new Date(`${ESA_UPDATED_ISO}T12:00:00Z`).toLocaleDateString("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Shown on every ESA page. Programs approve or register vendors; they do not
    endorse products, and implying they do is barred (16 CFR 461.2(b)) and is a
    misrepresentation ground in several programs (AR Rule 7.10.4, NH RSA 194-F:4). */
export const ESA_DISCLAIMER =
  "Eden's Table is published by Rooted in Faith Ventures LLC, an independent company. Being an approved or registered vendor means a program allows families to buy from us. It is not an endorsement by any state agency or program, and each program decides what it will pay for.";

export const ESA_CONTACT_EMAIL = "hello@edeninstitute.health";

/** What Eden's Table is, in the locked framing. The first FAQ answer on every ESA
    page, and the curriculum description in the state pages' JSON-LD. */
export const ESA_CURRICULUM_DESCRIPTION =
  "A 36-week Bible-based science and nature study curriculum for kindergarten through second grade. Each week centers on one plant, and reading, writing, math, history, geography and art are woven into the study of it. It is published by Rooted in Faith Ventures LLC.";

/** Questions every state page answers. Written the way parents ask them. */
export const ESA_COMMON_FAQ = [
  {
    q: "What is Eden's Table?",
    a: ESA_CURRICULUM_DESCRIPTION,
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
