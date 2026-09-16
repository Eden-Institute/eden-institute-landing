// Pre-1900 energetics evidence on the herb surfaces (founder decision
// 2026-09-15, memory p_herb_evidence_honesty_2026_09_15). What is pinned here:
//
//   1. Where the old sources disagree, the page says so plainly, at FREE tier,
//      in the founder's own stored sentence. It is never hidden behind a tier.
//   2. Where the research found no qualifying pre-1900 source, the page says
//      that, rather than implying the value rests on one.
//   3. The source list itself is ROOT: below Root a reader gets the upsell, and
//      no excerpt, locator or URL reaches the DOM.
//   4. A herb that has not been researched renders NOTHING. Silence is not the
//      same claim as "searched and found nothing".
//   5. The page never announces agreement. "The old sources agree" appears
//      nowhere, at any tier, for any of the three states.

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: async () => ({ data: [], error: null }) }) },
}));

import { HerbEnergeticsEvidence } from "@/components/apothecary/HerbEnergeticsEvidence";
import {
  freeEvidenceLine,
  NO_PRE1900_SOURCE_LINE,
  type HerbEnergeticsEvidence as Evidence,
} from "@/lib/energeticsEvidence";

// The sentence below is the founder-approved text stored for H111 Coriander by
// 20260916190000_energetics_sources_batches_1_2.sql, trimmed to its first
// clause. Kept verbatim so a reword in the data or the renderer shows up here.
const CORIANDER_DISAGREEMENT =
  "On temperature, the old sources disagree: Culpeper (1653), Gerard (1633), " +
  "Salmon (1710) and Bhavaprakasha (16th c.) read it as warm; Rajanighantu " +
  "(c. 15th c.) reads it as cool; Bencao Gangmu (1596) reads it as neutral. " +
  "The app keeps cool, the modern reading of what the herb does in the body; " +
  "the old readings are shown here but do not change it.";

const CULPEPER_EXCERPT =
  "Seeds are hot in the first degree. Linseed, Fenugreek, Coriander";

function evidence(over: Partial<Evidence> = {}): Evidence {
  return {
    herb_id: "H111",
    batch: 1,
    no_pre1900_source_found: false,
    no_counted_source_line: null,
    sources_agree: false,
    agreement_state: "disagree",
    disagreement_text: CORIANDER_DISAGREEMENT,
    rule: "Temperature: stored value clear (a definite Cool), so it stays Cool.",
    source_count: 2,
    sources: null,
    checked_no_reading: null,
    counted_readings: null,
    rule_general: null,
    ...over,
  };
}

// What the view hands a ROOT caller: the same row with the jsonb populated.
const ROOT_SOURCES = [
  {
    source:
      "Nicholas Culpeper, The Complete Herbal (text of 1653; Project Gutenberg #49513)",
    short: "Culpeper (1653)",
    year: "1653",
    corpus: "galenic-european",
    tradition: "Galenic (European)",
    tier: "first-hand",
    assigns_temperature: "Warm",
    assigns_moisture: "Dry",
    excerpt: CULPEPER_EXCERPT,
    gloss: "Coriander seed is hot in the first degree and dry in the third.",
    locator: "Catalogue of simples, 'Seeds'",
    url: "https://www.gutenberg.org/cache/epub/49513/pg49513.txt",
    counted: true,
    counted_temperature: true,
    counted_moisture: true,
    not_counted_why: "",
    agreement: "Counted: differs from the app temperature (source warm, app cool).",
  },
  {
    source: "Narahari, Rajanighantu (Sanskrit original)",
    short: "Rajanighantu (c. 15th c.)",
    year: "c. 15th century",
    corpus: "ayurvedic",
    tradition: "Ayurvedic (Indian)",
    tier: "first-hand",
    assigns_temperature: "Cool",
    assigns_moisture: null,
    excerpt: "dhanyakam madhuram sitam kasayam pittanasanam",
    gloss: "Coriander is sweet, COLD, astringent, destroys bile.",
    locator: "Rajanighantu 5.37",
    url: "http://gretil.sub.uni-goettingen.de/example.txt",
    counted: true,
    counted_temperature: true,
    counted_moisture: false,
    not_counted_why: "",
    agreement: "Counted: agrees with the app temperature (cool).",
  },
];

