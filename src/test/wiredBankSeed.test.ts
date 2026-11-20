/**
 * Wired quiz W3: the bank seed migration must carry the six approved banks exactly as the
 * versioned JSON files hold them (one source of truth; a hand edit to either side fails CI).
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..", "..");
const banksDir = join(root, "supabase", "functions", "_shared", "wired-banks");
const migDir = join(root, "supabase", "migrations");
const seedFile = readdirSync(migDir).find((f) => /_wired_w3_seed_banks\.sql$/.test(f));
// Normalise line endings: a Windows checkout (core.autocrlf=true) gives the .sql file CRLF, and the
// block regex below matches "\non conflict". Without this the test fails on Windows only (CI is Linux).
const seed = seedFile ? readFileSync(join(migDir, seedFile), "utf8").replace(/\r\n/g, "\n") : "";

describe("wired bank seed migration", () => {
  it("exists once", () => {
    expect(readdirSync(migDir).filter((f) => /_wired_w3_seed_banks\.sql$/.test(f))).toHaveLength(1);
  });

  it("holds every bank JSON exactly, active, idempotent", () => {
    const files = readdirSync(banksDir).filter((f) => f.endsWith(".json")).sort();
    expect(files).toEqual(["adult-v1.json", "g35-v1.json", "g68-v1.json", "g912-v1.json", "k2-v1.json", "teen-v1.json"]);
    const blocks = [...seed.matchAll(/values \('([a-z0-9-]+)', '([a-z0-9_]+)', \$bank\$([\s\S]*?)\$bank\$::jsonb, true, '[^']+'\)\non conflict \(version\) do nothing;/g)];
    expect(blocks).toHaveLength(6);
    for (const f of files) {
      const want = JSON.parse(readFileSync(join(banksDir, f), "utf8"));
      const got = blocks.find((b) => b[1] === want.version);
      expect(got, want.version).toBeTruthy();
      expect(got![2]).toBe(want.set_kind);
      expect(JSON.parse(got![3])).toEqual(want);
    }
  });
});
