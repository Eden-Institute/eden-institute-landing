// Single React island that owns the Eden's Table waitlist modal for the
// Astro /homeschool page. All the CTA buttons on the page are STATIC HTML
// (rendered by Astro for SEO) carrying data-waitlist-* attributes; this
// controller wires their clicks to open the shared modal with the right
// per-CTA config (reserve / sprouts_magnet / seedlings_magnet).
//
// client:only — the WaitlistModal imports the Supabase client, which touches
// localStorage at module load, so this must never run during the static build.
// The modal is closed on first paint anyway (no SEO value).

import { useEffect, useState } from "react";
import WaitlistModal from "@/components/landing/WaitlistModal";
import { HOMESCHOOL_AUDIENCE_ID } from "../../lib/freeWeekModal";

// Eden's Table waitlist audience (web/lib/freeWeekModal.ts). The resend-waitlist
// EF maps it to entry_funnel='edens_table'; the per-CTA `source` tag drives
// band-specific nurture routing.
const HS_AUD = HOMESCHOOL_AUDIENCE_ID;

interface Cfg {
  title: string;
  subtitle?: string;
  ctaHref?: string;
  ctaLabel?: string;
  ctaBlurb?: string;
  submitLabel?: string;
  successMessage?: string;
  successSubtitle?: string;
  source: string;
  /** GA4 form_name (data-waitlist-form-name); WaitlistModal falls back to source. */
  formName?: string;
}

export default function WaitlistController() {
  const [open, setOpen] = useState(false);
  // 2026-09-12: was "reserve", which routes to the Founders Club welcome and
  // its "preorders are open, $249 for the first 500 kits" copy. Preorders are
  // closed, so a trigger element that forgets data-waitlist-source must not be
  // able to send that. "waitlist" falls through to the plain homeschool welcome.
  const [cfg, setCfg] = useState<Cfg>({ title: "", source: "waitlist" });

  useEffect(() => {
    const buttons = Array.from(
      document.querySelectorAll<HTMLElement>("[data-waitlist-source]"),
    );
    const cleanups = buttons.map((el) => {
      const onClick = () => {
        setCfg({
          source: el.getAttribute("data-waitlist-source") || "waitlist",
          formName: el.getAttribute("data-waitlist-form-name") || undefined,
          title: el.getAttribute("data-waitlist-title") || "",
          subtitle: el.getAttribute("data-waitlist-subtitle") || undefined,
          ctaHref: el.getAttribute("data-waitlist-cta-href") || undefined,
          ctaLabel: el.getAttribute("data-waitlist-cta-label") || undefined,
          ctaBlurb: el.getAttribute("data-waitlist-cta-blurb") || undefined,
          // Free-week wording (web/lib/freeWeekModal.ts). Absent attribute = old
          // wording. successSubtitle reads hasAttribute because "" is meaningful:
          // it hides the subtitle once the address is in.
          submitLabel: el.getAttribute("data-waitlist-submit-label") || undefined,
          successMessage: el.getAttribute("data-waitlist-success-message") || undefined,
          successSubtitle: el.hasAttribute("data-waitlist-success-subtitle")
            ? el.getAttribute("data-waitlist-success-subtitle") ?? ""
            : undefined,
        });
        setOpen(true);
      };
      el.addEventListener("click", onClick);
      return () => el.removeEventListener("click", onClick);
    });
    return () => cleanups.forEach((c) => c());
  }, []);

  return (
    <WaitlistModal
      open={open}
      onOpenChange={setOpen}
      audienceId={HS_AUD}
      title={cfg.title}
      subtitle={cfg.subtitle}
      successCtaHref={cfg.ctaHref}
      successCtaLabel={cfg.ctaLabel}
      successCtaBlurb={cfg.ctaBlurb}
      submitLabel={cfg.submitLabel}
      successMessage={cfg.successMessage}
      formName={cfg.formName}
      successSubtitle={cfg.successSubtitle}
      source={cfg.source}
    />
  );
}
