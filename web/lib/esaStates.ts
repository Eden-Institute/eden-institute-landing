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
 * - Seedlings (grades 3-5) joined 2026-09-24. Item names match the invoice form's
 *   labels in web/lib/esaInvoice.ts exactly and always name the band, so a family
 *   with children in both bands can tell the items apart. No Seedlings page counts
 *   anywhere: they are not locked. Each band has its own Extra Student Notebook
 *   (Seedlings added 2026-09-24), listed wherever the other band's is.
 * - Bump ESA_UPDATED_ISO whenever what these pages say changes. It drives the
 *   "Updated" line, the sitemap <lastmod> for /esa and /esa/*, and dateModified.
 */

export type EsaStatus =
  /** A family can pay us through the program today. */
  | "open"
  /** Approved, and a family can buy today on our store and request reimbursement from
      the program, while direct payment (an invoice route, or a marketplace listing that is
      still waiting on approval) is not open yet. Utah since 2026-10-18. */
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
  /** Product photo for the JSON-LD: the same photo /curriculum shows for this item. Omitted where
      no photo of that product exists yet (Seedlings), rather than borrowing another band's. */
  image?: string;
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
  /** Ordered steps. Plain text. A step may carry one `link`, shown under its body, for the
      place the step sends a family (New Hampshire's CSF listing, 2026-10-20); everything
      else is linked from `links`. */
  howToBuy: { heading: string; body: string; link?: { label: string; href: string } }[];
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
  /** "What counts as curriculum" section (punch #292, founder decision 2026-10-18), for
      category searches like "Arizona ESA approved curriculum". How the program defines a
      curriculum expense, what a purchase or submission needs, what gets turned down, and
      Eden's Table as the worked example. Each `q` renders as an H3 and also ships in the
      FAQPage JSON-LD. EVERY program rule here comes from the program's own documents,
      listed in `sources`; a rule that cannot be sourced stays off the page. Never "can
      buy" where the listing is pending. */
  guide: EsaGuide;
}

export interface EsaGuide {
  /** The section's H2. */
  heading: string;
  intro: string;
  sections: { q: string; a: string[]; list?: string[] }[];
  /** The program's own documents behind every rule above, shown under the section. */
  sources: { label: string; href: string }[];
  /** When the rules above were last checked against `sources`, e.g. "October 18, 2026".
      Change it only when someone re-reads the documents, not on every ESA_UPDATED_ISO bump. */
  checked: string;
}

/** Words kept off every ESA page (see the rules at the top), as a build guard. The
    domain in the contact address and links is not a use of the word. */
const ESA_BANNED = /\b(herbalism|herbal|herbs?|remed(y|ies)|medicine|medicinal|wellness|healing|teas?|tinctures?|body pattern|terrain|clinical)\b|(?<!edeninstitute\.)\bhealth/i;

/** Problems in a piece of visible ESA copy: a banned word or an em dash. */
export function esaCopyProblems(text: string): string[] {
  const out: string[] = [];
  const banned = text.match(ESA_BANNED);
  if (banned) out.push(`banned word "${banned[0]}"`);
  if (/\u2014/.test(text)) out.push("em dash");
  return out;
}

const PHOTO = "https://edeninstitute.health/showcases";

const SET: EsaItem = {
  name: "Sprouts (grades K-2) Printed Curriculum Set",
  price: "$261 total",
  priceValue: 261,
  note: "$249 plus $12 shipping. Teacher's Guide, Student Notebook and Read-Aloud Storybook, all 36 weeks.",
  image: `${PHOTO}/ET_PrintSet.webp`,
};
const NOTEBOOK: EsaItem = {
  name: "Sprouts (grades K-2) Extra Student Notebook",
  price: "$39.99",
  priceValue: 39.99,
  note: "Shipping included. A second write-in notebook for another child using the set.",
  image: `${PHOTO}/ET_NB_Cover.webp`,
};
const STARTER: EsaItem = {
  name: "Sprouts (grades K-2) 9-Week Starter Unit",
  price: "$39",
  priceValue: 39,
  note: "Weeks 1 to 9 of the 36-week year, as a download. Not the full year.",
  image: `${PHOTO}/ET_StarterUnit.webp`,
};
// Seedlings (grades 3-5), founder decisions 2026-09-24. No photo yet, so no image.
const SDL_SET: EsaItem = {
  name: "Seedlings (grades 3-5) Printed Curriculum Set",
  price: "$261 total",
  priceValue: 261,
  note: "$249 plus $12 shipping. Teacher's Guide, Student Notebook and Read-Aloud Storybook, all 36 weeks for grades 3-5.",
};
const SDL_STARTER: EsaItem = {
  name: "Seedlings (grades 3-5) 9-Week Starter Unit",
  price: "$39",
  priceValue: 39,
  note: "Weeks 1 to 9 of the 36-week Seedlings year, as a download. Not the full year.",
};
const SDL_NOTEBOOK: EsaItem = {
  name: "Seedlings (grades 3-5) Extra Student Notebook",
  price: "$39.99",
  priceValue: 39.99,
  note: "Shipping included. A second write-in notebook for another child using the Seedlings set.",
};

