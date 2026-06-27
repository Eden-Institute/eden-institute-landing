import { Tabs, TabsList, TabsTrigger, TabsContent, Badge } from "eden-institute";

export function HerbMonograph() {
  return (
    <Tabs defaultValue="overview" style={{ width: 420 }}>
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="actions">Actions</TabsTrigger>
        <TabsTrigger value="cautions">Cautions</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <p className="font-body text-sm text-muted-foreground">
          <em>Matricaria chamomilla</em> is a cooling, relaxing nervine of the
          daisy family, traditionally taken as an evening infusion to settle a
          tense, overactive constitution.
        </p>
      </TabsContent>
      <TabsContent value="actions">
        <ul className="font-body text-sm text-muted-foreground" style={{ paddingLeft: 18, margin: 0 }}>
          <li>Carminative — eases gripe and trapped wind</li>
          <li>Nervine — quiets a Tense nervous system</li>
          <li>Anti-inflammatory — soothes Hot, irritated tissue</li>
        </ul>
      </TabsContent>
      <TabsContent value="cautions">
        <p className="font-body text-sm text-muted-foreground">
          Avoid in known Asteraceae allergy. Best paired with a warming herb in
          a markedly Cold, Damp constitution.
        </p>
      </TabsContent>
    </Tabs>
  );
}

export function ConstitutionAxes() {
  return (
    <Tabs defaultValue="temperature" style={{ width: 420 }}>
      <TabsList>
        <TabsTrigger value="temperature">Temperature</TabsTrigger>
        <TabsTrigger value="moisture">Moisture</TabsTrigger>
        <TabsTrigger value="tone">Tone</TabsTrigger>
      </TabsList>
      <TabsContent value="temperature">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <Badge variant="secondary">Hot</Badge>
          <span className="font-body text-sm text-muted-foreground">·</span>
          <Badge variant="secondary">Cold</Badge>
        </div>
        <p className="font-body text-sm text-muted-foreground" style={{ marginTop: 8 }}>
          Where your vitality runs along the warming axis of the Pattern of Eden.
        </p>
      </TabsContent>
      <TabsContent value="moisture">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <Badge variant="secondary">Damp</Badge>
          <span className="font-body text-sm text-muted-foreground">·</span>
          <Badge variant="secondary">Dry</Badge>
        </div>
        <p className="font-body text-sm text-muted-foreground" style={{ marginTop: 8 }}>
          The fluid quality of the tissues, from boggy fullness to parched depletion.
        </p>
      </TabsContent>
      <TabsContent value="tone">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <Badge variant="secondary">Tense</Badge>
          <span className="font-body text-sm text-muted-foreground">·</span>
          <Badge variant="secondary">Relaxed</Badge>
        </div>
        <p className="font-body text-sm text-muted-foreground" style={{ marginTop: 8 }}>
          The structural tone of the body, from constricted to lax.
        </p>
      </TabsContent>
    </Tabs>
  );
}
