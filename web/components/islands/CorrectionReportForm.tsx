// CorrectionReportForm — the report-an-error form on /homeschool/updates.
// Level -> book -> where in the book -> what is wrong, posted to the
// submit-curriculum-correction EF, which stores it and emails hello@.
//
// The "where" options are the real page structure of the printed books, measured
// from the Lulu print files on 2026-09-22, not assumed:
//   Teacher's Guide  each week is Week at a Glance, then Monday to Friday
//   Student Notebook each week is Monday to Friday, then My Wonder Pages
//   Read-Aloud       one continuous run of pages, so it asks for a page number
//
// client:only — imports the Supabase client (touches localStorage at module
// load), so it must never run during the Astro static build.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { FORM_ERROR_FALLBACK, visitorFacingError } from "@/lib/edgeFunctionError";

type Book = "tg" | "nb" | "ra";

const BANDS = [
  { value: "sprouts", label: "Sprouts, Grades K-2" },
  { value: "seedlings", label: "Seedlings, Grades 3-5" },
];

const BOOKS: { value: Book; label: string }[] = [
  { value: "tg", label: "Teacher's Guide" },
  { value: "nb", label: "Student Notebook" },
  { value: "ra", label: "Read-Aloud Storybook" },
];

// In-week pages, per book. Kept in step with BOOK_LOCATIONS in the edge function.
const WEEK_PAGES: Record<Book, { value: string; label: string }[]> = {
  tg: [
    { value: "wag", label: "Week at a Glance" },
    { value: "mon", label: "Monday, Read-Aloud & Discussion" },
    { value: "tue", label: "Tuesday, Discovery" },
    { value: "wed", label: "Wednesday, Kitchen Lab" },
    { value: "thu", label: "Thursday, History & Art" },
    { value: "fri", label: "Friday, Garden & Review" },
  ],
  nb: [
    { value: "mon", label: "Monday" },
    { value: "tue", label: "Tuesday" },
    { value: "wed", label: "Wednesday" },
    { value: "thu", label: "Thursday" },
    { value: "fri", label: "Friday" },
    { value: "wonder", label: "My Wonder Pages" },
  ],
  ra: [],
};

const OUTSIDE_PAGES = [
  { value: "front", label: "The front of the book" },
  { value: "back", label: "The back of the book" },
  { value: "cover", label: "The cover" },
  { value: "other", label: "Somewhere else" },
];

const WEEKS = Array.from({ length: 36 }, (_, i) => i + 1);

const inputClass =
  "w-full px-4 py-3 bg-background border border-border font-body text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-eden-gold transition-colors";
const labelClass =
  "block font-accent text-xs tracking-[0.2em] uppercase text-muted-foreground mb-2";

