// Client-side halves of "no tags on the private pages" (the page renders
// themselves are pinned in privatePagesNoTags.astro.test.ts):
//   1. SiteAnalytics on a private page: no Meta Pixel, no cookie banner, and the
//      first-party page view never carries the credential.
//   2. StarterDownloads: a click on a link that carries a credential never
//      reaches a document-level bubble listener, which is where Google
//      Analytics enhanced measurement listens (gtag.js adds click and auxclick
//      listeners on document, bubble phase). The link is otherwise untouched.
//   3. vercel.json: the case-variant redirects match every variant but never
//      the real lowercase path, so they cannot loop.

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import vercelJsonRaw from "../../vercel.json?raw";

const rpc = vi.fn((..._args: unknown[]) => Promise.resolve({ data: null, error: null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock("@/lib/pinterestTag", () => ({ pinCheckoutOnce: vi.fn(() => Promise.resolve()) }));

import SiteAnalytics from "../../web/components/islands/SiteAnalytics";
import StarterDownloads from "../../web/components/islands/StarterDownloads";

const TOKEN = "TOKENPROBE123";
const SIGNED = "https://stub.supabase.co/storage/v1/object/sign/starter/guide.pdf?token=SIGNEDPROBE";
const SIGNED_SAVE = `${SIGNED}&download=guide.pdf`;
const CONSENT_KEY = "eden-marketing-consent";

function metaPixelScripts(): number {
  return document.querySelectorAll('script[src*="connect.facebook.net"]').length;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  rpc.mockClear();
  // Meta's loader inserts before the first script on the page.
  const anchor = document.createElement("script");
  anchor.setAttribute("data-test-anchor", "");
  document.head.appendChild(anchor);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("SiteAnalytics on a private page (thirdPartyTags={false})", () => {
  it("shows no cookie banner to a visitor who has not chosen", async () => {
    window.history.replaceState(null, "", `/starter/downloads?t=${TOKEN}&utm_source=email`);
    render(<SiteAnalytics thirdPartyTags={false} />);
    await waitFor(() => expect(rpc).toHaveBeenCalled());
    expect(screen.queryByRole("region", { name: "Cookie consent" })).toBeNull();
    expect(screen.queryByText("Decline")).toBeNull();
  });

  it("does not load the Meta Pixel, even for a visitor who clicked Accept elsewhere", async () => {
    localStorage.setItem(CONSENT_KEY, "granted");
    window.history.replaceState(null, "", "/partner-sample?k=KEYPROBE456");
    render(<SiteAnalytics thirdPartyTags={false} />);
    await waitFor(() => expect(rpc).toHaveBeenCalled());
    expect(metaPixelScripts()).toBe(0);
    expect((window as unknown as { fbq?: unknown }).fbq).toBeUndefined();
  });

  it("still records the first-party page view, with the path and never the credential", async () => {
    window.history.replaceState(null, "", `/starter/downloads?t=${TOKEN}&utm_source=email#x`);
    render(<SiteAnalytics thirdPartyTags={false} />);
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    const [fn, args] = rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(fn).toBe("record_page_view");
    expect(args.p_path).toBe("/starter/downloads");
    expect(args.p_utm_source).toBe("email");
    expect(JSON.stringify(rpc.mock.calls)).not.toContain(TOKEN);
  });

  it("control: a normal page shows the banner to a visitor who has not chosen", async () => {
    window.history.replaceState(null, "", "/books");
    render(<SiteAnalytics />);
    expect(await screen.findByRole("region", { name: "Cookie consent" })).toBeTruthy();
  });

  // Last, because the Pixel loader remembers that it ran.
  it("control: a normal page loads the Meta Pixel for a visitor who clicked Accept", async () => {
    localStorage.setItem(CONSENT_KEY, "granted");
    window.history.replaceState(null, "", "/books");
    render(<SiteAnalytics />);
    await waitFor(() => expect(metaPixelScripts()).toBe(1));
  });
});

describe("StarterDownloads links keep clicks away from page tags", () => {
  const payload = {
    expires_at: "2026-09-20T00:00:00.000Z",
    download_token: TOKEN,
    credit_code: null,
    files: [{ slug: "teachers-guide", label: "Teacher's Guide", url: SIGNED, save_url: SIGNED_SAVE }],
  };

  async function renderReady(mode: "token" | "session") {
    window.history.replaceState(null, "", mode === "token" ? `/starter/downloads?t=${TOKEN}` : "/starter/thank-you?session_id=cs_test_probe");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(payload) })),
    );
    render(<StarterDownloads mode={mode} />);
    return screen.findByText("Teacher's Guide");
  }

  function listen() {
    const seen = { bubble: [] as string[], capture: [] as string[] };
    const bubble = (e: Event) => seen.bubble.push(`${e.type}:${(e.target as HTMLAnchorElement).getAttribute("href")}`);
    const capture = (e: Event) => seen.capture.push(`${e.type}:${(e.target as HTMLAnchorElement).getAttribute("href")}`);
    for (const type of ["click", "auxclick"]) {
      document.addEventListener(type, bubble, false);
      document.addEventListener(type, capture, true);
    }
    const stop = () => {
      for (const type of ["click", "auxclick"]) {
        document.removeEventListener(type, bubble, false);
        document.removeEventListener(type, capture, true);
      }
    };
    return { seen, stop };
  }

  /** Dispatches a click and reports whether anything on the page called
   *  preventDefault. jsdom cannot navigate, so a document capture listener
   *  cancels the default with the ORIGINAL preventDefault, which the spy does
   *  not count; any call the component made would go through the spy. */
  function dispatch(el: Element, type: "click" | "auxclick"): boolean {
    const nativePreventDefault = Event.prototype.preventDefault;
    const spy = vi.spyOn(Event.prototype, "preventDefault");
    const cancel = (e: Event) => nativePreventDefault.call(e);
    document.addEventListener(type, cancel, true);
    try {
      act(() => {
        el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: type === "auxclick" ? 1 : 0 }));
      });
      return spy.mock.calls.length > 0;
    } finally {
      document.removeEventListener(type, cancel, true);
      spy.mockRestore();
    }
  }

  for (const mode of ["session", "token"] as const) {
    it(`${mode} mode: file, save and fresh-links clicks never reach a document bubble listener`, async () => {
      const file = await renderReady(mode);
      const save = screen.getByText("or save it to your device");
      const fresh = screen.getByText("get fresh ones here");
      expect(file.getAttribute("href")).toBe(SIGNED);
      expect(save.getAttribute("href")).toBe(SIGNED_SAVE);
      expect(fresh.getAttribute("href")).toBe(`/starter/downloads?t=${TOKEN}`);

      const { seen, stop } = listen();
      try {
        for (const el of [file, save, fresh]) {
          expect(dispatch(el, "click")).toBe(false);
          expect(dispatch(el, "auxclick")).toBe(false);
        }
      } finally {
        stop();
      }
      expect(seen.bubble).toEqual([]);
      // The [data-cta] beacon in SiteAnalytics listens in the capture phase and still sees them.
      expect(seen.capture).toHaveLength(6);
      expect(file.getAttribute("data-cta")).toBe("starter-download-teachers-guide");
      expect(save.getAttribute("data-cta")).toBe("starter-save-teachers-guide");
    });
  }

  it("control: an ordinary link in the same document does reach the bubble listener", () => {
    const a = document.createElement("a");
    a.href = SIGNED;
    a.textContent = "plain";
    const wrap = document.createElement("div");
    wrap.appendChild(a);
    document.body.appendChild(wrap);
    const { seen, stop } = listen();
    try {
      dispatch(a, "click");
    } finally {
      stop();
      wrap.remove();
    }
    expect(seen.bubble).toEqual([`click:${SIGNED}`]);
  });
});

