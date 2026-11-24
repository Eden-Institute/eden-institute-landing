// /as-heard-on from public.podcast_appearances (punch #474, Camila's taps 2026-11-24 "Small table" + "Leave it off").
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import AsHeardOnLive from "../../web/components/islands/AsHeardOnLive";
import {
  APPEARANCES_PATH,
  cleanAppearances,
  fetchLiveAppearances,
  newerThanBuild,
  showSlug,
  type PodcastAppearance,
} from "../../web/lib/podcastAppearances";

const a: PodcastAppearance = { id: "a1", show: "Tidal Women", host: "Tidal Women", episode_title: "S04 E13", episode_url: "https://example.com/tidal", aired_on: "2026-11-23" };
const b: PodcastAppearance = { id: "b2", show: "Holy Ground Motherhood", host: "Julia Geiger", episode_title: "Reclaiming the Garden", episode_url: "https://www.youtube.com/watch?v=x", aired_on: "2026-10-13" };

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("podcast appearances data", () => {
  it("keeps only complete rows with an https link and a real date, newest first", () => {
    const rows = cleanAppearances([
      b,
      { ...a, extra: "dropped" },
      { ...a, id: "c3", episode_url: "http://insecure.example" },
      { ...a, id: "d4", episode_url: "javascript:alert(1)" },
      { ...a, id: "e5", show: "  " },
      { ...a, id: "f6", aired_on: "Nov 23" },
      null,
      "x",
    ]);
    expect(rows.map((r) => r.id)).toEqual(["a1", "b2"]);
    expect(rows[0]).toEqual(a); // unknown columns are not carried
    expect(cleanAppearances({ message: "error" })).toEqual([]);
  });

  it("reads published rows only, newest first", () => {
    expect(APPEARANCES_PATH).toContain("podcast_appearances?");
    expect(APPEARANCES_PATH).toContain("published=eq.true");
    expect(APPEARANCES_PATH).toContain("order=aired_on.desc");
  });

  it("newerThanBuild returns only rows the build did not have", () => {
    expect(newerThanBuild([a, b], ["b2"])).toEqual([a]);
    expect(newerThanBuild([a, b], ["a1", "b2"])).toEqual([]);
  });

  it("the link slug is the same rule the page always used", () => {
    expect(showSlug("Visibly Fit with Wendie Pett")).toBe("visibly-fit-with-wendie-pett");
    expect(showSlug("Home(school) with Steph")).toBe("home-school-with-steph");
  });

  it("the browser read sends only the publishable key and gives null on any failure", async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify([b, a]), { status: 200 }));
    expect(await fetchLiveAppearances("https://x.supabase.co", "pk", ok as unknown as typeof fetch)).toEqual([a, b]);
    const [url, init] = ok.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://x.supabase.co${APPEARANCES_PATH}`);
    expect(init.headers).toEqual({ apikey: "pk" });
    const bad = vi.fn(async () => new Response("no", { status: 500 }));
    expect(await fetchLiveAppearances("https://x.supabase.co", "pk", bad as unknown as typeof fetch)).toBeNull();
    const boom = vi.fn(async () => { throw new Error("offline"); });
    expect(await fetchLiveAppearances("https://x.supabase.co", "pk", boom as unknown as typeof fetch)).toBeNull();
    expect(await fetchLiveAppearances(undefined, "pk", ok as unknown as typeof fetch)).toBeNull();
  });
});

describe("AsHeardOnLive island", () => {
  it("adds an episode logged after the build, with its own link, and nothing it already has", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "pk");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([a, b]), { status: 200 })));
    render(<AsHeardOnLive knownIds={["b2"]} />);
    const link = await screen.findByRole("link", { name: "Listen to the full episode" });
    expect(link.getAttribute("href")).toBe(a.episode_url);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener");
    expect(link.getAttribute("data-cta")).toBe("as-heard-on-page-tidal-women");
    expect(screen.getByText("Tidal Women", { selector: "h2" })).toBeTruthy();
    expect(screen.queryByText("Holy Ground Motherhood")).toBeNull();
  });

  it("renders nothing when the read fails", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "pk");
    const f = vi.fn(async () => new Response("no", { status: 503 }));
    vi.stubGlobal("fetch", f);
    const { container } = render(<AsHeardOnLive knownIds={[]} />);
    await waitFor(() => expect(f).toHaveBeenCalled());
    expect(container.innerHTML).toBe("");
  });
});

