import { Label, Input, Checkbox } from "eden-institute";

export function FieldLabel() {
  return (
    <div style={{ display: "grid", gap: 6, maxWidth: 320 }}>
      <Label htmlFor="eden-herb" className="font-serif">Herb of the day</Label>
      <Input id="eden-herb" defaultValue="Tulsi (Holy Basil)" />
    </div>
  );
}

export function Eyebrow() {
  return (
    <Label
      className="font-accent tracking-[0.25em] uppercase"
      style={{ fontSize: 11, color: "hsl(var(--eden-gold))" }}
    >
      Constitutional assessment
    </Label>
  );
}

export function WithCheckbox() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <Checkbox id="eden-lbl-terms" defaultChecked />
      <Label htmlFor="eden-lbl-terms" className="font-body">
        I understand this is educational, not medical advice
      </Label>
    </div>
  );
}

export function Disabled() {
  return (
    <div className="peer" style={{ display: "grid", gap: 6, maxWidth: 320 }}>
      <Label className="font-serif" style={{ color: "hsl(var(--eden-bark))" }}>Required field</Label>
      <Label className="font-body" style={{ color: "hsl(var(--eden-bark) / 0.55)" }}>
        Optional secondary note
      </Label>
    </div>
  );
}
