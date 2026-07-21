import { useFontScale, type FontScaleId } from "@/contexts/FontScaleContext";

/**
 * ReadingSizeCard — the reader-facing text-size control.
 *
 * Lives on the Account page beside the other per-reader settings. The choice
 * is applied instantly (no save button) because the control's own label grows
 * as you press it: the preview IS the feedback, and an unapplied "Save" step
 * would hide exactly the thing the reader is trying to judge.
 *
 * Accessibility notes:
 * - Rendered as a radiogroup, not a row of buttons, so a screen reader
 *   announces "Large, 2 of 3" and arrow keys move between options natively.
 * - Each option carries aria-checked; the visual selected state is a border +
 *   background change, never colour alone (colour-blind readers).
 * - The sample line under the control is aria-hidden: it is redundant to the
 *   option labels for a non-visual reader and would just be noise.
 * - Tap targets are min-h-[44px], matching the 44px floor used across the
 *   Apothecary surfaces.
 */
export function ReadingSizeCard() {
  const { scale, setScale, options } = useFontScale();

  return (
    <section
      className="rounded-lg border p-6 space-y-5"
      style={{
        borderColor: "hsl(var(--border))",
        backgroundColor: "hsl(var(--eden-cream) / 0.3)",
      }}
    >
      <div>
        <p
          className="font-accent text-xs tracking-[0.2em] uppercase mb-1"
          style={{ color: "hsl(var(--eden-gold))" }}
        >
          Reading Size
        </p>
        <h2
          className="font-serif text-2xl font-semibold"
          style={{ color: "hsl(var(--eden-bark))" }}
        >
          Text size
        </h2>
        <p className="font-body text-sm text-muted-foreground mt-2">
          Applies across the Apothecary, herb monographs, and your deep-dive
          guide. Your choice is remembered on this device.
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label="Reading text size"
        className="flex flex-wrap gap-3"
      >
        {options.map((option) => {
          const isSelected = option.id === scale;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setScale(option.id as FontScaleId)}
              className="min-h-[44px] rounded-md border px-4 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{
                borderColor: isSelected
                  ? "hsl(var(--eden-gold))"
                  : "hsl(var(--border))",
                backgroundColor: isSelected
                  ? "hsl(var(--eden-gold) / 0.12)"
                  : "transparent",
                color: "hsl(var(--eden-bark))",
              }}
            >
              <span className="font-body block">
                {option.label}
                {isSelected && (
                  <span className="sr-only"> (current reading size)</span>
                )}
              </span>
              <span className="font-body block text-xs text-muted-foreground">
                {option.description}
              </span>
            </button>
          );
        })}
      </div>

      <p
        aria-hidden="true"
        className="font-body text-base leading-relaxed border-t pt-4"
        style={{ borderColor: "hsl(var(--border))" }}
      >
        Marshmallow coats, soothes, and moistens dry tissues throughout the
        body — a sample line at your current reading size.
      </p>
    </section>
  );
}
