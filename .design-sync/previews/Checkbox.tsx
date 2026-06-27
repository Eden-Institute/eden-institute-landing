import { Checkbox, Label } from "eden-institute";

export function WithLabel() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <Checkbox id="eden-consent" defaultChecked />
      <Label htmlFor="eden-consent" className="font-serif">
        Send me the weekly Materia Medica
      </Label>
    </div>
  );
}

export function SymptomList() {
  const items = [
    { id: "sleep", label: "Restless, broken sleep", checked: true },
    { id: "digestion", label: "Sluggish digestion", checked: true },
    { id: "tension", label: "Tense, overactive mind", checked: false },
    { id: "cold", label: "Cold hands and feet", checked: false },
  ];
  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        maxWidth: 320,
        padding: 18,
        borderRadius: 8,
        background: "hsl(var(--eden-parchment))",
        border: "1px solid hsl(var(--eden-forest) / 0.18)",
      }}
    >
      <span className="font-accent tracking-[0.25em] uppercase" style={{ fontSize: 11, color: "hsl(var(--eden-gold))" }}>
        Constitutional assessment
      </span>
      {items.map((it) => (
        <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Checkbox id={`eden-sx-${it.id}`} defaultChecked={it.checked} />
          <Label htmlFor={`eden-sx-${it.id}`} className="font-body">{it.label}</Label>
        </div>
      ))}
    </div>
  );
}

export function States() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Checkbox id="eden-s1" />
        <Label htmlFor="eden-s1" className="font-body">Unchecked</Label>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Checkbox id="eden-s2" defaultChecked />
        <Label htmlFor="eden-s2" className="font-body">Checked</Label>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Checkbox id="eden-s3" defaultChecked disabled />
        <Label htmlFor="eden-s3" className="font-body">Checked &amp; disabled</Label>
      </div>
    </div>
  );
}
