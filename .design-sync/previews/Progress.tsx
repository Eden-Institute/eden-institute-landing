import { Progress } from "eden-institute";

export function MateriaMedicaProgress() {
  const rows = [
    { label: "Nervines", value: 25 },
    { label: "Carminatives", value: 60 },
    { label: "Demulcents", value: 90 },
  ];
  return (
    <div style={{ maxWidth: 380, display: "grid", gap: 16 }}>
      {rows.map((r) => (
        <div key={r.label}>
          <div
            className="font-body"
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 13,
              marginBottom: 6,
              color: "hsl(var(--eden-bark))",
            }}
          >
            <span className="font-serif">{r.label}</span>
            <span>{r.value}%</span>
          </div>
          <Progress
            value={r.value}
            style={{ background: "hsl(var(--eden-parchment))" }}
          />
        </div>
      ))}
    </div>
  );
}

export function QuizProgress() {
  return (
    <div style={{ maxWidth: 380 }}>
      <div
        className="font-accent tracking-[0.25em] uppercase"
        style={{ fontSize: 10, color: "hsl(var(--eden-forest))", marginBottom: 8 }}
      >
        Pattern of Eden · Question 12 of 20
      </div>
      <Progress value={60} style={{ background: "hsl(var(--eden-parchment))" }} />
    </div>
  );
}
