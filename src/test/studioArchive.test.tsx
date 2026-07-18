// Phase 8 archive. Search and filtering are the new logic here and they are
// pure, so they are worth pinning down: a filter that silently hides a campaign
// is worse than no filter at all.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import StudioProjectList from "@/studio/StudioProjectList";
import type { StudioProject } from "@/studio/studio-db";

function project(over: Partial<StudioProject>): StudioProject {
  return {
    id: "p1", created_by: "u", title: "Untitled campaign",
    product: "kit", platforms: ["instagram"], ad_type: "feed",
    campaign_tag: "general", current_step: 0, status: "draft",
    state: {}, slides: [],
    canva_design_id: null, canva_edit_url: null,
    canva_asset_id: null, canva_synced_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...over,
  } as StudioProject;
}

const PROJECTS = [
  project({ id: "a", title: "Preorder push", campaign_tag: "sprouts", ad_type: "reel", status: "exported" }),
  project({ id: "b", title: "Testimonial one", campaign_tag: "seedlings", ad_type: "feed", status: "draft" }),
  project({ id: "c", title: "Curriculum reveal", campaign_tag: "sprouts", ad_type: "carousel", status: "draft" }),
];

function setup(over: Partial<React.ComponentProps<typeof StudioProjectList>> = {}) {
  const props = {
    projects: PROJECTS,
    exportCounts: { a: 3 },
    loading: false,
    error: null,
    busyId: null,
    onNew: vi.fn(),
    onOpen: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    ...over,
  };
  render(<StudioProjectList {...props} />);
  return props;
}

const titles = () =>
  screen.getAllByRole("listitem").map((li) => within(li).getAllByRole("button")[0].textContent);

describe("StudioProjectList archive", () => {
  it("lists every campaign when nothing is filtered", () => {
    setup();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("shows an export badge only for projects that exported", () => {
    setup();
    expect(screen.getByText("3 exported")).toBeInTheDocument();
    expect(screen.queryByText("0 exported")).not.toBeInTheDocument();
  });

  it("searches titles", () => {
    setup();
    fireEvent.change(screen.getByPlaceholderText("Search campaigns"), {
      target: { value: "testimonial" },
    });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(titles()[0]).toContain("Testimonial one");
  });

  it("searches facet labels, not just the title", () => {
    setup();
    // "Carousel" appears nowhere in any title; it is the ad type.
    fireEvent.change(screen.getByPlaceholderText("Search campaigns"), {
      target: { value: "carousel" },
    });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(titles()[0]).toContain("Curriculum reveal");
  });

  it("filters by campaign tag", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Sprouts" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("combines filters as AND across facets", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Sprouts" }));
    fireEvent.click(screen.getByRole("button", { name: "Exported" }));
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(1);
    expect(titles()[0]).toContain("Preorder push");
  });

  it("treats multiple values within one facet as OR", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Sprouts" }));
    fireEvent.click(screen.getByRole("button", { name: "Seedlings" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("reports the filtered count and clears back to everything", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Sprouts" }));
    expect(screen.getByText(/2 of 3/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("says so when filters match nothing, rather than looking empty", () => {
    setup();
    fireEvent.change(screen.getByPlaceholderText("Search campaigns"), {
      target: { value: "zzzz" },
    });
    expect(screen.getByText(/nothing matches/i)).toBeInTheDocument();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("passes the right project to duplicate", () => {
    // Declared here rather than read off the spread props, whose type widens
    // to the plain callback signature and loses the mock surface.
    const onDuplicate = vi.fn();
    setup({ onDuplicate });
    const row = screen.getAllByRole("listitem")[1];
    fireEvent.click(within(row).getByRole("button", { name: "Duplicate" }));
    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(onDuplicate.mock.calls[0][0].id).toBe("b");
  });
});
