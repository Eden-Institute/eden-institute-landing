import { Badge } from "eden-institute";

export function Variants() {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      <Badge variant="default">Nervine</Badge>
      <Badge variant="secondary">Cooling · Relaxing</Badge>
      <Badge variant="outline">Folk traditional</Badge>
      <Badge variant="destructive">Low-dose only</Badge>
    </div>
  );
}

export function Constitution() {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      <Badge variant="secondary">Hot</Badge>
      <Badge variant="secondary">Cold</Badge>
      <Badge variant="secondary">Damp</Badge>
      <Badge variant="secondary">Dry</Badge>
      <Badge variant="outline">Tense</Badge>
      <Badge variant="outline">Lax</Badge>
    </div>
  );
}

export function HerbActions() {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      <Badge
        style={{
          background: "hsl(var(--eden-forest))",
          color: "hsl(var(--eden-cream))",
          borderColor: "transparent",
        }}
      >
        Carminative
      </Badge>
      <Badge
        style={{
          background: "hsl(var(--eden-gold))",
          color: "hsl(var(--eden-bark))",
          borderColor: "transparent",
        }}
      >
        Demulcent
      </Badge>
      <Badge
        style={{
          background: "transparent",
          color: "hsl(var(--eden-forest))",
          borderColor: "hsl(var(--eden-forest))",
        }}
      >
        Anti-inflammatory
      </Badge>
    </div>
  );
}
