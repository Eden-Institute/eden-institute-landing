import { useState } from "react";
import { Button } from "@/components/ui/button";
import bookCover from "@/assets/back-to-eden-cover.jpg";
import WaitlistModal from "./WaitlistModal";

const COURSE_AUDIENCE_ID = "4860c1c5-8e2b-4d02-838a-60ef09b789bf";

const books = [
  {
    title: "Back to Eden: A Biblical Foundation for Herbal Healing",
    author: "Camila Johnson",
    status: "Available Now",
    description:
      "The foundational text restoring herbal medicine to its theological and constitutional roots. This volume establishes the scriptural basis for plant medicine, the doctrine of signatures, and the framework for reading the body before reaching for the herb.",
    available: true,
    link: "https://www.amazon.com/dp/B0GPW5BZ32",
  },
  {
    title: "Constitution & Terrain",
    status: "Coming Soon",
    description:
      "A deep exploration of the constitutional axes — temperature, fluid, and tone — and how terrain assessment informs every herbal decision.",
    available: false,
  },
  {
    title: "Biblical Clinical Herbalism",
    status: "Coming Soon",
    description:
      "The clinical application text. System-by-system herbal protocols grounded in constitutional matching, energetic assessment, and a scriptural framework.",
    available: false,
  },
];

const BooksSection = () => {
  const [courseModal, setCourseModal] = useState(false);

  return (
    <section className="section-padding-lg bg-secondary">
      <div className="eden-container">
        <p className="font-accent text-sm tracking-[0.3em] uppercase gold-text mb-4 text-center">
          The Library
        </p>
        <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-foreground text-center mb-4">
          The Back to Eden Series
        </h2>
        <div className="eden-divider" />

        <div className="grid lg:grid-cols-2 gap-16 mt-16 items-start">
          {/* Book image */}
          <div className="flex justify-center lg:sticky lg:top-24">
            <a href="https://www.amazon.com/dp/B0GPW5BZ32" target="_blank" rel="noopener noreferrer">
              <img
                src={bookCover}
                alt="Back to Eden: A Biblical Foundation for Herbal Healing by Camila Johnson"
                className="w-72 md:w-80 shadow-2xl border border-border hover:shadow-eden-gold/20 transition-shadow duration-500"
              />
            </a>
          </div>

          {/* Books list */}
          <div className="space-y-10">
            {books.map((book, i) => (
              <div key={i} className="border-b border-border pb-10 last:border-0">
                <div className="flex items-start justify-between gap-4 mb-1">
                  <h3 className="font-serif text-xl md:text-2xl font-semibold text-foreground">
                    {book.title}
                  </h3>
                  <span className={`font-accent text-xs tracking-[0.2em] uppercase whitespace-nowrap mt-2 ${book.available ? 'gold-text' : 'text-muted-foreground'}`}>
                    {book.status}
                  </span>
                </div>
                {book.author && (
                  <p className="font-accent text-sm text-muted-foreground italic mb-3">
                    by {book.author}
                  </p>
                )}
                <p className="font-body text-base text-muted-foreground leading-relaxed mb-4">
                  {book.description}
                </p>
                {book.available && (
                  <a href={book.link} target="_blank" rel="noopener noreferrer">
                    <Button variant="eden" size="lg">
                      → Purchase Book One
                    </Button>
                  </a>
                )}
              </div>
            ))}

            {/* Course waitlist woven in */}
            <div className="pt-2">
              <p className="font-body text-base italic text-foreground/70 mb-2">
                More volumes coming. Be the first to know.
              </p>
              <button
                onClick={() => setCourseModal(true)}
                className="font-accent text-sm tracking-wider uppercase transition-colors hover:opacity-80"
                style={{ color: "#C9A84C" }}
              >
                → Join the Course Waitlist
              </button>
            </div>
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
