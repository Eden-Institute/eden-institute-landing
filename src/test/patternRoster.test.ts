/**
 * Pattern roster consistency.
 *
 * The eight Patterns are keyed by axis label ("Hot / Dry / Tense") in two
 * places: constitution-data.ts constitutionProfiles (display copy) and
 * CONSTITUTION_MAP (derived from edenPattern.PATTERN_PROFILES). A typo in a
 * constitutionProfiles key silently drops that Pattern from results/[slug]
 * and the sitemap, so the key sets and nicknames are pinned here. The
 * follow-up question ids in AXIS_CONFIG are hand-mirrored in
 * quiz-followup.ts and are pinned too.
 */
import { describe, it, expect } from "vitest";
import { AXIS_CONFIG, constitutionProfiles, type Axis } from "@/lib/constitution-data";
import { CONSTITUTION_MAP } from "@/lib/constitution-utils";
import { followupQuestions } from "@/lib/quiz-followup";

describe("Pattern roster consistency", () => {
  it("constitutionProfiles and CONSTITUTION_MAP have the same eight keys", () => {
    const profileKeys = Object.keys(constitutionProfiles).sort();
    const mapKeys = Object.keys(CONSTITUTION_MAP).sort();
    expect(profileKeys).toHaveLength(8);
    expect(mapKeys).toHaveLength(8);
    expect(profileKeys).toEqual(mapKeys);
  });

  it.each(Object.keys(constitutionProfiles))("nickname for %s matches the Pattern name", (key) => {
    expect(constitutionProfiles[key].nickname).toBe(CONSTITUTION_MAP[key]?.name);
  });

  it.each(Object.keys(constitutionProfiles))("amazonUrl for %s is a non-empty https URL", (key) => {
    const url = constitutionProfiles[key].amazonUrl;
    expect(url.length).toBeGreaterThan(0);
    expect(new URL(url).protocol).toBe("https:");
  });

  it.each(Object.keys(AXIS_CONFIG) as Axis[])(
    "follow-up question ids for %s match quiz-followup.ts",
    (axis) => {
      const fromQuestions = followupQuestions
        .filter((q) => q.axis === axis)
        .map((q) => q.id)
        .sort((a, b) => a - b);
      const fromConfig = [...AXIS_CONFIG[axis].followupQuestions].sort((a, b) => a - b);
      expect(fromConfig.length).toBeGreaterThan(0);
      expect(fromQuestions).toEqual(fromConfig);
    },
  );
});
