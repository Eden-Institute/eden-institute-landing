// The Stripe Checkout session id is a bearer credential. These tests pin that
// the first head script takes ONLY session_id out of the address bar (other
// params and the hash stay), keeps it for the page in sessionStorage and a
// window global, still strips it when storage is blocked, that the pages can read
// it back on the same path (including after a reload), and that the copies in
// index.html and MarketingLayout.astro are the script under test and run first.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHECKOUT_SESSION_PARAM,
  CHECKOUT_SESSION_STORAGE_KEY,
  CHECKOUT_SESSION_STRIP_JS,
  readCheckoutSessionId,
} from "@/lib/checkoutSession";
import indexHtml from "../../index.html?raw";
import marketingLayout from "../../web/layouts/MarketingLayout.astro?raw";

type W = { __edenCheckoutSession?: unknown } & Record<string, unknown>;
const w = () => window as unknown as W;

const SESSION = "cs_test_ABC";

function go(url: string) {
  window.history.replaceState(null, "", url);
}
function runStrip() {
  new Function(CHECKOUT_SESSION_STRIP_JS)();
}
function here() {
  return window.location.pathname + window.location.search + window.location.hash;
}
/** Drops indentation so an indented copy inside HTML compares equal. */
function norm(s: string): string {
  return s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "")
    .join("\n");
}

