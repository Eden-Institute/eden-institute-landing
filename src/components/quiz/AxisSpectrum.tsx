/**
 * Visual axis-spectrum component for the Pattern of Eden quiz inconclusive
 * screen.
 *
 * Shows three horizontal bars (Temperature, Moisture, Tone) with the user's
 * center-of-mass plotted as a marker. For inconclusive axes (counts tied),
 * the marker sits in the center with a "Balanced — between patterns"
 * annotation.
 *
 * Per Lock #39, this is NOT a Pattern result — it's a visualization of the
 * user's spectrum position so they understand WHY the quiz couldn't resolve
 * them to a Pattern. The framing is "your body sits between patterns" rather
 * than "Pattern Inconclusive" — a positive description of where they are
 * rather than a failure-to-resolve.
 */

import type { AxisCounts } from "@/lib/constitution-data";

interface AxisSpectrumProps {
  counts: AxisCounts;
}

interface AxisRowProps {
  axisLabel: string;
  leftLabel: string;
  rightLabel: string;
  leftCount: number;
  rightCount: number;
  total: number;
}

function AxisRow({
  axisLabel,
  leftLabel,
  rightLabel,
  leftCount,
  rightCount,
  total,
}: AxisRowProps) {
  // Position is 0..1 from left to right.
  // 0 = all leftCount, 1 = all rightCount, 0.5 = balanced.
  // Neutrals are weighted toward the center.
  const position =
    total === 0
      ? 0.5
      : (rightCount + (total - leftCount - rightCount) / 2) / total;

  const isBalanced = leftCount === rightCount;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span
          className="font-accent text-xs tracking-[0.2em] uppercase"
          style={{ color: "#C9A84C" }}
        >
          {axisLabel}
        </span>
        {isBalanced && (
          <span
            className="font-accent text-[10px] tracking-[0.2em] uppercase italic"
            style={{ color: "hsl(30, 10%, 40%)" }}
          >
            Balanced — between patterns
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span
          className="font-body text-sm font-semibold w-16 text-right"
          style={{ color: "#1C3A2E" }}
        >
          {leftLabel}
        </span>
        <div
          className="flex-1 h-3 rounded-full relative"
          style={{ backgroundColor: "hsl(40, 20%, 88%)" }}
        >
          {/* Center tick */}
          <div
            className="absolute top-0 bottom-0 w-px"
            style={{ left: "50%", backgroundColor: "hsl(40, 20%, 70%)" }}
          />
          {/* Marker */}
          <div
            className="absolute w-4 h-4 rounded-full border-2 transition-all"
            style={{
              left: `calc(${position * 100}% - 0.5rem)`,
              top: "calc(50% - 0.5rem)",
              backgroundColor: "#1C3A2E",
              borderColor: "#C9A84C",
            }}
          />
        </div>
        <span
          className="font-body text-sm font-semibold w-16 text-left"
          style={{ color: "#1C3A2E" }}
        >
          {rightLabel}
        </span>
      </div>
      <div className="flex items-center justify-between mt-1 px-[4.75rem]">
        <span
          className="font-body text-xs"
          style={{ color: "hsl(30, 10%, 40%)" }}
        >
          {leftCount} of {total}
        </span>
        <span
          className="font-body text-xs"
          style={{ color: "hsl(30, 10%, 40%)" }}
        >
          {rightCount} of {total}
        </span>
      </div>
    </div>
  );
}

export function AxisSpectrum({ counts }: AxisSpectrumProps) {
  return (
    <div className="space-y-8">
      <AxisRow
        axisLabel="Temperature"
        leftLabel="Hot"
        rightLabel="Cold"
        leftCount={counts.temperature.hot}
        rightCount={counts.temperature.cold}
        total={counts.temperature.total}
      />
      <AxisRow
        axisLabel="Moisture"
        leftLabel="Damp"
        rightLabel="Dry"
        leftCount={counts.fluid.damp}
        rightCount={counts.fluid.dry}
        total={counts.fluid.total}
      />
      <AxisRow
        axisLabel="Tone"
        leftLabel="Tense"
        rightLabel="Relaxed"
        leftCount={counts.tone.tense}
        rightCount={counts.tone.relaxed}
        total={counts.tone.total}
      />
    </div>
  );
}

export default AxisSpectrum;
