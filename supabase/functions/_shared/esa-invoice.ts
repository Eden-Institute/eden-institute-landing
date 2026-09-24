// ESA invoice rules: products, prices, per-state wording, validation and totals.
// Pure (no network, no Deno APIs), so it is unit-tested in esa-invoice.test.ts.
//
// SOURCE OF TRUTH for every line below is the founder-approved Word templates:
//   OneDrive: Eden's Table (Homeschool Curriculum)/Projects/ESA and Marketplace Vendor/
//             ESA_Invoice_Templates_2026-09-13.docx
// and the decisions recorded in scripts/esa_invoice.py (Biblical Herbalism/scripts). The web
// copy of the prices lives in web/lib/esaInvoice.ts for the live total; THIS file is what the
// invoice is built from, so the server total always wins.
//
// Rules that must not drift:
//   - One invoice per student (NH EFAs are per pupil, CSF handbook p.18, p.29).
//   - Arizona passes ClassWallet's 2% deduction to the family as its own line, grossed up to
//     2.0408% so the vendor nets the item total (founder 2026-09-14, wording confirmed 2026-09-15).
//   - Both 9-Week Starters (Sprouts and Seedlings) are offered on ALABAMA invoices only
//     (founder 2026-09-14 for Sprouts, 2026-09-24 for Seedlings).
//   - Seedlings (grades 3-5) joined the rail 2026-09-24: the printed set on every state's invoice,
//     the Starter on Alabama's only. There is no Seedlings extra notebook.
//   - An Alabama invoice may NOT mention the CHOOSE Act or ClassWallet "in any form" (AL ESP
//     guide p.7), so it has no Program or Payment line.
//   - New Hampshire ships only to the New Hampshire address on file (CSF handbook p.18).
//   - No credit, coupon or kit wording anywhere (Laws L-29).

export type EsaStateCode = "AZ" | "AR" | "AL" | "NH";
export type Sku = "ET-SPR-K2-004" | "ET-SPR-K2-005" | "ET-SPR-K2-003" | "ET-SDL-35-004" | "ET-SDL-35-003";
/** Choice keys travel in the form body and are read with str(o.choice, 10): keep them 10 characters or fewer. */
export type Choice = "set" | "notebook" | "starter" | "sdl_set" | "sdl_start";

export const CHOICE_SKU: Record<Choice, Sku> = {
  set: "ET-SPR-K2-004",
  notebook: "ET-SPR-K2-005",
  starter: "ET-SPR-K2-003",
  sdl_set: "ET-SDL-35-004",
  sdl_start: "ET-SDL-35-003",
};

export interface Product {
  sku: Sku;
  title: string;
  description: string;
  unitCents: number;
  printed: boolean;
}

export const PRODUCTS: Record<Sku, Product> = {
  "ET-SPR-K2-004": {
    sku: "ET-SPR-K2-004",
    title: "Sprouts K-2 36-Week Science and Nature Study Printed Curriculum Set, Bible-Based",
    description:
      "Three printed books: Teacher's Guide (240 pages), Student Notebook (224 pages) and Read-Aloud Storybook (112 pages). Shipping included.",
    unitCents: 26100,
    printed: true,
  },
  "ET-SPR-K2-005": {
    sku: "ET-SPR-K2-005",
    title: "Sprouts K-2 36-Week Science and Nature Study Extra Student Notebook, Bible-Based",
    description: "One extra printed Student Notebook (224 pages, coil bound). Shipping included.",
    unitCents: 3999,
    printed: true,
  },
  "ET-SPR-K2-003": {
    sku: "ET-SPR-K2-003",
    title: "Sprouts K-2 9-Week Starter Unit, Science and Nature Study, Bible-Based",
    description:
      "Weeks 1 to 9 of the 36-week year, not the full year: Teacher's Guide, Student Notebook and Read-Aloud Storybook sections, delivered as a digital download.",
    unitCents: 3900,
    printed: false,
  },
  // Seedlings (grades 3-5), founder decisions 2026-09-24. No page counts: they are not locked yet.
  "ET-SDL-35-004": {
    sku: "ET-SDL-35-004",
    title: "Seedlings 3-5 36-Week Science and Nature Study Printed Curriculum Set, Bible-Based",
    description:
      "Three printed books: Teacher's Guide, Student Notebook and Read-Aloud Storybook, all 36 weeks for grades 3-5. Shipping included.",
    unitCents: 26100,
    printed: true,
  },
  "ET-SDL-35-003": {
    sku: "ET-SDL-35-003",
    title: "Seedlings 3-5 9-Week Starter Unit, Science and Nature Study, Bible-Based",
    description:
      "Weeks 1 to 9 of the 36-week year for grades 3-5, not the full year: Teacher's Guide, Student Notebook and Read-Aloud Storybook sections, delivered as a digital download.",
    unitCents: 3900,
    printed: false,
  },
};

