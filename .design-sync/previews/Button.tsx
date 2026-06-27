import { Button } from "eden-institute";

export function EdenVariants() {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
      <Button variant="eden" size="lg">Begin the Journey</Button>
      <Button variant="eden-outline" size="lg">Read the Materia Medica</Button>
      <Button variant="eden-gold" size="lg">Unlock Practitioner</Button>
      <Button variant="eden-light" size="lg">Create a free account</Button>
    </div>
  );
}

export function StandardVariants() {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
      <Button variant="default">Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="link">Link</Button>
    </div>
  );
}

export function Sizes() {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
      <Button variant="eden" size="sm">Small</Button>
      <Button variant="eden" size="default">Default</Button>
      <Button variant="eden" size="lg">Large</Button>
      <Button variant="eden" size="xl">Extra Large</Button>
    </div>
  );
}

export function Disabled() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <Button variant="eden" size="lg" disabled>Enrolling soon</Button>
      <Button variant="eden-outline" size="lg" disabled>Coming end of 2027</Button>
    </div>
  );
}
