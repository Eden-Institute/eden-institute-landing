// Export. The browser APIs here (MediaRecorder, canvas.captureStream, the share
// sheet) do not exist in jsdom, so what is testable in this file is the
// decision-making around them: what the file is called, how long the video
// should run, which destination the founder is sent to, and that an
// unsupported browser is reported rather than silently doing nothing.
//
// The recording itself is verified in a real browser.

import { describe, expect, it, vi, afterEach } from "vitest";
import {
  HANDOFF_LINKS, destinationUrl, downloadBlob, explainExportFailure,
  exportFilename, nextStepText, saveToDevice, suggestedDuration,
  supportsMicRecording, supportsVideoExport,
} from "@/studio/flow-export";
import type { FlowAnswers } from "@/studio/flow-graph";

const base = (over: Partial<FlowAnswers> = {}): FlowAnswers => ({
  platforms: "both", adType: "story", product: "kit", objective: "sales",
  audience: "homeschool", angle: "children", source: "media",
  slides: [{ id: "a", kind: "video" }], treatment: "scrolling",
  ...over,
});

afterEach(() => { vi.unstubAllGlobals(); });

describe("export · naming the file", () => {
  it("says what the ad is, so a camera roll stays navigable", () => {
    expect(exportFilename(base(), "mp4")).toBe("eden-kit-story.mp4");
    expect(exportFilename(base({ product: "course", adType: "feed" }), "png"))
      .toBe("eden-course-feed.png");
  });

  it("never lets a product name break the filename", () => {
    expect(exportFilename(base({ product: "a b/c:d" }), "png"))
      .toBe("eden-a-b-c-d-story.png");
  });

  it("copes with an ad that has barely been started", () => {
    expect(exportFilename({}, "png")).toBe("eden-ad-ad.png");
  });
});

describe("export · how long the video runs", () => {
  it("gives the credits time to roll through once", () => {
    const short = suggestedDuration(base({ credits: { text: "one", speed: 5, startDelaySec: 0 } }));
    const long = suggestedDuration(base({
      credits: { text: "one\ntwo\nthree\nfour\nfive\nsix", speed: 5, startDelaySec: 0 },
    }));
    expect(long).toBeGreaterThan(short);
  });

  it("never cuts the narration off", () => {
    const d = suggestedDuration(base({
      sound: { mode: "narration", narration: { name: "v", durationSec: 22 } },
    }));
    expect(d).toBeGreaterThanOrEqual(22);
  });

  it("stays inside Meta's limit however long the narration is", () => {
    const d = suggestedDuration(base({
      sound: { mode: "narration", narration: { name: "v", durationSec: 400 } },
    }));
    expect(d).toBeLessThanOrEqual(60);
  });

  it("is never so short it cannot be read", () => {
    expect(suggestedDuration({})).toBeGreaterThanOrEqual(8);
  });
});

describe("export · where the ad points", () => {
  it("tags the destination with the campaign, so clicks are attributable", () => {
    const url = new URL(destinationUrl(base()));
    expect(url.searchParams.get("utm_medium")).toBe("paid_social");
    expect(url.searchParams.get("utm_campaign")).toBe("edens_table_kit");
    expect(url.searchParams.get("utm_content")).toBe("children");
    expect(url.origin + url.pathname).toContain("edeninstitute.health");
  });

  it("attributes to the platform actually being posted to", () => {
    expect(new URL(destinationUrl(base({ platforms: "facebook" })))
      .searchParams.get("utm_source")).toBe("facebook");
    expect(new URL(destinationUrl(base({ platforms: "instagram" })))
      .searchParams.get("utm_source")).toBe("instagram");
  });

  it("does not lose an existing query string on the product url", () => {
    const url = destinationUrl(base({ product: "quiz" }));
    expect(url).toContain("utm_medium=paid_social");
    expect(url.split("?").length).toBeLessThanOrEqual(2);
  });
});

describe("export · telling her what to do next", () => {
  it("names the thing she is about to save", () => {
    expect(nextStepText(base({ pathway: "native" }))).toMatch(/video/);
    expect(nextStepText(base({
      pathway: "native", slides: [{ id: "a", kind: "image" }], treatment: "static",
    }))).toMatch(/image/);
  });

  it("gives a different instruction per destination", () => {
    const seen = new Set(["native", "canva", "bsuite", "local"]
      .map((p) => nextStepText(base({ pathway: p as FlowAnswers["pathway"] }))));
    expect(seen.size).toBe(4);
  });

  it("points at Meta and Canva, not at a made-up URL", () => {
    expect(HANDOFF_LINKS.adsManager).toContain("adsmanager.facebook.com");
    expect(HANDOFF_LINKS.businessSuite).toContain("business.facebook.com");
    expect(HANDOFF_LINKS.canva).toContain("canva.com");
    expect(HANDOFF_LINKS.soundCollection).toContain("facebook.com/sound/collection");
  });
});

describe("export · being honest about what the browser can do", () => {
  it("reports no recorder rather than pretending", () => {
    vi.stubGlobal("MediaRecorder", undefined);
    expect(supportsVideoExport()).toBe(false);
    expect(supportsMicRecording()).toBe(false);
  });

  it("every failure has a plain-language explanation", () => {
    for (const reason of ["no-recorder", "no-capture", "no-format", "no-canvas", "failed"] as const) {
      const text = explainExportFailure(reason);
      expect(text.length).toBeGreaterThan(20);
      expect(text).not.toMatch(/undefined|null|Error/);
    }
  });
});

describe("export · saving", () => {
  it("uses the share sheet when there is one, since that is the only route to Photos", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share, canShare: () => true });
    const out = await saveToDevice(new Blob(["x"]), "eden.mp4");
    expect(out).toBe("shared");
    expect(share).toHaveBeenCalled();
  });

  it("reports a cancelled share as cancelled, not as a failure", async () => {
    const err = Object.assign(new Error("cancel"), { name: "AbortError" });
    vi.stubGlobal("navigator", { share: vi.fn().mockRejectedValue(err), canShare: () => true });
    expect(await saveToDevice(new Blob(["x"]), "eden.mp4")).toBe("cancelled");
  });

  it("falls back to a download when the share sheet is unavailable", async () => {
    vi.stubGlobal("navigator", {});
    const clicked = vi.fn();
    const orig = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = orig(tag) as HTMLElement;
      if (tag === "a") (el as HTMLAnchorElement).click = clicked;
      return el;
    });
    vi.stubGlobal("URL", { createObjectURL: () => "blob:x", revokeObjectURL: () => {} });
    expect(await saveToDevice(new Blob(["x"]), "eden.png")).toBe("downloaded");
    expect(clicked).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("a download carries the filename, so it is not saved as 'download'", () => {
    let named = "";
    const orig = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = orig(tag) as HTMLElement;
      if (tag === "a") {
        (el as HTMLAnchorElement).click = () => { named = (el as HTMLAnchorElement).download; };
      }
      return el;
    });
    vi.stubGlobal("URL", { createObjectURL: () => "blob:x", revokeObjectURL: () => {} });
    downloadBlob(new Blob(["x"]), "eden-kit-story.mp4");
    expect(named).toBe("eden-kit-story.mp4");
    vi.restoreAllMocks();
  });
});
