import { HAT_COLOR_MAP, type HatName } from "@/lib/homeschool/data";

/**
 * HatBadge — color-coded pill used on every product card (§6) and on the
 * HAT Framework grid (§7).
 *
 * Color mapping lives in src/lib/homeschool/data.ts so the same source of
 * truth backs the product cards, the framework grid, and any future surface
 * that mentions HATs (e.g., FAQ §12 question #1).
 *
 * Sizing: spec calls for 11px uppercase letterspaced. Min-height 24px keeps
 * the pill above the WCAG 2.5.5 target-size advisory; the badge is read-only
 * here (not a tap target), but stays comfortable on touch surfaces anyway.
 */
export interface HatBadgeProps {
  hat: HatName;
  /** Compact: smaller padding for the product-card row where 4+ badges stack. */
  compact?: boolean;
}

export default function HatBadge({ hat, compact = false }: HatBadgeProps) {
  const { label, cssVar } = HAT_COLOR_MAP[hat];
  return (
    <span
      className={`inline-flex items-center rounded-full font-sans uppercase tracking-[0.12em] ${
        compact ? "text-[10px] px-2 py-0.5" : "text-[11px] px-3 py-1"
      }`}
      style={{
        backgroundColor: `hsl(var(${cssVar}) / 0.12)`,
        color: `hsl(var(${cssVar}))`,
        border: `1px solid hsl(var(${cssVar}) / 0.35)`,
      }}
    >
      {label}
    </span>
  );
}
