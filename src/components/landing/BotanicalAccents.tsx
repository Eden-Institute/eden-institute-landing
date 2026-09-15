/**
 * Decorative gold divider (the botanical leaf line-art was removed 2026-09-15 at the founder's request).
 * Pure visual component — no functional logic.
 */

export const GoldDivider = () => (
  <div className="w-full flex items-center justify-center py-1">
    <div className="flex items-center gap-3 w-full max-w-2xl mx-auto px-6">
      <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, transparent, hsl(var(--eden-gold)))" }} />
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="flex-shrink-0" style={{ color: "hsl(var(--eden-gold))" }}>
        <path d="M10 2 L12 8 L18 10 L12 12 L10 18 L8 12 L2 10 L8 8Z" stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.15" />
      </svg>
      <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, hsl(var(--eden-gold)), transparent)" }} />
    </div>
  </div>
);
