// The Stripe Checkout session id, the Starter Unit download token (?t= on
// /starter/downloads) and the partner sample key (?k= on /partner-sample) are
// bearer credentials. These tests pin that the first head script takes ONLY those
// params out of the address bar (other params and the hash stay), and t and k only
// on their own page; keeps session_id for the tab in sessionStorage and t and k for
// the device in localStorage (sessionStorage when localStorage is blocked), each
// with a window global; still strips when storage is blocked; that the pages can
// read them back on the same path (including after a reload, and for t and k on a
// return to the clean URL); and that the copies in index.html and
// MarketingLayout.astro are the script under test and run first.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHECKOUT_SESSION_PARAM,
  CHECKOUT_SESSION_STORAGE_KEY,
  CHECKOUT_SESSION_STRIP_JS,
  URL_TOKEN_PAGES,
  URL_TOKEN_STORAGE_PREFIX,
  readCheckoutSessionId,
  readUrlToken,
  urlTokenStorageKey,
  type UrlTokenParam,
} from "@/lib/checkoutSession";
import indexHtml from "../../index.html?raw";
import marketingLayout from "../../web/layouts/MarketingLayout.astro?raw";
import partnerSamplePage from "../../web/pages/partner-sample.astro?raw";

type W = { __edenCheckoutSession?: unknown; __edenUrlTokens?: unknown } & Record<string, unknown>;
const w = () => window as unknown as W;

const SESSION = "cs_test_ABC";
const TOKEN = "0123456789abcdef0123456789abcdef";
const KEY = "partner-KEY_42";
const T_SLOT = "eden_url_token:t:/starter/downloads";
const K_SLOT = "eden_url_token:k:/partner-sample";

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
/** A fresh page load: the window globals are gone, storage stays. */
function reloadWindow() {
  delete w().__edenCheckoutSession;
  delete w().__edenUrlTokens;
}

// localStorage is an own configurable getter on jsdom's window, so a test can
// make it throw (Safari with storage blocked) and put the original back.
const localStorageDescriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
function blockLocalStorage() {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    enumerable: true,
    get() {
      throw new Error("SecurityError");
    },
  });
}
function restoreLocalStorage() {
  if (localStorageDescriptor) Object.defineProperty(window, "localStorage", localStorageDescriptor);
}

