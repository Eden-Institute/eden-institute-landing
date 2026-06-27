import { Skeleton } from "eden-institute";

export function MonographLoading() {
  return (
    <div
      style={{
        maxWidth: 380,
        padding: 20,
        borderRadius: 12,
        background: "hsl(var(--eden-cream))",
        border: "1px solid hsl(var(--eden-parchment))",
      }}
    >
      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 18 }}>
        <Skeleton style={{ height: 48, width: 48, borderRadius: 9999 }} />
        <div style={{ flex: 1, display: "grid", gap: 8 }}>
          <Skeleton style={{ height: 16, width: "60%" }} />
          <Skeleton style={{ height: 12, width: "40%" }} />
        </div>
      </div>
      <Skeleton style={{ height: 140, width: "100%", marginBottom: 16 }} />
      <div style={{ display: "grid", gap: 10 }}>
        <Skeleton style={{ height: 12, width: "100%" }} />
        <Skeleton style={{ height: 12, width: "92%" }} />
        <Skeleton style={{ height: 12, width: "78%" }} />
      </div>
    </div>
  );
}

export function ListLoading() {
  return (
    <div style={{ maxWidth: 380, display: "grid", gap: 14 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Skeleton style={{ height: 40, width: 40, borderRadius: 8 }} />
          <div style={{ flex: 1, display: "grid", gap: 7 }}>
            <Skeleton style={{ height: 12, width: "55%" }} />
            <Skeleton style={{ height: 10, width: "35%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}
