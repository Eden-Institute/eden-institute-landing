// The flow screen. flow-graph decides the branching and is tested separately,
// so what matters here is that the screen honours it: the right question is
// shown, an answer moves on, Continue stays locked until the answer is real,
// and going back does not lose work.
//
// jsdom has no canvas, so paintAd is a no-op here. That is fine: what the ad
// LOOKS like is verified in a real browser, what the flow DOES is verified here.

import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import StudioFlow from "@/studio/StudioFlow";
import type { FlowAnswers } from "@/studio/flow-graph";
import { PRODUCTS } from "@/studio/studio-banks";

/** The flow is controlled, so tests drive it through a real state holder
 *  rather than re-implementing the update rules. */
function Harness({ initial = {} as FlowAnswers }) {
  const [answers, setAnswers] = useState<FlowAnswers>(initial);
  return (
    <>
      <StudioFlow answers={answers} onChange={setAnswers} />
      <div data-testid="answers" hidden>{JSON.stringify(answers)}</div>
    </>
  );
}

const answers = (): FlowAnswers =>
  JSON.parse(screen.getByTestId("answers").textContent || "{}");
const heading = () => screen.getByRole("heading", { level: 1 }).textContent || "";
const option = (text: string | RegExp) =>
  screen.getAllByRole("button").find((b) => (typeof text === "string"
    ? b.textContent?.includes(text) : text.test(b.textContent || "")))!;
const continueBtn = () =>
  screen.getAllByRole("button").find((b) => b.textContent?.trim() === "Continue");

describe("StudioFlow · asking one question at a time", () => {
  it("opens on the first question", () => {
    render(<Harness />);
    expect(heading()).toMatch(/Where is this ad going/i);
  });

  it("records an answer and moves on", () => {
    render(<Harness />);
    fireEvent.click(option("Instagram"));
    expect(answers().platforms).toBe("instagram");
    expect(heading()).toMatch(/What kind of ad/i);
  });

  it("shows the answers so far as chips", () => {
    render(<Harness />);
    fireEvent.click(option("Both"));
    expect(screen.getByTitle("Change this").textContent).toContain("IG + FB");
  });

  it("a visible choice waits for Continue instead of jumping away", () => {
    render(<Harness initial={{ platforms: "both" }} />);
    expect(heading()).toMatch(/What kind of ad/i);
    expect(continueBtn()).toBeDisabled();
    fireEvent.click(option("Story / Reel"));
    // still on the same question, so she can see it land on the preview
    expect(heading()).toMatch(/What kind of ad/i);
    expect(answers().adType).toBe("story");
    expect(continueBtn()).not.toBeDisabled();
    fireEvent.click(continueBtn()!);
    expect(heading()).toMatch(/What are you selling/i);
  });

  it("only offers angles the chosen product actually sells", () => {
    render(<Harness initial={{
      platforms: "both", adType: "feed", product: "quiz",
      objective: "leads", audience: "mom2am",
    }} />);
    expect(heading()).toMatch(/angle/i);
    const offered = screen.getAllByRole("button")
      .filter((b) => b.className.includes("ef-opt"));
    expect(offered.length).toBe(PRODUCTS.quiz.angles.length);
    // a kit-only angle must not be reachable from the quiz
    expect(screen.queryByText("Founding Families")).toBeNull();
    expect(screen.queryByText("Teach Your Children")).toBeNull();
  });

  it("badges the recommended angle without removing the others", () => {
    render(<Harness initial={{
      platforms: "both", adType: "feed", product: "kit",
      objective: "sales", audience: "homeschool",
    }} />);
    expect(screen.getAllByText(/Recommended/).length).toBeGreaterThan(0);
    // all seven kit angles are still there to choose from
    const buttons = screen.getAllByRole("button")
      .filter((b) => b.className.includes("ef-opt"));
    expect(buttons.length).toBe(PRODUCTS.kit.angles.length);
  });

  it("lets her go back, and keeps what she already answered", () => {
    render(<Harness />);
    fireEvent.click(option("Both"));
    fireEvent.click(option("Feed 1:1"));
    fireEvent.click(continueBtn()!);
    expect(heading()).toMatch(/What are you selling/i);
    fireEvent.click(option("◂ Back"));
    expect(heading()).toMatch(/What kind of ad/i);
    expect(answers().adType).toBe("feed");
  });

  it("a chip jumps back to that one question", () => {
    render(<Harness />);
    fireEvent.click(option("Both"));
    fireEvent.click(option("Feed 1:1"));
    fireEvent.click(continueBtn()!);
    fireEvent.click(screen.getAllByTitle("Change this")[0]);
    expect(heading()).toMatch(/Where is this ad going/i);
    expect(answers().adType).toBe("feed");     // later answers survive
  });

  it("an optional question can be passed over", () => {
    render(<Harness initial={{
      platforms: "both", adType: "feed", product: "kit", objective: "sales",
      audience: "homeschool", angle: "children",
    }} />);
    expect(heading()).toMatch(/your own words/i);
    fireEvent.click(option("Skip"));
    expect(answers().direction).toBeNull();
    expect(heading()).toMatch(/How should this ad look/i);
  });

  it("says so when a change invalidates an earlier answer", () => {
    render(<Harness initial={{
      platforms: "both", adType: "feed", product: "kit", objective: "sales",
      audience: "homeschool", angle: "preorder", direction: null,
    }} />);
    fireEvent.click(screen.getAllByTitle("Change this")
      .find((c) => c.textContent?.includes("Curriculum Kit"))!);
    fireEvent.click(option("Constitutional Quiz"));
    // the kit-only angle cannot survive the switch, and she is told once
    expect(answers().angle).toBeUndefined();
    expect(screen.getByRole("status").textContent).toMatch(/reset one earlier answer/i);
  });
});

describe("StudioFlow · not letting a half-made ad through", () => {
  it("keeps Continue locked until the caption has something in it", () => {
    render(<Harness initial={{
      platforms: "both", adType: "feed", product: "kit", objective: "sales",
      audience: "homeschool", angle: "children", direction: null,
      source: "branded", template: "label", copyMode: "own",
      own: { primary: "x" }, caption: "",
    }} />);
    expect(heading()).toMatch(/Confirm the caption/i);
    expect(continueBtn()).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox"),
      { target: { value: "One herb a week, all year long." } });
    expect(continueBtn()).not.toBeDisabled();
  });

  it("will not accept a media step with nothing chosen", () => {
    render(<Harness initial={{
      platforms: "both", adType: "feed", product: "kit", objective: "sales",
      audience: "homeschool", angle: "children", direction: null,
      source: "media", slides: [],
    }} />);
    expect(heading()).toMatch(/Pick your media/i);
    expect(continueBtn()).toBeDisabled();
  });

  it("offers a real file input that does not exclude an iPhone camera roll", () => {
    const { container } = render(<Harness initial={{
      platforms: "both", adType: "feed", product: "kit", objective: "sales",
      audience: "homeschool", angle: "children", direction: null, source: "media",
    }} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.accept).toContain("image/*");
    expect(input.accept).toContain("video/*");
    // a jpeg/mp4 allow-list greys out HEIC photos and HEVC clips
    expect(input.accept).not.toMatch(/image\/jpeg|video\/mp4/);
    expect(input.multiple).toBe(true);
  });
});
