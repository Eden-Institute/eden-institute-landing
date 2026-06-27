import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  Button, Badge,
} from "eden-institute";

export function HerbMonograph() {
  return (
    <Card style={{ maxWidth: 380 }}>
      <CardHeader>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <CardTitle className="font-serif">Chamomile</CardTitle>
          <Badge variant="secondary">Cooling · Relaxing</Badge>
        </div>
        <CardDescription><em>Matricaria chamomilla</em></CardDescription>
      </CardHeader>
      <CardContent>
        <p className="font-body text-sm text-muted-foreground">
          A gentle nervine and carminative. Traditionally taken as an evening
          infusion to settle the stomach and quiet a tense, overactive mind.
        </p>
      </CardContent>
      <CardFooter>
        <Button variant="eden-outline" size="sm">Open monograph</Button>
      </CardFooter>
    </Card>
  );
}

export function Plain() {
  return (
    <Card style={{ maxWidth: 380 }}>
      <CardHeader>
        <CardTitle className="font-serif">The Pattern of Eden</CardTitle>
        <CardDescription>A constitutional assessment in three axes</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="font-body text-sm text-muted-foreground">
          Temperature, moisture, and tone. Answer twenty questions and see
          where your body sits between the classical patterns.
        </p>
      </CardContent>
    </Card>
  );
}
