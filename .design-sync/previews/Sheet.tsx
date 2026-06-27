import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
  SheetFooter, Button, Badge,
} from "eden-institute";

export function HerbDetailSheet() {
  return (
    <Sheet open>
      <SheetContent
        side="right"
        className="font-body"
        style={{ position: "static", height: "auto", width: 360, maxWidth: "100%" }}
      >
        <SheetHeader>
          <span className="font-accent tracking-[0.25em] uppercase text-xs" style={{ color: "hsl(var(--eden-gold))" }}>
            Materia Medica
          </span>
          <SheetTitle className="font-serif">Lemon Balm</SheetTitle>
          <SheetDescription><em>Melissa officinalis</em></SheetDescription>
        </SheetHeader>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "12px 0" }}>
          <Badge variant="secondary">Cooling</Badge>
          <Badge variant="secondary">Relaxing</Badge>
          <Badge variant="secondary">Nervine</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          A gentle, uplifting nervine well suited to a Hot, Tense constitution.
          Traditionally taken as an infusion to lift the spirits and ease a
          restless gut.
        </p>
        <SheetFooter>
          <Button variant="eden-outline" size="sm">Save to garden</Button>
          <Button variant="eden" size="sm">Open monograph</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function FilterSheet() {
  return (
    <Sheet open>
      <SheetContent
        side="left"
        className="font-body"
        style={{ position: "static", height: "auto", width: 320, maxWidth: "100%" }}
      >
        <SheetHeader>
          <SheetTitle className="font-serif">Filter the apothecary</SheetTitle>
          <SheetDescription>Narrow by energetic pattern and tier.</SheetDescription>
        </SheetHeader>
        <ul className="text-sm text-muted-foreground" style={{ paddingLeft: 18, margin: "12px 0" }}>
          <li>Temperature — Hot or Cold</li>
          <li>Moisture — Damp or Dry</li>
          <li>Tone — Tense or Relaxed</li>
          <li>Tier — Free, Root, Practitioner</li>
        </ul>
        <SheetFooter>
          <Button variant="eden-outline" size="sm">Reset</Button>
          <Button variant="eden" size="sm">Apply filters</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
