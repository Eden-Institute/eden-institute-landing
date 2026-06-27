import { Alert, AlertTitle, AlertDescription } from "eden-institute";

export function SafetyNote() {
  return (
    <div style={{ maxWidth: 460 }}>
      <Alert>
        <AlertTitle className="font-serif">A note on dosage</AlertTitle>
        <AlertDescription className="font-body">
          Tulsi is generally well tolerated as a daily infusion. Begin with a
          single cup and observe your constitution before building the practice.
        </AlertDescription>
      </Alert>
    </div>
  );
}

export function Contraindication() {
  return (
    <div style={{ maxWidth: 460 }}>
      <Alert variant="destructive">
        <AlertTitle className="font-serif">Contraindicated in pregnancy</AlertTitle>
        <AlertDescription className="font-body">
          Pennyroyal and blue cohosh are emmenagogues. Do not take internally
          while pregnant or nursing. Consult a practitioner before use.
        </AlertDescription>
      </Alert>
    </div>
  );
}

export function PractitionerGate() {
  return (
    <div style={{ maxWidth: 460 }}>
      <Alert
        style={{
          borderColor: "hsl(var(--eden-gold))",
          background: "hsl(var(--eden-parchment))",
          color: "hsl(var(--eden-bark))",
        }}
      >
        <AlertTitle className="font-serif">Practitioner tier required</AlertTitle>
        <AlertDescription className="font-body">
          Full formularies and dosing ranges in the Materia Medica unlock with
          the Practitioner tier. Your reading notes are saved either way.
        </AlertDescription>
      </Alert>
    </div>
  );
}
