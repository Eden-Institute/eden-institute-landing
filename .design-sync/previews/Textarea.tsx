import { Textarea, Label } from "eden-institute";

export function IntakeNote() {
  return (
    <div style={{ display: "grid", gap: 6, maxWidth: 420 }}>
      <Label htmlFor="eden-intake" className="font-serif">Describe your chief complaint</Label>
      <Textarea
        id="eden-intake"
        rows={4}
        defaultValue={
          "Persistent evening restlessness and a tense, overactive mind. Sleep comes late and broken; mornings feel cold and slow to warm."
        }
      />
    </div>
  );
}

export function Placeholder() {
  return (
    <div style={{ display: "grid", gap: 6, maxWidth: 420 }}>
      <Label htmlFor="eden-tasting" className="font-serif">Tasting notes</Label>
      <Textarea
        id="eden-tasting"
        rows={3}
        placeholder="Record aroma, flavor, and the body's response to the infusion…"
      />
    </div>
  );
}

export function Disabled() {
  return (
    <div style={{ display: "grid", gap: 6, maxWidth: 420 }}>
      <Label htmlFor="eden-formula" className="font-serif">Practitioner formulary notes</Label>
      <Textarea
        id="eden-formula"
        rows={3}
        disabled
        defaultValue="Unlock the Practitioner tier to record and save formula adjustments."
      />
    </div>
  );
}
