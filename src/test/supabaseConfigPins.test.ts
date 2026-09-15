/**
 * Every deployed edge function must carry an explicit [functions.<name>]
 * entry in supabase/config.toml. Relying on the CLI default for verify_jwt
 * lets a stray --no-verify-jwt deploy flip a function that validates the
 * caller's JWT in code, which is only safe when the gateway has already
 * verified the signature.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..", "..");

describe("supabase/config.toml verify_jwt pins", () => {
  it("every edge function directory has an explicit [functions.<name>] entry", () => {
    const fnDir = join(root, "supabase", "functions");
    const toml = readFileSync(join(root, "supabase", "config.toml"), "utf8");
    const dirs = readdirSync(fnDir).filter(
      (d) => !d.startsWith("_") && statSync(join(fnDir, d)).isDirectory(),
    );
    // Guard against a blind check that reads nothing and passes.
    expect(dirs.length).toBeGreaterThan(30);
    const missing = dirs.filter(
      (d) => !new RegExp(`^\\[functions\\.${d.replace(/[-]/g, "\\-")}\\]\\s*$`, "m").test(toml),
    );
    expect(missing).toEqual([]);
  });
});
