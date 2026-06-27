import { MateriaMedicaPlate } from "eden-institute";

export function Chamomile() {
  return <MateriaMedicaPlate herb="chamomile" width={300} />;
}

export function WithCaption() {
  return <MateriaMedicaPlate herb="calendula" width={300} caption />;
}

export function Gallery() {
  const herbs = ["lavender", "elderberry", "tulsi", "peppermint", "ginger", "nettle"] as const;
  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        flexWrap: "wrap",
        justifyContent: "center",
        background: "hsl(var(--eden-parchment))",
        padding: 20,
      }}
    >
      {herbs.map((h) => (
        <MateriaMedicaPlate key={h} herb={h} width={150} />
      ))}
    </div>
  );
}
