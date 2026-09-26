// web/components/islands/ShipToForm.tsx
//
// Shipping address for HEAVY print orders only (founder decision 2026-09-26).
// A parcel too heavy for Lulu's MAIL level ships by ground (FedEx home delivery),
// which cannot reach a PO box or an APO/FPO/DPO address. Stripe Checkout cannot
// refuse an address, so for these orders we ask for it here, check it in the
// browser and again on the server (create-checkout, _shared/ship-address.ts),
// and Checkout then uses it without an address form. Normal orders never show
// this: Stripe collects their address as it always has.
//
// Copy rule: no em dashes.

import { SHIP_TO_STATES, type ShipTo } from "../../../supabase/functions/_shared/ship-address";

export type ShipToDraft = Partial<ShipTo>;

interface Props {
  value: ShipToDraft;
  onChange: (next: ShipToDraft) => void;
  idPrefix: string;
}

const input = "w-full rounded-md border px-3 py-2 bg-background font-body text-sm";
const border = { borderColor: "hsl(var(--eden-gold) / 0.5)" };

export default function ShipToForm({ value, onChange, idPrefix }: Props) {
  const set = (k: keyof ShipTo) => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value });
  const id = (k: string) => `${idPrefix}-${k}`;
  return (
    <fieldset className="mt-3 grid gap-2 font-body text-sm" style={{ color: "hsl(var(--eden-bark))" }}>
      <legend className="font-serif text-base font-bold mb-1" style={{ color: "hsl(var(--eden-forest))" }}>
        Where should we send it?
      </legend>
      <p className="text-xs text-muted-foreground -mt-1 mb-1">
        Larger orders ship by ground and need a street address (no PO boxes). You won't be asked for it again at checkout.
      </p>
      <label htmlFor={id("name")} className="sr-only">Full name</label>
      <input id={id("name")} className={input} style={border} autoComplete="shipping name" placeholder="Full name" value={value.name ?? ""} onChange={set("name")} />
      <label htmlFor={id("email")} className="sr-only">Email</label>
      <input id={id("email")} type="email" className={input} style={border} autoComplete="email" placeholder="Email, for your receipt and tracking" value={value.email ?? ""} onChange={set("email")} />
      <label htmlFor={id("line1")} className="sr-only">Street address</label>
      <input id={id("line1")} className={input} style={border} autoComplete="shipping address-line1" placeholder="Street address" value={value.line1 ?? ""} onChange={set("line1")} />
      <label htmlFor={id("line2")} className="sr-only">Apartment, suite or unit (optional)</label>
      <input id={id("line2")} className={input} style={border} autoComplete="shipping address-line2" placeholder="Apartment, suite or unit (optional)" value={value.line2 ?? ""} onChange={set("line2")} />
      <div className="grid grid-cols-[1fr_5rem_6rem] gap-2">
        <label htmlFor={id("city")} className="sr-only">City</label>
        <input id={id("city")} className={input} style={border} autoComplete="shipping address-level2" placeholder="City" value={value.city ?? ""} onChange={set("city")} />
        <label htmlFor={id("state")} className="sr-only">State</label>
        <select id={id("state")} className={input} style={border} autoComplete="shipping address-level1" value={value.state ?? ""} onChange={set("state")}>
          <option value="">State</option>
          {SHIP_TO_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label htmlFor={id("zip")} className="sr-only">ZIP code</label>
        <input id={id("zip")} className={input} style={border} inputMode="numeric" autoComplete="shipping postal-code" placeholder="ZIP" value={value.postal_code ?? ""} onChange={set("postal_code")} />
      </div>
    </fieldset>
  );
}
