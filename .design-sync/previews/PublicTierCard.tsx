import { PublicTierCard } from "eden-institute";

export function FreeTier() {
  return (
    <div style={{ maxWidth: 340 }}>
      <PublicTierCard
        tier="free"
        displayName="The Garden"
        persona="the curious beginner"
        tagline="Walk the apothecary and meet the herbs at your own pace."
        monthlyPrice="Free"
        yearlyPrice="Free"
        features={[
          "All one hundred herb monographs",
          "Taste, temperature, and moisture at a glance",
          "Save a small shelf of favorites",
          "The constitutional pattern quiz",
        ]}
      />
    </div>
  );
}

export function SeedTierHighlighted() {
  return (
    <div style={{ maxWidth: 340 }}>
      <PublicTierCard
        tier="seed"
        displayName="Seed"
        persona="the steady home herbalist"
        tagline="Move from knowing the herb to knowing the pattern it serves."
        monthlyPrice="$12"
        yearlyPrice="$120"
        highlighted
        features={[
          "Everything in The Garden",
          "Full materia medica with actions and energetics",
          "Pattern-matched herb suggestions",
          "Seasonal infusion and tincture guides",
          "Your living herbal journal",
        ]}
      />
    </div>
  );
}

export function RootTier() {
  return (
    <div style={{ maxWidth: 340 }}>
      <PublicTierCard
        tier="root"
        displayName="Root"
        persona="the devoted student"
        tagline="The deep study: constitution, contraindication, and craft."
        monthlyPrice="$24"
        yearlyPrice="$240"
        features={[
          "Everything in Seed",
          "Dual-sourced clinical detail per monograph",
          "Contraindications and herb-drug cautions",
          "Formulation method and ratio guidance",
          "Downloadable monograph cards",
        ]}
      />
    </div>
  );
}
