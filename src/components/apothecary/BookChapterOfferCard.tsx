// Back to Eden's free Chapter 1 on the app monograph (2026-11-16, Lane SEO funnel fix).
// Same heading, line, button and pop-up wording as the /herbs/<slug> page
// (web/lib/bookChapterOffer.ts): the button opens WaitlistModal with source
// back_to_eden_ch1, so resend-waitlist sends the chapter exactly as it does from
// /back-to-eden, and a sign-up reports email_submit with form_name monograph_bte_ch1.

import { useState } from "react";
import WaitlistModal from "@/components/landing/WaitlistModal";
import { HOMESCHOOL_AUDIENCE_ID } from "../../../web/lib/freeWeekModal";
import {
  BACK_TO_EDEN_CH1_ATTRS as CH1,
  BOOK_OFFER_BUTTON,
  BOOK_OFFER_HEADING,
  BOOK_OFFER_LINE,
  bookOfferCta,
  bookOfferFormName,
} from "../../../web/lib/bookChapterOffer";

export function BookChapterOfferCard() {
  const [open, setOpen] = useState(false);

  return (
    <section
      className="p-6 border rounded-lg"
      style={{ backgroundColor: "hsl(var(--eden-cream))", borderColor: "hsl(var(--eden-gold) / 0.35)" }}
      aria-label="Free Chapter 1 of Back to Eden"
    >
      <p className="font-serif text-xl font-bold mb-2" style={{ color: "hsl(var(--eden-bark))" }}>
        {BOOK_OFFER_HEADING}
      </p>
      <p className="font-body text-sm text-muted-foreground leading-relaxed mb-4">{BOOK_OFFER_LINE}</p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-cta={bookOfferCta("monograph")}
          className="font-body text-sm font-semibold rounded-md px-5 py-3 min-h-[48px] w-full sm:w-auto"
          style={{ backgroundColor: "hsl(var(--eden-forest))", color: "hsl(var(--eden-parchment))" }}
        >
          {BOOK_OFFER_BUTTON}
        </button>
      </div>
      <p className="font-body text-xs text-muted-foreground mt-3">
        Or see{" "}
        <a href="/back-to-eden" className="underline" data-cta={`${bookOfferCta("monograph")}-page`}>
          the book
        </a>
        .
      </p>
      <WaitlistModal
        open={open}
        onOpenChange={setOpen}
        audienceId={HOMESCHOOL_AUDIENCE_ID}
        source={CH1["data-waitlist-source"]}
        formName={bookOfferFormName("monograph")}
        title={CH1["data-waitlist-title"]}
        subtitle={CH1["data-waitlist-subtitle"]}
        successCtaHref={CH1["data-waitlist-cta-href"]}
        successCtaLabel={CH1["data-waitlist-cta-label"]}
        successCtaBlurb={CH1["data-waitlist-cta-blurb"]}
      />
    </section>
  );
}
