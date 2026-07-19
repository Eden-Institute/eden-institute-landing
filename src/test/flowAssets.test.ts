// Media persistence. The failure this guards against is quiet and expensive:
// an ad looks perfect when it is made, and every picture is gone when it is
// reopened tomorrow, because what got saved was a URL that had already expired.
//
// So the rule under test is: the bucket path is the only durable handle, and
// anything that never reached the bucket is reported rather than left pointing
// at a dead link.

import { describe, expect, it, vi } from "vitest";
import {
  isPersisted, kindForMime, listSavedSlides, resolveSlideUrls, signedUrlFor,
  unsavedSlides, uploadSlide,
} from "@/studio/flow-assets";
import type { AssetsPort } from "@/studio/flow-assets";
import type { SlideAnswer } from "@/studio/flow-graph";

function port(over: Partial<AssetsPort> = {}): AssetsPort {
  return {
    list: vi.fn().mockResolvedValue([]),
    upload: vi.fn().mockResolvedValue({ path: "1700-photo.jpg" }),
    url: vi.fn(async (name: string) => `https://signed.example/${name}?token=abc`),
    remove: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}
const file = (name = "photo.jpg", type = "image/jpeg", size = 1000) =>
  new File([new Uint8Array(size)], name, { type });

describe("uploading", () => {
  it("keeps the bucket path, which is what survives a refresh", async () => {
    const { slide, error } = await uploadSlide(file(), port(), "blob:local");
    expect(error).toBeNull();
    expect(slide.path).toBe("1700-photo.jpg");
    expect(isPersisted(slide)).toBe(true);
  });

  it("shows the local file straight away rather than waiting on the upload", async () => {
    const { slide } = await uploadSlide(file(), port(), "blob:local");
    expect(slide.url).toBe("blob:local");
  });

  it("recognises a video from its type", async () => {
    const { slide } = await uploadSlide(file("clip.mp4", "video/mp4"), port(), "blob:v");
    expect(slide.kind).toBe("video");
    expect(kindForMime("image/heic")).toBe("image");
  });

  it("keeps the work when the upload fails, and says it is not saved", async () => {
    const failing = port({ upload: vi.fn().mockRejectedValue(new Error("network down")) });
    const { slide, error } = await uploadSlide(file(), failing, "blob:local");
    // losing her photo over a network blip would be worse than telling her
    expect(slide.url).toBe("blob:local");
    expect(isPersisted(slide)).toBe(false);
    expect(error).toMatch(/network down/);
  });

  it("works with no bucket at all, unsaved", async () => {
    const { slide, error } = await uploadSlide(file(), undefined, "blob:local");
    expect(error).toBeNull();
    expect(isPersisted(slide)).toBe(false);
  });
});

describe("reopening a campaign", () => {
  const saved: SlideAnswer[] = [
    { id: "p1", path: "p1.jpg", kind: "image", url: "https://signed.example/p1.jpg?token=EXPIRED" },
  ];

  it("mints a fresh signed url instead of trusting the saved one", async () => {
    const p = port();
    const { slides } = await resolveSlideUrls(saved, p);
    expect(p.url).toHaveBeenCalledWith("p1.jpg");
    expect(slides[0].url).toContain("token=abc");
    expect(slides[0].url).not.toContain("EXPIRED");
  });

  it("drops a blob url from a dead tab rather than painting a broken frame", async () => {
    const { slides, lost } = await resolveSlideUrls(
      [{ id: "l1", kind: "image", url: "blob:gone" }], port(),
    );
    expect(slides).toHaveLength(0);
    expect(lost).toBe(1);
  });

  it("reports a file that is in the bucket but unreadable", async () => {
    const p = port({ url: vi.fn().mockRejectedValue(new Error("403")) });
    const { slides, lost } = await resolveSlideUrls(saved, p);
    expect(slides).toHaveLength(0);
    expect(lost).toBe(1);
  });

  it("keeps the good ones when only some are lost", async () => {
    const p = port();
    const { slides, lost } = await resolveSlideUrls(
      [...saved, { id: "l1", kind: "image", url: "blob:gone" }], p,
    );
    expect(slides.map((s) => s.id)).toEqual(["p1"]);
    expect(lost).toBe(1);
  });

  it("does nothing to an ad that has no media", async () => {
    const { slides, lost } = await resolveSlideUrls(undefined, port());
    expect(slides).toEqual([]);
    expect(lost).toBe(0);
  });
});

describe("warning about unsaved media", () => {
  it("counts only what never reached the bucket", () => {
    const slides: SlideAnswer[] = [
      { id: "a", path: "a.jpg", kind: "image" },
      { id: "b", kind: "image", url: "blob:b" },
      { id: "c", kind: "video", url: "blob:c" },
    ];
    expect(unsavedSlides(slides).map((s) => s.id)).toEqual(["b", "c"]);
  });

  it("says nothing when everything is saved", () => {
    expect(unsavedSlides([{ id: "a", path: "a.jpg", kind: "image" }])).toEqual([]);
  });
});

describe("the saved library", () => {
  it("offers saved assets as slides that already carry their path", async () => {
    const p = port({
      list: vi.fn().mockResolvedValue([
        { name: "a.jpg", id: "1", filename: "kitchen.jpg", kind: "image",
          campaign_tag: "general", source: "upload" },
        { name: "b.mp4", id: "2", filename: "clip.mp4", kind: "video",
          campaign_tag: "general", source: "canva" },
      ]),
    });
    const slides = await listSavedSlides(p);
    expect(slides[0]).toMatchObject({ path: "a.jpg", kind: "image", name: "kitchen.jpg", own: true });
    expect(slides[1]).toMatchObject({ path: "b.mp4", kind: "video", own: false });
    expect(slides.every(isPersisted)).toBe(true);
  });

  it("returns nothing rather than throwing when there is no bucket", async () => {
    expect(await listSavedSlides(undefined)).toEqual([]);
  });

  it("signs a thumbnail only when asked", async () => {
    const p = port();
    const url = await signedUrlFor({ id: "a", path: "a.jpg", kind: "image" }, p);
    expect(url).toContain("signed.example/a.jpg");
  });

  it("returns null rather than throwing if signing fails", async () => {
    const p = port({ url: vi.fn().mockRejectedValue(new Error("nope")) });
    expect(await signedUrlFor({ id: "a", path: "a.jpg", kind: "image" }, p)).toBeNull();
  });
});
