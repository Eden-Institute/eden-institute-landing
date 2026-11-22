// The Wired preview pass rides in /wired#preview=<pass> (founder tap 2026-11-22, "Phone link by QR").
// These tests pin that the head script wipes the hash from the address bar, saves the pass under the key
// web/lib/wiredApi.ts reads, clears it on #preview=clear, still wipes the URL when storage is blocked,
// leaves every other URL alone, and acts only on /wired pages.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  WIRED_PILOT_HASH_PARAM,
  WIRED_PILOT_STORAGE_KEY,
  WIRED_PREVIEW_CLEAR,
  WIRED_PREVIEW_HASH_PARAM,
  WIRED_PREVIEW_STORAGE_KEY,
  WIRED_PREVIEW_STRIP_JS,
  isWiredPath,
} from "@/lib/wiredPreviewLink";
import { PILOT_KEY, PREVIEW_KEY } from "../../web/lib/wiredApi";
import marketingLayout from "../../web/layouts/MarketingLayout.astro?raw";

const PASS = "pass_ABC-123_xyz";

function go(url: string) {
  window.history.replaceState(null, "", url);
}
function runStrip() {
  new Function(WIRED_PREVIEW_STRIP_JS)();
}
function here() {
  return window.location.pathname + window.location.search + window.location.hash;
}

describe("wiredPreviewLink", () => {
  beforeEach(() => {
    localStorage.clear();
    go("/");
  });
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    go("/");
  });

  it("saves under the key wiredApi reads, with the literals the script uses", () => {
    expect(WIRED_PREVIEW_STORAGE_KEY).toBe(PREVIEW_KEY);
    expect(WIRED_PILOT_STORAGE_KEY).toBe(PILOT_KEY);
    expect(WIRED_PREVIEW_STRIP_JS).toContain(`'${WIRED_PREVIEW_STORAGE_KEY}'`);
    expect(WIRED_PREVIEW_STRIP_JS).toContain(`'${WIRED_PILOT_STORAGE_KEY}'`);
    expect(WIRED_PREVIEW_STRIP_JS).toContain(`'#${WIRED_PREVIEW_HASH_PARAM}='`);
    expect(WIRED_PREVIEW_STRIP_JS).toContain(`'#${WIRED_PILOT_HASH_PARAM}='`);
    expect(WIRED_PREVIEW_STRIP_JS).toContain(`'${WIRED_PREVIEW_CLEAR}'`);
  });

  it("wipes the hash and saves the pass on /wired", () => {
    go(`/wired#preview=${PASS}`);
    runStrip();
    expect(here()).toBe("/wired");
    expect(window.location.href).not.toContain(PASS);
    expect(localStorage.getItem(PREVIEW_KEY)).toBe(PASS);
  });

  it("keeps the query string (the ?p= placement) and works on /wired/ subpages", () => {
    go(`/wired?p=header#preview=${PASS}`);
    runStrip();
    expect(here()).toBe("/wired?p=header");
    expect(localStorage.getItem(PREVIEW_KEY)).toBe(PASS);

    localStorage.clear();
    go(`/wired/results#preview=${PASS}`);
    runStrip();
    expect(here()).toBe("/wired/results");
    expect(localStorage.getItem(PREVIEW_KEY)).toBe(PASS);
  });

  it("decodes a percent-encoded pass", () => {
    go(`/wired#preview=${encodeURIComponent("a+b/c=")}`);
    runStrip();
    expect(localStorage.getItem(PREVIEW_KEY)).toBe("a+b/c=");
    expect(here()).toBe("/wired");
  });

  it("#preview=clear removes a saved pass", () => {
    localStorage.setItem(PREVIEW_KEY, PASS);
    go("/wired#preview=clear");
    runStrip();
    expect(localStorage.getItem(PREVIEW_KEY)).toBeNull();
    expect(here()).toBe("/wired");
  });

  it("an empty pass wipes the hash and saves nothing", () => {
    go("/wired#preview=");
    runStrip();
    expect(here()).toBe("/wired");
    expect(localStorage.getItem(PREVIEW_KEY)).toBeNull();
  });

  it("still wipes the URL when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    go(`/wired#preview=${PASS}`);
    expect(() => runStrip()).not.toThrow();
    expect(here()).toBe("/wired");
    expect(window.location.href).not.toContain(PASS);
  });

  it("leaves other hashes and other pages alone", () => {
    go("/wired#top");
    runStrip();
    expect(here()).toBe("/wired#top");

    go(`/books#preview=${PASS}`);
    runStrip();
    expect(here()).toBe(`/books#preview=${PASS}`);
    expect(localStorage.getItem(PREVIEW_KEY)).toBeNull();

    go(`/wiredx#preview=${PASS}`);
    runStrip();
    expect(localStorage.getItem(PREVIEW_KEY)).toBeNull();
  });

  it("#pilot= (the You're-in button) is wiped first and saved under its own key, not the preview key", () => {
    const TOKEN = "eyJ2IjoxfQ.sig_part-1";
    go(`/wired?utm_source=email&utm_content=pilot_selected#pilot=${TOKEN}`);
    runStrip();
    expect(here()).toBe("/wired?utm_source=email&utm_content=pilot_selected");
    expect(window.location.href).not.toContain(TOKEN);
    expect(localStorage.getItem(PILOT_KEY)).toBe(TOKEN);
    expect(localStorage.getItem(PREVIEW_KEY)).toBeNull();

    go("/wired#pilot=clear");
    runStrip();
    expect(localStorage.getItem(PILOT_KEY)).toBeNull();

    go(`/books#pilot=${TOKEN}`);
    runStrip();
    expect(here()).toBe(`/books#pilot=${TOKEN}`);
    expect(localStorage.getItem(PILOT_KEY)).toBeNull();
  });

  it("isWiredPath matches /wired and its subpages only", () => {
    expect(isWiredPath("/wired")).toBe(true);
    expect(isWiredPath("/wired/")).toBe(true);
    expect(isWiredPath("/wired/results")).toBe(true);
    expect(isWiredPath("/wiredx")).toBe(false);
    expect(isWiredPath("/")).toBe(false);
    expect(isWiredPath("/curriculum-finder")).toBe(false);
  });

  it("the layout runs it right after the checkout strip, before any tag", () => {
    const strip = marketingLayout.indexOf("set:html={CHECKOUT_SESSION_STRIP_JS}");
    const wired = marketingLayout.indexOf("set:html={WIRED_PREVIEW_STRIP_JS}");
    const firstTag = marketingLayout.indexOf("{!noThirdPartyTags && (<>");
    expect(strip).toBeGreaterThan(-1);
    expect(wired).toBeGreaterThan(strip);
    expect(firstTag).toBeGreaterThan(wired);
    expect(marketingLayout).toContain("{wiredPage && <script is:inline set:html={WIRED_PREVIEW_STRIP_JS}></script>}");
  });
});
