// Optional email + one-reminder checkbox shown above a curriculum buy button
// (Spring Buying Season Plan move 1, founder "All 13: Do it" 2026-11-18).
//
// Why: 32 checkouts were started and left between 9/29 and 11/14 and none got
// the abandoned-checkout reminder: 16 never typed an email on Stripe's page, 16
// never gave Stripe's promotional consent (checkout_recoveries). Taking the email
// here hands it to Stripe as customer_email (so Stripe's page arrives filled in)
// and to the webhook in metadata, and the box records a yes to ONE reminder.
//
// Rules this piece keeps:
//   - It never blocks the button. No `required`, no disabled state: native form
//     validation fires before any JS and its tooltip often does not show, which is
//     how the preorder Reserve button swallowed clicks for days in July. A blank or
//     malformed email is simply not sent, and Stripe asks for it as it always has.
//   - The box is default UNCHECKED, like the site's text-message consent box.
//   - No em dashes in buyer-facing copy.

import { useId } from "react";
// A usable email or null. Shared with create-checkout and the print ship-to form, so
// all three refuse exactly the addresses Stripe refuses (a trailing dot or comma,
// "<...>", a zero-width space); one Stripe refused used to fail the whole checkout
// (2026-11-19). Stripe still does the real check.
import { cleanContactEmail } from "../../../supabase/functions/_shared/contact-email";

export { cleanContactEmail };

export interface CheckoutContactValue {
  email: string;
  remind: boolean;
}

export const EMPTY_CHECKOUT_CONTACT: CheckoutContactValue = { email: "", remind: false };

/**
 * The fields to add to a create-checkout request body. Nothing when the email is
 * blank or malformed (the reminder needs an address, so the box alone sends
 * nothing either).
 */
export function checkoutContactBody(v: CheckoutContactValue): { email?: string; reminder_consent?: boolean } {
  const email = cleanContactEmail(v.email);
  if (!email) return {};
  return { email, reminder_consent: v.remind === true };
}

export default function CheckoutContact({
  value,
  onChange,
  className = "",
}: {
  value: CheckoutContactValue;
  onChange: (next: CheckoutContactValue) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={`text-left ${className}`}>
      {/* Styled like the print box's optional "Mobile number for text updates" field. */}
      <label htmlFor={`${id}-email`} className="block font-body text-sm text-muted-foreground">
        Your email (optional)
      </label>
      <input
        id={`${id}-email`}
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={value.email}
        onChange={(e) => onChange({ ...value, email: e.target.value })}
        className="mt-1 w-full rounded-md border px-3 py-2 bg-background font-body text-sm"
        style={{ borderColor: "hsl(var(--eden-gold) / 0.5)" }}
      />
      <p className="mt-1 font-body text-xs text-muted-foreground">
        We fill it in on the checkout page for you, and send your receipt there.
      </p>
      <label className="mt-2 flex items-start gap-2 font-body text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={value.remind}
          onChange={(e) => onChange({ ...value, remind: e.target.checked })}
          className="mt-1"
        />
        <span>If I don&apos;t finish checking out, send me one reminder.</span>
      </label>
    </div>
  );
}