export default function CorrectionReportForm() {
  const [band, setBand] = useState("");
  const [book, setBook] = useState<Book | "">("");
  // "week" means an in-week page; the alternative is a front/back/cover page.
  const [placement, setPlacement] = useState<"week" | "outside" | "">("");
  const [week, setWeek] = useState("");
  const [location, setLocation] = useState("");
  const [pageNumber, setPageNumber] = useState("");
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const isReadAloud = book === "ra";

  // Changing the book changes which pages exist, so anything already chosen goes.
  const chooseBook = (value: Book) => {
    setBook(value);
    setPlacement("");
    setWeek("");
    setLocation("");
    setPageNumber("");
  };

  const choosePlacement = (value: "week" | "outside") => {
    setPlacement(value);
    setLocation(value === "week" && isReadAloud ? "page" : "");
    if (value === "outside") {
      setWeek("");
      setPageNumber("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!band) return setError("Please choose which level the book is from.");
    if (!book) return setError("Please choose which book it is.");
    if (!placement) return setError("Please tell us where in the book it is.");
    if (placement === "week" && !isReadAloud && !location) return setError("Please choose the day.");
    if (placement === "week" && !isReadAloud && !week) return setError("Please choose the week.");
    if (placement === "week" && isReadAloud && !pageNumber) return setError("Please give the page number.");
    if (placement === "outside" && !location) return setError("Please choose where in the book it is.");
    if (description.trim().length < 10) return setError("Please tell us a little more about what looks wrong.");

    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("submit-curriculum-correction", {
        body: {
          band,
          book,
          week: placement === "week" && !isReadAloud ? Number(week) : null,
          location: placement === "week" ? (isReadAloud ? "page" : location) : location,
          pageNumber: pageNumber ? Number(pageNumber) : null,
          description: description.trim(),
          reporterName: name.trim() || null,
          reporterEmail: email.trim() || null,
          pageUrl: typeof window !== "undefined" ? window.location.href : null,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setDone(true);
    } catch (err: unknown) {
      setError(await visitorFacingError(err, FORM_ERROR_FALLBACK));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="max-w-md mx-auto text-center py-8">
        <p className="font-serif text-2xl mb-3" style={{ color: "hsl(var(--eden-bark))" }}>Thank you. I have it.</p>
        <p className="font-body text-muted-foreground leading-relaxed">
          I read every one of these myself. If it turns out to be our mistake, the fix is listed on this page, and
          if you left your email I will write back either way.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-5">
      <div>
        <label className={labelClass} htmlFor="correction-band">Which level</label>
        <select
          id="correction-band"
          value={band}
          onChange={(e) => setBand(e.target.value)}
          className={inputClass}
        >
          <option value="">Choose a level</option>
          {BANDS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
        </select>
      </div>

      {band && (
        <div>
          <label className={labelClass} htmlFor="correction-book">Which book</label>
          <select
            id="correction-book"
            value={book}
            onChange={(e) => chooseBook(e.target.value as Book)}
            className={inputClass}
          >
            <option value="">Choose a book</option>
            {BOOKS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </div>
      )}

      {book && (
        <div>
          <label className={labelClass} htmlFor="correction-placement">Where in the book</label>
          <select
            id="correction-placement"
            value={placement}
            onChange={(e) => choosePlacement(e.target.value as "week" | "outside")}
            className={inputClass}
          >
            <option value="">Choose one</option>
            <option value="week">{isReadAloud ? "Inside a story" : "Inside a week"}</option>
            <option value="outside">The front, the back, or the cover</option>
          </select>
        </div>
      )}

      {placement === "week" && !isReadAloud && book && (
        <>
          <div>
            <label className={labelClass} htmlFor="correction-week">Which week</label>
            <select
              id="correction-week"
              value={week}
              onChange={(e) => setWeek(e.target.value)}
              className={inputClass}
            >
              <option value="">Choose a week</option>
              {WEEKS.map((w) => <option key={w} value={w}>Week {w}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="correction-day">Which page</label>
            <select
              id="correction-day"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={inputClass}
            >
              <option value="">Choose a page</option>
              {WEEK_PAGES[book as Book].map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </>
      )}

      {placement === "week" && isReadAloud && (
        <div>
          <label className={labelClass} htmlFor="correction-page">Page number</label>
          <input
            id="correction-page"
            type="number"
            min="1"
            max="999"
            value={pageNumber}
            onChange={(e) => setPageNumber(e.target.value)}
            className={inputClass}
            placeholder="The number printed at the bottom of the page"
          />
        </div>
      )}

      {placement === "outside" && (
        <div>
          <label className={labelClass} htmlFor="correction-where">Which part</label>
          <select
            id="correction-where"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className={inputClass}
          >
            <option value="">Choose one</option>
            {OUTSIDE_PAGES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      )}

      {placement && (
        <>
          <div>
            <label className={labelClass} htmlFor="correction-description">What looks wrong</label>
            <textarea
              id="correction-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={8}
              maxLength={5000}
              className={inputClass}
              placeholder="Tell me what you are seeing and what you expected instead. Quote the line if you can. There is no such thing as too much detail here."
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="correction-name">Your name (optional)</label>
            <input
              id="correction-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Your name"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="correction-email">Your email (optional, if you would like a reply)</label>
            <input
              id="correction-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="your@email.com"
            />
          </div>
          {error && <p className="font-body text-sm text-destructive">{error}</p>}
          <Button variant="eden" size="xl" className="w-full" disabled={loading}>
            {loading ? "Sending…" : "Send this to Camila"}
          </Button>
          <p className="text-center font-body text-xs text-muted-foreground/70">
            A real person reads every one of these.
          </p>
        </>
      )}
    </form>
  );
}
