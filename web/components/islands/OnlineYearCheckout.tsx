// web/components/islands/OnlineYearCheckout.tsx
//
// The Online Year order page (OY2, punch #472): child names, where she lives and the required
// agreement box, collected on OUR page before Stripe (Stripe allows only a few custom fields).
// create-checkout (lookup_key "online_year_cart") checks every field again and prices the cart:
// $149 for the first child in a band, $29 for each sibling. Dark until ONLINE_YEAR_ENABLED: the
// function answers 404 until then, so this page shows the usual "could not open checkout" line.
// Words: web/lib/onlineYearCopy.ts (all approved, pinned by onlineYearCopy.test.ts).
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { friendlyEfError } from "@/components/apothecary/friendlyEfError";
import { getFbAttribution } from "@/lib/fbAttribution";
import { getCheckoutAttribution } from "@/lib/attribution";
import { trackCta } from "@/lib/trackCta";
import { partnerPromoCode } from "../../lib/partnerPromo";
import { OY_APPROVED, OY_COUNTRY_CODES, OY_APPROVED_ORDER_PAGE, type OnlineYearBandKey } from "../../lib/onlineYearCopy";

const MAX_CHILDREN = 10;
const MAX_NAME = 40;

export function bandFromSearch(search: string): OnlineYearBandKey {
  try {
    return new URLSearchParams(search).get("band") === "seedlings" ? "seedlings" : "sprouts";
  } catch {
    return "sprouts";
  }
}

export default function OnlineYearCheckout() {
  const [band] = useState<OnlineYearBandKey>(() =>
    typeof window === "undefined" ? "sprouts" : bandFromSearch(window.location.search),
  );
  const [email, setEmail] = useState("");
  const [children, setChildren] = useState<string[]>([""]);
  const [country, setCountry] = useState("");
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const elsewhere = country === "other";
  const namesOk = children.every((c) => c.trim().length > 0);
  const ready = email.trim().length > 3 && namesOk && (OY_COUNTRY_CODES as readonly string[]).includes(country) && agree && !loading;

  const setChild = (i: number, v: string) => setChildren((cs) => cs.map((c, j) => (j === i ? v : c)));

  async function startCheckout() {
    if (!ready) return;
    trackCta("checkout-start", { lookupKey: `online_year_${band}` });
    setLoading(true);
    setError(null);
    try {
      const promo = partnerPromoCode();
      const { data, error: fnError } = await supabase.functions.invoke("create-checkout", {
        body: {
          ...getFbAttribution(),
          attribution: getCheckoutAttribution(),
          lookup_key: "online_year_cart",
          band,
          email: email.trim(),
          country,
          child_names: children.map((c) => c.trim()),
          agree: true,
          ...(promo ? { promo_code: promo } : {}),
        },
      });
      if (fnError) throw new Error((await friendlyEfError(fnError, "")) || fnError.message);
      if (!data?.url) throw new Error("Checkout did not return a link.");
      window.location.href = data.url as string;
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? `We could not open checkout: ${err.message}`
          : "We could not open checkout. Please try again, or email hello@edeninstitute.health.",
      );
      setLoading(false);
    }
  }

  const field = "mt-1 w-full rounded-md border px-3 py-2 bg-background font-body text-sm";
  const border = { borderColor: "hsl(var(--eden-gold) / 0.5)" };

  return (
    <section className="max-w-xl mx-auto px-5 py-10" data-online-year-checkout={band}>
      <h1 className="font-display text-3xl" style={{ color: "hsl(var(--eden-bark))" }}>{OY_APPROVED.title}</h1>
      <p className="font-body text-lg mt-1">{OY_APPROVED.bandLabel[band]}</p>
      <p className="font-body mt-3"><strong>{OY_APPROVED.price}</strong> · {OY_APPROVED.siblingPrice}</p>
      <p className="font-body text-sm text-muted-foreground mt-1">{OY_APPROVED.noRenewal}</p>
      <p className="font-body text-sm text-muted-foreground mt-3">{OY_APPROVED_ORDER_PAGE.siblingNote}</p>

      <div className="mt-6 text-left">
        <label htmlFor="oy-email" className="block font-body text-sm">{OY_APPROVED_ORDER_PAGE.emailLabel}</label>
        <input id="oy-email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com"
          value={email} onChange={(e) => setEmail(e.target.value)} className={field} style={border} />
        <p className="mt-1 font-body text-xs text-muted-foreground">{OY_APPROVED.signInEmail}</p>
      </div>

      {children.map((c, i) => (
        <div className="mt-5 text-left" key={i}>
          <label htmlFor={`oy-child-${i}`} className="block font-body text-sm">{OY_APPROVED.childLabel}</label>
          <div className="flex gap-2 items-center">
            <input id={`oy-child-${i}`} type="text" autoComplete="off" maxLength={MAX_NAME}
              value={c} onChange={(e) => setChild(i, e.target.value)} className={field} style={border} />
            {children.length > 1 && (
              <button type="button" className="font-body text-sm underline mt-1"
                onClick={() => setChildren((cs) => cs.filter((_, j) => j !== i))}>{OY_APPROVED_ORDER_PAGE.removeChild}</button>
            )}
          </div>
          {i === 0 && <p className="mt-1 font-body text-xs text-muted-foreground">{OY_APPROVED.childHelper}</p>}
        </div>
      ))}
      {children.length < MAX_CHILDREN && (
        <button type="button" className="mt-3 font-body text-sm underline"
          onClick={() => setChildren((cs) => [...cs, ""])}>{OY_APPROVED_ORDER_PAGE.addChild}</button>
      )}

      <div className="mt-6 text-left">
        <label htmlFor="oy-country" className="block font-body text-sm">{OY_APPROVED_ORDER_PAGE.countryLabel}</label>
        <select id="oy-country" value={country} onChange={(e) => setCountry(e.target.value)} className={field} style={border}>
          <option value="" disabled>{" "}</option>
          {[...OY_COUNTRY_CODES, "other"].map((k) => (
            <option key={k} value={k}>{OY_APPROVED_ORDER_PAGE.countries[k]}</option>
          ))}
        </select>
        {elsewhere && <p className="mt-1 font-body text-sm">{OY_APPROVED.moreCountries}</p>}
      </div>

      <label className="mt-6 flex items-start gap-2 font-body text-sm text-left">
        <input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>{OY_APPROVED.agreement}</span>
      </label>

      <button type="button" onClick={startCheckout} disabled={!ready}
        className="mt-6 w-full rounded-md px-5 py-3 font-body font-semibold disabled:opacity-50"
        style={{ backgroundColor: "hsl(var(--eden-forest))", color: "white" }}>
        {loading ? "…" : OY_APPROVED.button}
      </button>
      <p className="mt-2 font-body text-xs text-muted-foreground text-center">{OY_APPROVED.underButton}</p>
      {error && <p className="mt-3 font-body text-sm" role="alert" style={{ color: "hsl(var(--destructive))" }}>{error}</p>}
    </section>
  );
}
