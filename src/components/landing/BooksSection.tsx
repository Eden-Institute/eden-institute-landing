import { useState } from "react";
import { Button } from "@/components/ui/button";
import bookCover from "@/assets/back-to-eden-cover.jpg";
import WaitlistModal from "./WaitlistModal";

const COURSE_AUDIENCE_ID = "4860c1c5-8e2b-4d02-838a-60ef09b789bf";

const books = [
  {
    title: "Back to Eden: A Biblical Foundation for Herbal Healing",
    label: "AVAILABLE NOW",
    labelActive: true,
    summary:
      "The foundational text restoring herbal medicine to its theological and constitutional roots. Establishes the scriptural basis for plant medicine, the doctrine of signatures, and the framework for reading the body before reaching for the herb.",
    action: "purchase" as const,
    link: "https://www.amazon.com/dp/B0GPW5BZ32",
  },
  {
    title: "Constitution & Terrain",
    label: "COMING SOON",
    labelActive: false,
    summary:
      "A deep exploration of the constitutional axes — temperature, fluid, and tone — and how terrain assessment informs every herbal decision. The practitioner's guide to pattern recognition.",
    action: "waitlist" as const,
  },
  {
    title: "Biblical Clinical Herbalism",
    label: "COMING SOON",
    labelActive: false,
    summary:
      "The clinical application text. System-by-system herbal protocols grounded in constitutional matching, energetic assessment, and a scriptural framework for stewarding health.",
    action: "none" as const,
  },
];

const BooksSection = () => {
  const [courseModal, setCourseModal] = useState(false);

  return (
    <section id="books" className="section-padding-lg bg-secondary">
      <div className="eden-container">
        <p className="font-accent text-sm tracking-[0.3em] uppercase gold-text mb-4 text-center">
          THE LIBRARY
        </p>
        <h2 className="font-serif text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold text-foreground text-center mb-2">
          The Back to Eden Series
        </h2>
        <p className="font-body text-base md:text-lg text-muted-foreground text-center max-w-2xl mx-auto mb-4">
          A complete framework for biblical herbal medicine — from theological foundation to clinical practice.
        </p>
        <div className="eden-divider" />

        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 mt-10 md:mt-16 items-start">
          {/* Book cover image */}
          <div className="flex justify-center lg:sticky lg:top-24">
            <a href="https://www.amazon.com/dp/B0GPW5BZ32" target="_blank" rel="noopener noreferrer">
              <img
                src={bookCover}
                alt="Back to Eden: A Biblical Foundation for Herbal Healing by Camila Johnson"
                className="w-56 md:w-72 lg:w-80 shadow-2xl border border-border hover:shadow-eden-gold/20 transition-shadow duration-500"
              />
            </a>
          </div>

          {/* Books list */}
          <div className="space-y-8 md:space-y-10">
            {books.map((book, i) => (
              <div key={i} className="border-b border-border pb-8 md:pb-10 last:border-0">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 mb-1">
                  <h3 className="font-serif text-xl md:text-2xl font-semibold text-foreground">
                    {book.title}
                  </h3>
                  <span
                    className={`font-accent text-xs tracking-[0.2em] uppercase whitespace-nowrap ${
                      book.labelActive ? "gold-text" : "text-muted-foreground"
                    }`}
                  >
                    {book.label}
                  </span>
                </div>
                <p className="font-body text-base text-muted-foreground leading-relaxed mb-4">
                  {book.summary}
                </p>
                {book.action === "purchase" && (
                  <a href={book.link} target="_blank" rel="noopener noreferrer" className="block">
                    <Button variant="eden" size="lg" className="w-full md:w-auto">
                      → Purchase Book One
                    </Button>
                  </a>
                )}
                {book.action === "waitlist" && (
                  <Button
                    variant="eden-outline"
                    size="lg"
                    className="w-full md:w-auto"
                    onClick={() => setCourseModal(true)}
                  >
                    → Join the Waitlist
                  </Button>
                )}
                {book.action === "none" && (
                  <p className="font-body text-sm italic text-foreground/60">
                    Notify me when available —{" "}
                    <button
                      onClick={() => setCourseModal(true)}
                      className="underline hover:opacity-80 transition-opacity not-italic"
                      style={{ color: "#C9A84C" }}
                    >
                      join the waitlist above
                    </button>
                    .
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <WaitlistModal
        open={courseModal}
        onOpenChange={setCourseModal}
        audienceId={COURSE_AUDIENCE_ID}
        title="Join the Foundations Course Waitlist"
      />
    </section>
  );
};

export default BooksSection;
