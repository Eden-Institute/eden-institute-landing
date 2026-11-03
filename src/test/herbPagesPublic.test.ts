// Public /herbs pages for every visible herb (punch #296, founder 2026-11-03).
// The pages are built for all tiers now, so the column list is the lock that keeps
// Seed and Root content out of a static file, and every herb canonicalizes to /herbs.
import { describe, expect, it } from "vitest";
import { PUBLIC_HERB_COLUMNS } from "../../web/lib/herbsPublic";
import { herbCanonicalUrl } from "@/lib/herbLinks";

// Every column herbs_directory_v gates behind current_user_at_least('seed' | 'root'),
// read from the view definition on 2026-11-03.
const GATED = [
  "tissue_states_indicated", "tissue_states_contraindicated", "system_affinity", "chief_complaints",
  "western_constitution_match", "ayurvedic_dosha_match", "ayurvedic_dosha_aggravates", "tcm_pattern_match",
  "tcm_contraindicated_patterns", "drug_interactions", "preparation_methods", "dosage_notes", "refer_threshold",
  "primary_sources", "secondary_sources", "notes", "actions_rel", "tissue_states_indicated_rel",
  "tissue_states_contraindicated_rel", "systems_rel", "complaints_rel", "tastes_rel", "constitutions_rel",
  "tcm_indicated_rel", "tcm_contraindicated_rel", "doshas_match_rel", "doshas_aggravates_rel", "preparations_rel",
  "primary_text_citation", "secondary_citation", "traditional_observations",
];

describe("public herb page columns", () => {
  it("name no Seed or Root column", () => {
    for (const c of PUBLIC_HERB_COLUMNS) expect(GATED).not.toContain(c);
  });

  it("still carry identity, energetics and the safety fields every visitor sees", () => {
    for (const c of ["common_name", "latin_name", "energetics_summary", "cautions", "pregnancy_safety", "breastfeeding_safety", "children_safety"]) {
      expect(PUBLIC_HERB_COLUMNS).toContain(c);
    }
  });
});

describe("herbCanonicalUrl", () => {
  it("sends every tier to its /herbs page", () => {
    for (const tier of ["free", "seed", "root", null]) {
      expect(herbCanonicalUrl({ herb_id: "H200", common_name: "Blue Vervain", tier_visibility: tier })).toBe(
        "https://edeninstitute.health/herbs/blue-vervain",
      );
    }
  });

  it("keeps the app URL for a row with no name (no slug page exists)", () => {
    expect(herbCanonicalUrl({ herb_id: "H201", common_name: null, tier_visibility: "seed" })).toBe(
      "https://edeninstitute.health/apothecary/H201",
    );
  });
});