const PENDING_ODYSSEY_STEPS = (short: string) => [
  {
    heading: "Where it stands",
    body: `Eden's Table is an approved ${short} vendor. Our Sprouts (grades K-2) and Seedlings (grades 3-5) listings have been submitted in the ${short} marketplace and are waiting for the marketplace to approve them, so they cannot be ordered there yet.`,
  },
  {
    heading: "When it opens",
    body: `Once the listings are approved, sign in to your ${short} marketplace and search for Eden's Table. The Sprouts printed set is listed as "Sprouts K-2 36-Week Science and Nature Study Printed Curriculum Set, Bible-Based".`,
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
        // Search names: founder 2026-10-20, same ClassWallet vendor record as New Hampshire.
        body: "In ClassWallet, search for Eden's Table or Rooted in Faith (the company that publishes Eden's Table), then submit the PDF invoice as a payment to a vendor. ClassWallet deducts 2%, so this invoice adds 2.0408% to cover it. The invoice shows it as its own line: a printed set (Sprouts or Seedlings) comes to $266.33 and an extra notebook (Sprouts or Seedlings) to $40.81. Arizona reviews every request, so check the current ESA Parent Handbook before you order.",
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
        name: "Sprouts (grades K-2) Printed Curriculum Set",
        price: "$266.33 by invoice",
        priceValue: 266.33,
        note: "$261 ($249 plus $12 shipping) plus the $5.33 Arizona processing fee. Teacher's Guide, Student Notebook and Read-Aloud Storybook, all 36 weeks.",
        image: `${PHOTO}/ET_PrintSet.webp`,
      },
      {
        name: "Sprouts (grades K-2) Extra Student Notebook",
        price: "$40.81 by invoice",
        priceValue: 40.81,
        note: "$39.99 with shipping, plus the $0.82 Arizona processing fee. A second write-in notebook for another child using the set.",
        image: `${PHOTO}/ET_NB_Cover.webp`,
      },
      {
        name: "Seedlings (grades 3-5) Printed Curriculum Set",
        price: "$266.33 by invoice",
        priceValue: 266.33,
        note: "$261 ($249 plus $12 shipping) plus the $5.33 Arizona processing fee. Teacher's Guide, Student Notebook and Read-Aloud Storybook, all 36 weeks for grades 3-5.",
      },
      {
        name: "Seedlings (grades 3-5) Extra Student Notebook",
        price: "$40.81 by invoice",
        priceValue: 40.81,
        note: "$39.99 with shipping, plus the $0.82 Arizona processing fee. A second write-in notebook for another child using the Seedlings set.",
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
      // 2026-09-15: Grant Ongstad offered Eden a featured vendor spot in exchange for a link
      // from this page (Gmail thread 1a0a11df74c03203); Camila proposed this page and he
      // replied "That would be amazing!". Founder approved adding it 2026-10-17. Exchanged
      // for a featured spot, so rel="sponsored", same as the azedvendors trade above. URL
      // and description from the site itself (title "Arizona Christian Homeschool
      // Directory, Programs by City"; contact gongstad@gmail.com in its footer), checked
      // 2026-10-17. Says nothing about Eden's own listing there: not verified.
      {
        name: "Arizona Christian Homeschool Directory",
        href: "https://arizonachristianhomeschools.com/",
        description:
          "is an independent directory of Christian co-ops, microschools, hybrid programs and tutors across Arizona, listed by city. It is not run by the state or the ESA program.",
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
      // 2026-09-18: reworded at Melissa's request (her 17:42 UTC email, same thread).
      // The old answer said the directory lists providers "that accept ESA funds"; it
      // covers all educational services, and a provider is shown as taking ESA funds
      // only once it has verified that. Her first sentence, lightly smoothed, and her
      // optional parent-portal line, both founder-approved 2026-09-18. The portal is
      // real: https://azedvendors.com/parent-portal/ (checked the same day).
      {
        q: "Where else can I look for Arizona ESA vendors?",
        a: "Arizona Education Vendors Directory is an independent directory of tutors, schools, enrichment programs and learning tools across Arizona and virtually, where families can search for educational options. It is run by Education Vendors LLC, not by the state or the ESA program. It covers every kind of educational service, not only ESA vendors, so not every provider listed accepts ESA funds. Many do, and the directory lists a provider as accepting them only once that provider has verified it. The directory also offers a free, optional parent portal where you can save, compare and write notes on providers to help find the right fit for your child. A listing there is not an approval by the Arizona Department of Education, and your ESA Parent Handbook is still the final word on what your account will pay for.",
      },
    ],
    // Sources checked 2026-10-18 (punch #292). The 2025-26 Parent Handbook is still the
    // "Current ESA Parent Handbook" on azed.gov; no 2026-27 edition is posted. Left out on
    // purpose: what parents must document for general supplemental material, which the
    // handbook (p.23) says is in litigation and the ESA Support page describes differently.
    guide: {
      heading: "Arizona ESA curriculum: what the program pays for",
      intro:
        "Arizona does not approve curricula or vendors one by one. Families choose the curriculum, and the program reviews purchases against state law and the ESA Parent Handbook. Here is how that works for a curriculum purchase, with Eden's Table as the example.",
      sections: [
        {
          q: "Is there an Arizona ESA approved curriculum list?",
          a: [
            "No. The ESA program does not create or keep a list of recommended schools, vendors or providers, and the Arizona Department of Education (ADE) does not regulate or oversee vendors, even the ones in ClassWallet. What ADE does publish is a list of purchases that are not allowed.",
            "You do not need pre-approval to buy curriculum. If you want ADE's answer on a specific item before you buy, you can submit an ESA Support Ticket.",
          ],
        },
        {
          q: "What does Arizona count as a curriculum expense?",
          a: [
            "State law lists curricula and supplementary materials as an allowable ESA expense, and defines a curriculum as a course of study for content areas or grade levels, including the supplemental materials it requires or recommends. ADE's ESA Support page says an off-the-shelf curriculum does not have to be justified by another curriculum, and that ESA staff treat buying one as an allowable expense under state law.",
            "Each year, part of every student's ESA must be spent on reading, grammar, math, social studies and science.",
          ],
        },
        {
          q: "What does an Arizona ESA curriculum purchase need?",
          a: [
            "The handbook lists four ways to spend in ClassWallet: the marketplace, Pay Vendor, a debit card (offered to account holders with a student with a disability) and reimbursement. To pay a curriculum vendor's invoice you use Pay Vendor and upload the invoice. A complete invoice shows the provider's name, address and contact details, the invoice date and number, the student's name, an itemized description of the charges and the total. Ask for exactly the invoice total, because anything over it may be rejected.",
            "A reimbursement needs proof of payment too, because an invoice alone is not enough. The receipt has to come from the vendor's own receipt system and show the vendor's details, the date, a receipt or order number and an itemized list of what you bought.",
            "One student's ESA cannot pay for another ESA student's items, and a purchase has to arrive within the same July to June contract year it is paid in.",
          ],
        },
        {
          q: "What gets an Arizona ESA purchase turned down?",
          a: [
            "A vendor accepting ESA funds does not make an item allowable. An order that goes through automatically is not treated as approved until it is audited or the audit window passes, and ADE can ask for repayment of items approved in error. Purchases are turned down for reasons like these:",
          ],
          list: [
            "An incomplete invoice, or a request for more than the invoice total.",
            "A reimbursement request with an invoice but no proof of payment.",
            "A receipt that is not itemized or did not come from the vendor's own receipt system.",
            "Items on ADE's unallowable list, such as gift cards of any kind, food, fees like Amazon Prime, and items that are mainly not educational.",
            "Items bought for another ESA student, or bought to resell.",
            "Anything bought before your ESA contract was signed.",
          ],
        },
        {
          q: "How does Eden's Table fit Arizona's rules?",
          a: [
            "Eden's Table is an off-the-shelf, Bible-based science and nature study curriculum in printed books: a Teacher's Guide, a Student Notebook and a Read-Aloud Storybook for a 36-week year. Science is one of the five subjects Arizona requires part of every ESA to cover.",
            "Eden's Table is a registered Arizona ESA vendor, which by itself does not make a purchase allowable. Our Arizona invoice is made for one student and shows our name, address and contact details, the invoice date and number, the student's name, each book with its price, and the total. The ClassWallet processing fee is its own line, which the handbook allows a vendor to charge.",
            "Our books are printed to order and arrive about two to three weeks after payment, so allow for that if you order close to the end of June.",
          ],
        },
      ],
      sources: [
        { label: "ADE, ESA Parent Handbook 2025-2026 (the current handbook)", href: "https://www.azed.gov/esa/parent-handbook" },
        { label: "ADE, ESA Support page", href: "https://www.azed.gov/esa/esa-support" },
        { label: "ADE, ESA Unallowable Purchases list 2025-2026", href: "https://www.azed.gov/sites/default/files/2025/09/Unallowable%20List%202025_2026.pdf" },
        { label: "Arizona Revised Statutes 15-2401, definitions", href: "https://www.azleg.gov/ars/15/02401.htm" },
        { label: "Arizona Revised Statutes 15-2402, ESA expenses", href: "https://www.azleg.gov/ars/15/02402.htm" },
      ],
      checked: "October 18, 2026",
    },
  },
  {
    slug: "utah",
    state: "Utah",
    program: "Utah Fits All Scholarship",
    short: "Utah Fits All",
    platform: "Odyssey",
    approved: "July 2026",
    // Founder decision 2026-10-18 (punch #292 follow-up): while the marketplace listings
    // wait on approval, Utah families can order on our store and request reimbursement.
    // Utah allows it (Utah Code 53F-6-405(11), new May 2026; Odyssey's 2026-27 Spending and
    // Reimbursement Guide): one request per product, one document per request, and a card
    // receipt must show the last four digits. The order confirmation and Starter emails
    // carry that receipt (supabase/functions/_shared/receipt.ts: seller, date, items,
    // total paid, "Paid by <card> ending ####"). Items are what the store sells on its own:
    // an extra notebook is only added at checkout with a set, with shipping worked out in
    // the cart (web/pages/books.astro), so it is listed that way here. When the marketplace
    // listing is approved, switch back to the marketplace steps and the shipping-included
    // NOTEBOOK / SDL_NOTEBOOK items.
    status: "confirming",
    statusLabel: "Approved · order now, then request reimbursement",
    summary:
      "Yes. Eden's Table is an approved Utah Fits All vendor. You can order on our store today and request reimbursement from Odyssey, while our marketplace listings wait on approval.",
    howToBuy: [
      {
        heading: "1. Order on our store",
        body: "Order the printed set ($249 plus $12 shipping) or a 9-Week Starter Unit ($39), Sprouts or Seedlings, and pay by credit or debit card. Your order confirmation email, or for a Starter the email with your download, is an itemized receipt: it shows the seller, the date, each item, the total paid and the card's last four digits, which Odyssey asks for on card purchases.",
      },
      {
        heading: "2. Request reimbursement in Odyssey",
        body: "Submit one reimbursement request for each product, enter the purchase date shown on your receipt, and upload the receipt email saved as a PDF as the one document for that request. Odyssey reviews every request. Our printed set is $261 with shipping, the same price as our marketplace listing.",
      },
      {
        heading: "3. We print and ship",
        body: "Printed books are printed to order and arrive in about two to three weeks. A Starter Unit download comes by email as soon as you buy it.",
      },
      {
        heading: "Waiting for the marketplace instead?",
        body: "Our Sprouts and Seedlings listings have been submitted in the Utah Fits All marketplace and are waiting for approval, so they cannot be ordered there yet. Once they are approved you can order there with nothing to upload. Email us and we will write back the day they open.",
      },
    ],
    items: [
      SET,
      STARTER,
      {
        name: "Sprouts (grades K-2) Extra Student Notebook",
        price: "$39.99",
        priceValue: 39.99,
        note: "Added at checkout with a printed set, for a sibling ($32 each from the sixth). Shipping for extra notebooks is worked out in your cart.",
        image: `${PHOTO}/ET_NB_Cover.webp`,
      },
      SDL_SET,
      SDL_STARTER,
      {
        name: "Seedlings (grades 3-5) Extra Student Notebook",
        price: "$39.99",
        priceValue: 39.99,
        note: "Added at checkout with a printed Seedlings set, for a sibling ($32 each from the sixth). Shipping for extra notebooks is worked out in your cart.",
      },
    ],
    // 2026-10-18: replaced utaheducationfitsall.org/faqs, which belongs to a private
    // advocacy group (its footer says it "is not the Program Manager"), with the state
    // board's page and the program manager's handbook. Odyssey runs the program for USBE.
    links: [
      { label: "Utah State Board of Education, Utah Fits All Scholarship", href: "https://schools.utah.gov/utahfitsallscholarship" },
      { label: "Utah Fits All Handbook (Odyssey, the program manager)", href: "https://support.withodyssey.com/hc/en-us/categories/36775387584539-Utah-Fits-All-UFA-Handbook" },
    ],
    faq: [],
    // Sources checked 2026-10-18 (punch #292). Utah DOES reimburse outside purchases
    // (53F-6-405(11), new May 2026; Odyssey's 2026-27 Spending Guide), and the founder chose
    // the same day to offer that route (see the note above `status`).
    guide: {
      heading: "Utah Fits All approved curriculum: what the program pays for",
      intro:
        "Utah Fits All does not keep a list of approved curricula. Odyssey, the program manager, reviews every marketplace vendor and listing before families see it, and reviews reimbursement requests one at a time. Here is how that works for a curriculum purchase, with Eden's Table as the example.",
      sections: [
        {
          q: "Is there a Utah Fits All approved curriculum list?",
          a: [
            "No. Odyssey says a set list of approved expenses would not be workable, given how many different ways families teach. Instead it points families to its Eligible Expense Guide, its Ineligible Expense Guide and the marketplace, where every vendor and every listing is reviewed for eligibility before families can see it.",
            "Since July 2026 you can also send Odyssey an Eligibility Request before you buy something. It is a preliminary answer, not a promise of reimbursement.",
          ],
        },
        {
          q: "What does Utah Fits All count as a curriculum expense?",
          a: [
            "Utah law lists textbooks, curricula and other instructional materials as a scholarship expense, including supplemental materials or online instruction that a curriculum recommends. Odyssey's test for any item is whether it is educational in itself or a general-purpose item that might be used for learning.",
            "Curriculum, textbooks and workbooks each have their own marketplace category. Families may buy several consumable items for their students, but large purchases that look like reselling or sharing supplies are denied.",
          ],
        },
        {
          q: "What does a Utah Fits All purchase need?",
          a: [
            "Families spend three ways: the Odyssey marketplace, tuition to an approved private school, and reimbursement for eligible purchases made outside the marketplace. Odyssey strongly encourages the marketplace. A marketplace purchase needs no receipt upload: you assign each item to a student at checkout, and the delivery address comes from your application.",
            "A reimbursement request covers one product and takes one document: a receipt showing the vendor's name, the date, an itemized list, the total paid with taxes and fees, the payment method and proof that the payment went through. A reimbursed item should cost no more than 10% above a comparable marketplace item.",
            "Funds belong to one student and cannot be pooled or moved between siblings.",
          ],
        },
        {
          q: "What gets a Utah Fits All reimbursement turned down?",
          a: ["Odyssey's own guides give reasons like these:"],
          list: [
            "Documents that are not receipts, such as cart screenshots, order emails or shipping notices.",
            "A receipt with a generic line like “Book” or “Educational Materials” in place of the product's actual name.",
            "Handwritten receipts, or a receipt with no proof of payment.",
            "A request filed under the wrong category, or with more than one receipt in it.",
            "Payment made only with gift cards or reward points.",
            "Bulk purchases that suggest reselling or sharing.",
            "Purchases outside the scholarship year, which runs July 1 to June 30.",
          ],
        },
        {
          q: "How does Eden's Table fit Utah Fits All's rules?",
          a: [
            "Eden's Table is a Bible-based science and nature study curriculum in printed books: a Teacher's Guide, a Student Notebook and a Read-Aloud Storybook for a 36-week year. Utah law says the program manager may not require a provider to change its creed or curricula to accept scholarship funds.",
            "Eden's Table is an approved Utah Fits All vendor. Our marketplace listings are waiting on Odyssey's review, so they cannot be ordered in the marketplace yet. Until they are, you can order on our store and request reimbursement: the order confirmation email is an itemized receipt with the seller, the date, each item, the total paid and the card's last four digits, and our printed set costs the same $261 with shipping as our marketplace listing. Once the listings are approved, you can order in the marketplace instead, with no receipt to upload.",
          ],
        },
      ],
      sources: [
        { label: "Odyssey, Utah Fits All Spending and Reimbursement Guide", href: "https://support.withodyssey.com/hc/en-us/articles/52216257447323" },
        { label: "Odyssey, Eligible Expense Guide", href: "https://support.withodyssey.com/hc/en-us/articles/37894468672283" },
        { label: "Odyssey, UFA Ineligible Expense Guide", href: "https://support.withodyssey.com/hc/en-us/articles/44943389629595" },
        { label: "Odyssey, UFA Acceptable Documentation for Reimbursements", href: "https://support.withodyssey.com/hc/en-us/articles/51870309021851" },
        { label: "Odyssey, Reimbursement Denial Reasons", href: "https://support.withodyssey.com/hc/en-us/articles/40492738658715" },
        { label: "Odyssey, Submitting an Eligibility Request", href: "https://support.withodyssey.com/hc/en-us/articles/53023926979611" },
        { label: "Odyssey, How to Use the UFA Marketplace", href: "https://support.withodyssey.com/hc/en-us/articles/40218512108187" },
        { label: "Odyssey, Utah Fits All Marketplace: Categories for Offerings", href: "https://support.withodyssey.com/hc/en-us/articles/37894643079707" },
        { label: "Utah Code 53F-6-401, definitions", href: "https://le.utah.gov/xcode/Title53F/Chapter6/53F-6-S401.html" },
        { label: "Utah Code 53F-6-406, provider autonomy", href: "https://le.utah.gov/xcode/Title53F/Chapter6/53F-6-S406.html" },
      ],
      checked: "October 18, 2026",
    },
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
    items: [SET, STARTER, NOTEBOOK, SDL_SET, SDL_STARTER, SDL_NOTEBOOK],
    // 2026-10-18: the LDOE program page, the official home of the program (checked live).
    links: [
      { label: "Louisiana Department of Education, LA GATOR Scholarship Program", href: "https://doe.louisiana.gov/topic-pages/louisiana-school-choice/la-gator" },
    ],
    faq: [],
    // Sources checked 2026-10-18 (punch #292). Odyssey's "Approved Curriculum/Books" list
    // (115 textbooks, updated 2026-05-07) does not include Eden's Table, and the page says so.
    // Whether a book off that list can still be approved is stated nowhere, so the page does
    // not guess either way.
    guide: {
      heading: "LA GATOR approved curriculum: what the program pays for",
      intro:
        "In Louisiana the review happens before anything reaches families: the Louisiana Department of Education (LDOE) and Odyssey review every vendor and every listing in the GATOR marketplace. Here is how that works for curriculum, with Eden's Table as the example.",
      sections: [
        {
          q: "Is there an LA GATOR approved curriculum list?",
          a: [
            "Odyssey publishes an Approved Curriculum/Books list of textbooks for the Louisiana marketplace, grouped by subject, and Eden's Table is not on that list. LDOE and Odyssey also review every vendor and every marketplace listing for eligibility before families can buy it.",
          ],
        },
        {
          q: "What does LA GATOR count as a curriculum expense?",
          a: [
            "Louisiana law counts curricula, textbooks and other instructional materials as a qualified education expense, including supplemental materials required by a school or service provider. Families agree to provide for the student's education in at least English language arts, math, social studies and science.",
            "A student's funds can be spent only on that student.",
          ],
        },
        {
          q: "What does an LA GATOR purchase need?",
          a: [
            "Every purchase happens inside the Odyssey marketplace, and families cannot be reimbursed for out-of-pocket purchases. You add the item to your cart, assign it to a student and check out. The delivery address comes from your application, and you can add a shipping address in your dashboard. Odyssey emails you when the order is placed and again when it ships.",
          ],
        },
        {
          q: "What does LA GATOR not allow?",
          a: ["The program rules and Odyssey's guides rule out:"],
          list: [
            "Anything bought outside the Odyssey marketplace, which cannot be reimbursed.",
            "Spending a student's funds on anyone else.",
            "Paying a family member, or a business a family member owns.",
            "A refund or rebate paid back to the parent. Any refund goes back into the student's account.",
          ],
        },
        {
          q: "How does Eden's Table fit LA GATOR's rules?",
          a: [
            "Eden's Table is a Bible-based science and nature study curriculum in printed books: a Teacher's Guide, a Student Notebook and a Read-Aloud Storybook for a 36-week year. LDOE names curriculum publishers as one kind of GATOR vendor, and Louisiana law says a service provider does not have to change its creed or curricula to accept program funds.",
            "Eden's Table is an approved LA GATOR service provider. Our listings are waiting on the marketplace's review, so they cannot be ordered there yet. Once they are approved, you buy them in the marketplace like any other listing.",
          ],
        },
      ],
      sources: [
        { label: "LDOE, LA GATOR Scholarship Program", href: "https://doe.louisiana.gov/topic-pages/louisiana-school-choice/la-gator" },
        { label: "LDOE, LA GATOR Scholarship Program Policy", href: "https://doe.louisiana.gov/topic-pages/louisiana-school-choice/la-gator/la-gator-policy" },
        { label: "LDOE, LA GATOR Service Providers", href: "https://doe.louisiana.gov/topic-pages/louisiana-school-choice/la-gator/la-gator-service-providers" },
        { label: "Odyssey, Eligible Educational Expenses for the LA GATOR Program", href: "https://support.withodyssey.com/hc/en-us/articles/31114295732379" },
        { label: "Odyssey, Approved Curriculum/Books for the LA GATOR Scholarship Program", href: "https://support.withodyssey.com/hc/en-us/articles/35905159982747" },
        { label: "Odyssey, How to Use the LA GATOR Marketplace", href: "https://support.withodyssey.com/hc/en-us/articles/38952332772379" },
        { label: "Odyssey, How to Become a Vendor or Service Provider for the LA GATOR Program", href: "https://support.withodyssey.com/hc/en-us/articles/31142680151963" },
        { label: "Louisiana Revised Statutes 17:4037.3, definitions", href: "https://legis.la.gov/legis/Law.aspx?d=1391565" },
        { label: "Louisiana Revised Statutes 17:4037.6, account funds", href: "https://legis.la.gov/legis/Law.aspx?d=1391568" },
        { label: "Louisiana Revised Statutes 17:4037.8, schools and service providers", href: "https://legis.la.gov/legis/Law.aspx?d=1391570" },
      ],
      checked: "October 18, 2026",
    },
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
    items: [SET, STARTER, NOTEBOOK, SDL_SET, SDL_STARTER, SDL_NOTEBOOK],
    links: [
      { label: "Wyoming ESA Family Handbook", href: "https://edu.wyoming.gov/wp-content/uploads/2025/04/ESA-Family-Handbook.pdf" },
    ],
    faq: [],
    // Sources checked 2026-10-18 (punch #292): the 2026-27 Family Handbook (updated
    // September 2026) at the same URL as the link above, and WDE guidance created Aug 2026.
    // The program is operating: the WDE page says the state supreme court lifted the
    // injunction and payouts continue while the district court case goes on. Not on the page.
    guide: {
      heading: "Wyoming ESA approved curriculum: what the program pays for",
      intro:
        "Wyoming does not keep a list of approved curricula. Every educational product in the Wyoming ESA marketplace is pre-approved, and the Wyoming Department of Education (WDE) reviews reimbursement requests for purchases made outside it. Here is how that works for curriculum, with Eden's Table as the example.",
      sections: [
        {
          q: "Is there a Wyoming ESA approved curriculum list?",
          a: [
            "Not a list of curricula. The Family Handbook says every educational product in the Wyoming ESA marketplace is pre-approved, so what is in the marketplace is what the program has approved. The WDE also publishes a list of registered providers and vendors.",
          ],
        },
        {
          q: "What does Wyoming count as a curriculum expense?",
          a: [
            "Wyoming law defines a curriculum as a course of study for content areas or grade levels, including supplemental materials the curriculum requires or recommends. The Family Handbook counts curriculum, textbooks and other instructional materials as a qualifying expense, and WDE guidance covers both printed and digital materials.",
            "A student in the program must be taught reading, writing, math, civics, history, literature and science.",
          ],
        },
        {
          q: "What does a Wyoming ESA purchase need?",
          a: [
            "The marketplace is the intended way to buy. You place the order in the portal, the vendor ships it, and the portal handles payment, which is made after the product ships. Each child's account is separate, and funds cannot move between siblings.",
            "Reimbursement is open only to a few categories, including curriculum that covers at least one required subject, and only after you have checked that the item is not in the marketplace and asked the vendor to join it. The request has to be filed within 30 days of purchase, with an itemized receipt and an explanation of why the account could not pay directly. The WDE decides within 30 days of receiving everything it needs.",
          ],
        },
        {
          q: "What gets a Wyoming ESA request turned down?",
          a: ["The WDE asks whether a request is allowed by law, ordinarily used in education, supportive of learning and typical in cost. Requests also fail for reasons like these:"],
          list: [
            "A reimbursement request for something that could have been bought in the marketplace.",
            "Handwritten receipts.",
            "Requests filed more than 30 days after the purchase.",
            "For 2026-27, anything bought before September 1, 2026.",
            "Gift cards, and grocery or household items.",
          ],
        },
        {
          q: "How does Eden's Table fit Wyoming's rules?",
          a: [
            "Eden's Table is a Bible-based science and nature study curriculum in printed books: a Teacher's Guide, a Student Notebook and a Read-Aloud Storybook for a 36-week year. Science is one of Wyoming's required subjects, and Wyoming law says a provider does not have to change its creed or curriculum to accept ESA payments.",
            "Rooted in Faith Ventures LLC, which publishes Eden's Table, is on the WDE's list of registered providers and vendors. Our marketplace listings are waiting on approval, so they cannot be ordered there yet. Once they are approved, you order them in the marketplace like any other pre-approved product.",
          ],
        },
      ],
      sources: [
        { label: "WDE, ESA 2026-27 Family Handbook", href: "https://edu.wyoming.gov/wp-content/uploads/2025/04/ESA-Family-Handbook.pdf" },
        { label: "WDE, Allowable and Disallowable Expense Guidance", href: "https://edu.wyoming.gov/wp-content/uploads/2025/05/Allowable-and-Disallowable-Expense-Guidance-1.pdf" },
        { label: "WDE, Reimbursement Guidelines", href: "https://edu.wyoming.gov/wp-content/uploads/2025/04/Reimbursement-Guidelines.pdf" },
        { label: "WDE, ESA Registered Providers and Vendors (August 25, 2026)", href: "https://edu.wyoming.gov/wp-content/uploads/2025/05/ESA-Registered-Providers-Vendors-1.pdf" },
        { label: "WDE, Education Savings Account program page", href: "https://edu.wyoming.gov/parents/education-savings-accounts/" },
        { label: "Wyoming Statutes 21-2-901 to 21-2-909 (Title 21)", href: "https://wyoleg.gov/statutes/compress/title21.pdf" },
      ],
      checked: "October 18, 2026",
    },
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
        // 2026-10-18 (founder): ADE's own wording replaces "their goal is about two weeks",
        // which no ADE document says. Source: ADE EFA FAQs, updated 10/1/26, "How long before
        // reimbursement funds are deposited into my bank account?".
        // Search names: founder 2026-10-20, same ClassWallet vendor record as New Hampshire.
        body: "In ClassWallet, search for Eden's Table or Rooted in Faith (the company that publishes Eden's Table), then upload the PDF invoice as a Direct Pay request. The Arkansas Department of Education reviews it (ADE says it tries to approve requests within 25 business days, and it can take longer in busy periods, especially right after funds go out), and ClassWallet then pays us.",
      },
      {
        heading: "3. We print and ship",
        body: "As soon as payment arrives we order your books. They are printed to order, so plan on about two to three weeks from there.",
      },
      // 2026-10-18 (founder): offered like Arizona's. Arkansas reimburses curriculum (a core
      // educational expense) without preapproval under 6 CAR pt. 35 as amended effective
      // 2026-06-29; the receipt needs vendor name and contact, date, items, itemized prices and
      // total, payment method and proof of payment (2026-27 Family Handbook p.22), all on our
      // order confirmation receipt. The handbook's audit line (p.30) is kept on purpose.
      {
        heading: "Prefer to pay first and get reimbursed?",
        body: "You can also order on our store ($249 plus $12 shipping) and request reimbursement in ClassWallet. Your order confirmation email is an itemized receipt: it shows our name and contact details, the date, each item, the total paid and the card used, and ADE needs proof of payment with every reimbursement. The Arkansas handbook notes that paying out of pocket and requesting reimbursement increases your chances of an audit, so the invoice above is the simpler way.",
      },
    ],
    items: [SET, NOTEBOOK, SDL_SET, SDL_NOTEBOOK],
    links: [
      {
        label: "Arkansas Education Freedom Accounts",
        href: "https://dese.ade.arkansas.gov/offices/office-of-school-choice-and-parent-empowerment/education-freedom-accounts",
      },
    ],
    // 2026-09-18: The Reform Alliance agreed to be listed (Britain, Gmail thread
    // 1a0a11e3f4e35df2, 17:25 UTC), on the condition that we say they only work in
    // Arkansas. Founder approved adding them the same day. Description is drawn from
    // their own home page (thereformalliance.org, checked 2026-09-18). A free listing,
    // nothing given in exchange, so not sponsored.
    resources: [
      {
        name: "The Reform Alliance",
        href: "https://thereformalliance.org",
        description:
          "is a nonprofit that helps Arkansas families sort through their school options and connect with funding like the Education Freedom Account. They serve Arkansas families only, and they are not part of the state or the EFA program.",
      },
    ],
    faq: [
      {
        q: "Is Eden's Table listed in the School Choice Arkansas Provider Finder?",
        a: "Yes. Eden's Table is listed as a curriculum provider paid by Direct Pay.",
      },
    ],
    // Sources checked 2026-10-18 (punch #292): the 2026-27 Family Handbook (v1.0, Sept 2026),
    // the rule 6 CAR pt. 35 as amended effective 2026-06-29, and the Non-Qualifying Expense
    // List effective 2026-08-18. The review time lives in step 2 above only (ADE's
    // "within 25 business days", founder decision 2026-10-18), so it is not repeated here.
    guide: {
      heading: "Arkansas EFA approved curriculum: what the program pays for",
      intro:
        "Arkansas does not keep a list of approved curricula. It approves providers, reviews every expense on its own merits, and publishes a list of what does not qualify. Here is how that works for curriculum, with Eden's Table as the example.",
      sections: [
        {
          q: "Is there an Arkansas EFA approved curriculum list?",
          a: [
            "No. Under the EFA rule every expense is reviewed, and an expense is not approved or denied from a list alone. The lists Arkansas does keep are a list of approved providers, which names curriculum providers as one kind of vendor, and a list of goods and services that do not qualify.",
          ],
        },
        {
          q: "What does Arkansas count as a curriculum expense?",
          a: [
            "The EFA rule lists curricula as a qualifying expense, along with supplemental materials a course of study requires, and names textbooks, workbooks and curricular materials as core educational expenses. Every expense also has to be ordinary and necessary. The Arkansas Department of Education's (ADE) own example of a necessary expense is curriculum for a student's math, science, English or social studies plan.",
            "Homeschool families agree to spend a substantial share of their funds on English language arts, math, social studies and science.",
          ],
        },
        {
          q: "What does an Arkansas EFA payment need?",
          a: [
            "Families pay four ways in ClassWallet: a payment request sent by the vendor, Direct Pay against a vendor's invoice, the ClassWallet marketplace, and reimbursement. Direct Pay works only with vendors ADE has approved and that are registered in ClassWallet.",
            "A Direct Pay invoice needs the vendor's name and contact information, a description of each item, and itemized charges with the total due. The student's name and dates of service are required for services. A reimbursement needs a receipt with the purchase date, payment method and proof of payment, and the handbook steers families toward paying through ClassWallet instead.",
            "Each EFA student has a separate ClassWallet account, and each item on an order is given its own expense category.",
          ],
        },
        {
          q: "What gets an Arkansas EFA request turned down or sent back?",
          a: ["Being in the ClassWallet marketplace does not make an item eligible. Requests are turned down or held for reasons like these:"],
          list: [
            "Anything on ADE's Non-Qualifying Expense List, which reviewers check first. It includes gift cards of any kind, games and toys with no educational purpose, and consulting, training or advice for the parent.",
            "Items with no link to the student's learning plan, or more copies of an item than the student needs.",
            "Items bought for a sibling who is not in the program.",
            "A reimbursement with no proof of payment.",
            "An invoice missing something ADE needs. ClassWallet's Arkansas FAQ gives the example of an invoice with no student name, which is sent back to be fixed and resubmitted.",
          ],
        },
        {
          q: "How does Eden's Table fit Arkansas's rules?",
          a: [
            "Eden's Table is a Bible-based science and nature study curriculum in printed books: a Teacher's Guide, a Student Notebook and a Read-Aloud Storybook for a 36-week year. Under the EFA rule, a provider does not have to change its creed or curriculum to be approved or to accept EFA payments.",
            "Eden's Table is an approved Arkansas EFA vendor. Our Arkansas invoice is made for one student and shows our name and contact details, the student's name, each book with its price and the total due, so you can upload it as a Direct Pay request. If you pay on our store instead, the order confirmation email is the itemized receipt for a reimbursement request. ADE still reviews every request.",
          ],
        },
      ],
      sources: [
        { label: "ADE, Arkansas EFA Family Handbook 2026-2027", href: "https://drive.google.com/file/d/1Wm9kR7GKA_n4N0zngBc63_cRh2tF0qNp/view" },
        { label: "ADE, EFA Program Rule, 6 CAR pt. 35", href: "https://dese.ade.arkansas.gov/Files/Education_Freedom_Account_Program_-_6_CAR_pt.35_Legal.pdf" },
        { label: "ADE, EFA Non-Qualifying Expense List (effective August 18, 2026)", href: "https://drive.google.com/file/d/18feFOIcXSjZATcCNxD62TqTjUiewh4B4/view" },
        { label: "ADE, EFA FAQs", href: "https://docs.google.com/document/d/1oQaCgoDd71N1dQIvCdlNAWC8gqzzbreRb-L-6feGKLE/edit" },
        { label: "ADE and ClassWallet, Arkansas EFA ClassWallet Accountholder Guide", href: "https://docs.google.com/presentation/d/1hat4SF2rcqEVdD0d0Z7Ru-7Jd9rBMiYKYCTGRcMajuM/edit" },
        { label: "ClassWallet, Arkansas Education Freedom Account FAQs", href: "https://classwallet.my.site.com/classwallet/s/article/Arkansas-Education-Freedom-Account-FAQs" },
      ],
      checked: "October 18, 2026",
    },
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
    // has NO reimbursement. The Starter is offered on Alabama invoices only (founder); since
    // 2026-09-24 that is both Starters, Sprouts and Seedlings.
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
        // Search names: founder 2026-10-20, same ClassWallet vendor record as New Hampshire.
        body: "In ClassWallet, search for Eden's Table or Rooted in Faith (the company that publishes Eden's Table), then submit the PDF invoice as a Direct Pay (Pay Vendor) request and choose the expense category for curriculum and supplemental reading materials. Alabama does not reimburse purchases, so the invoice is the way to pay.",
      },
      {
        heading: "3. We send or ship",
        body: "As soon as payment arrives, we email the 9-week starter files, or order your printed books, which are printed to order and arrive in about two to three weeks.",
      },
    ],
    items: [SET, STARTER, NOTEBOOK, SDL_SET, SDL_STARTER, SDL_NOTEBOOK],
    links: [
      { label: "Alabama Department of Revenue, CHOOSE Act", href: "https://www.revenue.alabama.gov/tax-policy/the-choose-act/" },
    ],
    faq: [],
    // Sources checked 2026-10-18 (punch #292): the 2026-27 Parent and ESP Guides (updated
    // July 27, 2026) and Ala. Admin. Code 810-28-1. Eden's Table is on ALDOR's provider list
    // dated 10/9/26 (p.41). No official document mentions downloads, so the guide says
    // nothing about the Starter files either way.
    guide: {
      heading: "Alabama CHOOSE Act approved curriculum: what the program pays for",
      intro:
        "Alabama does not approve curricula one by one. It approves providers, lists the subjects curriculum can cover, and reviews every payment. Here is how that works for a curriculum purchase, with Eden's Table as the example.",
      sections: [
        {
          q: "Is there an approved curriculum list for the Alabama CHOOSE Act?",
          a: [
            "No list of curricula. The Alabama Department of Revenue (ALDOR) approves and publishes a list of Education Service Providers, and the parent chooses the provider. What Alabama does list is subjects: textbooks count in the approved subjects, which include science and religion, and supplemental reading has to go with one of those subjects.",
          ],
        },
        {
          q: "What does Alabama count as a curriculum expense?",
          a: [
            "The CHOOSE Act rules define curricula and instructional materials as resources for one student's use, including curriculum, workbooks, flashcards and supplemental reading tied to approved subjects. Bulk purchases are not allowed.",
            "When you pay in ClassWallet, the expense category is called Curriculum and supplemental reading materials.",
          ],
        },
        {
          q: "What does an Alabama CHOOSE Act invoice need?",
          a: [
            "Alabama does not reimburse families. Every payment goes through ClassWallet, either in the marketplace or as a Pay Vendor payment against an invoice from an approved provider.",
            "The 2026-27 guides say an invoice is rejected unless it shows the provider's name and address, the student's name, the parent's name, the invoice date, the date or dates of service, what the payment is for, and the total due. It cannot be handwritten, and it may not mention the CHOOSE Act or ClassWallet. Only charges for the current school year, July 1, 2026 to June 30, 2027, are approved.",
          ],
        },
        {
          q: "What gets an Alabama CHOOSE Act payment turned down?",
          a: ["Every purchase and payment is reviewed. If one is rejected, the money goes straight back to the account and can be used again. Common reasons:"],
          list: [
            "Any ineligible item on the invoice. The whole invoice is rejected, not just that line.",
            "An invoice missing one of the required details, or a handwritten one.",
            "An invoice that names the CHOOSE Act or ClassWallet.",
            "A statement of account instead of an invoice for the original charge.",
            "Charges outside the current school year.",
            "More of the same item than one student could reasonably use in a year.",
          ],
        },
        {
          q: "How does Eden's Table fit Alabama's rules?",
          a: [
            "Eden's Table is a Bible-based science and nature study curriculum in printed books: a Teacher's Guide, a Student Notebook and a Read-Aloud Storybook for a 36-week year. Science and religion are both approved subjects in Alabama.",
            "Eden's Table is on ALDOR's list of approved Education Service Providers. Our Alabama invoice shows each of the details above, never names the program or ClassWallet, and lists only our own curriculum. You choose Curriculum and supplemental reading materials when you submit it.",
          ],
        },
      ],
      sources: [
        { label: "CHOOSE Act Parent Guide, 2026-2027", href: "https://classwallet.com/alchoose/assets/CHOOSE_ACT_parent_guide_2026-2027.pdf" },
        { label: "CHOOSE Act Education Service Provider Guide, 2026-2027", href: "https://classwallet.com/alchoose/assets/CHOOSE_ACT_education_service_provider_guide_2026-2027.pdf" },
        { label: "Alabama Administrative Code 810-28-1-.05, education service providers", href: "https://admincode.legislature.state.al.us/administrative-code/810-28-1-.05" },
        { label: "Alabama Administrative Code 810-28-1-.06, qualifying expenses", href: "https://admincode.legislature.state.al.us/administrative-code/810-28-1-.06" },
        { label: "ALDOR, CHOOSE Act Education Service Providers list", href: "https://www.revenue.alabama.gov/wp-content/uploads/2024/12/CHOOSE-Act-Alabama-ESPs.pdf" },
      ],
      checked: "October 18, 2026",
    },
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
        // Search names: founder 2026-10-20. Families find us under either name, in ClassWallet
        // and in the CSF directory. The CSF listing itself is titled "Eden's Table".
        body: "In ClassWallet, search for Eden's Table or Rooted in Faith (the company that publishes Eden's Table), then submit the PDF invoice as a Direct Pay request. There is no processing fee on New Hampshire invoices. We are also listed under both names in the Children's Scholarship Fund New Hampshire directory.",
        link: { label: "See our listing in the CSF New Hampshire directory", href: "https://app.nh.scholarshipfund.org/esa/esa_parent/esa_vendors/19171" },
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
    items: [SET, NOTEBOOK, SDL_SET, SDL_NOTEBOOK],
    links: [
      { label: "Eden's Table in the CSF New Hampshire directory", href: "https://app.nh.scholarshipfund.org/esa/esa_parent/esa_vendors/19171" },
      { label: "New Hampshire Education Freedom Accounts", href: "https://www.education.nh.gov/pathways-education/education-freedom-accounts" },
    ],
    faq: [],
    // Sources checked 2026-10-18 (punch #292): the CSF 2026-27 Parent Handbook (updated August
    // 2026, posted 2026-09) and STU-14 dated 8-28-26. Page numbers in the comments above and in
    // supabase/functions/_shared/esa-invoice.ts (p.18, p.29) are from the older 11-14-25 handbook.
    guide: {
      heading: "New Hampshire EFA approved curriculum: what CSF pays for",
      intro:
        "New Hampshire does not hand families a list of approved curricula. Parents choose, and Children's Scholarship Fund New Hampshire (CSF), which runs the program, checks each purchase against the EFA law. Here is how that works for a curriculum purchase, with Eden's Table as the example.",
      sections: [
        {
          q: "Is there a New Hampshire EFA approved curriculum list?",
          a: [
            "No. CSF decides only whether the materials a parent picks fit an approved expense category and fall within the core knowledge domains named in the EFA law. Science is one of those domains, and CSF can ask to see a curriculum to check.",
            "If you want to know whether an item is allowed before you buy it, you can ask CSF at nhapprovals@scholarshipfund.org.",
          ],
        },
        {
          q: "What does New Hampshire count as a curriculum expense?",
          a: [
            "The EFA law lists textbooks, curriculum and other instructional materials, including supplemental materials a curriculum requires. CSF's Parent Handbook defines curriculum as the lessons and academic content taught in a course, program or grade level, and counts workbooks and digital material, such as e-workbooks, as textbooks.",
          ],
        },
        {
          q: "What does a New Hampshire EFA purchase need?",
          a: [
            "Families pay three ways in ClassWallet: Marketplace orders, Direct Pay to an approved provider, and reimbursement. CSF staff approve or deny every transaction, whichever way you pay, and the reason for a denial shows in ClassWallet.",
            "A Direct Pay invoice from a retailer has to show the vendor's name, the invoice date, a description clear enough for CSF to tell what the item is, and the amount due. A reimbursement receipt needs the same details with the amount paid. Reimbursement is the slowest way, and CSF's FAQ says it can take weeks.",
            "ClassWallet orders ship only to the verified New Hampshire address on file. EFAs are student accounts, so one child's funds cannot be shared with a sibling.",
          ],
        },
        {
          q: "What gets a New Hampshire EFA purchase turned down?",
          a: ["CSF's handbook and policies name these:"],
          list: [
            "A Marketplace cart with one prohibited item in it. CSF cannot remove a single item, so the whole order is rejected and you reorder the rest.",
            "An invoice or receipt with missing or unclear details, if you cannot send the extra documents CSF asks for.",
            "Handwritten receipts, which CSF never accepts.",
            "Purchases paid for with gift cards or reward points.",
            "Items bought to resell or to give as gifts, and items meant for several students to share.",
            "Anything bought before the student's date of eligibility.",
            "Food, ingredients and kitchenware.",
          ],
        },
        {
          q: "How does Eden's Table fit New Hampshire's rules?",
          a: [
            "Eden's Table is a Bible-based science and nature study curriculum in printed books: a Teacher's Guide, a Student Notebook and a Read-Aloud Storybook for a 36-week year. No food or other supplies come with it. New Hampshire's EFA law says a provider does not have to change its creed or curriculum to accept EFA payments.",
            "Eden's Table is an approved New Hampshire EFA provider. Our New Hampshire invoice is made for one student and shows the vendor's name and address, the invoice date, a description of each book and the amount due for that student. It ships only to the New Hampshire address you have on file with the program. CSF still reviews and decides on every request.",
          ],
        },
      ],
      sources: [
        { label: "CSF New Hampshire, EFA Parent Handbook 2026-27", href: "https://nh.scholarshipfund.org/wp-content/uploads/2026/09/Parent-Handbook-CSF-8-2026.pdf" },
        { label: "CSF New Hampshire, EFA Parent FAQ", href: "https://nh.scholarshipfund.org/wp-content/uploads/2025/09/NH-FAQ-Updated-September-2025.pdf" },
        { label: "CSF New Hampshire, Shipping Policy (STU-14)", href: "https://nh.scholarshipfund.org/wp-content/uploads/2026/08/STU-14-Shipping-Policy_8-28-26.pdf" },
        { label: "CSF New Hampshire, EFA policies and procedures", href: "https://nh.scholarshipfund.org/efa-polices-and-procedures-2/" },
        { label: "New Hampshire RSA 194-F, Education Freedom Accounts", href: "https://gc.nh.gov/rsa/html/XV/194-F/194-F-mrg.htm" },
      ],
      checked: "October 18, 2026",
    },
  },
];

