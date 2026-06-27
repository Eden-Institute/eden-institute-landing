import { Separator } from "eden-institute";

export function MonographSections() {
  return (
    <div
      style={{
        maxWidth: 400,
        padding: 20,
        background: "hsl(var(--eden-cream))",
        borderRadius: 12,
        color: "hsl(var(--eden-bark))",
      }}
    >
      <div className="font-serif" style={{ fontSize: 18 }}>
        Elderberry
      </div>
      <p className="font-body" style={{ fontSize: 13, marginTop: 4 }}>
        Sambucus nigra · berries harvested at full ripeness.
      </p>
      <Separator style={{ margin: "16px 0", background: "hsl(var(--eden-gold))" }} />
      <div
        className="font-accent tracking-[0.25em] uppercase"
        style={{ fontSize: 10, color: "hsl(var(--eden-forest))" }}
      >
        Traditional use
      </div>
      <p className="font-body" style={{ fontSize: 13, marginTop: 6 }}>
        Taken as a syrup through the cold months to support the body during
        seasonal change.
      </p>
    </div>
  );
}

export function VerticalMeta() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: 16,
        background: "hsl(var(--eden-parchment))",
        borderRadius: 10,
        color: "hsl(var(--eden-bark))",
      }}
      className="font-body"
    >
      <div style={{ textAlign: "center" }}>
        <div className="font-serif" style={{ fontSize: 18 }}>
          Cooling
        </div>
        <div style={{ fontSize: 11 }}>Temperature</div>
      </div>
      <Separator
        orientation="vertical"
        style={{ height: 40, background: "hsl(var(--eden-forest))" }}
      />
      <div style={{ textAlign: "center" }}>
        <div className="font-serif" style={{ fontSize: 18 }}>
          Moistening
        </div>
        <div style={{ fontSize: 11 }}>Moisture</div>
      </div>
    </div>
  );
}
