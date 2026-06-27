import { GoldDivider } from "eden-institute";

export function OnParchment() {
  return (
    <div
      style={{
        background: "hsl(var(--eden-parchment))",
        padding: "40px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
      }}
    >
      <span
        className="font-accent"
        style={{
          color: "hsl(var(--eden-gold))",
          fontSize: 11,
          letterSpacing: "0.3em",
          textTransform: "uppercase",
        }}
      >
        Materia Medica
      </span>
      <GoldDivider />
      <span className="font-serif" style={{ color: "hsl(var(--eden-bark))", fontSize: 22 }}>
        Ancient knowledge, unearthed
      </span>
    </div>
  );
}
