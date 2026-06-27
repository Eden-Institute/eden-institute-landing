import { Toggle } from "eden-institute";

export function EnergeticFilters() {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <Toggle variant="outline" defaultPressed>Warming</Toggle>
      <Toggle variant="outline">Cooling</Toggle>
      <Toggle variant="outline">Moistening</Toggle>
      <Toggle variant="outline">Drying</Toggle>
    </div>
  );
}

export function Sizes() {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <Toggle variant="outline" size="sm" defaultPressed>Nervine</Toggle>
      <Toggle variant="outline" size="default">Carminative</Toggle>
      <Toggle variant="outline" size="lg">Bitter</Toggle>
    </div>
  );
}

export function States() {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <Toggle defaultPressed>Practitioner only</Toggle>
      <Toggle>Free tier</Toggle>
      <Toggle disabled>Coming soon</Toggle>
    </div>
  );
}
