// web/components/islands/EsaReceiptForm.tsx
//
// The reimbursement-ready receipt form on /esa/florida. Added 2026-11-20 (Lane 2c), modeled on
// EsaInvoiceForm.tsx. The family enters their order number, the email on the order, the parent's
// name and each student's name; the esa-receipt edge function checks the order against that email
// and Stripe, then returns a one-page paid-in-full PDF for an instant download.
//
// Privacy, deliberate: order details are POSTed in the body, never put in a URL, and NO analytics
// event fires from this form (no trackEmailSubmit, no data-cta on the button), so nothing about an
// order reaches GA4 or Meta. The PDF is built into an in-memory blob URL and revoked on unmount.
// Plain fetch with the publishable key, no Supabase client, nothing in localStorage.
// Copy rules (web/lib/esaStates.ts header): no em dashes, none of the listed words.

import { useEffect, useRef, useState } from "react";

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/esa-receipt`;
const MAX_STUDENTS = 6;

const input =
  "w-full px-3 py-2.5 bg-white border rounded-md font-body text-base sm:text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2";
const inputStyle = { borderColor: "hsl(var(--eden-gold) / 0.45)" };
const label = "block font-body text-sm font-semibold mb-1";
const labelStyle = { color: "hsl(var(--eden-bark))" };

let nextId = 0;
const newId = () => `r${++nextId}`;

function blobHref(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
}

export default function EsaReceiptForm() {
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [parentName, setParentName] = useState("");
  const [students, setStudents] = useState<{ id: string; name: string }[]>([{ id: newId(), name: "" }]);
  const [company, setCompany] = useState(""); // honeypot
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ href: string; filename: string; orderNumber: string } | null>(null);
  const inFlight = useRef(false);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.href); }, [result]);

  const setStudent = (i: number, name: string) => setStudents((prev) => prev.map((s, j) => (j === i ? { ...s, name } : s)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setError("");
    setLoading(true);
    try {
      let res: Response;
      try {
        res = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
          body: JSON.stringify({ orderNumber, email, parentName, students: students.map((s) => s.name), company }),
        });
      } catch {
        throw new Error("We could not reach our server. Please check your connection and press the button again.");
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Something went wrong. Please try again.");
      setResult({ href: blobHref(data.pdfBase64), filename: data.filename, orderNumber: data.orderNumber });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="rounded-lg p-6 bg-white border space-y-4" style={inputStyle}>
        <h3 className="font-serif text-xl font-bold" style={{ color: "hsl(var(--eden-forest))" }}>Your receipt is ready</h3>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-body text-sm text-muted-foreground">Paid-in-full receipt for order {result.orderNumber}</p>
          <a
            href={result.href}
            download={result.filename}
            className="font-body text-sm font-semibold rounded-md px-4 py-2"
            style={{ backgroundColor: "hsl(var(--eden-forest))", color: "hsl(var(--eden-parchment))" }}
          >
            Download PDF
          </a>
        </div>
        <div>
          <p className="font-serif text-base font-bold mb-1" style={{ color: "hsl(var(--eden-forest))" }}>Your next step</p>
          <p className="font-body text-sm text-muted-foreground leading-relaxed">
            Step Up For Students families: submit it in EMA. AAA families: submit it in the Scholarship Management Platform (SMP).
            Save a copy for your records too.
          </p>
        </div>
        <button type="button" onClick={() => setResult(null)} className="font-body text-sm underline" style={{ color: "hsl(var(--eden-forest))" }}>
          Make another receipt
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-lg p-6 bg-white border space-y-5" style={inputStyle}>
      <div>
        <h3 className="font-serif text-xl font-bold" style={{ color: "hsl(var(--eden-forest))" }}>Get your reimbursement-ready receipt</h3>
        <p className="font-body text-sm text-muted-foreground mt-1">
          Already ordered? Fill this in and download your paid-in-full receipt right away.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} style={labelStyle} htmlFor="rcpt-order">Order number</label>
          <input id="rcpt-order" className={input} style={inputStyle} placeholder="ET-1234" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} autoComplete="off" required />
        </div>
        <div>
          <label className={label} style={labelStyle} htmlFor="rcpt-email">Email you ordered with</label>
          <input id="rcpt-email" type="email" className={input} style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </div>
      </div>

      <div>
        <label className={label} style={labelStyle} htmlFor="rcpt-parent">Parent's name, as on the scholarship account</label>
        <input id="rcpt-parent" className={input} style={inputStyle} value={parentName} onChange={(e) => setParentName(e.target.value)} autoComplete="name" required />
      </div>

      <div className="space-y-3">
        <p className={label} style={labelStyle}>Student name{students.length > 1 ? "s" : ""}</p>
        {students.map((s, i) => (
          <div key={s.id} className="flex gap-2 items-center">
            <input
              className={input}
              style={inputStyle}
              placeholder="First and last name"
              aria-label={`Student ${i + 1} first and last name`}
              value={s.name}
              onChange={(e) => setStudent(i, e.target.value)}
              required
            />
            {students.length > 1 && (
              <button type="button" onClick={() => setStudents((prev) => prev.filter((_, j) => j !== i))} aria-label={`Remove student ${i + 1}`} className="font-body text-xs underline text-muted-foreground">
                Remove
              </button>
            )}
          </div>
        ))}
        {students.length < MAX_STUDENTS && (
          <button type="button" onClick={() => setStudents((prev) => [...prev, { id: newId(), name: "" }])} className="font-body text-sm font-semibold underline" style={{ color: "hsl(var(--eden-forest))" }}>
            + Add another student
          </button>
        )}
      </div>

      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label htmlFor="rcpt-company">Company</label>
        <input id="rcpt-company" tabIndex={-1} autoComplete="off" value={company} onChange={(e) => setCompany(e.target.value)} />
      </div>

      {error && <p className="font-body text-sm font-semibold" style={{ color: "#9b2c1c" }} role="alert">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full font-body text-base font-semibold rounded-md px-5 py-3 disabled:opacity-60"
        style={{ backgroundColor: "hsl(var(--eden-forest))", color: "hsl(var(--eden-parchment))" }}
      >
        {loading ? "Making your receipt..." : "Make my receipt"}
      </button>
      <p className="font-body text-xs text-muted-foreground">
        We check your order number against the email on the order before showing anything, and we do not save what you type.
        The names you enter are printed on the receipt because scholarship reviewers ask for them.
      </p>
    </form>
  );
}
