import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * FontScaleProvider — user-controlled reading size for the Apothecary + guide.
 *
 * Why this exists: a reader on a 24-inch monitor had to lean forward to read
 * monograph copy, and a laptop reader has it worse. The Apothecary's reading
 * surfaces bottom out at text-sm (14px) for herb-card body copy and text-xs
 * (12px) for safety/citation prose, against a root that was never pinned —
 * so everything inherited the browser's 16px default with no way to raise it
 * short of browser zoom (which most readers over 50 do not know to use, and
 * which is not discoverable inside the app).
 *
 * MECHANISM — percentage on <html>, not pixels.
 *
 * We set document.documentElement.style.fontSize to a PERCENTAGE. This is the
 * accessible choice and the reason matters: a percentage scales relative to
 * whatever the reader's browser/OS base size already is. A reader who has
 * already set their browser default to 20px because they need it gets
 * 20px x 1.125 = 22.5px at the "Large" step, not a hard 18px that would
 * silently *shrink* their text. Setting a px value on <html> would override
 * and defeat their OS-level accessibility setting — a well-known a11y
 * anti-pattern. Never change this to px.
 *
 * Because tailwind.config.ts declares NO custom fontSize scale, every text-*
 * utility in the app is stock Tailwind and therefore rem-based, as is the
 * whole spacing scale. One root change scales type and its surrounding
 * padding/margins together, which is why this reads as clean page zoom rather
 * than text overflowing fixed-size boxes.
 *
 * SCOPE — this provider governs the React SPA only. The Astro marketing pages
 * under web/ are separately pre-rendered documents; they share the stylesheet
 * but not this React tree, so they keep the browser default. That is
 * deliberate: the reading-heavy surfaces (herb monographs, purchased guides)
 * are all inside the SPA.
 *
 * PERSISTENCE — localStorage only, following the same policy as
 * eden.active_profile_id (see ActiveProfileContext): this is session-continuity
 * convenience, not critical state. Losing it on a new device degrades to
 * Standard. All access is wrapped in try/catch so Capacitor private-mode
 * contexts don't throw. A cross-device preference would need a profiles
 * column; that is a production migration and a separate decision.
 */

export type FontScaleId = "standard" | "large" | "largest";

interface FontScaleOption {
  id: FontScaleId;
  /** Shown on the control. */
  label: string;
  /** Percentage applied to <html>. Relative to the reader's own base size. */
  percent: number;
  /** Plain-language effect, for the control's helper text. */
  description: string;
}

/**
 * Three steps, not a slider. A continuous control invites 143.7% and the
 * long-tail layout bugs that come with it; three named steps are testable and
 * cover the reported need (a 24-inch reader leaning in) with headroom.
 *
 * 112.5% and 125% map to 18px and 20px against a 16px default — the sizes
 * large-print typography conventionally targets.
 */
export const FONT_SCALE_OPTIONS: readonly FontScaleOption[] = [
  {
    id: "standard",
    label: "Standard",
    percent: 100,
    description: "The default reading size.",
  },
  {
    id: "large",
    label: "Large",
    percent: 112.5,
    description: "About one step larger throughout.",
  },
  {
    id: "largest",
    label: "Largest",
    percent: 125,
    description: "Comfortable at arm's length from a desktop monitor.",
  },
] as const;

const DEFAULT_SCALE: FontScaleId = "standard";
const STORAGE_KEY = "eden.font_scale";

function isFontScaleId(value: unknown): value is FontScaleId {
  return FONT_SCALE_OPTIONS.some((option) => option.id === value);
}

function loadStoredScale(): FontScaleId {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    // Guard the read: a stale or hand-edited value must not put the app into
    // an unrenderable state, so anything unrecognised falls back to Standard.
    return isFontScaleId(stored) ? stored : DEFAULT_SCALE;
  } catch {
    return DEFAULT_SCALE;
  }
}

function storeScale(id: FontScaleId): void {
  try {
    if (id === DEFAULT_SCALE) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* private mode / Capacitor — silent; the choice holds in memory only */
  }
}

export function percentForScale(id: FontScaleId): number {
  return (
    FONT_SCALE_OPTIONS.find((option) => option.id === id)?.percent ??
    FONT_SCALE_OPTIONS[0].percent
  );
}

/**
 * Applies the scale to the document root. Exported so tests can assert the
 * DOM effect directly without mounting the whole provider tree.
 */
export function applyFontScale(id: FontScaleId): void {
  if (typeof document === "undefined") return;
  const percent = percentForScale(id);
  const root = document.documentElement;
  if (id === DEFAULT_SCALE) {
    // Clear rather than write 100%: leaves the reader's own browser/OS base
    // size untouched, which is the whole point of the percentage approach.
    root.style.removeProperty("font-size");
  } else {
    root.style.fontSize = `${percent}%`;
  }
  // Exposed for CSS that needs to counter-scale (e.g. anything that must stay
  // pinned regardless of reading size).
  root.dataset.fontScale = id;
}

interface FontScaleContextValue {
  scale: FontScaleId;
  setScale: (id: FontScaleId) => void;
  options: readonly FontScaleOption[];
}

const FontScaleContext = createContext<FontScaleContextValue | null>(null);

export function FontScaleProvider({ children }: { children: ReactNode }) {
  // Hydrated synchronously in the lazy initializer rather than via useEffect,
  // for the same reason ActiveProfileContext does it (PR δ): an effect-based
  // hydration leaves a one-render window at the default, which here would show
  // as a visible text-size flash on every page load for readers who need Large.
  const [scale, setScaleState] = useState<FontScaleId>(loadStoredScale);

  useEffect(() => {
    applyFontScale(scale);
  }, [scale]);

  const setScale = useCallback((id: FontScaleId) => {
    setScaleState(id);
    storeScale(id);
  }, []);

  const value = useMemo<FontScaleContextValue>(
    () => ({ scale, setScale, options: FONT_SCALE_OPTIONS }),
    [scale, setScale],
  );

  return (
    <FontScaleContext.Provider value={value}>
      {children}
    </FontScaleContext.Provider>
  );
}

export function useFontScale(): FontScaleContextValue {
  const context = useContext(FontScaleContext);
  if (!context) {
    throw new Error("useFontScale must be used within a FontScaleProvider");
  }
  return context;
}