describe("/as-heard-on page source", () => {
  const page = readFileSync(join(__dirname, "..", "..", "web", "pages", "as-heard-on.astro"), "utf8").replace(/\r\n/g, "\n");
  it("lists the table's rows (not the hard-coded SHOWS) and runs the live island with the built ids", () => {
    expect(page).toContain("const appearances = await fetchAppearances();");
    expect(page).toContain("{appearances.map((s) => {");
    expect(page).toContain("<AsHeardOnLive client:idle knownIds={appearances.map((s) => s.id)} />");
    expect(page).not.toMatch(/\bSHOWS\b/);
    expect(page).toContain("href={s.episode_url}");
    // Clips still attach by show name and stay behind the permission gate in hostClips.ts.
    expect(page).toContain("const mine = clips.filter((c) => c.show === s.show);");
  });
});

describe("podcast_appearances migration (table, access, the 18 verified rows)", () => {
  const sql = readFileSync(join(__dirname, "..", "..", "supabase", "migrations", "20261124174107_podcast_appearances.sql"), "utf8").replace(/\r\n/g, "\n");
  const rows = sql
    .split("\n")
    .filter((l) => l.startsWith("  ('"))
    .map((l) => [...l.matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1].replace(/''/g, "'")));

  it("public read of published rows only; writes are service_role", () => {
    expect(sql).toContain("alter table public.podcast_appearances enable row level security;");
    expect(sql).toContain("for select to anon, authenticated using (published);");
    expect(sql).toContain("grant select on table public.podcast_appearances to anon, authenticated;");
    expect(sql).toContain("grant select, insert, update, delete on table public.podcast_appearances to service_role;");
    expect(sql).toContain("episode_url text not null unique check (episode_url ~ '^https://')");
    expect(sql).toContain("on conflict (episode_url) do nothing;");
    // The follow-up migration takes back the extra privileges the project's defaults gave the public roles.
    const ro = readFileSync(join(__dirname, "..", "..", "supabase", "migrations", "20261124174135_podcast_appearances_read_only.sql"), "utf8");
    expect(ro).toContain("revoke all on table public.podcast_appearances from anon, authenticated;");
    expect(ro).toContain("grant select on table public.podcast_appearances to anon, authenticated;");
  });

  it("18 rows, each complete, https, a real date, no repeats", () => {
    expect(rows).toHaveLength(18);
    for (const r of rows) {
      expect(r, r[0]).toHaveLength(5);
      expect(r[3]).toMatch(/^https:\/\//);
      expect(r[4]).toMatch(/^2026-\d{2}-\d{2}$/);
    }
    expect(new Set(rows.map((r) => r[3])).size).toBe(18);
    expect(new Set(rows.map((r) => r[0])).size).toBe(18);
  });

  it("the 8 shows already on the page keep their exact names, hosts, titles and links (clips attach by show name)", async () => {
    const { SHOWS, HOST_CLIPS } = await import("../../web/lib/hostClips");
    for (const s of SHOWS) {
      const r = rows.find((x) => x[0] === s.show);
      expect(r, s.show).toBeTruthy();
      expect(r!.slice(1, 4)).toEqual([s.host, s.episodeTitle, s.episodeUrl]);
    }
    for (const c of HOST_CLIPS) expect(rows.some((r) => r[0] === c.show), c.show).toBe(true);
  });

  it("her calls: Southern Appalachian Herbs off; a mention is not a guest spot; never 'herbalist'; no em dash", () => {
    const all = rows.flat().join(" ");
    expect(all).not.toMatch(/Southern Appalachian|Healing Headquarters/);
    expect(all.toLowerCase()).not.toContain("herbalist");
    expect(all).not.toContain("—");
    expect(rows.find((r) => r[0].startsWith("Fuel Your Dreams"))![1]).toBe("Jamie Hass and Patricia Lambert");
    expect(rows.find((r) => r[0] === "Grace Rooted Wellness")![1]).toBe("Melissa Ticer");
    expect(rows.find((r) => r[0].startsWith("Women Soaring"))![1]).toBe("the Women Soaring team");
  });
});
