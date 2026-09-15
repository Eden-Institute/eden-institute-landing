/**
 * Prices and per-state options for the ESA invoice form island (web/components/islands/
 * EsaInvoiceForm.tsx). Used ONLY to show a live total while a family fills in the form.
 * The invoice itself is built by the esa-invoice edge function from
 * supabase/functions/_shared/esa-invoice.ts, which is authoritative; keep the two in step.
 */

export type EsaInvoiceState = "AZ" | "AR" | "AL" | "NH";
export type EsaChoice = "set" | "notebook" | "starter";

export const ESA_INVOICE_STATE_BY_SLUG: Record<string, EsaInvoiceState> = {
  arizona: "AZ",
  arkansas: "AR",
  alabama: "AL",
  "new-hampshire": "NH",
};

export const ESA_CHOICES: Record<EsaChoice, { label: string; detail: string; cents: number; printed: boolean }> = {
  set: {
    label: "Printed Curriculum Set",
    detail: "Teacher's Guide, Student Notebook and Read-Aloud Storybook, all 36 weeks. Shipping included.",
    cents: 26100,
    printed: true,
  },
  notebook: {
    label: "Extra Student Notebook",
    detail: "For a child who shares a brother's or sister's set. Shipping included.",
    cents: 3999,
    printed: true,
  },
  starter: {
    label: "9-Week Starter Unit",
    detail: "Weeks 1 to 9 as a download, not the full year.",
    cents: 3900,
    printed: false,
  },
};

export const ESA_STATE_OPTIONS: Record<EsaInvoiceState, { choices: EsaChoice[]; feeRate: number; holderLabel: string; shipNote: string }> = {
  AZ: {
    choices: ["set", "notebook"],
    feeRate: 0.020408,
    holderLabel: "Account holder's name, as it shows in ClassWallet",
    shipNote: "Use the shipping address you have on file with the Arizona ESA program.",
  },
  AR: {
    choices: ["set", "notebook"],
    feeRate: 0,
    holderLabel: "Account holder's name, as it shows in ClassWallet",
    shipNote: "Use the shipping address you have on file with the program.",
  },
  AL: {
    choices: ["set", "notebook", "starter"],
    feeRate: 0,
    holderLabel: "Parent's first and last name",
    shipNote: "Where we should ship the printed books.",
  },
  NH: {
    choices: ["set", "notebook"],
    feeRate: 0,
    holderLabel: "Account holder's name, as it shows in ClassWallet",
    shipNote: "New Hampshire EFA orders ship only to the New Hampshire address on file with your program.",
  },
};

/** The one sentence that explains the Arizona fee. Must match feeSentence() in
 *  supabase/functions/_shared/esa-invoice.ts, which prints it on the invoice PDF. */
export function esaFeeSentence(rate: number): string {
  return `ClassWallet deducts 2%, so this invoice adds ${(rate * 100).toFixed(4)}% to cover it.`;
}

export function esaFeeCents(subtotalCents: number, rate: number): number {
  return rate ? Math.round(subtotalCents * rate + 1e-9) : 0;
}

/** The idempotency key for one fill of the invoice form. */
export interface EsaFillKey {
  key: string;
  fingerprint: string;
}

/**
 * A retry of the SAME fill (a dropped connection, a second press) reuses the key, so the esa-invoice
 * function returns the invoices it already made instead of numbering and emailing new ones. Any
 * change to what was typed is a new fill and gets a new key.
 */
export function esaIdempotencyKey(
  prev: EsaFillKey | null,
  fingerprint: string,
  newKey: () => string = () => crypto.randomUUID(),
): EsaFillKey {
  return prev && prev.fingerprint === fingerprint ? prev : { key: newKey(), fingerprint };
}

export function esaMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