describe("checkoutSession", () => {
  beforeEach(() => {
    sessionStorage.clear();
    delete w().__edenCheckoutSession;
    go("/");
  });
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    delete w().__edenCheckoutSession;
    go("/");
  });

  describe("strip script", () => {
    it("removes session_id from the URL and keeps it for this path", () => {
      go(`/books/thank-you?session_id=${SESSION}`);
      runStrip();
      expect(here()).toBe("/books/thank-you");
      expect(window.location.href).not.toContain(SESSION);
      expect(JSON.parse(sessionStorage.getItem(CHECKOUT_SESSION_STORAGE_KEY) as string)).toEqual({
        id: SESSION,
        path: "/books/thank-you",
      });
      expect(w().__edenCheckoutSession).toEqual({ id: SESSION, path: "/books/thank-you" });
    });

    it("keeps every other param byte for byte, in order, and the hash", () => {
      go(`/homeschool/welcome?utm_source=a%20b&session_id=${SESSION}&lookup_key=sprouts+complete&flag#top`);
      runStrip();
      expect(here()).toBe("/homeschool/welcome?utm_source=a%20b&lookup_key=sprouts+complete&flag#top");
      expect(readCheckoutSessionId()).toBe(SESSION);
    });

    it("removes an encoded or repeated session_id key and keeps the first value", () => {
      go(`/starter/thank-you?session%5Fid=${SESSION}&session_id=cs_test_second`);
      runStrip();
      expect(here()).toBe("/starter/thank-you");
      expect(readCheckoutSessionId()).toBe(SESSION);
    });

    it("strips an empty session_id without storing anything", () => {
      go("/books/thank-you?session_id=&x=1");
      runStrip();
      expect(here()).toBe("/books/thank-you?x=1");
      expect(sessionStorage.getItem(CHECKOUT_SESSION_STORAGE_KEY)).toBeNull();
      expect(w().__edenCheckoutSession).toBeUndefined();
    });

    it("leaves a URL without session_id alone and stores nothing", () => {
      go("/books?checkout=cancelled#faq");
      const spy = vi.spyOn(window.history, "replaceState");
      runStrip();
      expect(spy).not.toHaveBeenCalled();
      expect(here()).toBe("/books?checkout=cancelled#faq");
      expect(sessionStorage.getItem(CHECKOUT_SESSION_STORAGE_KEY)).toBeNull();
    });

    it("preserves history.state (the SPA router keeps its own there)", () => {
      window.history.replaceState({ idx: 0, key: "k1" }, "", `/guide/the-oak?session_id=${SESSION}`);
      runStrip();
      expect(window.history.state).toEqual({ idx: 0, key: "k1" });
      expect(here()).toBe("/guide/the-oak");
    });

    it("still strips when sessionStorage is blocked, and the window global carries the id", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("blocked");
      });
      go(`/starter/thank-you?session_id=${SESSION}`);
      expect(() => runStrip()).not.toThrow();
      expect(here()).toBe("/starter/thank-you");
      expect(readCheckoutSessionId()).toBe(SESSION);
    });

    it("never throws, even when replaceState does", () => {
      vi.spyOn(window.history, "replaceState").mockImplementation(() => {
        throw new Error("SecurityError");
      });
      window.history.pushState(null, "", `/books/thank-you?session_id=${SESSION}`);
      expect(() => runStrip()).not.toThrow();
      expect(readCheckoutSessionId()).toBe(SESSION);
    });

    it("uses the same names the TypeScript reader uses", () => {
      expect(CHECKOUT_SESSION_STRIP_JS).toContain(`'${CHECKOUT_SESSION_STORAGE_KEY}'`);
      expect(CHECKOUT_SESSION_STRIP_JS).toContain(`'${CHECKOUT_SESSION_PARAM}'`);
    });
  });

  describe("readCheckoutSessionId", () => {
    it("prefers the URL", () => {
      w().__edenCheckoutSession = { id: "cs_test_window", path: "/books/thank-you" };
      go("/books/thank-you?session_id=cs_test_url");
      expect(readCheckoutSessionId()).toBe("cs_test_url");
    });

    it("then the window global, on the same path only", () => {
      w().__edenCheckoutSession = { id: "cs_test_window", path: "/books/thank-you" };
      sessionStorage.setItem(CHECKOUT_SESSION_STORAGE_KEY, JSON.stringify({ id: "cs_test_stored", path: "/books/thank-you" }));
      go("/books/thank-you");
      expect(readCheckoutSessionId()).toBe("cs_test_window");
    });

    it("restores from sessionStorage after a reload in the same tab", () => {
      go(`/books/thank-you?session_id=${SESSION}`);
      runStrip();
      delete w().__edenCheckoutSession; // a reload starts with a fresh window
      expect(here()).toBe("/books/thank-you");
      expect(readCheckoutSessionId()).toBe(SESSION);
    });

    it("tolerates a trailing slash on either side", () => {
      sessionStorage.setItem(CHECKOUT_SESSION_STORAGE_KEY, JSON.stringify({ id: SESSION, path: "/starter/thank-you" }));
      go("/starter/thank-you/");
      expect(readCheckoutSessionId()).toBe(SESSION);
    });

    it("does not hand one page's id to a different page", () => {
      go(`/books/thank-you?session_id=${SESSION}`);
      runStrip();
      go("/starter/thank-you");
      expect(readCheckoutSessionId()).toBeNull();
      go("/books");
      expect(readCheckoutSessionId()).toBeNull();
    });

    it("returns null for malformed or blocked storage", () => {
      go("/books/thank-you");
      sessionStorage.setItem(CHECKOUT_SESSION_STORAGE_KEY, "{not json");
      expect(readCheckoutSessionId()).toBeNull();
      sessionStorage.setItem(CHECKOUT_SESSION_STORAGE_KEY, JSON.stringify({ id: "", path: "/books/thank-you" }));
      expect(readCheckoutSessionId()).toBeNull();
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("blocked");
      });
      expect(readCheckoutSessionId()).toBeNull();
    });
  });

  describe("wiring", () => {
    it("index.html runs a verbatim copy as its first script", () => {
      const first = indexHtml.match(/<script\b[^>]*>([\s\S]*?)<\/script>/);
      expect(first).not.toBeNull();
      expect(norm((first as RegExpMatchArray)[1])).toBe(norm(CHECKOUT_SESSION_STRIP_JS));
    });

    it("MarketingLayout.astro emits it as the first script in the head", () => {
      const markup = marketingLayout.split(/^---\s*$/m).slice(2).join("---");
      const firstScript = markup.match(/<script\b[^>]*>/);
      expect(firstScript).not.toBeNull();
      expect((firstScript as RegExpMatchArray)[0]).toContain("set:html={CHECKOUT_SESSION_STRIP_JS}");
      expect(marketingLayout).toContain('import { CHECKOUT_SESSION_STRIP_JS } from "@/lib/checkoutSession";');
    });
  });
});
