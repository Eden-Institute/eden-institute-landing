import { Slider, Label } from "eden-institute";

export function MoistureAxis() {
  return (
    <div
      style={{
        display: "grid",
        gap: 14,
        maxWidth: 360,
        padding: 18,
        borderRadius: 8,
        background: "hsl(var(--eden-parchment))",
        border: "1px solid hsl(var(--eden-forest) / 0.18)",
      }}
    >
      <span className="font-accent tracking-[0.25em] uppercase" style={{ fontSize: 11, color: "hsl(var(--eden-gold))" }}>
        Moisture axis
      </span>
      <Slider defaultValue={[65]} max={100} step={1} />
      <div style={{ display: "flex", justifyContent: "space-between" }} className="font-body">
        <span style={{ fontSize: 12, color: "hsl(var(--eden-bark) / 0.7)" }}>Dry</span>
        <span style={{ fontSize: 12, color: "hsl(var(--eden-bark) / 0.7)" }}>Damp</span>
      </div>
    </div>
  );
}

export function DosageRange() {
  return (
    <div style={{ display: "grid", gap: 10, maxWidth: 340 }}>
      <Label className="font-serif">Tincture dose (drops)</Label>
      <Slider defaultValue={[20, 45]} max={60} step={5} />
    </div>
  );
}

export function Disabled() {
  return (
    <div style={{ display: "grid", gap: 10, maxWidth: 340 }}>
      <Label className="font-serif">Steeping strength (Practitioner)</Label>
      <Slider defaultValue={[40]} max={100} step={1} disabled />
    </div>
  );
}
