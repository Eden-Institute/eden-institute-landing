// 2026-11-21 (8 AM digest system check, Camila's tap "Build the fix"): marketing pages use a session-less
// Supabase client so a visitor with several tabs open never waits on the cross-tab auth lock
// ("Acquiring an exclusive Navigator LockManager lock ... timed out waiting 10000ms") and loses page views.
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("marketing-site Supabase client (web/lib/supabaseWebClient.ts)", () => {
  it("astro.config.mjs aliases ONLY the exact client module to the web client, before the general @ alias", () => {
    // Read as text: importing astro/config under jsdom trips esbuild's TextEncoder invariant.
    const src = readFileSync(resolve(process.cwd(), "astro.config.mjs"), "utf8");
    const line = src.split("\n").find((l) => l.includes('replacement: fromRoot("./web/lib/supabaseWebClient.ts")'));
    expect(line, "alias line for web/lib/supabaseWebClient.ts").toBeTruthy();
    const m = /find:\s*\/(.+?)\/\s*,\s*replacement:\s*fromRoot\("\.\/web\/lib\/supabaseWebClient\.ts"\)/.exec(line!);
    expect(m, "regex find + replacement on one line").toBeTruthy();
    const exact = new RegExp(m![1]);
    expect(exact.test("@/integrations/supabase/client")).toBe(true);
    for (const other of ["@/integrations/supabase/types", "@/integrations/supabase/client.ts", "@/integrations/supabase/clientX", "@/lib/trackCta"]) {
      expect(exact.test(other)).toBe(false);
    }
    const general = src.indexOf('{ find: "@", replacement: fromRoot("./src") }');
    expect(general).toBeGreaterThan(src.indexOf(line!));
  });

  it("keeps no session, runs no refresh timer, reads no session from the URL, and never takes the cross-tab lock", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    const mod = await import("../../web/lib/supabaseWebClient");
    expect(mod.WEB_AUTH_OPTIONS).toMatchObject({ persistSession: false, autoRefreshToken: false, detectSessionInUrl: false });
    const auth = mod.supabase.auth as unknown as { persistSession: boolean; autoRefreshToken: boolean; detectSessionInUrl: boolean; lock: unknown };
    expect(auth.persistSession).toBe(false);
    expect(auth.autoRefreshToken).toBe(false);
    expect(auth.detectSessionInUrl).toBe(false);
    expect(auth.lock).toBe(mod.inTabLock);
    // The in-tab lock runs the step at once and passes its result through (no waiting, no timeout).
    await expect(mod.inTabLock("lock:sb-x-auth-token", 10_000, async () => 42)).resolves.toBe(42);
    vi.unstubAllEnvs();
  });
});
