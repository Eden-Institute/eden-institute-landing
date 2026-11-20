// Curriculum finder: the filters and the shortlist form (2026-11-19).
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CurriculumFinder, { matches, priceText } from "../../web/components/islands/CurriculumFinder";
import { comingSoonName, EDEN_TESTIMONIALS, factsCheckedMonth, FINDER_COPY, FINDER_FAQ, FINDER_TRUST, finderCount, POINT_5_APPROVED, POINT_5_RETAILER_CLAUSE, WIRED_IS_PUBLIC, type FinderCurriculum } from "../../web/lib/curriculumFinder";
import { readFileSync } from "node:fs";

const base: FinderCurriculum = {
  id: "11111111-1111-4111-8111-111111111111", sheet_id: "C017", name: "Math-U-See", publisher: "Demme Learning", link: "https://mathusee.com/", is_affiliate: false,
  approach: "Mastery", approach_secondary: null, subjects: ["Math"], grade_min: 0, grade_max: 12, domains_served: ["maker"], prep_load: "Light",
  price_cents: 4500, price_basis: "Per level", multi_age: false, faith_alignment: "Christian-friendly", eden_band: null, coming_soon: false,
  free_trial_url: "https://mathusee.com/placement", free_trial_type: "placement_test", free_trial_note: "Free placement tool", completely_free: false, free_trial_checked: "2026-11-19",
  mom_pros: ["Clear videos"], mom_cons: ["Slow for strong math kids"], mom_sources: [{ title: "Cathy Duffy", url: "https://cathyduffyreviews.com/x" }], mom_note: null,
  esa_yes_states: ["FL"], last_verified_at: null, price_covers: null, screen_based: null,
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

  it("the trust copy is the approved Resource Guide copy word for word", () => {
    const approved = readFileSync("docs/wired-copy/Wired_Quiz_Resource_Guide_Copy.md", "utf8").replace(/\r\n/g, "\n");
    expect(approved).toContain(`Under it: ${FINDER_TRUST.underHeading}`);
    // Point 5 carries Camila's one amendment (2026-11-20 tap "Add retailers"); everything else is the approved text.
    const asApproved = FINDER_TRUST.how.map((h) => (h === POINT_5_APPROVED.replace("own site,", `own site${POINT_5_RETAILER_CLAUSE}`) ? POINT_5_APPROVED : h));
    expect(FINDER_TRUST.how[4]).toBe("The facts check out. Prices, grades and prep come from the publisher's own site, or from a named retailer when the publisher doesn't list a price, with the date we checked. If we couldn't confirm something, we say so instead of guessing.");
    expect(approved).toContain(`Heading: ${FINDER_TRUST.howHeading}\n${asApproved.map((h) => `- ${h}`).join("\n")}\n`);
    expect(approved).toContain(`Last line under the list: ${FINDER_TRUST.howLast}`);
    expect(approved).toContain(`an 'Ours' label and this line: ${FINDER_TRUST.oursLine}`);
    expect(approved).toContain(`Bottom of the hub: ${FINDER_TRUST.checked("[month year]")}\n${FINDER_TRUST.outOfDate} ${FINDER_TRUST.tellUs}.`);
    expect(approved).toContain(`Above the list (your approved line): ${FINDER_COPY.affiliate}`);
    expect(approved).toContain(`Next to each affiliate link (approved): ${FINDER_COPY.affiliateLabel}`);
    expect(approved).toContain(`Filters`); // the filter + label wording below
    expect(approved).toContain(`- ${FINDER_COPY.hideScreen}`);
    expect(approved).toContain(`· ${FINDER_COPY.screenBased} ·`);
    for (const s of [FINDER_TRUST.underHeading, ...FINDER_TRUST.how, FINDER_TRUST.howLast, FINDER_TRUST.oursLine]) expect(s).not.toContain("—");
  });

  it("the title, snippet, intro and /homeschool line say the live count (coming-soon sets not counted)", () => {
    const rows = [base, free, { ...base, id: "55555555-5555-4555-8555-555555555555", sheet_id: "C033", coming_soon: true }];
    expect(finderCount(rows)).toBe(2);
    expect(FINDER_COPY.title(95)).toBe("Homeschool Curriculum Finder: 95 Hand-Picked Options with Free Samples");
    expect(FINDER_COPY.description(95)).toMatch(/^Compare 95 homeschool curricula by grade/);
    expect(FINDER_COPY.intro(95)).toMatch(/^95 curricula, hand-picked and checked:/);
    expect(FINDER_COPY.homeschoolLink(95)).toBe("95 hand-picked homeschool curricula with free samples and what other moms say.");
    for (const s of [FINDER_COPY.title(1), FINDER_COPY.description(1), FINDER_COPY.intro(1)]) expect(s).not.toMatch(/\b100\b/);
    const page = readFileSync("web/pages/homeschool.astro", "utf8");
    expect(page).toContain("FINDER_COPY.homeschoolLink(finderCurricula)");
    expect(page).not.toContain("100 hand-picked");
  });

  it("facts-checked month = the oldest verified date, in UTC; none = no line", () => {
    expect(factsCheckedMonth([{ last_verified_at: "2026-12-01T00:00:00+00:00" }, { last_verified_at: "2026-11-18T00:00:00+00:00" }])).toBe("November 2026");
    expect(factsCheckedMonth([{ last_verified_at: "2026-12-01T00:00:00+00:00" }])).toBe("December 2026");
    expect(factsCheckedMonth([{ last_verified_at: null }])).toBeNull();
  });

  it("the page shows the trust copy, the Ours label on Eden's Table, and the checked line", () => {
    const eden = { ...base, id: "44444444-4444-4444-8444-444444444444", sheet_id: "C031", name: "Eden's Table: Sprouts", last_verified_at: "2026-11-18T00:00:00+00:00" };
    render(<CurriculumFinder rows={[base, eden]} />);
    expect(screen.getByText(FINDER_TRUST.underHeading)).toBeTruthy();
    expect(screen.getByRole("heading", { name: FINDER_TRUST.howHeading })).toBeTruthy();
    for (const h of FINDER_TRUST.how) expect(screen.getByText(h)).toBeTruthy();
    expect(screen.getByText(FINDER_TRUST.howLast)).toBeTruthy();
    expect(screen.getAllByText(FINDER_TRUST.oursLabel)).toHaveLength(1);
    expect(screen.getByText(FINDER_TRUST.oursLine)).toBeTruthy();
    expect(screen.getByText("Facts checked November 2026. Prices change, so check the publisher before you buy.")).toBeTruthy();
    expect(screen.getByRole("link", { name: FINDER_TRUST.tellUs }).getAttribute("href")).toBe("/contact");
  });

  it("hide screen-based hides only rows marked screen-based (an unanswered row stays in)", () => {
    expect(matches({ ...base, screen_based: true }, { ...none, hideScreen: true })).toBe(false);
    expect(matches({ ...base, screen_based: false }, { ...none, hideScreen: true })).toBe(true);
    expect(matches({ ...base, screen_based: null }, { ...none, hideScreen: true })).toBe(true);
    expect(matches({ ...base, screen_based: true }, none)).toBe(true);
  });

  it("the card shows the price-covers line under a price and the Screen-based label; the filter works", () => {
    const vp = { ...base, id: "33333333-3333-4333-8333-333333333333", sheet_id: "C091", name: "Veritas Press", screen_based: true, price_covers: "One subject for one year." };
    render(<CurriculumFinder rows={[base, vp, { ...free, price_covers: "Never shown for a free one." }]} />);
    expect(screen.getByText("What this price covers: One subject for one year.")).toBeTruthy();
    expect(screen.queryByText(/Never shown for a free one/)).toBeNull();
    expect(screen.getAllByText("Screen-based")).toHaveLength(1);
    fireEvent.click(screen.getByLabelText("Hide screen-based options"));
    expect(screen.queryByText("Veritas Press")).toBeNull();
    expect(screen.getByText("Math-U-See")).toBeTruthy();
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

  it("the FAQ is Camila's approved text word for word; no quiz invitation while the quiz is dark", () => {
    const approved = readFileSync("docs/finder-copy/curriculum_finder_faq_APPROVED_2026-11-20.md", "utf8");
    expect(FINDER_FAQ).toHaveLength(6);
    for (const f of FINDER_FAQ) {
      expect(approved).toContain(f.q);
      expect(approved).toContain(f.a);
    }
    expect(WIRED_IS_PUBLIC).toBe(false);
    // Camila 2026-11-20 amendment: Q1 avoids "learns best", like the Wired copy.
    for (const f of FINDER_FAQ) expect(f.a).not.toMatch(/learns best|learning style/i);
    expect(FINDER_FAQ[0].a).toContain("think about how God made your child, what lights them up");
    render(<CurriculumFinder rows={[base]} />);
    expect(screen.getByText("How do I choose a homeschool curriculum?")).toBeTruthy();
    expect(screen.getByText("ESA state guides").getAttribute("href")).toBe("/esa");
    expect(document.querySelector('a[href^="/wired"]')).toBeNull();
    expect(screen.queryByText(/Take the free quiz/)).toBeNull();
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
