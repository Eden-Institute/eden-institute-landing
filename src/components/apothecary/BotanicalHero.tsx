import type { CSSProperties, ReactNode } from "react";

/**
 * BotanicalHero: the page-top treatment shared by every signed-in Apothecary
 * surface. Same structure as the ApothecaryWelcome hero (#436), the Astro
 * marketing heroes (#433) and the Welcome body bands (#440): a full-colour,
 * public-domain plate from Koehler's Medizinal-Pflanzen (1887) runs the height
 * of the section at 95% multiply, and the words sit on a 92% white panel with
 * a gold hairline. The panel is what keeps type legible over full-colour
 * artwork; #433 measured 0.88 under the AA floor and 0.92 at 4.91:1 worst
 * case, so 0.92 is the number.
 *
 * Two rules for callers, both learned in #430 and #436:
 *   - Eyebrows and small gold text on the panel use --eden-gold-ink, never
 *     --eden-gold, which is 2.51:1 on bare cream and cannot be rescued.
 *   - Each `image` is built at its own section's aspect (see the asset
 *     comments at each call site) so object-cover crops as little as
 *     possible, with the plant mirrored either side of the panel and a centre
 *     copy that survives the phone crop.
 *
 * Under multiply the plate's white paper is a no-op, so the section colour
 * (eden-cream) shows through and only the plant tints it.
 */
interface BotanicalHeroProps {
  /** Composited plate, imported from src/assets/hero-*.jpg. */
  image: string;
  children: ReactNode;
  /** Section rhythm. The default matches the directory-page heroes. */
  className?: string;
  /** Panel width and alignment, e.g. "max-w-4xl text-center". */
  panelClassName?: string;
  panelStyle?: CSSProperties;
  "aria-label"?: string;
}

export function BotanicalHero({
  image,
  children,
  className = "py-12 md:py-16 px-6",
  panelClassName = "max-w-5xl",
  panelStyle,
  "aria-label": ariaLabel,
}: BotanicalHeroProps) {
  return (
    <section
      className={`relative overflow-hidden ${className}`}
      style={{ backgroundColor: "hsl(var(--eden-cream))" }}
      aria-label={ariaLabel}
    >
      <img
        src={image}
        alt=""
        aria-hidden="true"
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
        style={{ opacity: 0.95, mixBlendMode: "multiply" }}
      />
      <div
        className={`relative z-10 mx-auto rounded-lg ${panelClassName}`}
        style={{
          backgroundColor: "hsl(0 0% 100% / 0.92)",
          border: "1px solid hsl(var(--eden-gold) / 0.35)",
          padding: "clamp(26px, 3.5vw, 52px)",
          boxShadow: "0 2px 18px -10px rgba(30,62,46,0.28)",
          ...panelStyle,
        }}
      >
        {children}
      </div>
    </section>
  );
}
