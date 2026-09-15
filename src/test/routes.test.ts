/**
 * Drift guard for src/lib/routes.ts and the <Route> table in src/App.tsx.
 *
 * App.tsx builds every registered path from ROUTES (nested Apothecary children
 * through childPath()), so a rename in routes.ts changes the route and every
 * link together. These tests pin the resulting strings and fail if App.tsx
 * goes back to a hand-typed path literal.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ASTRO_PAGES, ROUTES, childPath } from "@/lib/routes";

describe("childPath", () => {
  it("returns the relative segment for every nested Apothecary route", () => {
    expect(childPath(ROUTES.APOTHECARY_START)).toBe("start");
    expect(childPath(ROUTES.APOTHECARY_SIGNUP)).toBe("auth/signup");
    expect(childPath(ROUTES.APOTHECARY_SIGNIN)).toBe("auth/signin");
    expect(childPath(ROUTES.APOTHECARY_RESET)).toBe("auth/reset");
    expect(childPath(ROUTES.APOTHECARY_UPDATE_PASSWORD)).toBe("auth/update-password");
    expect(childPath(ROUTES.APOTHECARY_PRICING)).toBe("pricing");
    expect(childPath(ROUTES.APOTHECARY_WELCOME_TOUR)).toBe("welcome-tour");
    expect(childPath(ROUTES.APOTHECARY_WELCOME)).toBe("welcome");
    expect(childPath(ROUTES.APOTHECARY_ACCOUNT)).toBe("account");
    expect(childPath(ROUTES.APOTHECARY_PROFILES)).toBe("profiles");
    expect(childPath(ROUTES.APOTHECARY_FAVORITES)).toBe("favorites");
    expect(childPath(ROUTES.APOTHECARY_QUIZ)).toBe("quiz");
    expect(childPath(ROUTES.APOTHECARY_HERB(":herbId"))).toBe(":herbId");
  });

  it("throws for a path that is not nested under the parent", () => {
    expect(() => childPath(ROUTES.ASSESSMENT)).toThrow(/not nested/);
    // A sibling that merely shares the prefix text is not nested.
    expect(() => childPath("/apothecary-old/start")).toThrow(/not nested/);
  });
});

describe("parameterized top-level routes", () => {
  it("keeps the registered param patterns", () => {
    expect(ROUTES.GUIDE(":constitutionSlug")).toBe("/guide/:constitutionSlug");
    expect(ROUTES.RESULTS(":constitutionSlug")).toBe("/results/:constitutionSlug");
  });
});

describe("ASTRO_PAGES", () => {
  it("never overlaps the SPA route table", () => {
    const spaPaths: string[] = Object.values(ROUTES).filter(
      (v) => typeof v === "string",
    ) as string[];
    for (const path of Object.values(ASTRO_PAGES)) {
      expect(spaPaths).not.toContain(path);
    }
  });

  it("lists the legal pages, static since 2026-09-15", () => {
    expect(ASTRO_PAGES.TERMS).toBe("/terms");
    expect(ASTRO_PAGES.PRIVACY).toBe("/privacy");
    expect(ASTRO_PAGES.COOKIES).toBe("/cookies");
  });
});

describe("App.tsx route registrations", () => {
  const appSource = readFileSync(join(__dirname, "..", "App.tsx"), "utf8");

  it("reads every path from ROUTES (only the catch-all is a literal)", () => {
    const paths = [...appSource.matchAll(/<Route\s[^>]*?path=(\{[^}]*\}|"[^"]*")/g)].map(
      (m) => m[1],
    );
    // Guard against a blind check that matches nothing and passes.
    expect(paths.length).toBeGreaterThan(20);
    const literals = paths.filter((p) => p.startsWith('"'));
    expect(literals).toEqual(['"*"']);
  });

  it("registers no <Route> for an Astro-served page", () => {
    expect(appSource).not.toMatch(/ASTRO_PAGES/);
  });
});
