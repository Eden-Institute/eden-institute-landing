import { Input, Label } from "eden-institute";

export function WithLabel() {
  return (
    <div style={{ display: "grid", gap: 6, maxWidth: 320 }}>
      <Label htmlFor="eden-name" className="font-serif">Your name</Label>
      <Input id="eden-name" placeholder="e.g. Camila Johnson" defaultValue="Camila Johnson" />
    </div>
  );
}

export function QuizCapture() {
  return (
    <div
      style={{
        display: "grid",
        gap: 16,
        maxWidth: 360,
        padding: 20,
        borderRadius: 8,
        background: "hsl(var(--eden-parchment))",
        border: "1px solid hsl(var(--eden-forest) / 0.18)",
      }}
    >
      <span className="font-accent tracking-[0.25em] uppercase" style={{ fontSize: 11, color: "hsl(var(--eden-gold))" }}>
        Pattern of Eden
      </span>
      <div style={{ display: "grid", gap: 6 }}>
        <Label htmlFor="eden-email" className="font-serif">Where shall we send your result?</Label>
        <Input id="eden-email" type="email" placeholder="you@example.com" defaultValue="seeker@gardenpath.com" />
      </div>
    </div>
  );
}

export function Types() {
  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 320 }}>
      <div style={{ display: "grid", gap: 4 }}>
        <Label className="font-serif">Search the Materia Medica</Label>
        <Input type="search" placeholder="Chamomile, Nettle, Tulsi…" />
      </div>
      <div style={{ display: "grid", gap: 4 }}>
        <Label className="font-serif">Years of practice</Label>
        <Input type="number" defaultValue={7} />
      </div>
    </div>
  );
}

export function States() {
  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 320 }}>
      <Input placeholder="Enter your herbal lineage" />
      <Input defaultValue="Western clinical herbalism" />
      <Input defaultValue="Enrollment opens 2027" disabled />
    </div>
  );
}
