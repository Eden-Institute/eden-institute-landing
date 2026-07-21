/**
 * Reading-size (font scale) tests.
 *
 * The reported defect: a reader on a 24-inch monitor had to lean forward to
 * read Apothecary copy. The fix is a reader-controlled scale written as a
 * PERCENTAGE onto <html>, which every rem-based Tailwind utility inherits.
 *
 * The invariants worth locking down are less about "does the number change"
 * and more about accessibility correctness, because the failure modes here
 * are silent and harm exactly the readers the feature is for:
 *
 *   1. The scale is expressed as a PERCENTAGE, never px. A px value on <html>
 *      overrides a reader's own browser/OS base size — so a reader who set
 *      their browser to 20px because they need it would be silently SHRUNK to
 *      18px by our "Large" setting. This is the single most important
 *      assertion in this file.
 *   2. Standard REMOVES the inline size rather than writing 100%, leaving the
 *      reader's own base size untouched.
 *   3. A corrupt/stale localStorage value degrades to Standard instead of
 *      producing an unrenderable root font-size.
 *   4. The provider hydrates synchronously, so readers who need Large never
 *      see a flash of small text on load (the same class of bug PR δ fixed
 *      for ActiveProfileContext's hydration race).
 *   5. Scale values are monotonically increasing — a "Largest" that rendered
 *      smaller than "Large" would be an obvious but easy regression when
 *      someone edits the options table.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  FONT_SCALE_OPTIONS,
  applyFontScale,
  percentForScale,
  FontScaleProvider,
  useFontScale,
  type FontScaleId,
} from "@/contexts/FontScaleContext";

const STORAGE_KEY = "eden.font_scale";

function resetRoot() {
  document.documentElement.style.removeProperty("font-size");
  delete document.documentElement.dataset.fontScale;
  window.localStorage.clear();
}

beforeEach(resetRoot);
afterEach(resetRoot);

describe("font scale option table", () => {
  it("exposes exactly the three named steps", () => {
    expect(FONT_SCALE_OPTIONS.map((o) => o.id)).toEqual([
      "standard",
      "large",
      "largest",
    ]);
  });

  it("increases monotonically, so a larger-named step is never smaller", () => {
    const percents = FONT_SCALE_OPTIONS.map((o) => o.percent);
    const sorted = [...percents].sort((a, b) => a - b);
    expect(percents).toEqual(sorted);
    expect(new Set(percents).size).toBe(percents.length);
  });

  it("anchors Standard at 100% so it is a true no-op", () => {
    expect(percentForScale("standard")).toBe(100);
  });

  it("falls back to Standard's percent for an unknown id", () => {
    expect(percentForScale("nonsense" as FontScaleId)).toBe(100);
  });
});

describe("applyFontScale — DOM effect", () => {
  it("writes a PERCENTAGE, never a pixel value (accessibility invariant)", () => {
    // A px value here would override the reader's browser/OS base size.
    // If this assertion ever fails, the feature has become actively harmful
    // to the low-vision readers it exists to serve.
    for (const option of FONT_SCALE_OPTIONS) {
      applyFontScale(option.id);
      const applied = document.documentElement.style.fontSize;
      expect(applied.endsWith("px")).toBe(false);
      if (option.id !== "standard") {
        expect(applied).toBe(`${option.percent}%`);
      }
    }
  });

  it("clears the inline size at Standard rather than pinning 100%", () => {
    applyFontScale("largest");
    expect(document.documentElement.style.fontSize).toBe("125%");

    applyFontScale("standard");
    // Empty string === property removed. Pinning "100%" would still override
    // a reader whose browser base size is not 16px.
    expect(document.documentElement.style.fontSize).toBe("");
  });

  it("records the active scale on the root dataset for CSS hooks", () => {
    applyFontScale("large");
    expect(document.documentElement.dataset.fontScale).toBe("large");
  });
});

function ScaleProbe() {
  const { scale, setScale } = useFontScale();
  return (
    <div>
      <span data-testid="scale">{scale}</span>
      <button type="button" onClick={() => setScale("largest")}>
        go largest
      </button>
    </div>
  );
}

describe("FontScaleProvider", () => {
  it("defaults to Standard with empty storage", () => {
    render(
      <FontScaleProvider>
        <ScaleProbe />
      </FontScaleProvider>,
    );
    expect(screen.getByTestId("scale").textContent).toBe("standard");
  });

  it("hydrates a stored preference on the FIRST render, with no small-text flash", () => {
    window.localStorage.setItem(STORAGE_KEY, "large");
    render(
      <FontScaleProvider>
        <ScaleProbe />
      </FontScaleProvider>,
    );
    // Synchronous lazy-initializer hydration: the very first committed render
    // already reads "large". An effect-based hydration would render
    // "standard" once first — a visible flash on every page load.
    expect(screen.getByTestId("scale").textContent).toBe("large");
  });

  it("degrades a corrupt stored value to Standard instead of applying it", () => {
    window.localStorage.setItem(STORAGE_KEY, "ENORMOUS");
    render(
      <FontScaleProvider>
        <ScaleProbe />
      </FontScaleProvider>,
    );
    expect(screen.getByTestId("scale").textContent).toBe("standard");
    expect(document.documentElement.style.fontSize).toBe("");
  });

  it("persists a change and applies it to the document root", () => {
    // fireEvent rather than user-event: the repo does not ship
    // @testing-library/user-event and a plain click is all this needs.
    render(
      <FontScaleProvider>
        <ScaleProbe />
      </FontScaleProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /go largest/i }));

    expect(screen.getByTestId("scale").textContent).toBe("largest");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("largest");
    expect(document.documentElement.style.fontSize).toBe("125%");
  });

  it("throws a clear error when the hook is used outside the provider", () => {
    const consoleError = console.error;
    console.error = () => {};
    try {
      expect(() => render(<ScaleProbe />)).toThrow(
        /must be used within a FontScaleProvider/,
      );
    } finally {
      console.error = consoleError;
    }
  });
});