export const AZ_FEE_RATE = 0.020408;

/** The one sentence that explains the Arizona fee, on the invoice PDF and on the web form (web/lib/
 *  esaInvoice.ts esaFeeSentence must say the same). 0.020408 is the gross-up of ClassWallet's 2%
 *  deduction (founder confirmed 2026-09-15): $261 + 2.0408% = $266.33, and 2% of that is ~$5.33. */
export function feeSentence(rate: number): string {
  return `ClassWallet deducts 2%, so this invoice adds ${(rate * 100).toFixed(4)}% to cover it.`;
}

export interface StateRules {
  code: EsaStateCode;
  name: string;
  /** Printed on the invoice. null for Alabama (no program name allowed). */
  programLine: string | null;
  /** Printed on the invoice. null for Alabama (no ClassWallet mention allowed). */
  paymentLine: string | null;
  holderLabel: string;
  itemHeader: string;
  totalLabel: string;
  choices: Choice[];
  feeRate: number;
  /** Two-letter state the shipping address must be in, when the program requires it. */
  shipState: string | null;
  /** Arkansas: "Expected ship date". Alabama: "Date(s) of service". */
  secondDateLabel: string | null;
  extraLines: string[];
  /** Plain-language next step for the family email and the confirmation screen. */
  nextStep: string;
}

export const STATE_RULES: Record<EsaStateCode, StateRules> = {
  AZ: {
    code: "AZ",
    name: "Arizona",
    programLine: "Program: Arizona Empowerment Scholarship Account (ESA)",
    paymentLine: "Payment: ClassWallet, Pay Vendor",
    holderLabel: "Account holder",
    itemHeader: "Item and description",
    totalLabel: "Total amount of charges",
    choices: ["set", "notebook", "sdl_set"],
    feeRate: AZ_FEE_RATE,
    shipState: null,
    secondDateLabel: null,
    extraLines: [],
    nextStep:
      "Sign in to ClassWallet and submit the invoice as a payment to a vendor (Pay Vendor), requesting exactly the total shown. Arizona reviews every request.",
  },
  AR: {
    code: "AR",
    name: "Arkansas",
    programLine: "Program: Arkansas Education Freedom Account (EFA)",
    paymentLine: "Payment: ClassWallet, Direct Pay",
    holderLabel: "Account holder",
    itemHeader: "Item and description",
    totalLabel: "Total due",
    choices: ["set", "notebook", "sdl_set"],
    feeRate: 0,
    shipState: null,
    secondDateLabel: "Expected ship date",
    extraLines: ["Please request exactly this total in ClassWallet Direct Pay."],
    nextStep:
      "Sign in to ClassWallet and upload the invoice as a Direct Pay request for exactly the total shown. The Arkansas Department of Education reviews it, and ClassWallet then pays us.",
  },
  AL: {
    code: "AL",
    name: "Alabama",
    programLine: null,
    paymentLine: null,
    holderLabel: "Parent",
    itemHeader: "Item and description",
    totalLabel: "Total amount due",
    choices: ["set", "notebook", "starter", "sdl_set", "sdl_start"],
    feeRate: 0,
    shipState: null,
    secondDateLabel: "Date(s) of service",
    extraLines: [],
    nextStep:
      "Sign in to ClassWallet and submit the invoice as a Direct Pay (Pay Vendor) request, choosing the category for curriculum and supplemental reading materials.",
  },
  NH: {
    code: "NH",
    name: "New Hampshire",
    programLine: "Program: New Hampshire Education Freedom Account (EFA), Children's Scholarship Fund New Hampshire",
    paymentLine: "Payment: ClassWallet, Direct Pay",
    holderLabel: "Account holder",
    itemHeader: "Description of item purchased",
    totalLabel: "Amount due for this student (per pupil)",
    choices: ["set", "notebook", "sdl_set"],
    feeRate: 0,
    shipState: "NH",
    secondDateLabel: null,
    extraLines: [],
    nextStep:
      "Sign in to ClassWallet and submit the invoice as a Direct Pay request for exactly the total shown. There is no processing fee in New Hampshire.",
  },
};