/** Programs we have applied to and are waiting on. Plain facts only. */
export const ESA_PENDING = [
  { state: "Florida", program: "Step Up For Students scholarships", note: "Provider application submitted, waiting on review." },
  { state: "West Virginia", program: "Hope Scholarship", note: "Provider application submitted September 2026, waiting on review." },
];

/** Last content review of the ESA pages. Bump it when what they say changes (see
    the rules at the top). */
export const ESA_UPDATED_ISO = "2026-10-20";

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
  "A 36-week Bible-based science and nature study curriculum in two levels: Sprouts for kindergarten through second grade, and Seedlings for grades 3 to 5. Each week centers on one plant. In Sprouts, reading, writing, math, history, geography and art are woven into the study of it, and Seedlings studies a different 36 plants for older children. It is published by Rooted in Faith Ventures LLC.";

/** Questions every state page answers. Written the way parents ask them. */
export const ESA_COMMON_FAQ = [
  {
    q: "What is Eden's Table?",
    a: ESA_CURRICULUM_DESCRIPTION,
  },
  {
    q: "What grades is it for?",
    a: "Sprouts is for kindergarten through second grade, ages five to seven. Every Sprouts lesson is written at two depths, so a younger and an older child can work the same week together. Seedlings is for grades 3 to 5.",
  },
  {
    q: "What comes in the printed set?",
    a: "The Sprouts set is a Teacher's Guide (240 pages, coil bound), a Student Notebook (224 pages, coil bound) and a Read-Aloud Storybook (112 pages, paperback). The Seedlings set has the same three books for grades 3 to 5: a Teacher's Guide (245 pages, coil bound), a Student Notebook (227 pages, coil bound) and a Read-Aloud Storybook (160 pages, paperback). Each set covers the full 36-week year and is printed to order.",
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