function renderEvidence(props: {
  evidence: Evidence | null;
  hasRoot: boolean;
  part?: "both" | "line" | "sources";
}) {
  return render(
    <MemoryRouter>
      <HerbEnergeticsEvidence
        evidence={props.evidence}
        hasRoot={props.hasRoot}
        part={props.part}
      />
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe("the disagreement sentence", () => {
  it("renders in full for a FREE reader when the data says the sources disagree", () => {
    renderEvidence({ evidence: evidence(), hasRoot: false });
    expect(screen.getByText(CORIANDER_DISAGREEMENT)).toBeInTheDocument();
  });

  it("renders for a ROOT reader too, above the source list", () => {
    renderEvidence({
      evidence: evidence({ sources: ROOT_SOURCES }),
      hasRoot: true,
    });
    expect(screen.getByText(CORIANDER_DISAGREEMENT)).toBeInTheDocument();
    expect(screen.getByText("The old sources")).toBeInTheDocument();
  });

  it("is the stored sentence and nothing else: no source, no sentence", () => {
    renderEvidence({
      evidence: evidence({
        agreement_state: "none",
        disagreement_text: null,
        source_count: 1,
      }),
      hasRoot: false,
    });
    expect(screen.queryByText(CORIANDER_DISAGREEMENT)).toBeNull();
    expect(screen.queryByText(NO_PRE1900_SOURCE_LINE)).toBeNull();
  });
});

describe("the no-source line", () => {
  const searchedAndFoundNothing = evidence({
    herb_id: "H102",
    agreement_state: "none",
    disagreement_text: null,
    no_pre1900_source_found: true,
    source_count: 0,
  });

  it("renders for a FREE reader when the research found no pre-1900 source", () => {
    renderEvidence({ evidence: searchedAndFoundNothing, hasRoot: false });
    expect(screen.getByText(NO_PRE1900_SOURCE_LINE)).toBeInTheDocument();
    expect(screen.getByText(NO_PRE1900_SOURCE_LINE).textContent).toBe(
      "No pre-1900 source found for this reading.",
    );
  });

  it("offers no Root upsell, because there is nothing behind it to sell", () => {
    renderEvidence({ evidence: searchedAndFoundNothing, hasRoot: false });
    expect(screen.queryByText(/Unlock with Root/)).toBeNull();
  });

  it("says nothing at all for a herb that has not been researched", () => {
    const { container } = renderEvidence({ evidence: null, hasRoot: true });
    expect(container).toBeEmptyDOMElement();
    expect(freeEvidenceLine(null)).toBeNull();
  });
});

describe("sources found, but none of them counted", () => {
  // Founder decision 2026-09-15. Cape Aloes is the real case: Gerard, the Bencao
  // Gangmu and the Bhavaprakasha all describe aloes, but none of them describe
  // Aloe ferox. Before this, such a herb rendered nothing, which reads to a
  // visitor exactly like a herb nobody has researched.
  const CAPE_ALOES_LINE =
    "No pre-1900 source found for this exact plant. The old books describe" +
    " aloes from other species, not the South African plant this entry is about.";
  const noneCounted = evidence({
    herb_id: "H299",
    agreement_state: "none",
    disagreement_text: null,
    no_pre1900_source_found: false,
    no_counted_source_line: CAPE_ALOES_LINE,
    source_count: 3,
  });

  it("gives a FREE reader the herb's own reason, not silence", () => {
    renderEvidence({ evidence: noneCounted, hasRoot: false });
    expect(screen.getByText(CAPE_ALOES_LINE)).toBeInTheDocument();
    expect(freeEvidenceLine(noneCounted)).toBe(CAPE_ALOES_LINE);
  });

  it("does not claim the flat no-source line, because sources WERE found", () => {
    renderEvidence({ evidence: noneCounted, hasRoot: false });
    expect(screen.queryByText(NO_PRE1900_SOURCE_LINE)).toBeNull();
  });

  it("still prefers the disagreement sentence when there is one", () => {
    const both = evidence({
      disagreement_text: "The old sources disagree about this.",
      no_counted_source_line: CAPE_ALOES_LINE,
    });
    expect(freeEvidenceLine(both)).toBe("The old sources disagree about this.");
  });

  it("stays silent when the herb counted a source, so the line is absent", () => {
    expect(
      freeEvidenceLine(
        evidence({
          agreement_state: "agree",
          disagreement_text: null,
          no_pre1900_source_found: false,
          no_counted_source_line: null,
        }),
      ),
    ).toBeNull();
  });
});

describe("the source list is Root-gated", () => {
  it("shows every source, its reading, excerpt, locator and link at ROOT", () => {
    renderEvidence({
      evidence: evidence({ sources: ROOT_SOURCES }),
      hasRoot: true,
    });
    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    // Scoped to the list: "Culpeper (1653)" also appears inside the
    // disagreement sentence above it, which is the point of the short form.
    expect(items[0].textContent).toContain("Culpeper (1653)");
    expect(items[0].textContent).toContain("Galenic (European)");
    expect(items[0].textContent).toContain("reads it as Warm, Dry");
    expect(items[0].textContent).toContain(CULPEPER_EXCERPT);
    expect(items[0].textContent).toContain("Catalogue of simples, 'Seeds'");
    expect(items[1].textContent).toContain("Rajanighantu (c. 15th c.)");
    expect(items[1].textContent).toContain("reads it as Cool");
    const links = screen.getAllByRole("link", { name: "Read the text" });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute(
      "href",
      "https://www.gutenberg.org/cache/epub/49513/pg49513.txt",
    );
  });

  it("gives a FREE reader the Root upsell and NO source content", () => {
    // The view NULLs `sources` below Root; this also proves the component does
    // not render a list from a payload that somehow arrives anyway.
    renderEvidence({
      evidence: evidence({ sources: ROOT_SOURCES }),
      hasRoot: false,
    });
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByText(new RegExp(CULPEPER_EXCERPT))).toBeNull();
    expect(screen.queryByText(/Catalogue of simples/)).toBeNull();
    expect(screen.queryByRole("link", { name: "Read the text" })).toBeNull();
    expect(
      screen.getByText(
        "Root opens the 2 pre-1900 sources behind this reading, with the passages and where to read them.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Unlock with Root/ })).toHaveAttribute(
      "href",
      "/apothecary/pricing#tier-root",
    );
  });

  it("keeps the disagreement sentence visible to that same FREE reader", () => {
    renderEvidence({
      evidence: evidence({ sources: ROOT_SOURCES }),
      hasRoot: false,
    });
    expect(screen.getByText(CORIANDER_DISAGREEMENT)).toBeInTheDocument();
  });

  it("splits into parts for the directory card: the line on the row, the sources in the quick view", () => {
    const { unmount } = renderEvidence({
      evidence: evidence({ sources: ROOT_SOURCES }),
      hasRoot: true,
      part: "line",
    });
    expect(screen.getByText(CORIANDER_DISAGREEMENT)).toBeInTheDocument();
    expect(screen.queryByText("The old sources")).toBeNull();
    unmount();

    renderEvidence({
      evidence: evidence({ sources: ROOT_SOURCES }),
      hasRoot: true,
      part: "sources",
    });
    expect(screen.queryByText(CORIANDER_DISAGREEMENT)).toBeNull();
    expect(screen.getByText("The old sources")).toBeInTheDocument();
  });
});

describe("the page never claims agreement it does not have", () => {
  for (const [label, row] of [
    ["sources disagree", evidence({ sources: ROOT_SOURCES })],
    [
      "one reading only",
      evidence({
        agreement_state: "none",
        disagreement_text: null,
        source_count: 1,
        sources: [ROOT_SOURCES[0]],
      }),
    ],
    [
      "sources agree",
      evidence({
        agreement_state: "agree",
        sources_agree: true,
        disagreement_text: null,
        sources: ROOT_SOURCES,
      }),
    ],
    [
      "no pre-1900 source",
      evidence({
        agreement_state: "none",
        disagreement_text: null,
        no_pre1900_source_found: true,
        source_count: 0,
        sources: [],
      }),
    ],
  ] as Array<[string, Evidence]>) {
    it(`renders no "the sources agree" claim when ${label}`, () => {
      const { container } = renderEvidence({ evidence: row, hasRoot: true });
      expect(container.textContent ?? "").not.toMatch(/sources agree/i);
    });
  }
});

// ── The monograph itself, wired to the hook ────────────────────────────────
// Everything above tests the renderer in isolation. This proves the page
// actually reaches for the evidence and puts it under the energetics.

const directory = {
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

const evidenceMap = new Map<string, Evidence>();
const tierState = { tier: "free", isSubscriber: false };

vi.mock("@/hooks/useHerbsDirectory", () => ({
  useHerbsDirectory: () => ({
    data: [directory],
    isLoading: false,
    isError: false,
    isSubscriber: tierState.isSubscriber,
    tier: tierState.tier,
  }),
}));
vi.mock("@/hooks/useHerbEnergeticsEvidence", () => ({
  useHerbEnergeticsEvidence: () => ({ byHerbId: evidenceMap }),
}));
vi.mock("@/hooks/useEdenPattern", () => ({
  useEdenPattern: () => ({
    data: null,
    activeProfile: null,
    patternSubject: "your",
  }),
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

function renderMonograph() {
  return render(
    <MemoryRouter initialEntries={["/apothecary/H111"]}>
      <Routes>
        <Route path="/apothecary/:herbId" element={<HerbMonograph />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("HerbMonograph", () => {
  afterEach(() => {
    evidenceMap.clear();
    tierState.tier = "free";
    tierState.isSubscriber = false;
  });

  it("puts the disagreement sentence under the energetics for a free reader", () => {
    evidenceMap.set("H111", evidence({ sources: null }));
    renderMonograph();
    const glance = screen.getByLabelText("Energetics at a glance");
    expect(within(glance).getByText(CORIANDER_DISAGREEMENT)).toBeInTheDocument();
    expect(within(glance).queryByText("The old sources")).toBeNull();
  });

  it("opens the source list for a root reader", () => {
    tierState.tier = "root";
    tierState.isSubscriber = true;
    evidenceMap.set("H111", evidence({ sources: ROOT_SOURCES }));
    renderMonograph();
    const glance = screen.getByLabelText("Energetics at a glance");
    expect(within(glance).getByText("The old sources")).toBeInTheDocument();
    expect(
      within(glance).getByText(new RegExp(CULPEPER_EXCERPT)),
    ).toBeInTheDocument();
  });

  it("says nothing about sources for a herb with no evidence row", () => {
    renderMonograph();
    const glance = screen.getByLabelText("Energetics at a glance");
    expect(within(glance).queryByText(NO_PRE1900_SOURCE_LINE)).toBeNull();
    expect(within(glance).queryByText("The old sources")).toBeNull();
    expect(within(glance).queryByText(/Unlock with Root/)).toBeNull();
  });
});