describe("checkoutSession", () => {
  beforeEach(() => {
    restoreLocalStorage();
    sessionStorage.clear();
    localStorage.clear();
    reloadWindow();
    go("/");
  });
  afterEach(() => {
    vi.restoreAllMocks();
    restoreLocalStorage();
    sessionStorage.clear();
    localStorage.clear();
    reloadWindow();
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
      expect(CHECKOUT_SESSION_STRIP_JS).toContain(`'${URL_TOKEN_STORAGE_PREFIX}'`);
      for (const [param, page] of Object.entries(URL_TOKEN_PAGES)) {
        expect(CHECKOUT_SESSION_STRIP_JS).toContain(`${param}: '${page}'`);
      }
      expect(urlTokenStorageKey("t")).toBe(T_SLOT);
      expect(urlTokenStorageKey("k")).toBe(K_SLOT);
    });
  });

  describe("strip script, page-scoped t and k", () => {
    for (const path of ["/starter/downloads", "/starter/downloads/"]) {
      it(`removes t on ${path} and keeps it in localStorage and the window global`, () => {
        go(`${path}?t=${TOKEN}`);
        runStrip();
        expect(here()).toBe(path);
        expect(window.location.href).not.toContain(TOKEN);
        expect(localStorage.getItem(T_SLOT)).toBe(TOKEN);
        expect(sessionStorage.getItem(T_SLOT)).toBeNull();
        expect(w().__edenUrlTokens).toEqual({ [T_SLOT]: TOKEN });
        expect(readUrlToken("t")).toBe(TOKEN);
      });
    }

    for (const path of ["/partner-sample", "/partner-sample/"]) {
      it(`removes k on ${path} and keeps it in localStorage and the window global`, () => {
        go(`${path}?k=${KEY}`);
        runStrip();
        expect(here()).toBe(path);
        expect(window.location.href).not.toContain(KEY);
        expect(localStorage.getItem(K_SLOT)).toBe(KEY);
        expect(w().__edenUrlTokens).toEqual({ [K_SLOT]: KEY });
        expect(readUrlToken("k")).toBe(KEY);
      });
    }

    const elsewhere: Array<[UrlTokenParam, string]> = [
      ["t", "/"],
      ["t", "/starter"],
      ["t", "/starter/thank-you"],
      ["t", "/starter/downloads-old"],
      ["t", "/starter/downloads/extra"],
      ["t", "/partner-sample"],
      ["t", "/books"],
      ["k", "/"],
      ["k", "/partner-sample/abc"],
      ["k", "/partner-samples"],
      ["k", "/starter/downloads"],
      ["k", "/homeschool"],
    ];
    for (const [param, path] of elsewhere) {
      it(`leaves ${param} alone on ${path}`, () => {
        go(`${path}?${param}=generic-value&x=1#h`);
        const spy = vi.spyOn(window.history, "replaceState");
        runStrip();
        expect(spy).not.toHaveBeenCalled();
        expect(here()).toBe(`${path}?${param}=generic-value&x=1#h`);
        expect(localStorage.length).toBe(0);
        expect(sessionStorage.length).toBe(0);
        expect(w().__edenUrlTokens).toBeUndefined();
      });
    }

    it("keeps every other param byte for byte, in order, the hash and history.state", () => {
      window.history.replaceState({ idx: 3 }, "", `/partner-sample?utm_source=gmail&k=${KEY}&note=a%20b+c&flag&t=keep-me#files`);
      runStrip();
      expect(here()).toBe("/partner-sample?utm_source=gmail&note=a%20b+c&flag&t=keep-me#files");
      expect(window.history.state).toEqual({ idx: 3 });
      expect(readUrlToken("k")).toBe(KEY);
    });

    it("strips session_id and t together on /starter/downloads", () => {
      go(`/starter/downloads?utm_source=email&t=${TOKEN}&session_id=${SESSION}#x`);
      runStrip();
      expect(here()).toBe("/starter/downloads?utm_source=email#x");
      expect(readUrlToken("t")).toBe(TOKEN);
      expect(readCheckoutSessionId()).toBe(SESSION);
    });

    it("removes an encoded or repeated key and keeps the first non-empty value, decoded", () => {
      go(`/starter/downloads?t=&%74=${TOKEN}&t=second&t=a%2Bb`);
      runStrip();
      expect(here()).toBe("/starter/downloads");
      expect(localStorage.getItem(T_SLOT)).toBe(TOKEN);
      go("/partner-sample?k=a%2Bb%20c+d");
      runStrip();
      expect(localStorage.getItem(K_SLOT)).toBe("a+b c d");
    });

    it("strips an empty t without storing anything and without touching a stored token", () => {
      localStorage.setItem(T_SLOT, TOKEN);
      go("/starter/downloads?t=&x=1");
      runStrip();
      expect(here()).toBe("/starter/downloads?x=1");
      expect(localStorage.getItem(T_SLOT)).toBe(TOKEN);
      expect(w().__edenUrlTokens).toBeUndefined();
    });

    it("a new value in the URL replaces the stored one", () => {
      localStorage.setItem(T_SLOT, "old-token");
      sessionStorage.setItem(T_SLOT, "older-session-token");
      go("/starter/downloads?t=new-token");
      runStrip();
      expect(localStorage.getItem(T_SLOT)).toBe("new-token");
      expect(sessionStorage.getItem(T_SLOT)).toBeNull();
      reloadWindow();
      expect(readUrlToken("t")).toBe("new-token");
    });

    it("still strips when all storage is blocked, and the window global carries the value", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("blocked");
      });
      go(`/partner-sample?k=${KEY}&utm_source=gmail`);
      expect(() => runStrip()).not.toThrow();
      expect(here()).toBe("/partner-sample?utm_source=gmail");
      expect(readUrlToken("k")).toBe(KEY);
    });

    it("falls back to sessionStorage when localStorage throws, and a reload still finds it", () => {
      blockLocalStorage();
      go(`/starter/downloads?t=${TOKEN}`);
      expect(() => runStrip()).not.toThrow();
      expect(here()).toBe("/starter/downloads");
      expect(sessionStorage.getItem(T_SLOT)).toBe(TOKEN);
      reloadWindow();
      expect(readUrlToken("t")).toBe(TOKEN);
    });

    it("never throws, even when replaceState does, and the reader still gets the URL value", () => {
      vi.spyOn(window.history, "replaceState").mockImplementation(() => {
        throw new Error("SecurityError");
      });
      window.history.pushState(null, "", `/starter/downloads?t=${TOKEN}`);
      expect(() => runStrip()).not.toThrow();
      expect(readUrlToken("t")).toBe(TOKEN);
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

  describe("readUrlToken", () => {
    it("reads the URL, then the window global, then localStorage, then sessionStorage", () => {
      go("/starter/downloads?t=from-url");
      w().__edenUrlTokens = { [T_SLOT]: "from-window" };
      localStorage.setItem(T_SLOT, "from-local");
      sessionStorage.setItem(T_SLOT, "from-session");
      expect(readUrlToken("t")).toBe("from-url");
      go("/starter/downloads");
      expect(readUrlToken("t")).toBe("from-window");
      delete w().__edenUrlTokens;
      expect(readUrlToken("t")).toBe("from-local");
      localStorage.removeItem(T_SLOT);
      expect(readUrlToken("t")).toBe("from-session");
      sessionStorage.removeItem(T_SLOT);
      expect(readUrlToken("t")).toBeNull();
    });

    it("skips an empty URL value and uses the first non-empty one", () => {
      localStorage.setItem(K_SLOT, "stored");
      go("/partner-sample?k=&k=second");
      expect(readUrlToken("k")).toBe("second");
      go("/partner-sample?k=");
      expect(readUrlToken("k")).toBe("stored");
    });

    it("returns to the clean URL in a new tab on the same device from localStorage", () => {
      go(`/starter/downloads?t=${TOKEN}&utm_source=email#x`);
      runStrip();
      // New tab: fresh window globals and a fresh sessionStorage, same localStorage.
      reloadWindow();
      sessionStorage.clear();
      go("/starter/downloads");
      expect(readUrlToken("t")).toBe(TOKEN);
      go("/starter/downloads/");
      expect(readUrlToken("t")).toBe(TOKEN);
    });

    it("does not hand a stored value to a different page or a different param", () => {
      go(`/starter/downloads?t=${TOKEN}`);
      runStrip();
      go(`/partner-sample?k=${KEY}`);
      runStrip();
      go("/starter/thank-you");
      expect(readUrlToken("t")).toBeNull();
      expect(readUrlToken("k")).toBeNull();
      go("/partner-sample");
      expect(readUrlToken("t")).toBeNull();
      expect(readUrlToken("k")).toBe(KEY);
      go("/starter/downloads");
      expect(readUrlToken("k")).toBeNull();
      expect(readUrlToken("t")).toBe(TOKEN);
      go("/?t=elsewhere&k=elsewhere");
      expect(readUrlToken("t")).toBeNull();
      expect(readUrlToken("k")).toBeNull();
    });

    it("returns null when storage is blocked or the global is the wrong shape, and never throws", () => {
      go("/partner-sample");
      w().__edenUrlTokens = "not an object";
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("blocked");
      });
      expect(readUrlToken("k")).toBeNull();
      vi.restoreAllMocks();
      blockLocalStorage();
      w().__edenUrlTokens = { [K_SLOT]: 42 };
      expect(() => readUrlToken("k")).not.toThrow();
      expect(readUrlToken("k")).toBeNull();
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

    it("partner-sample.astro passes the reader the storage key from urlTokenStorageKey", () => {
      expect(partnerSamplePage).toContain('const keySlot = urlTokenStorageKey("k");');
      expect(partnerSamplePage).toMatch(/<script is:inline define:vars=\{\{ keySlot \}\}>/);
      expect(partnerSamplePage).not.toContain('.get("k")');
    });
  });

  describe("partner-sample page script", () => {
    const body = (() => {
      const m = partnerSamplePage.match(/<script is:inline define:vars=\{\{ keySlot \}\}>([\s\S]*?)<\/script>/);
      if (!m) throw new Error("partner-sample inline script not found");
      return m[1];
    })();
    function mountPage() {
      document.body.innerHTML = `
        <div id="ps-locked" class="hidden"></div>
        <div id="ps-downloads" class="hidden">
          <a href="#" data-slug="read-aloud" class="ps-dl">Read-Aloud</a>
          <a href="#" data-slug="teachers-guide" class="ps-dl">Teacher's Guide</a>
        </div>`;
    }
    function runPage() {
      new Function("keySlot", body)(urlTokenStorageKey("k"));
    }
    const hrefs = () => [...document.querySelectorAll("a.ps-dl")].map((a) => a.getAttribute("href"));
    const shown = (id: string) => !(document.getElementById(id) as HTMLElement).classList.contains("hidden");
    afterEach(() => {
      document.body.innerHTML = "";
    });

    it("after the strip, wires the buttons with the key and shows the downloads", () => {
      go(`/partner-sample?k=${encodeURIComponent("a b+c")}&utm_source=gmail`);
      runStrip();
      expect(here()).toBe("/partner-sample?utm_source=gmail");
      mountPage();
      runPage();
      expect(shown("ps-downloads")).toBe(true);
      expect(shown("ps-locked")).toBe(false);
      expect(hrefs()).toEqual([
        "/api/partner-sample?k=a%20b%2Bc&f=read-aloud",
        "/api/partner-sample?k=a%20b%2Bc&f=teachers-guide",
      ]);
    });

    it("a later visit to the clean URL on the same device still works", () => {
      go(`/partner-sample?k=${KEY}`);
      runStrip();
      reloadWindow();
      sessionStorage.clear();
      go("/partner-sample");
      mountPage();
      runPage();
      expect(shown("ps-downloads")).toBe(true);
      expect(hrefs()[0]).toBe(`/api/partner-sample?k=${KEY}&f=read-aloud`);
    });

    it("works with storage blocked, from the window global", () => {
      blockLocalStorage();
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("blocked");
      });
      go(`/partner-sample?k=${KEY}`);
      runStrip();
      mountPage();
      expect(() => runPage()).not.toThrow();
      expect(hrefs()[1]).toBe(`/api/partner-sample?k=${KEY}&f=teachers-guide`);
    });

    it("shows the incomplete-link panel when there is no key anywhere", () => {
      go("/partner-sample");
      mountPage();
      runPage();
      expect(shown("ps-locked")).toBe(true);
      expect(shown("ps-downloads")).toBe(false);
      expect(hrefs()).toEqual(["#", "#"]);
    });
  });
});
