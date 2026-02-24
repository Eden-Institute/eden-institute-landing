import { Button } from "@/components/ui/button";
import bookCover from "@/assets/book-cover.jpg";

const books = [
  {
    title: "Back to Eden: A Biblical Foundation for Herbal Healing",
    status: "Available Now",
    description:
      "The foundational text restoring herbal medicine to its theological and constitutional roots. This volume establishes the scriptural basis for plant medicine, the doctrine of signatures, and the framework for reading the body before reaching for the herb.",
    available: true,
  },
  {
    title: "Constitution & Terrain",
    status: "Coming Soon",
    description:
      "A deep exploration of the constitutional axes — temperature, fluid, and tone — and how terrain assessment informs every herbal decision. The practitioner's guide to pattern recognition.",
    available: false,
  },
  {
    title: "Biblical Clinical Herbalism",
    status: "Coming Soon",
    description:
      "The clinical application text. System-by-system herbal protocols grounded in constitutional matching, energetic assessment, and a scriptural framework for stewarding health.",
    available: false,
  },
];

const BooksSection = () => {
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
            <img
              src={bookCover}
              alt="Back to Eden book"
              className="w-72 md:w-80 shadow-2xl border border-border"
            />
          </div>

          {/* Books list */}
          <div className="space-y-10">
            {books.map((book, i) => (
              <div key={i} className="border-b border-border pb-10 last:border-0">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h3 className="font-serif text-xl md:text-2xl font-semibold text-foreground">
                    {book.title}
                  </h3>
                  <span className={`font-accent text-xs tracking-[0.2em] uppercase whitespace-nowrap mt-2 ${book.available ? 'gold-text' : 'text-muted-foreground'}`}>
                    {book.status}
                  </span>
                </div>
                <p className="font-body text-base text-muted-foreground leading-relaxed mb-4">
                  {book.description}
                </p>
                {book.available ? (
                  <Button variant="eden" size="lg">
                    → Purchase Book One
                  </Button>
                ) : (
                  <Button variant="eden-outline" size="lg">
                    → Join Waitlist
                  </Button>
                )}
              </div>
            ))}

            <div className="pt-4">
              <Button variant="eden-gold" size="lg">
                → Join Book Release List
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BooksSection;
