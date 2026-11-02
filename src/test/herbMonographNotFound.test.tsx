// /apothecary/<unknown> is still served by the SPA (vercel.json rewrites any one
// /apothecary segment to the shell, because the :herbId route accepts any slug
// or H-code), so it answers HTTP 200. The page itself must keep it out of the
// index: a settled not-found is noindex and carries no canonical or og:url. A
// real herb keeps its canonical and stays indexable, and so does the loading
// state, which knows nothing yet.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: async () => ({ data: [], error: null }) }) },
}));

const herb = {
  herb_id: "H111",
  common_name: "Coriander",
  latin_name: "Coriandrum sativum L.",
  temperature: "Cool",
  moisture: "Neutral",
  taste: "Pungent",
  energetics_summary: "A cooling seed for heat in the gut.",
  complaint_names: [] as string[],
  tier_visibility: "free",
};

const state = { isLoading: false };

vi.mock("@/hooks/useHerbMonograph", () => ({
  useHerbByParam: (param: string | undefined) => ({
    data: state.isLoading ? null : param?.toLowerCase() === "h111" ? herb : null,
    isLoading: state.isLoading,
    isError: false,
    isSubscriber: false,
    tier: "free",
  }),
  useHerbNames: () => new Map(),
}));
vi.mock("@/hooks/useHerbEnergeticsEvidence", () => ({
  useHerbEnergeticsEvidence: () => ({ byHerbId: new Map() }),
}));
vi.mock("@/hooks/useEdenPattern", () => ({
  useEdenPattern: () => ({ data: null, activeProfile: null, patternSubject: "your" }),
}));
vi.mock("@/hooks/useCuratedHerbVerdicts", () => ({
  useCuratedHerbVerdicts: () => ({ byHerbId: new Map() }),
}));
vi.mock("@/hooks/useViewedHerbs", () => ({
  useViewedHerbs: () => ({ viewedOrder: [], recordView: () => {} }),
}));
vi.mock("@/components/apothecary/HerbFavoriteHeart", () => ({
  HerbFavoriteHeart: () => null,
}));

import HerbMonograph from "@/pages/apothecary/HerbMonograph";

const robots = () => document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? null;
const canonical = () => document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null;
const ogUrl = () => document.querySelector('meta[property="og:url"]')?.getAttribute("content") ?? null;

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/apothecary/:herbId" element={<HerbMonograph />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("HerbMonograph head", () => {
  afterEach(() => {
    cleanup();
    state.isLoading = false;
  });

  it("an unknown herb is noindex and names no canonical", () => {
    renderAt("/apothecary/not-a-real-herb-xyz");
    expect(screen.getByRole("heading", { name: "Herb not found" })).toBeInTheDocument();
    expect(robots()).toBe("noindex, follow");
    expect(canonical()).toBeNull();
    expect(ogUrl()).toBeNull();
  });

  it("leaving the not-found page puts the indexable default back", () => {
    const { unmount } = renderAt("/apothecary/not-a-real-herb-xyz");
    expect(robots()).toBe("noindex, follow");
    unmount();
    // The test document ships no robots tag, so restoring means removing it.
    expect(robots()).toBeNull();
  });

  it("a real herb keeps its canonical and is not noindex", () => {
    renderAt("/apothecary/H111");
    expect(screen.getByRole("heading", { level: 1, name: /Coriander/ })).toBeInTheDocument();
    expect(robots()).toBeNull();
    expect(canonical()).toBe("https://edeninstitute.health/herbs/coriander");
  });

  it("while loading, nothing is marked noindex", () => {
    state.isLoading = true;
    renderAt("/apothecary/H111");
    expect(robots()).toBeNull();
    expect(canonical()).toBe("https://edeninstitute.health/apothecary");
  });
});