describe("vercel.json redirects for the private pages", () => {
  type Redirect = { source: string; destination: string; permanent: boolean };
  const redirects = (JSON.parse(vercelJsonRaw) as { redirects: Redirect[] }).redirects;
  const find = (source: string) => {
    const r = redirects.find((x) => x.source === source);
    expect(r, source).toBeTruthy();
    return r as Redirect;
  };

  /** The custom pattern of a `/:page(<pattern>)` source, as a JS regex over the
   *  path after its leading slash. Vercel compiles sources with path-to-regexp,
   *  case-sensitive and strict (@vercel/routing-utils sourceToRegex), and a
   *  custom parameter pattern is used as written. */
  function pagePattern(source: string): RegExp {
    const m = source.match(/^\/:page\((.+?)\)(\/.*)?$/);
    expect(m, source).not.toBeNull();
    return new RegExp(`^(?:${(m as RegExpMatchArray)[1]})$`);
  }

  it("keeps the original path form and adds the trailing slash and deeper forms", () => {
    expect(find("/partner-sample/:key")).toEqual({ source: "/partner-sample/:key", destination: "/partner-sample?k=:key", permanent: false });
    expect(find("/partner-sample/:key/(.*)")).toMatchObject({ destination: "/partner-sample?k=:key", permanent: false });
    expect(find("/starter/downloads/(.+)")).toMatchObject({ destination: "/starter/downloads", permanent: false });
  });

  const cases = [
    {
      sources: [
        "/:page((?!partner-sample)[Pp][Aa][Rr][Tt][Nn][Ee][Rr]-[Ss][Aa][Mm][Pp][Ll][Ee])",
        "/:page((?!partner-sample)[Pp][Aa][Rr][Tt][Nn][Ee][Rr]-[Ss][Aa][Mm][Pp][Ll][Ee])/:rest(.*)",
      ],
      destinations: ["/partner-sample", "/partner-sample/:rest"],
      canonical: "partner-sample",
      variants: ["Partner-Sample", "PARTNER-SAMPLE", "partner-Sample", "partner-samplE", "pARTNER-sAMPLE"],
      notMatched: ["partner-sample", "partner-samples", "Partner-Samples", "partner", "starter/downloads"],
    },
    {
      sources: [
        "/:page((?!starter/downloads)[Ss][Tt][Aa][Rr][Tt][Ee][Rr]/[Dd][Oo][Ww][Nn][Ll][Oo][Aa][Dd][Ss])",
        "/:page((?!starter/downloads)[Ss][Tt][Aa][Rr][Tt][Ee][Rr]/[Dd][Oo][Ww][Nn][Ll][Oo][Aa][Dd][Ss])/(.*)",
      ],
      destinations: ["/starter/downloads", "/starter/downloads"],
      canonical: "starter/downloads",
      variants: ["Starter/Downloads", "STARTER/DOWNLOADS", "starter/Downloads", "Starter/downloads", "starter/downloadS"],
      notMatched: ["starter/downloads", "starter", "starter/thank-you", "Starter/Download", "partner-sample"],
    },
  ];

  for (const c of cases) {
    it(`case variants of /${c.canonical} redirect to it and the real path never matches`, () => {
      c.sources.forEach((source, i) => {
        const rule = find(source);
        expect(rule.destination).toBe(c.destinations[i]);
        expect(rule.permanent).toBe(false);
        const re = pagePattern(source);
        for (const v of c.variants) expect(re.test(v), `${source} should match ${v}`).toBe(true);
        for (const v of c.notMatched) expect(re.test(v), `${source} must not match ${v}`).toBe(false);
        // No loop: the destination's own path is never matched again by this rule.
        expect(re.test(rule.destination.slice(1).split("/:")[0].replace(/\/$/, ""))).toBe(false);
      });
    });
  }
});
