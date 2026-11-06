/**
 * PERSON_PROFILE_CAP_BY_TIER must mirror public.person_profile_cap_for_tier.
 *
 * The cap table was once duplicated in ProfilesPage and ProfilePicker, and a
 * cap change updated one copy and the migration but not the other (PR #101,
 * fixed by #102). It now lives once in src/lib/tiers.ts; this test reads the
 * LATEST migration that (re)defines the SQL function and fails if the two
 * disagree.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PERSON_PROFILE_CAP_BY_TIER,
  isSubscriberTier,
  personProfileCap,
} from "@/lib/tiers";

const migrationsDir = join(__dirname, "..", "..", "supabase", "migrations");
const DEFINITION = /create\s+or\s+replace\s+function\s+public\.person_profile_cap_for_tier\s*\(/i;

function latestCapFunctionBody(): { file: string; body: string } {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  let latest: { file: string; body: string } | null = null;
  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    const match = DEFINITION.exec(sql);
    if (!match) continue;
    const start = match.index;
    const open = sql.indexOf("$$", start);
    const close = open === -1 ? -1 : sql.indexOf("$$", open + 2);
    if (open === -1 || close === -1) continue;
    latest = { file, body: sql.slice(open + 2, close) };
  }
  if (!latest) throw new Error("no migration defines public.person_profile_cap_for_tier");
  return latest;
}

// Reads every migration file (150+ and growing), which can pass the default 5 s
// timeout when the machine is busy running other suites in parallel.
describe("PERSON_PROFILE_CAP_BY_TIER", { timeout: 30_000 }, () => {
  it("matches the latest SQL definition of person_profile_cap_for_tier", () => {
    const { file, body } = latestCapFunctionBody();
    const sqlCaps = Object.fromEntries(
      [...body.matchAll(/when\s+'([a-z_]+)'\s+then\s+(\d+)/gi)].map((m) => [
        m[1],
        Number(m[2]),
      ]),
    );
    // Guard against a blind check that parsed nothing and passes.
    expect(Object.keys(sqlCaps).length, file).toBeGreaterThanOrEqual(5);
    expect(sqlCaps, file).toEqual({ ...PERSON_PROFILE_CAP_BY_TIER });
  });
});

// Founder decision 2026-11-06: Seed is sold as up to 5 profiles for the member
// AND family. v4.3.1 (20260502142601) had added a trigger rule that blocked
// every non-self profile on Seed, so the cap of 5 above was unreachable and the
// Add profile button failed. Guard both halves of the fix.
const TRIGGER_DEFINITION =
  /create\s+or\s+replace\s+function\s+public\.tg_person_profiles_enforce_cap\s*\(/i;

describe("Seed family profiles", { timeout: 30_000 }, () => {
  it("the latest tg_person_profiles_enforce_cap does not forbid Seed family profiles", () => {
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    let latest: { file: string; sql: string } | null = null;
    for (const file of files) {
      const sql = readFileSync(join(migrationsDir, file), "utf8");
      if (TRIGGER_DEFINITION.test(sql)) latest = { file, sql };
    }
    if (!latest) throw new Error("no migration defines public.tg_person_profiles_enforce_cap");
    // Comments may name the retired rule; only the executable SQL matters.
    const code = latest.sql.replace(/--.*$/gm, "");
    expect(code, latest.file).toMatch(/profile_cap_exceeded/);
    expect(code, latest.file).not.toMatch(/seed_tier_subprofiles_forbidden/);
  });

  it("Seed can open the per-profile Pattern quiz", () => {
    const app = readFileSync(join(__dirname, "..", "App.tsx"), "utf8");
    const at = app.indexOf("childPath(ROUTES.APOTHECARY_QUIZ)");
    expect(at).toBeGreaterThan(-1);
    const gate = /<RequireTier\s+allow=\{\[([^\]]*)\]\}/.exec(app.slice(at));
    expect(gate?.[1]).toContain('"seed"');
  });
});

describe("personProfileCap", () => {
  it("returns the per-tier cap and 0 for an unknown tier", () => {
    expect(personProfileCap("seed")).toBe(5);
    expect(personProfileCap("root")).toBe(10);
    expect(personProfileCap("practitioner")).toBe(500);
    expect(personProfileCap("free")).toBe(0);
    expect(personProfileCap(undefined)).toBe(0);
  });
});

describe("isSubscriberTier", () => {
  it("is true only for paid tiers", () => {
    expect(isSubscriberTier("seed")).toBe(true);
    expect(isSubscriberTier("root")).toBe(true);
    expect(isSubscriberTier("practitioner")).toBe(true);
    expect(isSubscriberTier("free")).toBe(false);
    expect(isSubscriberTier("anon")).toBe(false);
    expect(isSubscriberTier(undefined)).toBe(false);
  });
});