export const SELLER_LINES = [
  "Eden's Table",
  "Rooted in Faith Ventures LLC",
  "303 Holly Cir, Unit 3262",
  "Clarksville, TN 37043",
  "hello@edeninstitute.health",
  "(931) 575-5895",
];

export const THANK_YOU = "Thank you! Questions about this invoice: hello@edeninstitute.health or (931) 575-5895.";

export const MAX_STUDENTS = 6;

/** Address used by founder test submissions: invoices are marked is_test and never numbered. */
export const TEST_EMAIL = "hello+esatest@edeninstitute.health";

export interface Address {
  line1: string;
  line2: string;
  city: string;
  region: string;
  zip: string;
}

export interface StudentInput {
  first: string;
  last: string;
  choice: Choice;
}

export interface Submission {
  state: EsaStateCode;
  parentName: string;
  email: string;
  /** Optional. Lulu needs a phone for the carrier; blank falls back to the business line at fulfilment. */
  phone: string;
  address: Address | null;
  students: StudentInput[];
}

export interface LineItem {
  sku: Sku;
  title: string;
  description: string;
  qty: number;
  unitCents: number;
  amountCents: number;
}

export interface InvoicePlan {
  state: EsaStateCode;
  parentName: string;
  studentName: string;
  email: string;
  shipTo: string;
  items: LineItem[];
  subtotalCents: number;
  feeCents: number;
  totalCents: number;
  printed: boolean;
}

const US_STATES = new Set(
  "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" "),
);

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/** Validates and normalises the raw JSON body. Returns the parsed submission or a
 *  family-readable error message. Never throws. */
export function parseSubmission(raw: unknown): { ok: true; value: Submission } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Please fill in the form." };
  const b = raw as Record<string, unknown>;
  const state = str(b.state, 2).toUpperCase() as EsaStateCode;
  const rules = STATE_RULES[state];
  if (!rules) return { ok: false, error: "This form is for Arizona, Arkansas, Alabama and New Hampshire." };

  const parentName = str(b.parentName, 80);
  if (parentName.length < 3 || !parentName.includes(" ")) {
    return { ok: false, error: `Please enter the ${rules.holderLabel.toLowerCase()}'s first and last name.` };
  }
  const email = str(b.email, 120).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: "Please enter a valid email address." };
  // Same shape lulu.ts accepts (/^\+?[\d\s\-.\/()]{8,20}$/), so a phone that passes here passes at Lulu.
  const phone = str(b.phone, 20);
  if (phone && !/^\+?[\d\s\-.\/()]{8,20}$/.test(phone)) return { ok: false, error: "Please check the phone number, or leave it blank." };

  if (!Array.isArray(b.students) || b.students.length === 0) {
    return { ok: false, error: "Please add at least one student." };
  }
  if (b.students.length > MAX_STUDENTS) {
    return { ok: false, error: `Please use the form for up to ${MAX_STUDENTS} students, or email us for more.` };
  }
  const students: StudentInput[] = [];
  for (const [i, s] of (b.students as unknown[]).entries()) {
    const o = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
    const first = str(o.first, 40);
    const last = str(o.last, 40);
    const choice = str(o.choice, 10) as Choice;
    if (!first || !last) return { ok: false, error: `Please enter student ${i + 1}'s first and last name.` };
    if (!rules.choices.includes(choice)) return { ok: false, error: `Please choose what student ${i + 1} needs.` };
    students.push({ first, last, choice });
  }

  const needsAddress = students.some((s) => PRODUCTS[CHOICE_SKU[s.choice]].printed);
  let address: Address | null = null;
  if (needsAddress) {
    const a = (b.address && typeof b.address === "object" ? b.address : {}) as Record<string, unknown>;
    address = {
      line1: str(a.line1, 100),
      line2: str(a.line2, 60),
      city: str(a.city, 60),
      region: str(a.region, 2).toUpperCase(),
      zip: str(a.zip, 10),
    };
    if (!address.line1 || !address.city) return { ok: false, error: "Please enter the full shipping address." };
    if (!US_STATES.has(address.region)) return { ok: false, error: "Please choose the state in the shipping address." };
    if (!/^\d{5}(-\d{4})?$/.test(address.zip)) return { ok: false, error: "Please enter a 5-digit ZIP code." };
    if (rules.shipState && address.region !== rules.shipState) {
      return {
        ok: false,
        error: "New Hampshire EFA orders can only ship to the New Hampshire address on file with your program.",
      };
    }
  }
  return { ok: true, value: { state, parentName, email, phone, address, students } };
}

