// Curriculum finder: the filters and the shortlist form (2026-11-19).
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CurriculumFinder, { matches, priceText } from "../../web/components/islands/CurriculumFinder";
import { comingSoonName, EDEN_TESTIMONIALS, type FinderCurriculum } from "../../web/lib/curriculumFinder";
import { readFileSync } from "node:fs";

const base: FinderCurriculum = {
  id: "11111111-1111-4111-8111-111111111111", sheet_id: "C017", name: "Math-U-See", publisher: "Demme Learning", link: "https://mathusee.com/", is_affiliate: false,
  approach: "Mastery", approach_secondary: null, subjects: ["Math"], grade_min: 0, grade_max: 12, domains_served: ["maker"], prep_load: "Light",
  price_cents: 4500, price_basis: "Per level", multi_age: false, faith_alignment: "Christian-friendly", eden_band: null, coming_soon: false,
  free_trial_url: "https://mathusee.com/placement", free_trial_type: "placement_test", free_trial_note: "Free placement tool", completely_free: false, free_trial_checked: "2026-11-19",
  mom_pros: ["Clear videos"], mom_cons: ["Slow for strong math kids"], mom_sources: [{ title: "Cathy Duffy", url: "https://cathyduffyreviews.com/x" }], mom_note: null,
  esa_yes_states: ["FL"], last_verified_at: null,
};
const free: FinderCurriculum = { ...base, id: "22222222-2222-4222-8222-222222222222", name: "Khan Academy", publisher: "Khan Academy", subjects: ["Math", "Science"], completely_free: true, price_cents: 0, faith_alignment: "Secular / neutral", free_trial_url: null, esa_yes_states: [] };
const none = { q: "", grade: "", subject: "", prep: "", state: "", freeOnly: false, hasTrial: false, christian: false };

afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });

describe("curriculum finder", () => {
  it("filters by free, trial, grade, subject, ESA state and faith", () => {
    expect(matches(free, { ...none, freeOnly: true })).toBe(true);
    expect(matches(base, { ...none, freeOnly: true })).toBe(false);
    expect(matches(free, { ...none, hasTrial: true })).toBe(false);
    expect(matches(base, { ...none, grade: "K" })).toBe(true);
    expect(matches({ ...base, grade_min: null }, { ...none, grade: "3" })).toBe(false);
    expect(matches(base, { ...none, subject: "Science" })).toBe(false);
    expect(matches(base, { ...none, state: "FL" })).toBe(true);
    expect(matches(base, { ...none, state: "TX" })).toBe(false);
    expect(matches(base, { ...none, christian: true })).toBe(false);
    expect(matches(base, { ...none, q: "demme" })).toBe(true);
    expect(priceText(free)).toBe("Completely free");
    expect(priceText(base)).toBe("About $45 (per level)");
  });

  it("Eden's Table testimonials match /homeschool word for word, and show only on Eden's Table cards", () => {
    const page = readFileSync("web/pages/homeschool.astro", "utf8").replace(/&lsquo;/g, "‘").replace(/&rsquo;/g, "’");
    for (const t of EDEN_TESTIMONIALS) {
      expect(page).toContain(t.quote);
      expect(page).toContain(t.by);
    }
    render(<CurriculumFinder rows={[{ ...base, sheet_id: "C031", name: "Eden's Table: Sprouts" }, base]} />);
    expect(screen.getAllByText("What families say")).toHaveLength(1);
    expect(screen.getByText(/so these aren't independent reviews/)).toBeTruthy();
  });

  it("coming-soon Eden's Table sets show a clean name, the approved line and the waitlist button, no star", () => {
    const cs = { ...base, id: "33333333-3333-4333-8333-333333333333", sheet_id: "C033", coming_soon: true, grade_min: 6, grade_max: 8,
      name: comingSoonName({ sheet_id: "C033", name: "Eden's Table: grades 6-8 set (name to come from Lane 8)" }), free_trial_url: null };
    expect(cs.name).toBe("Eden's Table: Cultivators (grades 6-8)");
    render(<CurriculumFinder rows={[cs]} />);
    expect(screen.getByText(/Coming soon · Planned for late 2027/)).toBeTruthy();
    expect(screen.getByText(/Eden's Table for grades 6-8 is on the way/)).toBeTruthy();
    expect(screen.getByText("Join the waitlist")).toBeTruthy();
    expect(screen.queryByText(/Save to my shortlist/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/name to come/);
    expect(matches(cs, { ...none, grade: "7" })).toBe(true);
    expect(matches(cs, { ...none, hasTrial: true })).toBe(false);
  });

  it("starring shows the bar; the Friday box starts unticked; the form posts the starred ids", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    render(<CurriculumFinder rows={[base, free]} />);
    fireEvent.click(screen.getAllByText(/Save to my shortlist/)[0]);
    fireEvent.click(screen.getByText("Email me my shortlist"));
    const box = screen.getByLabelText(/Friday homeschool email/) as HTMLInputElement;
    expect(box.checked).toBe(false);
    fireEvent.change(screen.getByPlaceholderText("Email"), { target: { value: "mom@example.com" } });
    fireEvent.click(screen.getByText("Email my shortlist"));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/Sent!/));
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toMatchObject({ email: "mom@example.com", ids: [base.id], friday_opt_in: false });
  });
});
