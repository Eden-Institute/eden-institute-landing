// supabase/functions/_shared/print-session-lock.ts
//
// Heavy print orders (2026-09-26) lock the buyer's checked street address on a
// Stripe Customer and show Checkout NO address form. Every Checkout field that
// only makes sense next to Stripe's address form has to go with it, or Stripe
// refuses the whole session:
//
//   - shipping_address_collection: removed, so Checkout shows no address fields.
//   - customer_creation: cannot be combined with `customer`.
//   - custom_text.shipping_address: Stripe answers 400 "You must provide shipping
//     address collection when using custom_text[shipping_address]". This one
//     shipped in #590 and made EVERY heavy checkout return 500 (found by the
//     fake-card E2E, 2026-09-27). custom_text.submit is kept; an emptied
//     custom_text object is dropped rather than sent empty.
//
// Verified in Stripe TEST mode 2026-09-27 with the full print parameter set
// (automatic tax, fixed shipping rate, phone collection, invoice_creation,
// promotion codes, a Customer carrying the address): accepted, tax "complete",
// shipping kept. Nothing else in that set needs shipping_address_collection.
//
// Used only by create-checkout (and its E2E twin, which imports it).

// deno-lint-ignore no-explicit-any
type Params = Record<string, any>;

/** Strip the address-form fields from a print session whose address is locked on a Customer. Mutates and returns `params`. */
export function lockShipToSessionParams<T extends Params>(params: T): T {
  delete params.shipping_address_collection;
  delete params.customer_creation;
  const ct = params.custom_text;
  if (ct && typeof ct === 'object') {
    delete ct.shipping_address;
    if (Object.keys(ct).length === 0) delete params.custom_text;
  }
  return params;
}