export function formatAddress(a: Address | null, email: string): string {
  if (!a) return `Digital download, emailed to ${email}`;
  return [a.line1, a.line2, `${a.city}, ${a.region} ${a.zip}`].filter(Boolean).join("\n");
}

/** ClassWallet's fee on the item total, rounded half-up to the cent (matches esa_invoice.py). */
export function feeFor(subtotalCents: number, rate: number): number {
  return rate ? Math.round(subtotalCents * rate + 1e-9) : 0;
}

/** One invoice plan per student. */
export function planInvoices(sub: Submission): InvoicePlan[] {
  const rules = STATE_RULES[sub.state];
  return sub.students.map((s) => {
    const p = PRODUCTS[CHOICE_SKU[s.choice]];
    const items: LineItem[] = [
      { sku: p.sku, title: p.title, description: p.description, qty: 1, unitCents: p.unitCents, amountCents: p.unitCents },
    ];
    const subtotalCents = items.reduce((t, i) => t + i.amountCents, 0);
    const feeCents = feeFor(subtotalCents, rules.feeRate);
    return {
      state: sub.state,
      parentName: sub.parentName,
      studentName: `${s.first} ${s.last}`,
      email: sub.email,
      shipTo: formatAddress(p.printed ? sub.address : null, sub.email),
      items,
      subtotalCents,
      feeCents,
      totalCents: subtotalCents + feeCents,
      printed: p.printed,
    };
  });
}

export function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Today's date in Central time as YYYY-MM-DD (the business runs on Central, L-16). */
export function centralDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(now);
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** MM/DD/YYYY, the format every program's invoice rules use. */
export function usDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${m}/${d}/${y}`;
}

/** Arkansas ship date / Alabama service date: +21 days when printed books are on the invoice. */
export function secondDate(plan: InvoicePlan, invoiceDate: string): string | null {
  if (!STATE_RULES[plan.state].secondDateLabel) return null;
  return plan.printed ? addDays(invoiceDate, 21) : invoiceDate;
}

export function deliveryLine(plan: InvoicePlan): string {
  if (!plan.printed) return "Delivery: the Starter Unit is emailed as a download once payment is received.";
  return "Delivery: printed to order once payment is received, then shipped. In hand in about 2 to 3 weeks.";
}

export const AL_FORBIDDEN_RE = /choose\s*act|classwallet/i;

/** Words that must never reach an invoice. Checked on the final text before anything is saved. */
export function forbiddenOnInvoice(state: EsaStateCode, text: string): string[] {
  const hits: string[] = [];
  if (state === "AL" && AL_FORBIDDEN_RE.test(text)) hits.push("Alabama invoice names the CHOOSE Act or ClassWallet");
  if (/\b(credit|coupon)\b/i.test(text)) hits.push("credit or coupon wording (L-29)");
  return hits;
}

/** Alabama only. The ClassWallet / CHOOSE Act ban covers every word on the page, including
 *  family-typed names and the ship-to block. Credit/coupon stays a static-text check so a real
 *  surname is never rejected. */
export function forbiddenInFamilyText(state: EsaStateCode, text: string): string[] {
  return state === "AL" && AL_FORBIDDEN_RE.test(text)
    ? ["Alabama invoice names the CHOOSE Act or ClassWallet in a family-supplied field"]
    : [];
}
