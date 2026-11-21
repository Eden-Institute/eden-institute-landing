// The grade 6-12 waitlist form (PR #780) is ONE form: the Curriculum Finder's coming-soon cards and the Wired results
// page's coming-soon line (2026-11-21) open the same WaitlistModal with the same list (source), audience, consent
// and welcome words. Only the GA4 form name (one per placement) differs.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const opened: Record<string, unknown>[] = [];
vi.mock("@/components/landing/WaitlistModal", () => ({
  default: (props: Record<string, unknown>) => {
    opened.push(props);
    return <div role="dialog">{String(props.title)}</div>;
  },
}));
vi.mock("@/lib/trackCta", () => ({ trackCta: vi.fn() }));

import CurriculumFinder from "../../web/components/islands/CurriculumFinder";
import WiredResults from "../../web/components/islands/WiredResults";
import { bandWaitlistProps, upperBandOf } from "../../web/lib/bandWaitlist";
import { comingSoonName, type FinderCurriculum } from "../../web/lib/curriculumFinder";
import { RESULTS_KEY } from "../../web/lib/wiredApi";

// The finder's props exactly as PR #780 wrote them inline (CurriculumFinder.tsx before 2026-11-21).
const PR780 = (name: string, band: string) => ({
  audienceId: "a48cb66e-b2a9-461d-98a6-bb1b12f72693",
  source: `${band}_waitlist`,
  formName: `finder_${band}_waitlist`,
  title: `Tell me when ${name} opens`,
  subtitle: `I will email you the moment ${name} has a date. Add your mobile number if you would also like a text when it opens.`,
  successCtaHref: "https://edeninstitute.health/homeschool#choose-band",
  successCtaLabel: "See where to start today",
  successCtaBlurb: `${name} goes deeper into the 72 plants your child meets in Sprouts and Seedlings, so the best preparation is to start with them now.`,
});
const formProps = (p: Record<string, unknown>) => {
  const { open: _o, onOpenChange: _c, ...rest } = p;
  return rest;
};

const finderRow = (sheet: "C033" | "C034"): FinderCurriculum => ({
  id: sheet === "C033" ? "33333333-3333-4333-8333-333333333333" : "44444444-4444-4444-8444-444444444444", sheet_id: sheet,
  name: comingSoonName({ sheet_id: sheet, name: "x" }), publisher: null, link: null, is_affiliate: false, approach: null, approach_secondary: null,
  subjects: [], grade_min: sheet === "C033" ? 6 : 9, grade_max: sheet === "C033" ? 8 : 12, domains_served: [], prep_load: null, price_cents: null,
  price_basis: null, multi_age: false, faith_alignment: null, eden_band: sheet === "C033" ? "6-8 set" : "9-12 set", coming_soon: true,
  free_trial_url: null, free_trial_type: null, free_trial_note: null, completely_free: false, free_trial_checked: null,
  mom_pros: [], mom_cons: [], mom_sources: [], mom_note: null, esa_yes_states: [], last_verified_at: null, price_covers: null, screen_based: null, resource_type: "Curriculum",
});

const scores = { storyteller: 40, organizer: 30, designer: 85, maker: 90, psalmist: 20, connector: 50, ponderer: 10, cultivator: 70, seeker: 5 };
const child = (eden_band: string) => ({
  child_id: "c1", nickname: "Lily", grade: 8, unlocked: true, scores, top3: ["maker", "designer", "cultivator"], renaissance: false, tip_first: "try_today",
  matches: [], coming_soon: [{ name: "Eden's Table", eden_band }], offers: { blueprint: true, family_map: false },
});
function mockFetch(routes: Record<string, { status: number; body: unknown }>) {
  return vi.fn((url: string) => {
    const hit = Object.entries(routes).find(([k]) => url.includes(k));
    const r = hit ? hit[1] : { status: 500, body: {} };
    return Promise.resolve(new Response(JSON.stringify(r.body), { status: r.status }));
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  opened.length = 0;
});

describe("the grade 6-12 waitlist form is shared", () => {
  it("eden_band picks the band: 9-12 = Practitioners, otherwise Cultivators", () => {
    expect(upperBandOf("9-12 set")).toBe("practitioners");
    expect(upperBandOf("6-8 set")).toBe("cultivators");
  });

  for (const [sheet, name, band] of [["C033", "Cultivators", "cultivators"], ["C034", "Practitioners", "practitioners"]] as const) {
    it(`Curriculum Finder (${name}): the very same props PR #780 shipped`, async () => {
      render(<CurriculumFinder rows={[finderRow(sheet)]} />);
      fireEvent.click(screen.getByText("Join the waitlist"));
      await waitFor(() => expect(screen.getByRole("dialog").textContent).toBe(`Tell me when ${name} opens`));
      expect(formProps(opened.at(-1)!)).toEqual(PR780(name, band));
    });

    it(`Wired results (${name}): the same form, tagged to the child's band`, async () => {
      localStorage.setItem(RESULTS_KEY, "TOKEN123");
      vi.stubGlobal("fetch", mockFetch({
        "wired-results": { status: 200, body: { children: [child(band === "practitioners" ? "9-12 set" : "6-8 set")] } },
        "wired-matches": { status: 200, body: { matches: [], budget_filter_offered: true } },
      }));
      render(<WiredResults />);
      await waitFor(() => expect(screen.getByText("Join the waitlist")).toBeTruthy());
      expect(screen.queryByRole("dialog")).toBeNull();
      fireEvent.click(screen.getByText("Join the waitlist"));
      await waitFor(() => expect(screen.getByRole("dialog").textContent).toBe(`Tell me when ${name} opens`));
      const got = formProps(opened.at(-1)!);
      expect(got).toEqual({ ...PR780(name, band), formName: `wired_results_${band}_waitlist` });
      expect(got).toEqual(bandWaitlistProps(band, `wired_results_${band}_waitlist`));
    });
  }
});
