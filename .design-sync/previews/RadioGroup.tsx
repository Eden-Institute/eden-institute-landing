import { RadioGroup, RadioGroupItem, Label } from "eden-institute";

export function TemperatureAxis() {
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
        Temperature axis
      </span>
      <RadioGroup defaultValue="warm">
        {[
          ["hot", "Hot — flushed, fast, easily overheated"],
          ["warm", "Warm — generally runs warm"],
          ["cool", "Cool — slow to warm"],
          ["cold", "Cold — cold hands and feet"],
        ].map(([val, label]) => (
          <div key={val} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <RadioGroupItem value={val} id={`eden-temp-${val}`} />
            <Label htmlFor={`eden-temp-${val}`} className="font-body">{label}</Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}

export function ToneAxis() {
  return (
    <div style={{ display: "grid", gap: 10, maxWidth: 320 }}>
      <Label className="font-serif">Tissue tone</Label>
      <RadioGroup defaultValue="tense" style={{ display: "flex", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <RadioGroupItem value="tense" id="eden-tone-tense" />
          <Label htmlFor="eden-tone-tense" className="font-body">Tense</Label>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <RadioGroupItem value="balanced" id="eden-tone-balanced" />
          <Label htmlFor="eden-tone-balanced" className="font-body">Balanced</Label>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <RadioGroupItem value="relaxed" id="eden-tone-relaxed" />
          <Label htmlFor="eden-tone-relaxed" className="font-body">Relaxed</Label>
        </div>
      </RadioGroup>
    </div>
  );
}

export function WithDisabled() {
  return (
    <RadioGroup defaultValue="sprouts" style={{ maxWidth: 320 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <RadioGroupItem value="sprouts" id="eden-tier-sprouts" />
        <Label htmlFor="eden-tier-sprouts" className="font-body">Sprouts</Label>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <RadioGroupItem value="seedlings" id="eden-tier-seedlings" />
        <Label htmlFor="eden-tier-seedlings" className="font-body">Seedlings</Label>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <RadioGroupItem value="practitioner" id="eden-tier-practitioner" disabled />
        <Label htmlFor="eden-tier-practitioner" className="font-body">Practitioner — opens 2027</Label>
      </div>
    </RadioGroup>
  );
}
