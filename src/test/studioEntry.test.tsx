// Phase 1: the merged entry screen is the one new piece of UI logic that can be
// exercised without a founder session, so it is worth pinning down. What matters
// is the payload it hands to createProject and the platform guard, since an
// empty platforms array would hit a database CHECK constraint rather than a
// friendly message.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import StudioEntry from "@/studio/StudioEntry";

function setup() {
  const onCreate = vi.fn();
  const onCancel = vi.fn();
  render(<StudioEntry onCreate={onCreate} onCancel={onCancel} />);
  return { onCreate, onCancel };
}

describe("StudioEntry", () => {
  it("defaults to both platforms, the kit, and a feed post", () => {
    const { onCreate } = setup();
    fireEvent.click(screen.getByRole("button", { name: /open the workroom/i }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate.mock.calls[0][0]).toMatchObject({
      product: "kit",
      ad_type: "feed",
      campaign_tag: "general",
      platforms: ["instagram", "facebook"],
    });
  });

  it("carries all four merged answers through, including carousel", () => {
    const { onCreate } = setup();

    fireEvent.click(screen.getByText("Practitioner Program"));
    fireEvent.click(screen.getByText("Carousel"));
    fireEvent.click(screen.getByRole("button", { name: "Facebook" }));
    fireEvent.change(screen.getByLabelText(/campaign/i), {
      target: { value: "seedlings" },
    });
    fireEvent.change(screen.getByLabelText(/name it/i), {
      target: { value: "Fall launch" },
    });
    fireEvent.click(screen.getByRole("button", { name: /open the workroom/i }));

    expect(onCreate).toHaveBeenCalledWith({
      title: "Fall launch",
      product: "practitioner",
      platforms: ["instagram"],
      ad_type: "carousel",
      campaign_tag: "seedlings",
    });
  });

  it("blocks submission when every platform is deselected", () => {
    const { onCreate } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Instagram" }));
    fireEvent.click(screen.getByRole("button", { name: "Facebook" }));

    expect(screen.getByText(/pick at least one platform/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /open the workroom/i }));
    expect(onCreate).not.toHaveBeenCalled();
  });
});
