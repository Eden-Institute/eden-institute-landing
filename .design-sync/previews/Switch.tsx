import { Switch, Label } from "eden-institute";

export function WithLabel() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <Switch id="eden-reminders" defaultChecked />
      <Label htmlFor="eden-reminders" className="font-serif">Daily herbal reminders</Label>
    </div>
  );
}

export function Preferences() {
  const rows = [
    { id: "newsletter", label: "Weekly Materia Medica", on: true },
    { id: "season", label: "Seasonal protocol updates", on: true },
    { id: "research", label: "New research digests", on: false },
  ];
  return (
    <div
      style={{
        display: "grid",
        gap: 14,
        maxWidth: 340,
        padding: 18,
        borderRadius: 8,
        background: "hsl(var(--eden-parchment))",
        border: "1px solid hsl(var(--eden-forest) / 0.18)",
      }}
    >
      <span className="font-accent tracking-[0.25em] uppercase" style={{ fontSize: 11, color: "hsl(var(--eden-gold))" }}>
        Notifications
      </span>
      {rows.map((r) => (
        <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Label htmlFor={`eden-pref-${r.id}`} className="font-body">{r.label}</Label>
          <Switch id={`eden-pref-${r.id}`} defaultChecked={r.on} />
        </div>
      ))}
    </div>
  );
}

export function States() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Switch defaultChecked />
        <Label className="font-body">On</Label>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Switch />
        <Label className="font-body">Off</Label>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Switch defaultChecked disabled />
        <Label className="font-body">On &amp; disabled</Label>
      </div>
    </div>
  );
}
