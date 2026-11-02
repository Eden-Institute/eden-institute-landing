// The free-week offer on the app monograph (2026-10-28, analytics and search
// developer prompt, task 18). Same heading, line, buttons and pop-up as the
// /herbs/<slug> page (web/lib/freeWeekOffer.ts): the buttons open WaitlistModal with
// FREE_WEEK_MODAL's wording, and a sign-up reports email_submit with form_name
// herb_sprouts_week1 or herb_seedlings_week1.

import { useState } from "react";
import WaitlistModal from "@/components/landing/WaitlistModal";
import { FREE_WEEK_MODAL, HOMESCHOOL_AUDIENCE_ID } from "../../../web/lib/freeWeekModal";
import {
  FREE_WEEK_BUTTON_LABELS,
  FREE_WEEK_OFFER_HEADING,
  FREE_WEEK_OFFER_LINE,
  freeWeekFormName,
  type FreeWeekBand,
} from "../../../web/lib/freeWeekOffer";

const BANDS: FreeWeekBand[] = ["sprouts", "seedlings"];

export function FreeWeekOfferCard() {
  const [band, setBand] = useState<FreeWeekBand | null>(null);
  const m = band ? FREE_WEEK_MODAL[band] : null;

  return (
    <section
      className="p-6 border rounded-lg"
      style={{ backgroundColor: "hsl(var(--eden-cream))", borderColor: "hsl(var(--eden-gold) / 0.35)" }}
      aria-label="Free Week 1 of Eden's Table"
    >
      <p className="font-serif text-xl font-bold mb-2" style={{ color: "hsl(var(--eden-bark))" }}>
        {FREE_WEEK_OFFER_HEADING}
      </p>
      <p className="font-body text-sm text-muted-foreground leading-relaxed mb-4">{FREE_WEEK_OFFER_LINE}</p>
      <div className="flex flex-col sm:flex-row gap-3">
        {BANDS.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setBand(b)}
            data-cta={`monograph-${b}-free`}
            className="font-body text-sm font-semibold rounded-md px-5 py-3 min-h-[48px] w-full sm:w-auto"
            style={{ backgroundColor: "hsl(var(--eden-forest))", color: "hsl(var(--eden-parchment))" }}
          >
            {FREE_WEEK_BUTTON_LABELS[b]}
          </button>
        ))}
      </div>
      <p className="font-body text-xs text-muted-foreground mt-3">
        Or see both on{" "}
        <a href="/freebies" className="underline" data-cta="monograph-freebies">
          the free samples page
        </a>
        .
      </p>
      {m && band && (
        <WaitlistModal
          open={band !== null}
          onOpenChange={(open) => !open && setBand(null)}
          audienceId={HOMESCHOOL_AUDIENCE_ID}
          source={m.source}
          formName={freeWeekFormName("herb", band)}
          title={m.title}
          subtitle={m.subtitle}
          submitLabel={m.submitLabel}
          successMessage={m.successMessage}
          successSubtitle={m.successSubtitle}
          successCtaHref="/homeschool"
          successCtaLabel="See the full year"
        />
      )}
    </section>
  );
}
