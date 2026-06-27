import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, Button,
} from "eden-institute";

export function EnrollDialog() {
  return (
    <Dialog open>
      <DialogContent className="font-body" style={{ position: "static", transform: "none", maxWidth: 440 }}>
        <DialogHeader>
          <span className="font-accent tracking-[0.25em] uppercase text-xs" style={{ color: "hsl(var(--eden-gold))" }}>
            Practitioner Tier
          </span>
          <DialogTitle className="font-serif">Unlock the full apothecary</DialogTitle>
          <DialogDescription>
            Formularies, dosing tables, and pattern-matched protocols across the
            whole Materia Medica.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Your body pattern stays saved to your account. Cancel anytime before
          your first renewal.
        </p>
        <DialogFooter>
          <Button variant="eden-outline" size="sm">Not yet</Button>
          <Button variant="eden-gold" size="sm">Unlock Practitioner</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function HerbCautionDialog() {
  return (
    <Dialog open>
      <DialogContent className="font-body" style={{ position: "static", transform: "none", maxWidth: 440 }}>
        <DialogHeader>
          <DialogTitle className="font-serif">Before you brew Comfrey</DialogTitle>
          <DialogDescription><em>Symphytum officinale</em></DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          A cooling, moistening vulnerary for external use. Internal use is
          restricted owing to pyrrolizidine alkaloids. Reserved for Practitioner
          guidance.
        </p>
        <DialogFooter>
          <Button variant="eden-outline" size="sm">Read the monograph</Button>
          <Button variant="eden" size="sm">I understand</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
