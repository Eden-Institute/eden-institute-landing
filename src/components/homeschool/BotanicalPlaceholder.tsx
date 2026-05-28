/**
 * BotanicalPlaceholder — brand-appropriate fallback for product cards and
 * the hero composite when a real mockup PNG isn't available yet.
 *
 * Used in two scenarios:
 *  1. Garden Journal + Family Devotional (no Canva master exists yet — these
 *     are in launch scope but production hasn't built the masters; per
 *     Camila's Option 1 disposition, ship with placeholder and build the
 *     masters before July 15 content lock).
 *  2. onError fallback inside ProductMockup — if any image path 404s, the
 *     card degrades gracefully to this placeholder rather than showing a
 *     browser broken-image icon.
 *
 * Design: hand-rolled SVG sprig of botanical line art (sage stroke on
 * cream-warm background) with the spec-aligned "Mockup coming July 22,
 * 2026" caption. Reads as Eden-brand, not stock filler.
 */
export interface BotanicalPlaceholderProps {
  /** Optional product name shown in small caption above the date line. */
  productName?: string;
  /** Override the date line (e.g., for the GJ/FD permanent-placeholder case). */
  captionOverride?: string;
}

export default function BotanicalPlaceholder({
  productName,
  captionOverride,
}: BotanicalPlaceholderProps) {
  const caption = captionOverride ?? "Mockup coming July 22, 2026";

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center px-6 py-8"
      style={{ backgroundColor: "hsl(var(--cream-warm))" }}
      role="img"
      aria-label={`${productName ?? "Product"} — ${caption}`}
    >
      <svg
        viewBox="0 0 120 140"
        className="w-24 h-28 mb-4"
        aria-hidden="true"
      >
        {/* Central stem */}
        <path
          d="M 60 130 Q 60 90 60 20"
          fill="none"
          stroke="hsl(var(--sage-border))"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        {/* Left leaf cluster (upper) */}
        <path
          d="M 60 50 Q 35 45 25 55 Q 35 50 60 55 Z"
          fill="hsl(var(--sage-border) / 0.18)"
          stroke="hsl(var(--sage-border))"
          strokeWidth="1"
        />
        {/* Right leaf cluster (upper) */}
        <path
          d="M 60 50 Q 85 45 95 55 Q 85 50 60 55 Z"
          fill="hsl(var(--sage-border) / 0.18)"
          stroke="hsl(var(--sage-border))"
          strokeWidth="1"
        />
        {/* Left leaf cluster (lower) */}
        <path
          d="M 60 85 Q 30 80 18 92 Q 32 85 60 90 Z"
          fill="hsl(var(--sage-border) / 0.22)"
          stroke="hsl(var(--sage-border))"
          strokeWidth="1"
        />
        {/* Right leaf cluster (lower) */}
        <path
          d="M 60 85 Q 90 80 102 92 Q 88 85 60 90 Z"
          fill="hsl(var(--sage-border) / 0.22)"
          stroke="hsl(var(--sage-border))"
          strokeWidth="1"
        />
        {/* Crown bud */}
        <circle cx="60" cy="20" r="4" fill="hsl(var(--honey) / 0.6)" />
        <circle cx="60" cy="20" r="2" fill="hsl(var(--honey))" />
      </svg>
      {productName && (
        <p
          className="text-xs font-serif text-center mb-1"
          style={{ color: "hsl(var(--ink))", fontFamily: "var(--font-accent)" }}
        >
          {productName}
        </p>
      )}
      <p
        className="text-[11px] text-center italic"
        style={{ color: "hsl(var(--ink-soft))" }}
      >
        {caption}
      </p>
    </div>
  );
}
