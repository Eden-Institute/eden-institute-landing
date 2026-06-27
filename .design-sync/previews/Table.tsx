import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption,
} from "eden-institute";

export function MateriaMedica() {
  const rows = [
    { herb: "Chamomile", temperature: "Cooling", moisture: "Drying", action: "Relaxing nervine" },
    { herb: "Ginger", temperature: "Warming", moisture: "Drying", action: "Circulatory stimulant" },
    { herb: "Marshmallow", temperature: "Cooling", moisture: "Moistening", action: "Demulcent" },
    { herb: "Sage", temperature: "Warming", moisture: "Drying", action: "Astringent antiseptic" },
    { herb: "Elderflower", temperature: "Cooling", moisture: "Neutral", action: "Diaphoretic" },
  ];

  return (
    <div style={{ maxWidth: 520, padding: 8 }}>
      <Table>
        <TableCaption className="font-body">
          Energetic profile of five common herbs
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="font-serif">Herb</TableHead>
            <TableHead className="font-serif">Temperature</TableHead>
            <TableHead className="font-serif">Moisture</TableHead>
            <TableHead className="font-serif">Primary action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.herb}>
              <TableCell
                className="font-serif font-medium"
                style={{ color: "hsl(var(--eden-bark))" }}
              >
                {r.herb}
              </TableCell>
              <TableCell className="font-body">{r.temperature}</TableCell>
              <TableCell className="font-body">{r.moisture}</TableCell>
              <TableCell className="font-body">{r.action}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
