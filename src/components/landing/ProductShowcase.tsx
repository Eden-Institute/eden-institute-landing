// src/components/landing/ProductShowcase.tsx
//
// Interactive product reveal component for the /homeschool page.
// Five instances render below the Three Pillars section to show what the
// homeschool mother actually gets inside each Sprouts/Seedlings box:
//   1. Teacher Guide (6 pages, Wk 2 Chamomile example)
//   2. Student Notebook (5 pages, Seedlings Wk 1 Elderberry example)
//   3. Herb Field Cards (front + back, Sprouts Chamomile example)
//   4. Recipe Cards (front + back, Sprouts Chamomile Tea example)
//   5. Around the Table (Faith F+B + Family F+B, Sprouts Wk 2 example)
//
// Behavior:
//   - Mobile (<md): image stacks above copy panel; swipe gesture advances
//     (Embla handles touch natively); arrows hidden; page indicator "N of M"
//     centered between image and copy.
//   - Desktop (>=md): image left half, copy panel right half, arrows flank
//     the image, page indicator below the arrows.
//   - No autoplay anywhere. Reader controls the reveal.
//   - No CTAs inside the carousel — primary + optional secondary CTA render
//     BELOW the closing pull-quote, OUTSIDE the carousel container.
//   - Specs panel (optional, used by FC/RC/ATT showcases) renders below the
//     CTAs as a centered small-text block with a top divider.
//
// Built on the existing shadcn/Embla Carousel primitive at
// src/components/ui/carousel.tsx — no new dependencies.

import { useEffect, useState } from "react";
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";

export interface ProductShowcaseSlide {
  src: string;
  alt: string;
  label: string;
  body: string;
}

export interface ProductShowcaseProps {
  anchorId: string;
  eyebrow: string;
  title: string;
  subhead: string;
  slides: ProductShowcaseSlide[];
  pullQuote: string;
  primaryCta: {
    label: string;
    onClick: () => void;
  };
  secondaryCta?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  specs?: string;
}

export default function ProductShowcase({
  anchorId,
  eyebrow,
  title,
  subhead,
  slides,
  pullQuote,
  primaryCta,
  secondaryCta,
  specs,
}: ProductShowcaseProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const total = slides.length;

  // Subscribe to the Embla "select" event to keep the page indicator in sync
  // with whichever slide the reader has advanced to. Embla emits "select"
  // after any user-driven nav (arrow, swipe, keyboard, programmatic).
  useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  return (
    <section
      id={anchorId}
      className="py-16 md:py-20 px-6"
      style={{ backgroundColor: "hsl(var(--background))" }}
      aria-labelledby={`${anchorId}-heading`}
    >
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-10">
          <p
            className="font-accent text-sm tracking-[0.3em] uppercase mb-3"
            style={{ color: "hsl(var(--eden-gold))" }}
          >
            {eyebrow}
          </p>
          <h2
            id={`${anchorId}-heading`}
            className="font-serif text-3xl md:text-4xl font-bold mb-4"
            style={{ color: "hsl(var(--eden-bark))" }}
          >
            {title}
          </h2>
          <p className="font-body text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            {subhead}
          </p>
        </div>

        {/* Carousel — image + copy panel per slide */}
        <Carousel
          setApi={setApi}
          opts={{
            align: "start",
            loop: false,
          }}
          className="max-w-5xl mx-auto"
        >
          <CarouselContent>
            {slides.map((slide, idx) => (
              <CarouselItem key={idx}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 items-center">
                  {/* Image — left on desktop, top on mobile */}
                  <div className="rounded-lg overflow-hidden shadow-sm bg-white">
                    <img
                      src={slide.src}
                      alt={slide.alt}
                      loading={idx === 0 ? "eager" : "lazy"}
                      className="w-full h-auto object-contain"
                    />
                  </div>

                  {/* Copy panel — right on desktop, bottom on mobile */}
                  <div className="space-y-4">
                    <p
                      className="font-accent text-xs tracking-[0.25em] uppercase"
                      style={{ color: "hsl(var(--eden-sage))" }}
                    >
                      {slide.label}
                    </p>
                    <p
                      className="font-body text-base md:text-lg leading-relaxed"
                      style={{ color: "hsl(var(--foreground))" }}
                    >
                      {slide.body}
                    </p>
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>

          {/* Desktop arrows — hidden on mobile (touch swipe handles it natively).
              The shadcn primitive positions these absolutely with -left-12 /
              -right-12; we override with sm-tier left/right offsets and bump
              to 44px tap target per the mobile-aware mandate. */}
          <CarouselPrevious
            className="hidden md:flex -left-4 lg:-left-12 h-11 w-11"
            aria-label="Previous slide"
          />
          <CarouselNext
            className="hidden md:flex -right-4 lg:-right-12 h-11 w-11"
            aria-label="Next slide"
          />
        </Carousel>

        {/* Page indicator — visible at all viewports */}
        <div className="flex items-center justify-center gap-3 mt-6">
          <span
            className="font-accent text-xs tracking-widest uppercase"
            style={{ color: "hsl(var(--muted-foreground))" }}
            aria-live="polite"
          >
            {current + 1} of {total}
          </span>
          <div className="flex gap-1.5">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => api?.scrollTo(idx)}
                className="h-2 w-2 rounded-full transition-colors"
                style={{
                  backgroundColor:
                    idx === current
                      ? "hsl(var(--eden-gold))"
                      : "hsl(var(--muted-foreground) / 0.3)",
                }}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Closing pull-quote */}
        <blockquote
          className="font-serif text-xl md:text-2xl italic text-center my-10 max-w-3xl mx-auto leading-relaxed"
          style={{ color: "hsl(var(--eden-bark))" }}
        >
          {pullQuote}
        </blockquote>

        {/* CTAs — primary button + optional secondary text link.
            Centered, generous tap targets, no CTA inside the carousel. */}
        <div className="flex flex-col items-center gap-3">
          <Button
            variant="eden"
            size="xl"
            onClick={primaryCta.onClick}
            className="min-w-[280px]"
          >
            {primaryCta.label}
          </Button>
          {secondaryCta &&
            (secondaryCta.href ? (
              <a
                href={secondaryCta.href}
                onClick={secondaryCta.onClick}
                className="font-accent text-sm tracking-wider uppercase underline-offset-4 hover:underline"
                style={{ color: "hsl(var(--eden-gold))" }}
              >
                {secondaryCta.label}
              </a>
            ) : (
              <button
                onClick={secondaryCta.onClick}
                className="font-accent text-sm tracking-wider uppercase underline-offset-4 hover:underline"
                style={{ color: "hsl(var(--eden-gold))" }}
              >
                {secondaryCta.label}
              </button>
            ))}
        </div>

        {/* Specs panel — only for FC, RC, ATT showcases. Small centered
            text with a top divider, max-w-2xl. */}
        {specs && (
          <div
            className="mt-10 pt-6 max-w-2xl mx-auto text-center border-t"
            style={{ borderColor: "hsl(var(--border))" }}
          >
            <p
              className="font-accent text-xs tracking-wider uppercase leading-relaxed"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              {specs}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
