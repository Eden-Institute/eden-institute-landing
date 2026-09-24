// web/components/islands/EsaInvoiceForm.tsx
//
// The instant-invoice form on /esa/<state> for the programs that pay by invoice today
// (Arizona, Arkansas, Alabama, New Hampshire). Added 2026-09-14.
//
// A family enters the account holder, each student and what that student needs, and the
// shipping address. The esa-invoice edge function issues one invoice per student, returns the
// PDFs for an instant download, and emails a copy. The live total here is a preview only; the
// server builds the invoice from supabase/functions/_shared/esa-invoice.ts.
//
// Double submit (2026-09-16): each fill carries an idempotency key (esaIdempotencyKey), kept in memory
// and reused when the same fill is sent again, so a dropped connection plus a second press returns the
// same invoices instead of new numbers and a second email. A ref also blocks a double click.
//
// Plain fetch with the publishable key (no Supabase client), so nothing touches localStorage,
// but it is still mounted client:only because the static page needs no server render of a form.
// Copy rules (web/lib/esaStates.ts header): no em dashes, and none of the listed health words.
//
// Seedlings (2026-09-24): each student's choices are grouped by band, Sprouts first, under a small
// band heading. Every label also names its band, because the same label shows in the running total.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ESA_BANDS,
  ESA_CHOICES,
  ESA_STATE_OPTIONS,
  esaFeeCents,
  esaFeeSentence,
  esaIdempotencyKey,
  esaMoney,
  type EsaChoice,
  type EsaFillKey,
  type EsaInvoiceState,
} from "../../lib/esaInvoice";

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/esa-invoice`;

const US_STATES =
  "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");

interface Props {
  state: EsaInvoiceState;
  stateName: string;
  short: string;
}

interface Student {
  id: string;
  first: string;
  last: string;
  choice: EsaChoice;
}

interface Issued {
  number: string;
  student: string;
  total: string;
  filename: string;
  pdfBase64: string;
}

const input =
  "w-full px-3 py-2.5 bg-white border rounded-md font-body text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2";
const inputStyle = { borderColor: "hsl(var(--eden-gold) / 0.45)" };
const label = "block font-body text-sm font-semibold mb-1";
const labelStyle = { color: "hsl(var(--eden-bark))" };

let nextStudentId = 0;
const newStudentId = () => `s${++nextStudentId}`;

function downloadHref(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
}

export default function EsaInvoiceForm({ state, stateName, short }: Props) {
  const opts = ESA_STATE_OPTIONS[state];
  const [parentName, setParentName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [students, setStudents] = useState<Student[]>([{ id: newStudentId(), first: "", last: "", choice: "set" }]);
  const [addr, setAddr] = useState<{ line1: string; line2: string; city: string; region: string; zip: string }>({
    line1: "",
    line2: "",
    city: "",
    region: state,
    zip: "",
  });
  const [company, setCompany] = useState(""); // honeypot
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fillKey = useRef<EsaFillKey | null>(null);
  const inFlight = useRef(false);
  const [result, setResult] = useState<{ invoices: (Issued & { href: string })[]; emailed: boolean; email: string; nextStep: string } | null>(null);
  useEffect(() => () => { result?.invoices.forEach((inv) => URL.revokeObjectURL(inv.href)); }, [result]);

  const needsAddress = students.some((s) => ESA_CHOICES[s.choice].printed);
  const lines = useMemo(
    () =>
      students.map((s, i) => {
        const sub = ESA_CHOICES[s.choice].cents;
        const fee = esaFeeCents(sub, opts.feeRate);
        return { i, name: `${s.first} ${s.last}`.trim() || `Student ${i + 1}`, label: ESA_CHOICES[s.choice].label, sub, fee, total: sub + fee };
      }),
    [students, opts.feeRate],
  );
  const grand = lines.reduce((t, l) => t + l.total, 0);

  const setStudent = (i: number, patch: Partial<Student>) =>
    setStudents((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  // A sibling usually shares student 1's set and needs that band's Extra Student Notebook (Sprouts
  // "notebook", Seedlings "sdl_nb", 2026-09-24). If the state does not offer it, start on student 1's choice.
  const addStudent = () =>
    setStudents((prev) => {
      if (prev.length >= 6) return prev;
      const firstChoice = prev[0]?.choice ?? "set";
      const bandNotebook: EsaChoice = ESA_CHOICES[firstChoice].band === "seedlings" ? "sdl_nb" : "notebook";
      const choice: EsaChoice = opts.choices.includes(bandNotebook) ? bandNotebook : firstChoice;
      return [...prev, { id: newStudentId(), first: "", last: prev[0]?.last ?? "", choice }];
    });
  const removeStudent = (i: number) => setStudents((prev) => prev.filter((_, j) => j !== i));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // A state update does not disable the button before a fast second click lands; the ref does.
    if (inFlight.current) return;
    inFlight.current = true;
    setError("");
    setLoading(true);
    try {
      const payload = { state, parentName, email, phone, students: students.map(({ first, last, choice }) => ({ first, last, choice })), address: needsAddress ? addr : null, company };
      fillKey.current = esaIdempotencyKey(fillKey.current, JSON.stringify(payload));
      let res: Response;
      try {
        res = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
          body: JSON.stringify({ ...payload, idempotencyKey: fillKey.current.key }),
        });
      } catch {
        throw new Error("We could not reach our server. Please check your connection and press the button again.");
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Something went wrong. Please try again.");
      setResult({
        invoices: (data.invoices as Issued[]).map((inv) => ({ ...inv, href: downloadHref(inv.pdfBase64) })),
        emailed: !!data.emailed,
        email: data.email,
        nextStep: data.nextStep,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  if (result) {
    const many = result.invoices.length > 1;
    return (
      <div className="rounded-lg p-6 bg-white border space-y-4" style={inputStyle}>
        <h3 className="font-serif text-xl font-bold" style={{ color: "hsl(var(--eden-forest))" }}>
          Your invoice{many ? "s are" : " is"} ready
        </h3>
        <ul className="space-y-3">
          {result.invoices.map((inv) => (
            <li key={inv.number} className="flex flex-wrap items-center justify-between gap-3 border-b pb-3" style={inputStyle}>
              <div className="font-body text-sm">
                <p className="font-semibold" style={labelStyle}>{inv.number}</p>
                <p className="text-muted-foreground">{inv.student} · {inv.total}</p>
              </div>
              <a
                href={inv.href}
                download={inv.filename}
                className="font-body text-sm font-semibold rounded-md px-4 py-2"
                style={{ backgroundColor: "hsl(var(--eden-forest))", color: "hsl(var(--eden-parchment))" }}
              >
                Download PDF
              </a>
            </li>
          ))}
        </ul>
        <p className="font-body text-sm text-muted-foreground">
          {result.emailed
            ? `We also emailed ${many ? "them" : "it"} to ${result.email}.`
            : `Please download ${many ? "them" : "it"} now. We could not send the email copy, so write to hello@edeninstitute.health if you need it again.`}
        </p>
        <div>
          <p className="font-serif text-base font-bold mb-1" style={{ color: "hsl(var(--eden-forest))" }}>Your next step</p>
          <p className="font-body text-sm text-muted-foreground leading-relaxed">
            {result.nextStep}
            {many ? " Submit each invoice under that student's account." : ""}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-lg p-6 bg-white border space-y-5" style={inputStyle}>
      <div>
        <h3 className="font-serif text-xl font-bold" style={{ color: "hsl(var(--eden-forest))" }}>Get your {short} invoice now</h3>
        <p className="font-body text-sm text-muted-foreground mt-1">
          Fill this in and your invoice is ready to download right away. We email you a copy too.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} style={labelStyle} htmlFor="esa-parent">{opts.holderLabel}</label>
          <input id="esa-parent" className={input} style={inputStyle} value={parentName} onChange={(e) => setParentName(e.target.value)} autoComplete="name" required />
        </div>
        <div>
          <label className={label} style={labelStyle} htmlFor="esa-email">Email</label>
          <input id="esa-email" type="email" className={input} style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </div>
      </div>

      <div className="space-y-4">
        <p className={label} style={labelStyle}>Students</p>
        {students.map((s, i) => (
          <fieldset key={s.id} className="rounded-md border p-4 space-y-3" style={inputStyle}>
            <legend className="sr-only">Student {i + 1}</legend>
            {/* !mt-0: the sr-only legend is now the first child, so space-y-3 would otherwise push this row down. */}
            <div className="flex items-center justify-between !mt-0">
              <span aria-hidden="true" className="font-body text-sm font-semibold" style={labelStyle}>Student {i + 1}</span>
              {students.length > 1 && (
                <button type="button" onClick={() => removeStudent(i)} aria-label={`Remove student ${i + 1}`} className="font-body text-xs underline text-muted-foreground">
                  Remove
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input className={input} style={inputStyle} placeholder="First name" aria-label={`Student ${i + 1} first name`} value={s.first} onChange={(e) => setStudent(i, { first: e.target.value })} required />
              <input className={input} style={inputStyle} placeholder="Last name" aria-label={`Student ${i + 1} last name`} value={s.last} onChange={(e) => setStudent(i, { last: e.target.value })} required />
            </div>
            <div className="space-y-3">
              {ESA_BANDS.map(({ band, heading }) => {
                const bandChoices = opts.choices.filter((c) => ESA_CHOICES[c].band === band);
                if (!bandChoices.length) return null;
                return (
                  <div key={band} role="group" aria-label={`Student ${i + 1}: ${heading}`} className="space-y-2">
                    <p aria-hidden="true" className="font-accent text-xs tracking-[0.2em] uppercase" style={{ color: "hsl(var(--eden-gold-ink))" }}>{heading}</p>
                    {bandChoices.map((c) => (
                      <label key={c} className="flex items-start gap-3 cursor-pointer font-body text-sm">
                        <input type="radio" name={`choice-${s.id}`} className="mt-1" checked={s.choice === c} onChange={() => setStudent(i, { choice: c })} />
                        <span>
                          <span className="font-semibold" style={labelStyle}>{ESA_CHOICES[c].label}</span>
                          <span className="text-muted-foreground"> · {esaMoney(ESA_CHOICES[c].cents)}</span>
                          <span className="block text-xs text-muted-foreground">{ESA_CHOICES[c].detail}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}
        {students.length < 6 && (
          <button type="button" onClick={addStudent} className="font-body text-sm font-semibold underline" style={{ color: "hsl(var(--eden-forest))" }}>
            + Add another student
          </button>
        )}
        <p className="font-body text-xs text-muted-foreground">
          Each student gets their own invoice, because {stateName} accounts are per student. A brother or sister sharing a set usually just needs an Extra Student Notebook for that band: Sprouts or Seedlings.
        </p>
      </div>

      {needsAddress && (
        <div className="space-y-3">
          <p className={label} style={labelStyle}>Shipping address</p>
          <p className="font-body text-xs text-muted-foreground -mt-2">{opts.shipNote}</p>
          <input className={input} style={inputStyle} placeholder="Street address" aria-label="Street address" autoComplete="address-line1" value={addr.line1} onChange={(e) => setAddr({ ...addr, line1: e.target.value })} required />
          <input className={input} style={inputStyle} placeholder="Apartment, unit (optional)" aria-label="Apartment or unit" autoComplete="address-line2" value={addr.line2} onChange={(e) => setAddr({ ...addr, line2: e.target.value })} />
          <div className="grid gap-3 grid-cols-[1fr_5.5rem_7rem]">
            <input className={input} style={inputStyle} placeholder="City" aria-label="City" autoComplete="address-level2" value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} required />
            <select className={input} style={inputStyle} aria-label="State" autoComplete="address-level1" value={addr.region} onChange={(e) => setAddr({ ...addr, region: e.target.value })}>
              {US_STATES.map((st) => <option key={st} value={st}>{st}</option>)}
            </select>
            <input className={input} style={inputStyle} placeholder="ZIP" aria-label="ZIP code" inputMode="numeric" autoComplete="postal-code" pattern="\d{5}(-\d{4})?" value={addr.zip} onChange={(e) => setAddr({ ...addr, zip: e.target.value })} required />
          </div>
          <input className={input} style={inputStyle} type="tel" placeholder="Phone for the delivery carrier (optional)" aria-label="Phone for the delivery carrier (optional)" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      )}

      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label htmlFor="esa-company">Company</label>
        <input id="esa-company" tabIndex={-1} autoComplete="off" value={company} onChange={(e) => setCompany(e.target.value)} />
      </div>

      <div className="rounded-md p-4 space-y-1" style={{ backgroundColor: "hsl(var(--eden-cream))" }}>
        {lines.map((l) => (
          <div key={l.i} className="flex justify-between gap-3 font-body text-sm">
            <span className="text-muted-foreground">{l.name}: {l.label}{l.fee ? ` + ${esaMoney(l.fee)} processing fee` : ""}</span>
            <span className="font-semibold" style={labelStyle}>{esaMoney(l.total)}</span>
          </div>
        ))}
        {lines.length > 1 && (
          <div className="flex justify-between gap-3 font-body text-sm pt-1 border-t" style={inputStyle}>
            <span className="font-semibold" style={labelStyle}>All invoices together</span>
            <span className="font-semibold" style={labelStyle}>{esaMoney(grand)}</span>
          </div>
        )}
        {opts.feeRate > 0 && (
          <p className="font-body text-xs text-muted-foreground pt-1">
            {esaFeeSentence(opts.feeRate)} It is shown as its own line on the invoice.
          </p>
        )}
      </div>

      {error && <p className="font-body text-sm font-semibold" style={{ color: "#9b2c1c" }} role="alert">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full font-body text-base font-semibold rounded-md px-5 py-3 disabled:opacity-60"
        style={{ backgroundColor: "hsl(var(--eden-forest))", color: "hsl(var(--eden-parchment))" }}
      >
        {loading ? "Making your invoice..." : `Create my invoice${students.length > 1 ? "s" : ""}`}
      </button>
      <p className="font-body text-xs text-muted-foreground">
        We use these details only to make and send your invoice and to ship your order. Your student's name is printed on the invoice because the program requires it.
      </p>
    </form>
  );
}
