// Curriculum finder: the filters and the shortlist form (2026-11-19).
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CurriculumFinder, { matches, priceText } from "../../web/components/islands/CurriculumFinder";
import type { FinderCurriculum } from "../../web/lib/curriculumFinder";

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
