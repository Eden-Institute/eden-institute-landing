// The mobile number typed next to the SMS consent box on the print buy box.
//
// A2P 10DLC: the phone field sits on the same form as the consent checkbox, so the
// number the buyer typed there is the number they gave permission to text (Twilio's
// campaign pre-check flagged the old box, which had a checkbox and no number field;
// the number was only collected later, on Stripe's page). US numbers only: the print
// shop ships within the United States.
//
// Mirror of usMobileE164 in supabase/functions/_shared/order-sms.ts. Keep the two in step.

/** "+1" and 10 digits, or null when the input is not a US phone number. */
export function usMobileE164(raw: string | null | undefined): string | null {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  if (d.length !== 10) return null;
  // North American numbering: the area code and the exchange never start with 0 or 1.
  if (d[0] === "0" || d[0] === "1" || d[3] === "0" || d[3] === "1") return null;
  return `+1${d}`;
}
