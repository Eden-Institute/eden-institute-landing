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

// Eden's Table waitlist audience — same constant the React page uses. The
// resend-waitlist EF maps this audienceId to entry_funnel='edens_table';
// the per-CTA `source` tag drives band-specific nurture routing.
const HS_AUD = "a48cb66e-b2a9-461d-98a6-bb1b12f72693";

interface Cfg {
  title: string;
  subtitle?: string;
  source: string;
}

export default function WaitlistController() {
  const [open, setOpen] = useState(false);
  const [cfg, setCfg] = useState<Cfg>({ title: "", source: "reserve" });

  useEffect(() => {
    const buttons = Array.from(
      document.querySelectorAll<HTMLElement>("[data-waitlist-source]"),
    );
    const cleanups = buttons.map((el) => {
      const onClick = () => {
        setCfg({
          source: el.getAttribute("data-waitlist-source") || "waitlist",
          title: el.getAttribute("data-waitlist-title") || "",
          subtitle: el.getAttribute("data-waitlist-subtitle") || undefined,
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
      source={cfg.source}
    />
  );
}
